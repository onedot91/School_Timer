import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import pg from 'pg';
import handler from '../../api/shared-settings.js';
import { createDeviceSessionToken } from '../../src/server/deviceSession.js';
import { storageCommandScope } from '../../src/server/storageCommandScope.js';
import { economyResultScope } from '../../src/server/economyStorageScope.js';
import { isStorageRecord, splitStorageState } from '../../src/lib/storageV2Codec.js';
import { AUCTION_ITEM_IDS, createAuctionItemTemplate } from '../../src/lib/currency.js';

// storage_scope_read_buffers.sql on production-shaped synthetic data: identical scoped reads and polling
// versions, fewer buffers, idempotent apply and exact rollback. SCOPE_BENCH_RUNS sets timing samples.
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
const json = (value: unknown) => `${literal(JSON.stringify(value))}::jsonb`;
const invoke = (program: string, args: string[], input?: string) => execFileSync(program, args,
  { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
const sqlFile = (name: string) => readFile(new URL(`../../supabase/${name}`, import.meta.url), 'utf8');
const runs = Number(process.env.SCOPE_BENCH_RUNS ?? 5);
const students = Array.from({ length: 23 }, (_, index) => index + 1);
const secret = 'synthetic-scope-read-buffer-session-secret';
const baselineHashes = { storage_load_scope: '6916f9db14ee774148259dbaa7566558', storage_scope_read_version: '6866cb51793ad8b48f47a681f28c89a1' };
const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (!isStorageRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
};
// Aggregation order of unordered collections is not part of the RPC contract.
const comparable = (value: unknown) => {
  assert.ok(isStorageRecord(value));
  return canonical(Object.fromEntries(Object.entries(value).map(([key, field]) =>
    [key, ['resources', 'wallets', 'history', 'deletedKeys'].includes(key) && Array.isArray(field)
      ? field.map(canonical).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) : field])));
};
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;
const scope = (resources: unknown[] = [], wallets: number[] = [], history: number[] = wallets) =>
  ({ resources, wallets, history, writeResources: [], writeWallets: [] });
const edgeScopes = [
  scope(),
  scope([{ path: '/studentLife' }, { path: '/studentLife/letters' }]),
  scope([{ path: '/studentLife/letters', mail: { actor: 2, direction: 'participant' } }], [2]),
  scope([{ path: '/studentLife/letters', mail: { actor: 0, direction: 'recipient' } }]),
  { ...scope([{ path: '/studentEconomy', students: [1, 2] }, { path: '/studentEconomy', students: [2, 3] }], [1, 2, 3]), revisionKeys: ['wallet:23'] },
  scope([], [1], [1, 1, 2]),
  scope([], students),
  scope([{ path: '/prefix' }, { path: '/한글_%' }]),
  scope([{ path: '/auctionBidHistory/item-a' }, { path: '/auctionBidHistory' }]),
  scope([{ path: '/studentLife/failureStories', students: [4] }]),
];

test('scope read buffers migration keeps scoped reads identical and bounds buffer use on PostgreSQL', { timeout: 300_000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'school-scope-buffers.'));
  const port = 55493;
  const query = (sql: string) => invoke('psql', ['-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-h', directory, '-p', String(port), '-U', 'postgres', '-d', 'postgres'], sql).trim();
  invoke('initdb', ['-D', `${directory}/data`, '-U', 'postgres', '-A', 'trust', '--no-locale', '--encoding=UTF8']);
  invoke('pg_ctl', ['-D', `${directory}/data`, '-l', `${directory}/postgres.log`, '-o', `-F -h '' -k ${directory} -p ${port}`, '-w', 'start']);
  const pool = new pg.Pool({ host: directory, port, user: 'postgres', database: 'postgres', max: 4 });
  pool.on('error', error => { if (Reflect.get(error, 'code') !== '57P01') throw error; });
  const originalFetch = globalThis.fetch;
  const environment = { ...process.env };
  try {
    query('create role anon; create role authenticated; create role service_role;');
    // Production function chain for the scoped reads (verified against production on 2026-10-23).
    for (const file of ['app_settings.sql', 'classword.sql', 'library_competition.sql', 'storage_v2.sql', 'storage_today_friend_v2.sql', 'storage_rewards_v2.sql',
      'newspaper_questions.sql', 'storage_classword_v2.sql', 'storage_audit_v2.sql', 'storage_scoped_v2.sql', 'storage_read_performance.sql',
      'storage_library_placement_v2.sql', 'storage_scoped_polling.sql', 'storage_scope_history_read_performance.sql', 'storage_scoped_read_execution.sql', 'storage_snapshot_execution.sql',
      'storage_ancestor_locks.sql', 'storage_command_round_trips.sql']) query(await sqlFile(file));
    const hashes = () => Object.fromEntries(query(`select proname||'='||md5(prosrc) from pg_proc
      where oid in ('public.storage_load_scope(jsonb)'::regprocedure,'public.storage_scope_read_version(jsonb)'::regprocedure) order by proname`)
      .split('\n').map(line => line.split('=')));
    assert.deepEqual(hashes(), baselineHashes);

    // Shape observed in production on 2026-10-23: ~4.2k resources, 768 letters, ~75 bids per auction item, 203–610 ledger rows per student.
    const createdAt = '2026-10-01T00:00:00Z';
    const source = {
      scheduleNotice: '합성 학급', auctionBids: {}, auctionAwards: {},
      auctionItems: Array.from({ length: 6 }, (_, slot) => ({ ...createAuctionItemTemplate(0, slot), name: '합성 물품', isConfigured: true })),
      auctionBidHistory: Object.fromEntries(AUCTION_ITEM_IDS.slice(0, 20).map((itemId, slot) => [itemId, Array.from({ length: 75 }, (_, index) => ({
        itemId, bidder: (index + slot) % 23 + 1, amount: 10 + index, createdAt }))])),
      currencyBalances: Object.fromEntries(students.map(student => [student, 1000])),
      currencyHistory: Object.fromEntries(students.map(student => [student, Array.from({ length: 200 + student * 18 }, (_, index) => ({
        id: `history-${student}-${index}`, studentNumber: student, before: 1000, after: 1000, delta: 0, reason: '합성 내역', createdAt }))])),
      studentNumberBaseball: Object.fromEntries(students.map(student => [student, { history: Array.from({ length: 7 }, (_, index) => ({ id: `game-${student}-${index}`, guesses: [] })) }])),
      studentLife: {
        letters: Array.from({ length: 768 }, (_, index) => ({ id: `letter-${index}`, recipient: index % 24, senderLabel: '합성',
          senderStudentNumber: index % 3 === 0 ? index % 23 + 1 : null, replyToId: null, title: '합성 편지', content: '합성 내용 '.repeat(20), createdAt, readAt: null })),
        failureStories: students.flatMap(studentNumber => Array.from({ length: 3 }, (_, index) => ({ id: `story-${studentNumber}-${index}`, studentNumber,
          failure: '합성 실패 '.repeat(20), lesson: '합성 배움 '.repeat(20), createdAt, stamps: [{ studentNumber: studentNumber % 23 + 1, stampId: 'brave' }] }))),
        books: Array.from({ length: 67 }, (_, index) => ({ id: `book-${index}`, studentNumber: index % 23 + 1, title: '합성 책', createdAt })),
      },
    };
    const encoded = splitStorageState(source);
    // The legacy row only seeds the bootstrap; production-sized data exceeds its retired size cap.
    query(`alter table app_settings drop constraint app_settings_value_size_check;
      insert into app_settings(id,value,updated_at) values('school-timer-main',${json(source)},${literal(createdAt)});
      select storage_set_maintenance(true);
      select storage_bootstrap(${literal(createdAt)},${json(source)},${json(encoded.resources)},${json(encoded.wallets)},${json(encoded.history)});
      select storage_set_maintenance(false,true);`);
    // Deleted letters exercise the deleted-mail branch the way teacher deletions do in production.
    query("update storage_resources set deleted=true where value->>'parentKey'='/studentLife/letters' and (value->>'order')::numeric::integer % 9 = 0; analyze;");

    // Capture the student read scopes exactly as the GET handler requests them.
    const scopes: { label: string; scope: unknown }[] = edgeScopes.map(scope => ({ label: 'edge', scope }));
    Object.assign(process.env, { SUPABASE_URL: 'https://scope-fixture.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic',
      DEVICE_SESSION_SECRET: secret, STORAGE_PROTOCOL_VERSION: '2' });
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.origin, 'https://scope-fixture.invalid');
      const rpc = url.pathname.split('/').at(-1) ?? '';
      assert.match(rpc, /^storage_[a-z_]+$/);
      const body: unknown = JSON.parse(String(init?.body ?? '{}'));
      assert.ok(isStorageRecord(body));
      if (rpc === 'storage_load_scope') scopes.push({ label: 'student.read', scope: body.p_scope });
      const names = Object.keys(body);
      const result = await pool.query(`select public.${rpc}(${names.map((name, index) => `${name} => $${index + 1}`).join(',')})::text as output`,
        names.map(name => JSON.stringify(body[name])));
      return new Response(String(result.rows[0]?.output ?? 'null'), { headers: { 'Content-Type': 'application/json' } });
    };
    for (const student of [2, 13, 23]) {
      let status = 0; let output: unknown;
      const response = { setHeader() {}, status(code: number) { status = code; return this; }, json(value: unknown) { output = value; } };
      await handler({ method: 'GET', query: {}, headers: { cookie: `__Host-school-timer-device=${createDeviceSessionToken({ role: 'student', studentNumber: student }, secret)}`,
        'sec-fetch-site': 'same-origin', 'x-storage-projection': '1' } }, response);
      assert.equal(status, 200, JSON.stringify(output));
    }
    globalThis.fetch = originalFetch;
    assert.equal(scopes.filter(item => item.label === 'student.read').length, 3);
    const student = (studentNumber: number) => ({ role: 'student' as const, studentNumber, expiresAt: Date.now() + 60_000 });
    const teacher = { role: 'teacher' as const, expiresAt: Date.now() + 60_000 };
    scopes.push(
      { label: 'student.auction.bid', scope: storageCommandScope('student.auction.bid', { itemId: AUCTION_ITEM_IDS[0], amount: 100 }, student(7)) },
      { label: 'student.emotion.save', scope: storageCommandScope('student.emotion.save', {}, student(7)) },
      { label: 'student.letter.send', scope: storageCommandScope('student.letter.send', {}, student(7)) },
      { label: 'student.failure.create', scope: storageCommandScope('student.failure.create', {}, student(7)) },
      { label: 'economy.result', scope: economyResultScope(7) },
      { label: 'teacher.currency.deduct', scope: storageCommandScope('teacher.currency.deduct', { studentNumbers: [3, 4] }, teacher) },
      { label: 'teacher.mail.delete', scope: storageCommandScope('teacher.mail.delete', {}, teacher) },
    );

    const explain = async (rpc: string, input: unknown) => {
      const times: number[] = []; let buffers = 0;
      for (let run = 0; run < runs; run++) {
        const plan = await pool.query<{ 'QUERY PLAN': [{ 'Execution Time': number; Plan: { 'Shared Hit Blocks': number; 'Shared Read Blocks': number } }] }>(
          `explain (analyze, buffers, format json) select public.${rpc}($1::jsonb)`, [JSON.stringify(input)]);
        const [root] = plan.rows[0]?.['QUERY PLAN'] ?? [];
        assert.ok(root);
        times.push(root['Execution Time']); buffers = root.Plan['Shared Hit Blocks'] + root.Plan['Shared Read Blocks'];
      }
      return { ms: Math.round(median(times) * 10) / 10, buffers };
    };
    const measure = async () => {
      const report: Record<string, { ms: number; buffers: number; bytes?: number }> = {};
      const outputs: Record<string, unknown> = {};
      for (const [index, { label, scope: input }] of scopes.entries()) {
        const key = `${index}:${label}`;
        const output = await pool.query<{ output: unknown; version: string }>(
          'select public.storage_load_scope($1::jsonb) as output, public.storage_scope_read_version($1::jsonb) as version', [JSON.stringify(input)]);
        const loaded = output.rows[0]?.output;
        // Polling compares this version with the loaded snapshot; they must stay identical.
        assert.ok(isStorageRecord(loaded));
        assert.equal(output.rows[0]?.version, loaded.readVersion, key);
        outputs[key] = comparable(loaded);
        if (label === 'edge') continue;
        report[key] = { ...await explain('storage_load_scope', input), bytes: Buffer.byteLength(JSON.stringify(loaded)) };
        report[`${key}:readVersion`] = await explain('storage_scope_read_version', input);
      }
      return { report, outputs };
    };
    const before = await measure();
    query(await sqlFile('storage_scope_read_buffers.sql'));
    const candidateHashes = hashes();
    assert.notDeepEqual(candidateHashes, baselineHashes);
    query(await sqlFile('storage_scope_read_buffers.sql'));
    assert.deepEqual(hashes(), candidateHashes);
    assert.equal(query(`select string_agg(distinct array_to_string(proconfig,',')||'|'||prosecdef::text||'|'||provolatile::text||'|'||proacl::text,';') from pg_proc
      where oid in ('public.storage_load_scope(jsonb)'::regprocedure,'public.storage_scope_read_version(jsonb)'::regprocedure)`),
    'search_path=pg_catalog, public,jit=off|true|s|{postgres=X/postgres,service_role=X/postgres}');
    const after = await measure();
    for (const key of Object.keys(before.outputs)) assert.deepEqual(after.outputs[key], before.outputs[key], key);
    for (const key of Object.keys(before.report).filter(key => key.endsWith(':student.read') || key.endsWith(':student.read:readVersion'))) {
      assert.ok(after.report[key].buffers * 4 <= before.report[key].buffers, `${key} ${before.report[key].buffers} -> ${after.report[key].buffers}`);
    }
    query(await sqlFile('storage_scope_read_buffers_rollback.sql'));
    assert.deepEqual(hashes(), baselineHashes);
    query(await sqlFile('storage_scope_read_buffers.sql'));
    assert.deepEqual(hashes(), candidateHashes);

    const sum = (report: typeof before.report, field: 'ms' | 'buffers') => Math.round(Object.values(report).reduce((total, row) => total + row[field], 0) * 10) / 10;
    console.log(JSON.stringify({ node: process.version, postgres: query('show server_version'), runs,
      resources: Number(query('select count(*) from storage_resources')), ledger: Number(query('select count(*) from wallet_ledger')),
      rows: Object.fromEntries(Object.keys(before.report).map(key => [key, { before: before.report[key], after: after.report[key] }])),
      total: { before: { ms: sum(before.report, 'ms'), buffers: sum(before.report, 'buffers') }, after: { ms: sum(after.report, 'ms'), buffers: sum(after.report, 'buffers') } } }));
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env)) if (!(key in environment)) delete process.env[key];
    Object.assign(process.env, environment);
    await pool.end();
    invoke('pg_ctl', ['-D', `${directory}/data`, '-m', 'fast', '-w', 'stop']);
  }
});
