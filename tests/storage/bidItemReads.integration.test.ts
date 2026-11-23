import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile, execFileSync } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import handler from '../../api/shared-settings.js';
import { createDeviceSessionToken } from '../../src/server/deviceSession.js';
import { splitStorageState, isStorageRecord } from '../../src/lib/storageV2Codec.js';
import { parseStorageProjectionPatch, StorageProjectionPatchCache } from '../../src/lib/storageProjectionPatch.js';
import { parseReadManifest } from '../../src/lib/storageReadManifest.js';
import { compareStorageTimestamps } from '../../src/lib/storageResponseOrder.js';

// 2026-11-23 classroom stall: each bid re-sent the whole class bid history (about 500KB of JSON per student
// on production-sized data). Reading it item by item re-sends only the item that changed.
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
const json = (value: unknown) => `${literal(JSON.stringify(value))}::jsonb`;
const students = Array.from({ length: 23 }, (_, index) => index + 1);

test('real PostgreSQL: item-level bid history reads match whole reads and send only the changed item', {
  skip: process.env.STORAGE_AUCTION_PSQL_TEST !== '1', timeout: 120_000,
}, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'school-bid-item-reads-'));
  const invoke = (program: string, args: string[], input?: string) => execFileSync(program, args, {
    input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024,
  });
  invoke('initdb', ['-D', `${directory}/data`, '-U', 'postgres', '-A', 'trust', '--no-locale', '--encoding=UTF8']);
  invoke('pg_ctl', ['-D', `${directory}/data`, '-l', `${directory}/postgres.log`, '-o', `-F -h '' -k ${directory} -p 55497`, '-w', 'start']);
  const args = ['-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-h', directory, '-p', '55497', '-U', 'postgres', '-d', 'postgres'];
  const query = (sql: string) => invoke('psql', args, sql).trim();
  const asyncQuery = (sql: string): Promise<unknown> => new Promise((resolve, reject) => {
    const child = execFile('psql', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr)); else { try { resolve(JSON.parse(stdout.trim())); } catch (error) { reject(error); } }
    });
    child.stdin?.end(sql);
  });
  const previousEnv = { ...process.env }, previousFetch = globalThis.fetch;
  try {
    query('create role anon; create role authenticated; create role service_role;');
    for (const file of ['app_settings.sql', 'classword.sql', 'library_competition.sql', 'storage_v2.sql', 'storage_today_friend_v2.sql', 'storage_rewards_v2.sql',
      'newspaper_questions.sql', 'storage_classword_v2.sql', 'storage_audit_v2.sql', 'storage_scoped_v2.sql', 'storage_read_performance.sql',
      'storage_library_placement_v2.sql', 'storage_scoped_polling.sql', 'storage_scope_history_read_performance.sql', 'storage_scoped_read_execution.sql', 'storage_snapshot_execution.sql',
      'storage_ancestor_locks.sql', 'storage_command_round_trips.sql', 'storage_scope_read_buffers.sql', 'storage_student_read_gate.sql', 'storage_student_changes.sql', 'storage_teacher_history_window.sql', 'storage_student_history_window.sql']) {
      query(await readFile(new URL(`../../supabase/${file}`, import.meta.url), 'utf8'));
    }
    const at = '2026-10-30T00:00:00.000Z';
    const source = {
      currencyBalances: Object.fromEntries(students.map(s => [s, 1000])),
      currencyHistory: Object.fromEntries(students.map(s => [s, [{ id: `seed-${s}`, studentNumber: s, delta: 0, before: 1000, after: 1000, reason: 'manual', createdAt: at }]])),
      auctionItems: [{ id: 'item-a', name: '합성 물품', dayIndex: 0, startPrice: 10, isConfigured: true }],
      auctionBids: { 'item-a': { bidder: 3, amount: 20 } },
      auctionBidHistory: { 'item-a': [{ itemId: 'item-a', bidder: 3, amount: 20, createdAt: at }] },
      weeklySubjects: { w1: { d1: '국어', d2: '수학' } },
      studentEmotionHistory: Object.fromEntries(students.map(s => [s, [{ id: `emotion-${s}`, text: '합성', createdAt: at }]])),
      studentLife: {
        letters: students.flatMap(s => [{ id: `letter-${s}`, recipient: s, content: '합성 편지', createdAt: at }]),
        failureStories: [{ id: 'story-1', studentNumber: 2, text: '합성 실패', createdAt: at }],
      },
      retained: 'synthetic untouched data',
    };
    const encoded = splitStorageState(source);
    query(`insert into app_settings(id,value,updated_at) values('school-timer-main',${json(source)},${literal(at)});
      select storage_set_maintenance(true);
      select storage_bootstrap(${literal(at)},${json(source)},${json(encoded.resources)},${json(encoded.wallets)},${json(encoded.history)});
      select storage_set_maintenance(false,true);`);

    const secret = 'student-changes-test-only-secret-at-least-32-bytes';
    Object.assign(process.env, { SUPABASE_URL: 'https://bid-items.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic', DEVICE_SESSION_SECRET: secret,
      STORAGE_PROTOCOL_VERSION: '2', STORAGE_STUDENT_READ_GATE: '1', STORAGE_STUDENT_CHANGES: '1' });
    let calls: string[] = [];
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input)); assert.equal(url.origin, 'https://bid-items.invalid');
      const rpc = url.pathname.split('/').at(-1) ?? '';
      calls.push(rpc);
      const body: unknown = JSON.parse(String(init?.body)); assert.ok(isStorageRecord(body));
      const parameters = Object.entries(body).map(([key, value]) => `${key} => ${value === null ? 'null' : typeof value === 'string' ? literal(value) : json(value)}`).join(',');
      try { return Response.json(await asyncQuery(`select public.${rpc}(${parameters});`)); }
      catch (error) {
        const code = error instanceof Error ? /STORAGE_[A-Z_]+/.exec(error.message)?.[0] : undefined;
        if (!code) throw error;
        return Response.json({ message: code }, { status: 400 });
      }
    };
    const read = async (student: number, manifest?: Record<string, string>, bidItems = false) => {
      calls = [];
      let status = 0, body: unknown;
      const response = { setHeader() {}, status(value: number) { status = value; return this; }, json(value: unknown) { body = value; } };
      const token = createDeviceSessionToken({ role: 'student', studentNumber: student }, secret);
      await handler({ method: 'GET', query: {}, headers: { cookie: `__Host-school-timer-device=${token}`, 'x-storage-projection': '1', 'x-storage-changes': '1',
        ...(bidItems ? { 'x-storage-bid-items': '1' } : {}), ...(manifest ? { 'x-storage-read-manifest': JSON.stringify(manifest) } : {}) } }, response);
      assert.ok(isStorageRecord(body));
      return { status, body, bytes: JSON.stringify(body).length, calls: [...calls] };
    };
    const patchOf = (body: unknown) => parseStorageProjectionPatch(isStorageRecord(body) ? body.storagePatch : null);
    const full = async (student: number) => {
      const result = await read(student);
      assert.equal(result.status, 200);
      assert.equal(patchOf(result.body).complete, true);
      return new StorageProjectionPatchCache(compareStorageTimestamps).apply(patchOf(result.body), String(Reflect.get(result.body, 'updated_at')));
    };

    // Reading bid history item by item needs the range manifest; its output must equal the previous one.
    const bidEntry = (amount: number) => ({ itemId: 'item-b', bidder: 4, amount, createdAt: at });
    const bidResources = (amounts: number[]) => splitStorageState({ ...source, auctionBidHistory: { ...source.auctionBidHistory, 'item-b': amounts.map(bidEntry) } })
      .resources.filter(row => row.resource_key.startsWith('/auctionBidHistory/item-b'));
    const saveBids = (amounts: number[]) => {
      for (const row of bidResources(amounts)) query(`select storage_write_resource(${literal(row.resource_key)},'auctionBidHistory',null,${json(row.value)});`);
    };
    const bidKey = (amount: number) => bidResources([amount]).at(-1)!.resource_key;
    saveBids([25]);
    let scope: unknown;
    const recordingFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const body: unknown = JSON.parse(String(init?.body));
      if (isStorageRecord(body) && body.p_scope) scope = body.p_scope;
      return recordingFetch(input, init);
    };
    const manifestSql = () => query(`select storage_scope_selector_manifest(${json(scope)});`);
    await read(5);
    const wholeScope = scope;
    query("update storage_resources set deleted=true, revision=revision+1 where resource_key='/studentLife/letters/@letter-5';");
    const previousManifest = manifestSql();
    const definition = query("select md5(prosrc) from pg_proc where oid='public.storage_scope_selector_manifest(jsonb)'::regprocedure;");
    const rangeSql = await readFile(new URL('../../supabase/storage_manifest_range.sql', import.meta.url), 'utf8');
    query(rangeSql);
    assert.notEqual(query("select md5(prosrc) from pg_proc where oid='public.storage_scope_selector_manifest(jsonb)'::regprocedure;"), definition);
    assert.deepEqual(JSON.parse(manifestSql()), JSON.parse(previousManifest));
    query(rangeSql);
    for (const role of ['anon', 'authenticated']) assert.equal(query(`select has_function_privilege('${role}','storage_scope_selector_manifest(jsonb)','execute');`), 'f');
    assert.equal(query("select has_function_privilege('service_role','storage_scope_selector_manifest(jsonb)','execute');"), 't');

    // Off by default: the header alone keeps one selector for the whole history.
    const off = await read(5, undefined, true);
    const manifestOf = (body: Record<string, unknown>) => Reflect.get(body, 'readManifest') as Record<string, string>;
    assert.ok('scope:/auctionBidHistory' in manifestOf(off.body));
    process.env.STORAGE_BID_ITEM_READS = '1';
    // An older screen without the header keeps the previous layout.
    assert.ok('scope:/auctionBidHistory' in manifestOf((await read(5)).body));

    // A screen that still holds the previous layout is upgraded without a rejected request.
    const cache = new StorageProjectionPatchCache(compareStorageTimestamps);
    const apply = (result: { body: Record<string, unknown> }) => cache.apply(patchOf(result.body), String(Reflect.get(result.body, 'updated_at')));
    apply(off);
    const upgraded = await read(5, manifestOf(off.body), true);
    assert.equal(upgraded.status, 200, JSON.stringify(upgraded.body));
    let manifest = manifestOf(upgraded.body);
    assert.ok('scope:/auctionBidHistory/item-a' in manifest && 'scope:/auctionBidHistory/item-5-6' in manifest && !('scope:/auctionBidHistory' in manifest));
    assert.deepEqual(parseReadManifest(manifest), manifest);
    const fullItems = async () => {
      const result = await read(5, undefined, true);
      return new StorageProjectionPatchCache(compareStorageTimestamps).apply(patchOf(result.body), String(Reflect.get(result.body, 'updated_at')));
    };
    assert.deepEqual(apply(upgraded), await fullItems());
    const step = async () => {
      const result = await read(5, manifest, true);
      assert.equal(result.status, 200, JSON.stringify(result.body));
      manifest = manifestOf(result.body);
      const merged = apply(result);
      assert.deepEqual(merged, await full(5));
      assert.deepEqual(merged, await fullItems());
      return patchOf(result.body);
    };

    // A bid on one item sends only that item's history.
    saveBids([25, 26]);
    const bidKeys = (await step()).resources.map(row => row.resource_key);
    assert.ok(bidKeys.includes(bidKey(26)));
    assert.ok(!bidKeys.some(key => key.startsWith('/auctionBidHistory/item-a/')));
    // A reset item is removed from the merged history.
    query("update storage_resources set deleted=true, revision=revision+1 where resource_key like '/auctionBidHistory/item-b/%' and not deleted;");
    assert.ok((await step()).deletedKeys.includes(bidKey(25)));

    // The poll compares the same layout, so an unchanged class does not trigger another read.
    process.env.STORAGE_SCOPED_POLLING = '2';
    const poll = async (bidItems: boolean) => {
      let body: unknown;
      const response = { setHeader() {}, status() { return this; }, json(value: unknown) { body = value; } };
      const token = createDeviceSessionToken({ role: 'student', studentNumber: 5 }, secret);
      await handler({ method: 'GET', query: { metadata: '1', scoped: '1', ...(bidItems ? { bidItems: '1' } : {}) }, headers: { cookie: `__Host-school-timer-device=${token}` } }, response);
      assert.ok(isStorageRecord(body));
      return body.readVersion;
    };
    assert.equal(await poll(true), Reflect.get((await read(5, manifest, true)).body, 'readVersion'));
    assert.equal(await poll(false), Reflect.get((await read(5)).body, 'readVersion'));

    // Other students' wallets, unknown items and unrelated parts are still refused.
    const digest = 'a'.repeat(32);
    for (const key of ['wallet:6', 'scope:/retained', 'scope:/auctionBidHistory/item-z'])
      assert.equal((await read(5, { ...manifest, [key]: digest }, true)).status, 400, key);

    // Turning the flag off again returns to one selector, also for screens holding item digests.
    process.env.STORAGE_BID_ITEM_READS = '0';
    const back = await read(5, manifest, true);
    assert.equal(back.status, 200);
    assert.ok('scope:/auctionBidHistory' in manifestOf(back.body));
    assert.deepEqual(apply(back), await full(5));
    assert.equal(await poll(true), Reflect.get(back.body, 'readVersion'));

    // Rollback restores the previous definition exactly.
    query(await readFile(new URL('../../supabase/storage_manifest_range_rollback.sql', import.meta.url), 'utf8'));
    assert.equal(query("select md5(prosrc) from pg_proc where oid='public.storage_scope_selector_manifest(jsonb)'::regprocedure;"), definition);
    scope = wholeScope;
    assert.deepEqual(JSON.parse(manifestSql()), manifestOf((await read(5)).body));
  } finally {
    globalThis.fetch = previousFetch; process.env = previousEnv;
    invoke('pg_ctl', ['-D', `${directory}/data`, '-m', 'fast', '-w', 'stop']);
  }
});
