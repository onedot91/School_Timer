import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { fakeClassroom, fixtureCookie, startHttpHarness } from './httpHarness.js';
import { isStorageRecord } from '../../src/lib/storageV2Codec.js';

const students = Array.from({ length: 23 }, (_, index) => index + 1);
const initialValue = fakeClassroom();
initialValue.currencyBalances = Object.fromEntries(students.map(student => [student, 1000]));
initialValue.currencyHistory = Object.fromEntries(students.map(student => [student, Array.from({ length: 143 }, (_, index) => ({
  id: `history-${student}-${index}`, studentNumber: student, delta: 0, before: 1000, after: 1000,
  reason: '격리 성능 검증', createdAt: '2026-09-08T00:00:00.000Z',
}))]));
assert.ok(isStorageRecord(initialValue.studentLife));
initialValue.studentLife.letters = Array.from({ length: 1300 }, (_, index) => ({
  id: `letter-${index}`, recipient: index % 23 + 1, senderLabel: '합성 교사', senderStudentNumber: null,
  title: '합성 검증', content: '격리 자료', createdAt: '2026-09-08T00:00:00.000Z', readAt: null,
}));
const rounds = Number(process.env.MIXED_ROUNDS ?? 5);
const rpcDelayMs = Number(process.env.MIXED_RPC_DELAY_MS ?? 100);
const harness = await startHttpHarness({ name: `storage_http_test_mixed24_${process.pid}_${Date.now()}`, port: 0, initialValue, rpcDelayMs });
const latencies: Record<string, number[]> = { read: [], write: [] };
const errors: { actor: number; status: number; code: unknown }[] = [];
const request = async (actor: number, body?: unknown) => {
  const start = performance.now();
  const response = await fetch(`${harness.baseUrl}/api/${body && actor ? 'student-economy' : 'shared-settings'}`, {
    method: body ? 'POST' : 'GET', headers: { Cookie: fixtureCookie(actor), 'X-Storage-Projection': '1', 'Content-Type': 'application/json', 'sec-fetch-site': 'same-origin' },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000),
  });
  const value: unknown = await response.json();
  latencies[body ? 'write' : 'read'].push(performance.now() - start);
  if (response.status !== 200) errors.push({ actor, status: response.status, code: isStorageRecord(value) ? value.error : 'invalid' });
  return value;
};
const percentile = (values: number[], p: number) => Math.round([...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * p))] ?? 0);
try {
  await harness.query(await readFile(new URL('../../supabase/storage_scope_read_performance.sql', import.meta.url), 'utf8'));
  if (process.argv.includes('--scoped-polling')) {
    await harness.query(await readFile(new URL('../../supabase/storage_scoped_polling.sql', import.meta.url), 'utf8'));
    process.env.STORAGE_SCOPED_POLLING = '1';
  }
  const started = performance.now();
  await Promise.all([...students, 0].map(async actor => {
    for (let round = 0; round < rounds; round++) {
      await request(actor);
      if (actor) await request(actor, { protocolVersion: 2, studentNumber: actor, action: { type: 'deposit', amount: 10 }, requestId: `mixed-${actor}-${round}` });
      else if (process.argv.includes('--teacher-writes')) await request(0, { protocolVersion: 2, requestId: `mixed-teacher-${round}`, action: 'teacher.settings.patch',
        payload: { changes: [{ field: 'scheduleNotice', before: round ? `격리 ${round - 1}` : '격리 검증 학급', after: `격리 ${round}` }] } });
      else await new Promise(resolve => setTimeout(resolve, 500));
    }
  }));
  const reconciliation = (await harness.query('select storage_reconcile_wallets() result')).rows[0]?.result;
  const wallets = (await harness.query('select balance from wallet_accounts order by student_number')).rows;
  const receipts = (await harness.query('select count(*)::integer count from storage_receipts')).rows[0]?.count;
  const report = { sessions: 24, rounds, simulatedRpcRoundTripMs: rpcDelayMs * 2, elapsedMs: Math.round(performance.now() - started),
    latency: Object.fromEntries(Object.entries(latencies).map(([key, values]) => [key, { count: values.length, p50: percentile(values, .5), p95: percentile(values, .95), max: Math.round(Math.max(...values)) }])), errors,
    rpcs: Object.fromEntries([...new Set(harness.metrics.map(row => row.rpc))].map(rpc => [rpc, { count: harness.metrics.filter(row => row.rpc === rpc && !row.code).length,
      bytes: harness.metrics.filter(row => row.rpc === rpc).reduce((sum, row) => sum + (row.responseBytes ?? 0), 0) }])), receipts, reconciliation };
  console.log(JSON.stringify(report));
  assert.deepEqual(errors, []);
  assert.equal(receipts, (process.argv.includes('--teacher-writes') ? 24 : 23) * rounds);
  assert.deepEqual(wallets.map(row => row.balance), Array(23).fill(1000 - 10 * rounds));
  assert.deepEqual(reconciliation, []);
  if (process.argv.includes('--scoped-polling')) {
    const rows = await Promise.all(students.map(student => request(student)));
    const versions = rows.map(row => { assert.ok(isStorageRecord(row)); assert.equal(typeof row.readVersion, 'string'); return row.readVersion; });
    await request(1, { protocolVersion: 2, studentNumber: 1, action: { type: 'deposit', amount: 10 }, requestId: 'private-polling-change' });
    const poll = async () => Promise.all(students.map(async student => {
      const response = await fetch(`${harness.baseUrl}/api/shared-settings?metadata=1&scoped=1`, { headers: { Cookie: fixtureCookie(student) } });
      assert.equal(response.status, 200);
      const value: unknown = await response.json(); assert.ok(isStorageRecord(value)); return value;
    }));
    const after = await poll();
    assert.deepEqual(after.map((value, index) => value.readVersion !== versions[index]), students.map(student => student === 1));
    await harness.query("update wallet_accounts set revision=revision+1,updated_at='2026-09-01' where student_number=3");
    const delayed = await poll();
    assert.equal(delayed[2].updatedAt, after[2].updatedAt);
    assert.notEqual(delayed[2].readVersion, after[2].readVersion);
    await harness.query("select storage_write_resource('/auctionItems','auctionItems',null,null)");
    const deleted = await poll();
    assert.ok(deleted.every((value, index) => value.readVersion !== delayed[index].readVersion));
    const permissions = (await harness.query("select has_function_privilege('anon','storage_load_scope_metadata(jsonb)','execute') anon, has_function_privilege('authenticated','storage_load_scope_metadata(jsonb)','execute') authenticated, has_function_privilege('service_role','storage_load_scope_metadata(jsonb)','execute') service_role")).rows[0];
    assert.deepEqual(permissions, { anon: false, authenticated: false, service_role: true });
    console.log(JSON.stringify({ polling: 'one private save changes only its owner; same global timestamp still detects revisions; shared deletion changes all 23', permissions }));
  }
} finally { await harness.stop(); }
