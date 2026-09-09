import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { fixtureCookie, startHttpHarness } from './httpHarness.js';

const harness = await startHttpHarness({ name: `storage_http_test_metadata_${process.pid}_${Date.now()}`, port: 0 });
const scope = { resources: [], wallets: [], history: [], writeResources: [], writeWallets: [] };
const percentile = (values: number[], fraction: number) => Math.round([...values].sort((a, b) => a - b)[Math.floor(values.length * fraction)]);
try {
  await harness.query(`insert into storage_resources(resource_key,category,owner_number,value,revision)
    select '/benchmark/'||n,'benchmark',null,jsonb_build_object('kind','value','parentKey','/benchmark','member',n::text,'data',repeat('fixture',80)),1
    from generate_series(1,5000) n`);
  await harness.query('alter function public.storage_load_scope(jsonb) reset jit');
  const measure = async (query: string, values: readonly unknown[] = []) => {
    const times: number[] = [];
    for (let round = 0; round < 3; round++) {
      await Promise.all(Array.from({ length: 24 }, async () => {
        const started = performance.now();
        await harness.query(query, values);
        times.push(performance.now() - started);
      }));
    }
    return { p50Ms: percentile(times, .5), p95Ms: percentile(times, .95), maxMs: Math.round(Math.max(...times)) };
  };
  const before = await measure('select storage_load_scope($1)', [scope]);
  await harness.query(await readFile(new URL('../../supabase/storage_read_performance.sql', import.meta.url), 'utf8'));
  const after = await measure('select storage_load_updated_at()');
  const expected = (await harness.query('select storage_load_scope($1) result', [scope])).rows[0]?.result;
  assert.ok(expected && typeof expected === 'object' && 'updated_at' in expected);
  const expectedTimestamp = expected.updated_at;
  harness.metrics.length = 0;
  const started = performance.now();
  const results = await Promise.all(Array.from({ length: 24 }, async (_, actor) => {
    const response = await fetch(`${harness.baseUrl}/api/shared-settings?metadata=1`, { headers: { Cookie: fixtureCookie(actor) } });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.updatedAt, expectedTimestamp);
    return response.status;
  }));
  const anonymous = await fetch(`${harness.baseUrl}/api/shared-settings?metadata=1`);
  assert.equal(anonymous.status, 401);
  assert.ok(harness.metrics.every(metric => metric.rpc === 'storage_load_updated_at'));
  assert.ok(harness.metrics.length < 24);
  const metadataReads = harness.metrics.length;
  const metadataHttpMs = Math.round(performance.now() - started);
  harness.metrics.length = 0;
  await Promise.all(Array.from({ length: 24 }, async (_, actor) => {
    const response = await fetch(`${harness.baseUrl}/api/shared-settings`, { headers: { Cookie: fixtureCookie(actor) } });
    assert.equal(response.status, 200);
    const body = await response.json();
    if (actor !== 0) assert.deepEqual(Object.keys(body.value.currencyBalances), [String(actor)]);
  }));
  assert.ok(harness.metrics.every(metric => metric.rpc === 'storage_load_snapshot'));
  assert.ok(harness.metrics.length < 24);
  const fullReads = harness.metrics.length;
  for (const change of [
    "update storage_resources set updated_at=clock_timestamp()+interval '1 second' where resource_key=''",
    "update wallet_accounts set updated_at=clock_timestamp()+interval '2 seconds' where student_number=1",
    "update storage_control set updated_at=clock_timestamp()+interval '3 seconds' where singleton",
  ]) {
    await harness.query(change);
    const result = await harness.query('select storage_load_updated_at() = (storage_load_scope($1)->\'updated_at\') equal', [scope]);
    assert.equal(result.rows[0]?.equal, true);
  }
  assert.ok(after.p95Ms < before.p95Ms, JSON.stringify({ before, after }));
  const permissions = await harness.query(`select has_function_privilege('anon','storage_load_updated_at()','execute') anon,
    has_function_privilege('authenticated','storage_load_updated_at()','execute') authenticated,
    has_function_privilege('service_role','storage_load_updated_at()','execute') service_role`);
  assert.deepEqual(permissions.rows[0], { anon: false, authenticated: false, service_role: true });
  console.log(JSON.stringify({ database: harness.name, sessions: 24, rounds: 3, syntheticResources: 5000, before, after,
    http: { milliseconds: metadataHttpMs, statuses: results, metadataReads, fullReads },
    timestampEquivalent: true, permissions: permissions.rows[0] }, null, 2));
} finally { await harness.stop(); }
