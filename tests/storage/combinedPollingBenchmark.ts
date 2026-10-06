import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { fakeClassroom, fixtureCookie, startHttpHarness } from './httpHarness.js';
import { isStorageRecord } from '../../src/lib/storageV2Codec.js';

const students = Array.from({ length: 23 }, (_, index) => index + 1);
const actors = [...students, 0, 0];
const source = fakeClassroom();
source.currencyHistory = Object.fromEntries(students.map(student => [String(student), Array.from({ length: 210 }, (_, index) => ({
  id: `synthetic-history-${student}-${index}`, studentNumber: student, delta: 0, before: 100, after: 100,
  reason: '합성 검증', createdAt: '2026-09-08T00:00:00.000Z',
}))]));
assert.ok(isStorageRecord(source.studentLife));
source.studentLife.letters = Array.from({ length: 800 }, (_, index) => ({
  id: `synthetic-letter-${index}`, recipient: index % 23 + 1, senderLabel: '합성 교사', senderStudentNumber: null,
  title: '합성 검증', content: '로컬 검증 데이터', createdAt: '2026-09-08T00:00:00.000Z', readAt: null,
}));
const harness = await startHttpHarness({ name: `storage_http_test_combined_${process.pid}_${Date.now()}`, port: 0,
  initialValue: source, rpcDelayMs: 20 });
const percentile = (values: number[], fraction: number) => Math.round([...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * fraction))] ?? 0);
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const originalPolling = process.env.STORAGE_SCOPED_POLLING;
const read = async (actor: number, marker: string) => {
  const response = await fetch(`${harness.baseUrl}/api/shared-settings?metadata=1&scoped=1&knownReadMarker=${marker}&studentNumber=23`, {
    headers: { Cookie: fixtureCookie(actor) }, signal: AbortSignal.timeout(15_000),
  });
  const body: unknown = await response.json();
  assert.equal(response.status, 200);
  assert.ok(isStorageRecord(body));
  return body;
};
const version = async (actor: number) => {
  const response = await fetch(`${harness.baseUrl}/api/shared-settings`, { headers: { Cookie: fixtureCookie(actor), 'X-Storage-Projection': '1' } });
  const body: unknown = await response.json();
  assert.equal(response.status, 200);
  assert.ok(isStorageRecord(body));
  return body;
};
const measure = async (flag: '1' | '2', unchanged: boolean, staggered: boolean) => {
  process.env.STORAGE_SCOPED_POLLING = flag;
  const markerRow = (await harness.query('select storage_load_read_marker() result')).rows[0]?.result;
  assert.ok(isStorageRecord(markerRow) && typeof markerRow.readMarker === 'string');
  const marker = unchanged ? markerRow.readMarker : '0'.repeat(32);
  const expected: string[] = [];
  for (const actor of actors) expected.push(JSON.stringify(await read(actor, marker)));
  harness.metrics.length = 0;
  const times: number[] = [];
  for (let round = 0; round < 3; round++) await Promise.all(actors.map(async (actor, client) => {
    if (staggered) await delay(client * 75);
    const started = performance.now();
    assert.equal(JSON.stringify(await read(actor, marker)), expected[client]);
    times.push(performance.now() - started);
  }));
  const counts = Object.fromEntries([...new Set(harness.metrics.map(metric => metric.rpc))].map(rpc => [rpc, harness.metrics.filter(metric => metric.rpc === rpc).length]));
  const result = { flag, state: unchanged ? 'idle' : 'changed', start: staggered ? 'staggered75ms' : 'simultaneous',
    requests: times.length, p50Ms: percentile(times, .5), p95Ms: percentile(times, .95), maxMs: Math.round(Math.max(...times)), rpcCounts: counts,
    databaseRequests: harness.metrics.length, errors: 0, artificialRoundTripMs: 40 };
  console.log(JSON.stringify(result));
  if (flag === '2') {
    if (unchanged) assert.equal(counts.storage_load_scope_metadata ?? 0, 0);
    assert.equal(counts.storage_load_read_marker ?? 0, 0);
    assert.equal(counts.storage_load_scope ?? 0, 0);
  }
  return result;
};
try {
  await harness.query(await readFile(new URL('../../supabase/storage_scoped_polling.sql', import.meta.url), 'utf8'));
  const beforeFunctions = (await harness.query("select oid::regprocedure::text identity,md5(prosrc) body_hash,proconfig from pg_proc where pronamespace='public'::regnamespace and proname<>'storage_poll_scope' order by identity")).rows;
  const standalone = await readFile(new URL('../../supabase/storage_combined_polling.sql', import.meta.url), 'utf8');
  await harness.query(standalone);
  await harness.query(standalone);
  assert.deepEqual((await harness.query("select oid::regprocedure::text identity,md5(prosrc) body_hash,proconfig from pg_proc where pronamespace='public'::regnamespace and proname<>'storage_poll_scope' order by identity")).rows, beforeFunctions);
  const permissions = (await harness.query("select has_function_privilege('anon','storage_poll_scope(jsonb,text)','execute') anon,has_function_privilege('authenticated','storage_poll_scope(jsonb,text)','execute') authenticated,has_function_privilege('service_role','storage_poll_scope(jsonb,text)','execute') service_role")).rows[0];
  assert.deepEqual(permissions, { anon: false, authenticated: false, service_role: true });
  const snapshots = await Promise.all(students.map(version));
  process.env.STORAGE_SCOPED_POLLING = '2';
  for (const [index, snapshot] of snapshots.entries()) {
    const changed = await read(students[index], '0'.repeat(32));
    assert.equal(changed.readVersion, snapshot.readVersion);
    process.env.STORAGE_SCOPED_POLLING = '1';
    assert.deepEqual(await read(students[index], '0'.repeat(32)), changed);
    process.env.STORAGE_SCOPED_POLLING = '2';
    assert.equal((await read(students[index], String(snapshot.readMarker))).unchanged, true);
  }
  for (const staggered of [false, true]) for (const unchanged of [false, true]) {
    for (let repeat = 0; repeat < 2; repeat++) {
      const baseline = await measure('1', unchanged, staggered);
      const combined = await measure('2', unchanged, staggered);
      assert.ok(combined.databaseRequests <= baseline.databaseRequests, 'Combined polling must preserve idle request coalescing');
    }
  }
  const snapshot1 = await version(1), snapshot2 = await version(2);
  await harness.query("update storage_resources set updated_at='2030-01-01T00:00:00Z' where resource_key='/scheduleNotice'");
  const before = await read(1, '0'.repeat(32));
  await harness.query("update storage_resources set revision=revision+1,updated_at='2028-01-01T00:00:00Z' where resource_key='/studentEconomy/1'");
  const own = await read(1, String(before.readMarker));
  const other = await read(2, String(before.readMarker));
  assert.equal(own.updatedAt, before.updatedAt);
  assert.notEqual(own.readVersion, snapshot1.readVersion);
  assert.equal(other.readVersion, snapshot2.readVersion);
  assert.notEqual(own.readMarker, before.readMarker);
  assert.equal(own.unchanged, undefined);
  await harness.query("begin; set local role service_role; select storage_poll_scope('{\"resources\":[],\"wallets\":[],\"history\":[],\"writeResources\":[],\"writeWallets\":[]}'::jsonb,null); rollback;");
  const beforeGuard = (await harness.query("select md5(prosrc) body_hash from pg_proc where oid='storage_poll_scope(jsonb,text)'::regprocedure")).rows;
  await harness.query('alter function storage_scope_read_version(jsonb) rename to storage_scope_read_version_guard_test');
  await assert.rejects(harness.query(standalone), /storage_scope_read_version/);
  await harness.query('rollback');
  await harness.query('alter function storage_scope_read_version_guard_test(jsonb) rename to storage_scope_read_version');
  assert.deepEqual((await harness.query("select md5(prosrc) body_hash from pg_proc where oid='storage_poll_scope(jsonb,text)'::regprocedure")).rows, beforeGuard);
  await harness.query('alter function storage_poll_scope(jsonb,text) rename to storage_poll_scope_guard_test');
  await harness.query("create function storage_poll_scope(jsonb,text) returns jsonb language sql as 'select null::jsonb'");
  await assert.rejects(harness.query(standalone), /STORAGE_POLL_FUNCTION_VERSION_MISMATCH/);
  await harness.query('rollback');
  await harness.query('alter function storage_poll_scope(jsonb,text) rename to storage_poll_scope_guard_rejected');
  await harness.query('alter function storage_poll_scope_guard_test(jsonb,text) rename to storage_poll_scope');
  assert.deepEqual((await harness.query("select md5(prosrc) body_hash from pg_proc where oid='storage_poll_scope(jsonb,text)'::regprocedure")).rows, beforeGuard);
  console.log(JSON.stringify({ studentVersionsEquivalent: 23, permissions, oldFunctionsUnchanged: true, idempotentSql: true,
    lateCommitDetectedWithUnchangedTimestamp: true, otherStudentVersionPreserved: true, versionGuardPreservedFunction: true }));
} finally {
  if (originalPolling === undefined) delete process.env.STORAGE_SCOPED_POLLING; else process.env.STORAGE_SCOPED_POLLING = originalPolling;
  await harness.stop();
}
