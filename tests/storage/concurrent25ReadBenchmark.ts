import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { fakeClassroom, fixtureCookie, startHttpHarness } from './httpHarness.js';
import { isStorageRecord, splitStorageState } from '../../src/lib/storageV2Codec.js';

const boundedScopePlan = process.argv.includes('--bounded-scope-plan');
const pollingLoad = process.argv.includes('--polling-load');
const baselinePath = process.argv[process.argv.indexOf('--baseline-sql') + 1];
if (pollingLoad && (!process.argv.includes('--baseline-sql') || !baselinePath || baselinePath.startsWith('--')))
  throw new Error('Pass --baseline-sql <saved pre-change storage_scoped_polling.sql>');
const reuseReadVersion = pollingLoad || boundedScopePlan || process.argv.includes('--reuse-read-version');
const pollingSql = await readFile(new URL('../../supabase/storage_scoped_polling.sql', import.meta.url), 'utf8');
const optimizedReadVersionStart = pollingSql.indexOf("'readVersion',md5(");
const optimizedReadVersionEnd = pollingSql.indexOf("    'resources',", optimizedReadVersionStart);
const baselinePollingSql = pollingLoad ? await readFile(baselinePath, 'utf8') : boundedScopePlan ? pollingSql
  .replace('select r.* from public.storage_resources r where r.resource_key in(select resource_key from closure)', 'select r.* from public.storage_resources r join closure c using(resource_key)')
  .replace("union select 'scope:'||category||':all' from nodes\n    union select 'scope:'||category||':'||coalesce(owner_number::text,'shared') from nodes\n    union select 'collection:'||(value->>'parentKey') from nodes where value->>'parentKey' is not null", 'union select public.storage_scope_keys(category,owner_number,value) from nodes')
  : pollingSql.slice(0, optimizedReadVersionStart)
  + "'readVersion',public.storage_scope_read_version(p_scope),\n"
  + pollingSql.slice(optimizedReadVersionEnd);

const students = Array.from({ length: 23 }, (_, index) => index + 1);
const actors = [...students, 0, 0];
const source = fakeClassroom();
source.currencyHistory = Object.fromEntries(students.map(student => [String(student), Array.from({ length: 134 + Number(student <= 9) }, (_, index) => ({
  id: `synthetic-history-${student}-${index}`, studentNumber: student, delta: 0, before: 100, after: 100,
  reason: '합성 성능 검증', createdAt: '2026-09-08T00:00:00.000Z',
}))]));
assert.ok(isStorageRecord(source.studentLife));
source.studentLife.letters = Array.from({ length: 1300 }, (_, index) => ({
  id: `synthetic-letter-${index}`, recipient: index % 23 + 1, senderLabel: '합성 교사', senderStudentNumber: null,
  title: '합성 검증', content: '외부 전송 없는 격리 자료'.repeat(10), createdAt: '2026-09-08T00:00:00.000Z', readAt: null,
}));
const harness = await startHttpHarness({ name: `storage_http_test_concurrent25_${process.pid}_${Date.now()}`, port: 0 });
const localFetch = globalThis.fetch;
const scopes = new Map<number, Record<string, unknown>>();
globalThis.fetch = async (input, init) => {
  const destination = new URL(input instanceof Request ? input.url : String(input));
  if (destination.port === String(harness.gatewayPort) && destination.pathname.endsWith('/storage_load_scope') && typeof init?.body === 'string') {
    const body: unknown = JSON.parse(init.body);
    if (isStorageRecord(body) && isStorageRecord(body.p_scope) && Array.isArray(body.p_scope.wallets)) {
      const student = body.p_scope.wallets[0];
      if (typeof student === 'number') scopes.set(student, body.p_scope);
    }
  }
  return localFetch(input, init);
};
const percentile = (values: number[], fraction: number) => Math.round([...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * fraction))] ?? 0);
const canonical = (input: unknown): unknown => {
  if (Array.isArray(input)) return input.map(canonical);
  if (!isStorageRecord(input)) return input;
  return Object.fromEntries(Object.keys(input).filter(key => key !== 'readMarker').sort().map(key => {
    const value = input[key];
    if (['resources', 'wallets', 'history', 'deletedKeys'].includes(key) && Array.isArray(value)) {
      return [key, value.map(canonical).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))];
    }
    return [key, canonical(value)];
  }));
};
const snapshots = async () => Promise.all(students.map(async student => {
  const result = await harness.query('select storage_load_scope($1) result', [scopes.get(student)]);
  return canonical(result.rows[0]?.result);
}));
const edgeScopes = [
  { resources: [], wallets: [], history: [], writeResources: [], writeWallets: [] },
  { resources: [{ path: '/studentLife' }, { path: '/studentLife/letters' }], wallets: [], history: [], writeResources: [], writeWallets: [] },
  { resources: [{ path: '/studentLife/letters', mail: { actor: 2, direction: 'participant' } }], wallets: [2], history: [2], writeResources: [], writeWallets: [] },
  { resources: [{ path: '/studentLife/letters', mail: { actor: 0, direction: 'recipient' } }], wallets: [], history: [], writeResources: [], writeWallets: [] },
  { resources: [{ path: '/studentEconomy', students: [1, 2] }, { path: '/studentEconomy', students: [2, 3] }], wallets: [1, 2, 3], history: [1, 2, 3], writeResources: [], writeWallets: [], revisionKeys: ['wallet:23'] },
];
const edgeSnapshots = async () => Promise.all(edgeScopes.map(async scope => canonical((await harness.query('select storage_load_scope($1) result', [scope])).rows[0]?.result)));
const metadataSnapshots = async () => Promise.all([...scopes.values(), ...edgeScopes].map(async scope =>
  canonical((await harness.query('select storage_load_scope_metadata($1) result', [scope])).rows[0]?.result)));
const measurePolling = async (label: string, cheap: boolean) => {
  process.env.STORAGE_SCOPED_POLLING = '1';
  const knownUpdatedAt = (await harness.query('select storage_load_updated_at() result')).rows[0]?.result;
  assert.equal(typeof knownUpdatedAt, 'string');
  const marker = cheap ? (await harness.query('select storage_load_read_marker() result')).rows[0]?.result : undefined;
  if (cheap) assert.ok(isStorageRecord(marker) && typeof marker.readMarker === 'string');
  harness.metrics.length = 0;
  const times: number[] = [];
  for (let round = 0; round < 5; round++) await Promise.all(actors.map(async actor => {
    const started = performance.now();
    const response = await fetch(`${harness.baseUrl}/api/shared-settings?metadata=1&scoped=1${cheap
      ? `&knownReadMarker=${isStorageRecord(marker) ? marker.readMarker : ''}` : ''}`, {
      headers: { Cookie: fixtureCookie(actor) }, signal: AbortSignal.timeout(15_000),
    });
    const body: unknown = await response.json();
    assert.equal(response.status, 200);
    assert.ok(isStorageRecord(body));
    assert.equal(body.updatedAt, knownUpdatedAt);
    if (actor) assert.equal(cheap ? body.unchanged : typeof body.readVersion === 'string', true);
    times.push(performance.now() - started);
  }));
  const result = { label, requests: times.length, p95Ms: percentile(times, .95),
    scopedMetadataCalls: harness.metrics.filter(item => item.rpc === 'storage_load_scope_metadata').length,
    timestampCalls: harness.metrics.filter(item => item.rpc === 'storage_load_updated_at').length,
    markerCalls: harness.metrics.filter(item => item.rpc === 'storage_load_read_marker').length };
  console.log(JSON.stringify(result));
  if (cheap) assert.equal(result.scopedMetadataCalls, 0);
};
const measure = async (label: string, rounds = 3, pauseMs = 0) => {
  harness.metrics.length = 0;
  const latencies: number[] = [], failures: string[] = [];
  for (let round = 0; round < rounds; round++) {
    await Promise.all(actors.map(async (student, client) => {
      const started = performance.now();
      try {
        const response = await fetch(`${harness.baseUrl}/api/shared-settings`, {
          headers: { Cookie: fixtureCookie(student), 'X-Storage-Projection': '1' }, signal: AbortSignal.timeout(15000),
        });
        const body: unknown = await response.json();
        assert.equal(response.status, 200, `client=${client}, status=${response.status}`);
        assert.ok(isStorageRecord(body) && isStorageRecord(body.value));
        if (student) {
          assert.deepEqual(Object.keys(body.value.currencyBalances ?? {}), [String(student)]);
          assert.deepEqual(Object.keys(body.value.currencyHistory ?? {}), [String(student)]);
          assert.ok(isStorageRecord(body.value.studentLife));
          assert.ok(Array.isArray(body.value.studentLife.letters));
          assert.ok(body.value.studentLife.letters.every((letter: unknown) => isStorageRecord(letter) && letter.recipient === student));
        }
      } catch (error) { failures.push(error instanceof Error ? error.message : 'unknown'); }
      latencies.push(performance.now() - started);
    }));
    if (pauseMs && round + 1 < rounds) await new Promise(resolve => setTimeout(resolve, pauseMs));
  }
  const result = { label, sessions: 25, rounds, requests: latencies.length, p50Ms: percentile(latencies, .5), p95Ms: percentile(latencies, .95),
    maxMs: Math.round(Math.max(...latencies)), errors: failures.length, failures,
    rpcCounts: Object.fromEntries([...new Set(harness.metrics.map(item => item.rpc))].map(rpc => [rpc, harness.metrics.filter(item => item.rpc === rpc && !item.code).length])),
    rpcLatency: Object.fromEntries([...new Set(harness.metrics.map(item => item.rpc))].map(rpc => {
      const values = harness.metrics.filter(item => item.rpc === rpc && item.milliseconds !== undefined).map(item => item.milliseconds ?? 0);
      return [rpc, { p50Ms: percentile(values, .5), p95Ms: percentile(values, .95) }];
    })),
    queryCount: harness.metrics.filter(item => !item.code).length,
  };
  console.log(JSON.stringify(result));
  assert.equal(failures.length, 0, JSON.stringify(result));
  return result;
};
try {
  const encoded = splitStorageState(source);
  await harness.query(`insert into storage_resources(resource_key,category,owner_number,value)
    select item->>'resource_key',item->>'category',(item->>'owner_number')::integer,item->'value'
    from jsonb_array_elements($1::jsonb) item on conflict do nothing`, [JSON.stringify(encoded.resources)]);
  await harness.query(`insert into wallet_ledger(resource_key,entry_id,student_number,delta,balance_before,balance_after,reason,created_at,operation_id,historical,sort_order,value)
    select item->>'resource_key',item->>'entry_id',(item->>'student_number')::integer,0,100,100,'합성 성능 검증',
      '2026-09-08T00:00:00Z'::timestamptz,'synthetic-opening',true,(item->>'sort_order')::double precision,item->'value'
    from jsonb_array_elements($1::jsonb) item`, [JSON.stringify(encoded.history)]);
  await harness.query('analyze storage_resources');
  await harness.query('analyze wallet_ledger');
  await harness.query('analyze wallet_accounts');
  const counts = (await harness.query('select (select count(*) from storage_resources) resources, (select count(*) from wallet_ledger) history')).rows[0];
  console.log(JSON.stringify({ database: harness.name, node: process.version, counts }));
  if (reuseReadVersion) await harness.query(baselinePollingSql);
  const baseline = await measure('baseline');
  assert.equal(scopes.size, 23);
  const before = await snapshots();
  const edgeBefore = await edgeSnapshots();
  const metadataBefore = pollingLoad ? await metadataSnapshots() : undefined;
  if (pollingLoad) await measurePolling('baseline-unchanged-polling', false);
  const baselineSql = reuseReadVersion ? baselinePollingSql : await readFile(new URL('../../supabase/storage_scoped_v2.sql', import.meta.url), 'utf8');
  const query = baselineSql.slice(baselineSql.indexOf('  with recursive selected'), baselineSql.indexOf('  return output;')).replace(' into output;', ';').replaceAll('p_scope', '$1::jsonb');
  const explain = async (sql: string, label: string) => {
    const result = await harness.query(`explain (analyze, buffers, format json) ${sql}`, [scopes.get(1)]);
    await writeFile(`/private/tmp/concurrent25-${label}-plan.json`, JSON.stringify(result.rows, null, 2));
  };
  await harness.query('set jit=off');
  if (!reuseReadVersion) await explain(query, 'baseline');
  if (!process.argv.includes('--baseline-only')) {
    const optimizedSql = reuseReadVersion ? pollingSql : await readFile(new URL('../../supabase/storage_scope_read_performance.sql', import.meta.url), 'utf8');
    await harness.query(optimizedSql);
    const after = await snapshots();
    assert.deepEqual(after, before, 'scope resources, history, wallet, revisions, ordering bounds and timestamp must match for all 23 students');
    assert.deepEqual(await edgeSnapshots(), edgeBefore, 'overlapping selectors, mailbox directions, multi-student scope and empty scope must match');
    if (pollingLoad) {
      const markerPermissions = (await harness.query(`select has_function_privilege('anon','storage_load_read_marker()','execute') anon,
        has_function_privilege('authenticated','storage_load_read_marker()','execute') authenticated,
        has_function_privilege('service_role','storage_load_read_marker()','execute') service_role,
        has_function_privilege('anon','storage_read_marker()','execute') helper_anon,
        has_function_privilege('authenticated','storage_read_marker()','execute') helper_authenticated`)).rows[0];
      assert.deepEqual(markerPermissions, { anon: false, authenticated: false, service_role: true, helper_anon: false, helper_authenticated: false });
      console.log(JSON.stringify({ markerPermissions }));
      assert.deepEqual(await metadataSnapshots(), metadataBefore, 'scoped metadata and full snapshot readVersion must remain identical');
      await measurePolling('optimized-unchanged-polling', true);
    }
    await assert.rejects(harness.query('select storage_load_scope($1)', [{ ...edgeScopes[0], wallets: [24] }]), /STORAGE_SCOPE_VIOLATION/);
    const optimizedQuery = optimizedSql.slice(optimizedSql.indexOf('  with recursive selected'), optimizedSql.indexOf('  return output;')).replace(' into output;', ';').replaceAll('p_scope', '$1::jsonb');
    if (!reuseReadVersion) await explain(optimizedQuery, 'optimized');
    const optimized = await measure('optimized');
    await harness.query(baselineSql);
    await harness.query('alter function public.storage_load_scope(jsonb) set jit=off');
    const reverted = await measure('baseline-repeat');
    await harness.query(optimizedSql);
    const repeat = await measure('optimized-repeat');
    const permissions = (await harness.query(`select has_function_privilege('anon','storage_load_scope(jsonb)','execute') anon,
      has_function_privilege('authenticated','storage_load_scope(jsonb)','execute') authenticated,
      has_function_privilege('service_role','storage_load_scope(jsonb)','execute') service_role`)).rows[0];
    assert.deepEqual(permissions, { anon: false, authenticated: false, service_role: true });
    console.log(JSON.stringify({ equalityAcross23Scopes: true, edgeScopesEquivalent: edgeScopes.length, invalidScopeRejected: true,
      arrayOrder: 'compared by resource identity; stored order and sort_order included', permissions,
      p95ImprovementPercent: Math.round((1 - (optimized.p95Ms + repeat.p95Ms) / (baseline.p95Ms + reverted.p95Ms)) * 100) }));
    if (pollingLoad) {
      await harness.query("update storage_resources set updated_at='2030-01-01T00:00:00Z' where resource_key='/scheduleNotice'");
      const beforeMarker = (await harness.query('select storage_load_read_marker() result')).rows[0]?.result;
      assert.ok(isStorageRecord(beforeMarker));
      const beforeVersions = await metadataSnapshots();
      const changed = await harness.query("update storage_resources set revision=revision+1,updated_at='2028-01-01T00:00:00Z' where resource_key='/studentEconomy/1' returning resource_key");
      assert.equal(changed.rows.length, 1);
      const afterMarker = (await harness.query('select storage_load_read_marker() result')).rows[0]?.result;
      assert.ok(isStorageRecord(afterMarker));
      assert.equal(afterMarker.updatedAt, beforeMarker.updatedAt);
      assert.notEqual(afterMarker.readMarker, beforeMarker.readMarker);
      const afterVersions = await metadataSnapshots();
      assert.notDeepEqual(afterVersions[0], beforeVersions[0]);
      assert.deepEqual(afterVersions[1], beforeVersions[1]);
      console.log(JSON.stringify({ lateCommitDetectedWithUnchangedTimestamp: true, otherStudentVersionPreserved: true }));
    }
    if (process.argv.includes('--soak')) await measure('optimized-soak', 60, 2_000);
  }
} finally {
  globalThis.fetch = localFetch;
  await harness.stop();
}
