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
import { compareStorageTimestamps } from '../../src/lib/storageResponseOrder.js';

// storage_student_changes.sql: a student re-read sends only the scope parts whose digest changed,
// and applying those parts to the cached projection gives exactly the full projection.
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
const json = (value: unknown) => `${literal(JSON.stringify(value))}::jsonb`;
const students = Array.from({ length: 23 }, (_, index) => index + 1);

test('real PostgreSQL: student change reads match full reads after shared, own, wallet and deleted changes', {
  skip: process.env.STORAGE_AUCTION_PSQL_TEST !== '1', timeout: 120_000,
}, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'school-student-changes-'));
  const invoke = (program: string, args: string[], input?: string) => execFileSync(program, args, {
    input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024,
  });
  invoke('initdb', ['-D', `${directory}/data`, '-U', 'postgres', '-A', 'trust', '--no-locale', '--encoding=UTF8']);
  invoke('pg_ctl', ['-D', `${directory}/data`, '-l', `${directory}/postgres.log`, '-o', `-F -h '' -k ${directory} -p 55490`, '-w', 'start']);
  const args = ['-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-h', directory, '-p', '55490', '-U', 'postgres', '-d', 'postgres'];
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
      'storage_ancestor_locks.sql', 'storage_command_round_trips.sql', 'storage_scope_read_buffers.sql', 'storage_student_read_gate.sql', 'storage_student_changes.sql']) {
      query(await readFile(new URL(`../../supabase/${file}`, import.meta.url), 'utf8'));
    }
    const contracts = () => query("select jsonb_agg(jsonb_build_array(proname,md5(prosrc),proconfig) order by proname,oid) from pg_proc where pronamespace='public'::regnamespace;");
    const beforeReapply = contracts();
    query(await readFile(new URL('../../supabase/storage_student_changes.sql', import.meta.url), 'utf8'));
    assert.equal(contracts(), beforeReapply);

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
    Object.assign(process.env, { SUPABASE_URL: 'https://student-changes.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic', DEVICE_SESSION_SECRET: secret,
      STORAGE_PROTOCOL_VERSION: '2', STORAGE_STUDENT_READ_GATE: '1', STORAGE_STUDENT_CHANGES: '1' });
    let calls: string[] = [];
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input)); assert.equal(url.origin, 'https://student-changes.invalid');
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
    const read = async (student: number, manifest?: Record<string, string>) => {
      calls = [];
      let status = 0, body: unknown;
      const response = { setHeader() {}, status(value: number) { status = value; return this; }, json(value: unknown) { body = value; } };
      const token = createDeviceSessionToken({ role: 'student', studentNumber: student }, secret);
      await handler({ method: 'GET', query: {}, headers: { cookie: `__Host-school-timer-device=${token}`, 'x-storage-projection': '1', 'x-storage-changes': '1',
        ...(manifest ? { 'x-storage-read-manifest': JSON.stringify(manifest) } : {}) } }, response);
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

    // First read is complete and carries a manifest for this student only.
    const first = await read(5);
    assert.equal(first.status, 200);
    assert.deepEqual(first.calls, ['storage_load_scope_changes_student']);
    const cache = new StorageProjectionPatchCache(compareStorageTimestamps);
    const apply = (result: { body: Record<string, unknown> }) => cache.apply(patchOf(result.body), String(Reflect.get(result.body, 'updated_at')));
    apply(first);
    let manifest = Reflect.get(first.body, 'readManifest') as Record<string, string>;
    assert.ok(Object.keys(manifest).includes('wallet:5') && !Object.keys(manifest).includes('wallet:6'));
    assert.ok(typeof Reflect.get(first.body, 'readVersion') === 'string');
    const step = async () => {
      const result = await read(5, manifest);
      assert.equal(result.status, 200);
      assert.equal(patchOf(result.body).complete, false);
      manifest = Reflect.get(result.body, 'readManifest') as Record<string, string>;
      const merged = apply(result);
      assert.deepEqual(merged, await full(5));
      return result;
    };

    // Nothing changed: a tiny patch, same projection.
    const unchanged = await step();
    assert.ok(unchanged.bytes < first.bytes / 3, `${unchanged.bytes} vs ${first.bytes}`);
    assert.equal(patchOf(unchanged.body).resources.length, 1);

    // Another student's bid changes only the shared auction parts.
    const writeResource = (key: string, category: string, owner: number | null, value: unknown) =>
      query(`select storage_write_resource(${literal(key)},${literal(category)},${owner === null ? 'null' : owner},${json(value)});`);
    writeResource('/auctionBids/item-a', 'auctionBids', null, { kind: 'value', parentKey: '/auctionBids', member: 'item-a', data: { bidder: 7, amount: 30 } });
    const bid = await step();
    const bidKeys = patchOf(bid.body).resources.map(row => row.resource_key);
    assert.ok(bidKeys.includes('/auctionBids/item-a'));
    assert.ok(!bidKeys.some(key => key.startsWith('/weeklySubjects') || key.startsWith('/studentEmotionHistory')));
    assert.equal(patchOf(bid.body).history.length, 0);

    // Another student's private data is outside the scope and changes nothing.
    writeResource('/studentEmotionHistory/9/@emotion-9', 'studentEmotionHistory', 9, { kind: 'value', parentKey: '/studentEmotionHistory/9', member: '@emotion-9', order: 0, data: { id: 'emotion-9', text: '바뀜', createdAt: at } });
    assert.equal(patchOf((await step()).body).resources.length, 1);

    // A deleted shared row is removed from the merged projection.
    query("update storage_resources set deleted=true, revision=revision+1 where resource_key='/studentLife/failureStories/@story-1';");
    const removed = await step();
    assert.ok(patchOf(removed.body).deletedKeys.includes('/studentLife/failureStories/@story-1'));

    // The student's own wallet change sends the wallet and history.
    query("select storage_apply_wallet_delta(5,'grant-5',3,'manual',now(),'grant-5');");
    const wallet = await step();
    assert.deepEqual(patchOf(wallet.body).wallets.map(row => row.balance), [1003]);
    assert.deepEqual(patchOf(wallet.body).historyStudents, [5]);

    // Mail addressed to the student is detected; mail to others is not.
    writeResource('/studentLife/letters/@letter-x', 'studentLife', 5, { kind: 'value', parentKey: '/studentLife/letters', member: '@letter-x', order: 99, data: { id: 'letter-x', recipient: 5, content: '새 편지', createdAt: at } });
    assert.ok(patchOf((await step()).body).resources.some(row => row.resource_key === '/studentLife/letters/@letter-x'));

    // A manifest naming another student's wallet or an unknown part is refused.
    assert.equal((await read(5, { ...manifest, 'wallet:6': manifest['wallet:5'] })).status, 400);
    assert.equal((await read(5, { 'scope:/retained': manifest['wallet:5'] })).status, 400);

    // Without the flag the request keeps the full read path.
    process.env.STORAGE_STUDENT_CHANGES = '0';
    const legacy = await read(5, manifest);
    assert.equal(legacy.status, 200);
    assert.deepEqual(legacy.calls, ['storage_load_scope_student']);
    assert.equal(Reflect.get(legacy.body, 'readManifest'), undefined);

    for (const role of ['anon', 'authenticated']) assert.equal(query(`select has_function_privilege('${role}','storage_load_scope_changes_student(jsonb,jsonb)','execute');`), 'f');
    assert.equal(query("select has_function_privilege('service_role','storage_load_scope_changes_student(jsonb,jsonb)','execute');"), 't');
  } finally {
    globalThis.fetch = previousFetch; process.env = previousEnv;
    invoke('pg_ctl', ['-D', `${directory}/data`, '-m', 'fast', '-w', 'stop']);
  }
});
