import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mock } from 'node:test';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import pg from 'pg';
import { verifyClassroomTimings } from '../../dev/storageBudgets.mjs';
import handler from '../../api/shared-settings.js';
import { createDeviceSessionToken } from '../../src/server/deviceSession.js';
import { isStorageRecord, splitStorageState } from '../../src/lib/storageV2Codec.js';
import { createAuctionItemTemplate } from '../../src/lib/currency.js';
import { parseScopedStorageSnapshot } from '../../src/server/storageV2Repository.js';

const directory = await mkdtemp(join(tmpdir(), 'school-classroom-load.'));
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
const json = (value: unknown) => `${literal(JSON.stringify(value))}::jsonb`;
const invoke = (program: string, args: string[], input?: string) => execFileSync(program, args,
  { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024 });
const args = ['-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-h', directory, '-p', '55488', '-U', 'postgres', '-d', 'postgres'];
const query = (sql: string) => invoke('psql', args, sql).trim();
// Pooled connections like PostgREST: spawning psql per RPC made shared CI runners measure process startup, not storage.
const pool = new pg.Pool({ host: directory, port: 55488, user: 'postgres', database: 'postgres', max: 48 });
// pool.end() resolves before idle sockets close, so stopping PostgreSQL can reach them with 57P01 admin_shutdown.
const unexpectedPoolErrors: unknown[] = [];
pool.on('error', error => { if (Reflect.get(error, 'code') !== '57P01') unexpectedPoolErrors.push(error); });
const asyncQuery = async (sql: string): Promise<string> => {
  const result = await pool.query<{ output: string }>(`select (${sql})::text as output`);
  return result.rows[0]?.output ?? '';
};
const rpcDelayMs = Number(process.env.CLASSROOM_RPC_DELAY_MS ?? 40);
assert.ok(Number.isFinite(rpcDelayMs) && rpcDelayMs >= 0 && rpcDelayMs <= 1000);
const originalFetch = globalThis.fetch;
const environment = { ...process.env };
mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-16T00:00:00Z') });
const secret = 'synthetic-classroom-load-session-secret';
const samples: { action: string; status: number; code?: string; ms: number }[] = [];
const metrics: { rpc: string; action: string; bytes: number; ms: number; saved?: boolean }[] = [];
const rpcNames = new Set(['storage_get_receipt', 'storage_load_scope', 'storage_prepare_command', 'storage_commit_scoped_mutation', 'storage_commit_scoped_and_load', 'storage_place_auction_bid']);
invoke('initdb', ['-D', `${directory}/data`, '-U', 'postgres', '-A', 'trust', '--no-locale', '--encoding=UTF8']);
invoke('pg_ctl', ['-D', `${directory}/data`, '-l', `${directory}/postgres.log`, '-o', `-F -h '' -k ${directory} -p 55488`, '-w', 'start']);
try {
  query('create role anon; create role authenticated; create role service_role;');
  // Same function chain as production: JIT-free scoped reads and shared ancestor locks, then the combined command RPCs.
  for (const file of ['app_settings.sql', 'classword.sql', 'library_competition.sql', 'storage_v2.sql', 'storage_today_friend_v2.sql', 'storage_rewards_v2.sql',
    'newspaper_questions.sql', 'storage_classword_v2.sql', 'storage_audit_v2.sql', 'storage_scoped_v2.sql', 'storage_read_performance.sql',
    'storage_library_placement_v2.sql', 'storage_scoped_polling.sql', 'storage_scope_history_read_performance.sql', 'storage_scoped_read_execution.sql', 'storage_snapshot_execution.sql',
    'storage_ancestor_locks.sql', 'storage_command_round_trips.sql']) {
    query(await readFile(new URL(`../../supabase/${file}`, import.meta.url), 'utf8'));
  }
  const students = Array.from({ length: 23 }, (_, index) => index + 1);
  const createdAt = '2026-09-01T00:00:00Z';
  const stories = students.flatMap(studentNumber => Array.from({ length: 3 }, (_, index) => ({
    id: `seed-${studentNumber}-${index}`, studentNumber, failure: '합성 실패 '.repeat(30), lesson: '합성 배움 '.repeat(30), createdAt,
    stamps: [{ studentNumber: studentNumber % 23 + 1, stampId: 'brave' }],
  })));
  const items = Array.from({ length: 6 }, (_, slot) => ({ ...createAuctionItemTemplate(0, slot), name: '합성 물품', isConfigured: true }));
  const source = { scheduleNotice: 'before', auctionItems: items, auctionBids: {}, auctionAwards: {}, auctionBidHistory: {},
    currencyBalances: Object.fromEntries(students.map(student => [student, 1000])),
    currencyHistory: Object.fromEntries(students.map(student => [student, Array.from({ length: 100 }, (_, index) => ({
      id: `history-${student}-${index}`, studentNumber: student, before: 1000, after: 1000, delta: 0, reason: '합성 내역', createdAt,
    }))])), studentLife: { failureStories: stories, letters: [], books: [] } };
  const encoded = splitStorageState(source);
  query(`insert into app_settings(id,value,updated_at) values('school-timer-main',${json(source)},${literal(createdAt)});
    select storage_set_maintenance(true);
    select storage_bootstrap(${literal(createdAt)},${json(source)},${json(encoded.resources)},${json(encoded.wallets)},${json(encoded.history)});
    select storage_set_maintenance(false,true);`);
  Object.assign(process.env, { SUPABASE_URL: 'https://classroom-fixture.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic',
    DEVICE_SESSION_SECRET: secret, STORAGE_PROTOCOL_VERSION: '2', STORAGE_COMBINED_COMMANDS: '1',
    STORAGE_ATOMIC_AUCTION_BIDS: process.env.CLASSROOM_ATOMIC_BIDS ?? '1' });
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, 'https://classroom-fixture.invalid');
    const rpc = url.pathname.split('/').at(-1) ?? '';
    assert.ok(rpcNames.has(rpc), rpc);
    const body: unknown = JSON.parse(String(init?.body));
    assert.ok(isStorageRecord(body));
    const parameters = Object.entries(body).map(([key, value]) => {
      assert.match(key, /^p_[a-z_]+$/);
      return `${key} => ${value === null ? 'null' : typeof value === 'string' ? literal(value) : json(value)}`;
    }).join(',');
    const start = performance.now();
    await new Promise(resolve => setTimeout(resolve, rpcDelayMs));
    try {
      const output: unknown = JSON.parse(await asyncQuery(`select public.${rpc}(${parameters})`));
      metrics.push({ rpc, action: String(body.p_action ?? ''), bytes: Buffer.byteLength(JSON.stringify(output)), ms: performance.now() - start,
        ...(isStorageRecord(output) && typeof output.saved === 'boolean' ? { saved: output.saved } : {}) });
      return Response.json(output);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const retryable = /deadlock detected|could not serialize/.test(message);
      return Response.json({ code: retryable ? '40001' : 'P0001', message: /STORAGE_[A-Z_]+/.exec(message)?.[0] ?? 'FIXTURE_DATABASE_ERROR' }, { status: retryable ? 503 : 400 });
    }
  };
  const requests: { actor: number; requestId: string; action: string; payload: unknown }[] = [];
  const successful: typeof requests = [];
  const call = async (command: typeof requests[number], record = true) => {
    let status = 0; let output: unknown;
    const start = performance.now();
    const token = createDeviceSessionToken(command.actor === 0 ? { role: 'teacher' } : { role: 'student', studentNumber: command.actor }, secret);
    const response = { setHeader() {}, status(code: number) { status = code; return this; }, json(value: unknown) { output = value; } };
    await handler({ method: 'POST', headers: { cookie: `__Host-school-timer-device=${token}`, 'sec-fetch-site': 'same-origin', 'x-storage-projection': '1' },
      body: { protocolVersion: 2, requestId: command.requestId, action: command.action, payload: command.payload } }, response);
    if (record) {
      if (status === 200) successful.push(command);
      samples.push({ action: command.action, status, ms: performance.now() - start,
        ...(isStorageRecord(output) && typeof output.error === 'string' ? { code: output.error } : {}) });
    }
    return { status, output };
  };
  const command = (actor: number, action: string, payload: unknown, suffix: string) => {
    const request = { actor, action, payload, requestId: `classroom-${suffix}-${actor}` }; requests.push(request); return request;
  };
  // Separates database waits from handler CPU on the single Node event loop.
  const loopDelay = monitorEventLoopDelay({ resolution: 10 }); loopDelay.enable();
  const cpuStart = process.cpuUsage(), wallStart = performance.now();
  const teacher = command(0, 'teacher.settings.patch', { changes: [{ field: 'scheduleNotice', before: 'before', after: 'after' }] }, 'teacher');
  await Promise.all([call(teacher), ...students.map(async student => {
    await call(command(student, 'student.auction.bid', { itemId: items[(student - 1) % 6].id, amount: student * 10 + 10 }, 'bid'));
    await call(command(student, 'student.failure.create', { failure: '합성 새 실패', lesson: '합성 새 배움' }, 'story'));
  })]);
  const workloadMetrics = [...metrics];
  loopDelay.disable();
  const cpu = process.cpuUsage(cpuStart);
  const node = { wallMs: Math.round(performance.now() - wallStart), cpuMs: Math.round((cpu.user + cpu.system) / 1000),
    loopDelayP99Ms: Math.round(loopDelay.percentile(99) / 1e6), loopDelayMaxMs: Math.round(loopDelay.max / 1e6) };
  const snapshot = parseScopedStorageSnapshot(JSON.parse(query(`select storage_load_scope(${json({ resources: [{ path: '/studentLife/failureStories' }, { path: '/auctionBids' }], wallets: students, history: [], writeResources: [], writeWallets: [] })});`)));
  assert.ok(isStorageRecord(snapshot.value.studentLife) && Array.isArray(snapshot.value.studentLife.failureStories));
  const savedStories = snapshot.value.studentLife.failureStories;
  for (const story of stories) assert.deepEqual(savedStories.find(entry => isStorageRecord(entry) && entry.id === story.id), story);
  for (const student of students) assert.equal(snapshot.value.currencyBalances && Reflect.get(Object(snapshot.value.currencyBalances), String(student)), 1015);
  assert.ok(isStorageRecord(snapshot.value.auctionBids));
  const winners = Object.entries(snapshot.value.auctionBids);
  assert.equal(winners.length, 6);
  for (const [itemId, bid] of winners) {
    assert.ok(isStorageRecord(bid) && typeof bid.bidder === 'number' && typeof bid.amount === 'number');
    const slot = items.findIndex(item => item.id === itemId);
    const expectedWinner = Math.max(...students.filter(student => (student - 1) % 6 === slot));
    assert.equal(bid.bidder, expectedWinner);
    assert.equal(bid.amount, expectedWinner * 10 + 10);
    const request = { actor: 0, action: 'teacher.auction.finalize', payload: { itemId, useLatestBid: true }, requestId: `classroom-finalize-${itemId}` };
    assert.equal((await call(request, false)).status, 200);
    successful.push(request);
    assert.equal(query(`select balance from wallet_accounts where student_number=${bid.bidder};`), String(1015 - bid.amount));
  }
  const beforeReplay = query("select jsonb_build_object('wallets',(select jsonb_agg(to_jsonb(w) order by student_number) from wallet_accounts w),'ledger',(select count(*) from wallet_ledger),'stories',(select count(*) from storage_resources where resource_key like '/studentLife/failureStories/@classroom-story-%/failure' and not deleted));");
  for (const request of successful) assert.equal((await call(request, false)).status, 200);
  const afterReplay = query("select jsonb_build_object('wallets',(select jsonb_agg(to_jsonb(w) order by student_number) from wallet_accounts w),'ledger',(select count(*) from wallet_ledger),'stories',(select count(*) from storage_resources where resource_key like '/studentLife/failureStories/@classroom-story-%/failure' and not deleted));");
  const summary = Object.fromEntries([...new Set(samples.map(sample => sample.action))].map(action => {
    const rows = samples.filter(sample => sample.action === action), times = rows.map(row => row.ms).sort((a, b) => a - b);
    return [action, { requests: rows.length, statuses: rows.reduce<Record<string, number>>((counts, row) => { const key = `${row.status}:${row.code ?? 'ok'}`; counts[key] = (counts[key] ?? 0) + 1; return counts; }, {}),
      p50: Math.round(times[Math.floor((times.length - 1) * .5)]), p95: Math.round(times[Math.ceil((times.length - 1) * .95)]), max: Math.round(times.at(-1) ?? 0) }];
  }));
  // GitHub job logs need sign-in; a notice annotation keeps CI measurements readable from the public check run.
  const rpcTimings = Object.fromEntries([...new Set(workloadMetrics.map(metric => `${metric.action || 'read'}:${metric.rpc}`))].map(key => {
    const times = workloadMetrics.filter(metric => `${metric.action || 'read'}:${metric.rpc}` === key).map(metric => metric.ms).sort((a, b) => a - b);
    return [key, { calls: times.length, p50: Math.round(times[Math.floor((times.length - 1) * .5)]), max: Math.round(times.at(-1) ?? 0) }];
  }));
  if (process.env.GITHUB_ACTIONS === 'true') console.log(`::notice title=classroom save load::${JSON.stringify({ summary, node, rpcTimings })}`);
  console.log(JSON.stringify({ atomicBids: process.env.STORAGE_ATOMIC_AUCTION_BIDS === '1', rpcDelayMs, syntheticStories: stories.length, historyPerStudent: 100, summary,
    node, rpcTimings,
    rpcCalls: workloadMetrics.length, responseBytes: workloadMetrics.reduce((total, metric) => total + metric.bytes, 0), conflicts: workloadMetrics.filter(metric => metric.saved === false).length,
    receiptCount: query('select count(*) from storage_receipts;'), replayUnchanged: beforeReplay === afterReplay }, null, 2));
  assert.equal(beforeReplay, afterReplay, 'replays must not duplicate rewards or stories');
  assert.deepEqual(JSON.parse(query('select storage_reconcile_wallets();')), []);
  assert.equal(query('select count(*) from wallet_ledger where historical;'), '2300');
  assert.equal(query("select count(*) from storage_resources where resource_key like '/studentLife/failureStories/@classroom-story-%/failure' and not deleted;"), '23');
  assert.equal(query("select value->>'data' from storage_resources where resource_key='/scheduleNotice';"), 'after');
  assert.ok(samples.every(sample => sample.status === 200 || (sample.action === 'student.auction.bid' && ['BID_TOO_LOW', 'DUPLICATE_BID_AMOUNT'].includes(sample.code ?? ''))), JSON.stringify(samples.filter(sample => sample.status !== 200)));
  verifyClassroomTimings(samples, { atomicBids: process.env.STORAGE_ATOMIC_AUCTION_BIDS === '1' });
  assert.ok(metrics.every(metric => metric.ms < 8000), 'each database RPC must finish before the production read timeout');
  assert.deepEqual(unexpectedPoolErrors, []);
} finally {
  globalThis.fetch = originalFetch;
  process.env = environment;
  mock.timers.reset();
  await pool.end();
  invoke('pg_ctl', ['-D', `${directory}/data`, '-m', 'fast', '-w', 'stop']);
}
