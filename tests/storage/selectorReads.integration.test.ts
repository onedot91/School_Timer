import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fakeClassroom, fixtureCookie, startHttpHarness } from './httpHarness.js';
import { isStorageRecord, splitStorageState } from '../../src/lib/storageV2Codec.js';

const students = Array.from({ length: 23 }, (_, index) => index + 1);
const actors = [...students, 0, 0];
const functions = ['storage_load_scope', 'storage_scope_read_version'];
const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (!isStorageRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => {
    const field = value[key];
    return [key, ['resources', 'wallets', 'history', 'deletedKeys'].includes(key) && Array.isArray(field)
      ? field.map(canonical).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
      : canonical(field)];
  }));
};
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
];
const percentile = (values: number[], fraction: number) =>
  Math.round([...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * fraction))]);

test('selector migration preserves scoped reads and reduces repeated selector scans on real PostgreSQL', { timeout: 180_000 }, async () => {
  const artifactDir = resolve(process.env.STORAGE_SELECTOR_EVIDENCE_DIR ?? '.omo/evidence/storage-selector-reads');
  await mkdir(artifactDir, { recursive: true });
  const source = fakeClassroom();
  source.currencyHistory = Object.fromEntries(students.map(student => [String(student), Array.from({ length: 210 }, (_, index) => ({
    id: `synthetic-history-${student}-${index}`, studentNumber: student, delta: 0, before: 100, after: 100,
    reason: 'Synthetic selector verification', createdAt: '2026-09-08T00:00:00.000Z',
  }))]));
  assert.ok(isStorageRecord(source.studentLife));
  source.studentLife.letters = Array.from({ length: 800 }, (_, index) => ({
    id: `synthetic-letter-${index}`, recipient: index % 24, senderLabel: 'Synthetic teacher',
    senderStudentNumber: index % 5 === 0 ? 2 : null, title: 'Synthetic fixture', content: 'Disposable local fixture',
    createdAt: '2026-09-08T00:00:00.000Z', readAt: null,
  }));
  const harness = await startHttpHarness({ name: `storage_http_test_selectors_${process.pid}_${Date.now()}`, port: 0 });
  const localFetch = globalThis.fetch;
  const previousPolling = process.env.STORAGE_SCOPED_POLLING;
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
  const sql = (name: string) => readFile(new URL(`../../supabase/${name}.sql`, import.meta.url), 'utf8');
  const definitions = async () => (await harness.query(
    'select proname,pg_get_functiondef(oid) definition from pg_proc where pronamespace=\'public\'::regnamespace and proname=any($1::text[]) order by proname', [functions],
  )).rows.map(row => { assert.equal(typeof row.definition, 'string'); return String(row.definition); });
  const restore = async (bodies: string[]) => { for (const body of bodies) await harness.query(body); };
  const read = async (actor: number) => {
    const response = await fetch(`${harness.baseUrl}/api/shared-settings`, {
      headers: { Cookie: fixtureCookie(actor), 'X-Storage-Projection': '1' }, signal: AbortSignal.timeout(15_000),
    });
    assert.equal(response.status, 200);
    const body: unknown = await response.json();
    assert.ok(isStorageRecord(body) && isStorageRecord(body.value));
    if (actor) {
      assert.deepEqual(Object.keys(body.value.currencyBalances ?? {}), [String(actor)]);
      assert.deepEqual(Object.keys(body.value.currencyHistory ?? {}), [String(actor)]);
      assert.ok(isStorageRecord(body.value.studentLife) && Array.isArray(body.value.studentLife.letters));
      assert.ok(body.value.studentLife.letters.every(letter => isStorageRecord(letter) && (letter.recipient === actor || letter.senderStudentNumber === actor)));
    }
    return body;
  };
  const allScopes = () => [...students.map(student => scopes.get(student)), ...edgeScopes];
  const snapshots = async () => Promise.all(allScopes().map(async selected => {
    const row = (await harness.query('select storage_load_scope($1) snapshot,storage_load_scope_metadata($1) metadata', [selected])).rows[0];
    assert.ok(isStorageRecord(row.snapshot) && isStorageRecord(row.metadata));
    assert.deepEqual(row.metadata, { updatedAt: row.snapshot.updated_at, readVersion: row.snapshot.readVersion, readMarker: row.snapshot.readMarker });
    return canonical(row);
  }));
  const measure = async (label: string) => {
    harness.metrics.length = 0;
    const times: number[] = [];
    const studentTimes: number[] = [], teacherTimes: number[] = [];
    for (let round = 0; round < 3; round++) await Promise.all(actors.map(async actor => {
      const started = performance.now();
      await read(actor);
      const elapsed = performance.now() - started;
      times.push(elapsed);
      (actor ? studentTimes : teacherTimes).push(elapsed);
    }));
    const result = { label, sessions: 25, rounds: 3, requests: times.length, errors: 0,
      p50Ms: percentile(times, .5), p95Ms: percentile(times, .95), maxMs: Math.round(Math.max(...times)),
      studentP95Ms: percentile(studentTimes, .95), teacherP95Ms: percentile(teacherTimes, .95),
      rpcCounts: Object.fromEntries([...new Set(harness.metrics.map(metric => metric.rpc))].map(rpc => [rpc, harness.metrics.filter(metric => metric.rpc === rpc).length])),
    };
    console.log(JSON.stringify(result));
    return result;
  };
  const plan = async (label: string) => {
    const body = (await harness.query("select prosrc from pg_proc where oid='storage_load_scope(jsonb)'::regprocedure")).rows[0]?.prosrc;
    assert.equal(typeof body, 'string');
    const text = String(body);
    const start = text.indexOf('with recursive selected');
    const end = text.indexOf('), roots as (', start);
    assert.ok(start >= 0 && end > start);
    const query = text.slice(start, end).replaceAll('p_scope', '$1::jsonb') + ') select count(*) from selected';
    const result = (await harness.query(`explain (analyze, buffers, format json) ${query}`, [scopes.get(1)])).rows;
    await writeFile(resolve(artifactDir, `${label}-plan.json`), JSON.stringify(result, null, 2));
    const nodes = (value: unknown): Record<string, unknown>[] => Array.isArray(value) ? value.flatMap(nodes)
      : isStorageRecord(value) ? [...(value['Node Type'] ? [value] : []), ...Object.values(value).flatMap(nodes)] : [];
    return nodes(result).filter(node => node['Function Name'] === 'jsonb_array_elements').reduce((sum, node) => sum + Number(node['Actual Loops']), 0);
  };
  try {
    const encoded = splitStorageState(source);
    await harness.query(`insert into storage_resources(resource_key,category,owner_number,value)
      select item->>'resource_key',item->>'category',(item->>'owner_number')::integer,item->'value'
      from jsonb_array_elements($1::jsonb) item on conflict do nothing`, [JSON.stringify(encoded.resources)]);
    await harness.query(`insert into wallet_ledger(resource_key,entry_id,student_number,delta,balance_before,balance_after,reason,created_at,operation_id,historical,sort_order,value)
      select item->>'resource_key',item->>'entry_id',(item->>'student_number')::integer,0,100,100,'Synthetic selector verification',
        '2026-09-08T00:00:00Z'::timestamptz,'synthetic-opening',true,(item->>'sort_order')::double precision,item->'value'
      from jsonb_array_elements($1::jsonb) item`, [JSON.stringify(encoded.history)]);
    process.env.STORAGE_SCOPED_POLLING = '1';
    await harness.query(await sql('storage_scoped_polling'));
    await harness.query(await sql('storage_scope_history_read_performance'));
    await harness.query('analyze storage_resources; analyze wallet_ledger; analyze wallet_accounts');
    const baselineDefinitions = await definitions();
    await writeFile(resolve(artifactDir, 'baseline-functions.sql'), baselineDefinitions.join('\n'));
    await Promise.all(students.map(read));
    assert.equal(scopes.size, 23);
    const before = await snapshots();
    const beforeHttp = await Promise.all(students.map(read));
    const beforeLoops = await plan('baseline');
    const baseline = await measure('baseline');
    const migration = await sql('storage_selector_reads');
    await harness.query(migration);
    const optimizedDefinitions = await definitions();
    await harness.query(migration);
    assert.deepEqual(await definitions(), optimizedDefinitions, 'Migration must be idempotent');
    assert.deepEqual(await snapshots(), before, 'All 23 student scopes and edge scopes must preserve snapshots and metadata');
    assert.deepEqual(await Promise.all(students.map(read)), beforeHttp, 'HTTP projected output must match before migration');
    const afterLoops = await plan('optimized');
    assert.ok(afterLoops < beforeLoops, `Selector scans must decrease: ${beforeLoops} -> ${afterLoops}`);
    const optimized = await measure('optimized');
    const permissions = (await harness.query(`select proname,prosecdef,
      has_function_privilege('anon',oid,'execute') anon,has_function_privilege('authenticated',oid,'execute') authenticated,
      has_function_privilege('service_role',oid,'execute') service_role
      from pg_proc where pronamespace='public'::regnamespace and proname=any($1::text[]) order by proname`, [functions])).rows;
    for (const permission of permissions) assert.deepEqual(permission, { proname: permission.proname, prosecdef: true, anon: false, authenticated: false, service_role: true });
    await assert.rejects(harness.query('select storage_load_scope($1)', [{ ...scope(), wallets: [24] }]), /STORAGE_SCOPE_VIOLATION/);
    await harness.query("begin; set local role service_role; select storage_load_scope('{\"resources\":[],\"wallets\":[],\"history\":[],\"writeResources\":[],\"writeWallets\":[]}'::jsonb); rollback;");

    await harness.query("update storage_resources set updated_at='2030-01-01T00:00:00Z' where resource_key='/scheduleNotice'");
    const version = async (student: number) => (await harness.query('select storage_load_scope_metadata($1) result', [scopes.get(student)])).rows[0]?.result;
    const ownBefore = await version(1), otherBefore = await version(3);
    assert.ok(isStorageRecord(ownBefore) && isStorageRecord(otherBefore));
    const changed = await harness.query("update storage_resources set revision=revision+1,updated_at='2028-01-01T00:00:00Z' where resource_key='/studentEconomy/1' returning resource_key");
    assert.equal(changed.rows.length, 1);
    const ownAfter = await version(1), otherAfter = await version(3);
    assert.ok(isStorageRecord(ownAfter) && isStorageRecord(otherAfter));
    assert.equal(ownAfter.updatedAt, ownBefore.updatedAt);
    assert.notEqual(ownAfter.readVersion, ownBefore.readVersion);
    assert.equal(otherAfter.readVersion, otherBefore.readVersion);
    const deleted = await harness.query("update storage_resources set deleted=true,revision=revision+1 where value->>'parentKey'='/studentLife/letters' and value#>>'{data,recipient}'='1' returning resource_key");
    assert.ok(deleted.rows.length > 0);
    const ownDeleted = await version(1), otherDeleted = await version(3);
    assert.ok(isStorageRecord(ownDeleted) && isStorageRecord(otherDeleted));
    assert.notEqual(ownDeleted.readVersion, ownAfter.readVersion);
    assert.equal(otherDeleted.readVersion, otherAfter.readVersion);
    const deletedSnapshot = (await harness.query('select storage_load_scope($1) result', [scopes.get(1)])).rows[0]?.result;
    assert.ok(isStorageRecord(deletedSnapshot) && Array.isArray(deletedSnapshot.deletedKeys));
    for (const row of deleted.rows) assert.ok(deletedSnapshot.deletedKeys.includes(row.resource_key));
    const alteredSnapshots = await snapshots();
    await restore(baselineDefinitions);
    assert.deepEqual(await snapshots(), alteredSnapshots, 'Revision, late timestamp and tombstone outputs must match baseline');
    await harness.query(migration);
    for (const original of baselineDefinitions) {
      await restore(baselineDefinitions);
      const unknown = original.replace('where exists(select 1', 'where false and exists(select 1');
      assert.notEqual(unknown, original);
      await harness.query(unknown);
      const beforeGuard = await definitions();
      await assert.rejects(harness.query(migration), /VERSION_MISMATCH|SELECTOR/);
      await harness.query('rollback');
      assert.deepEqual(await definitions(), beforeGuard, 'Unknown body must abort without changing either function');
    }
    await restore(baselineDefinitions);
    await harness.query(migration);
    const result = { database: harness.name, fixtures: { students: 23, syntheticLetters: 800, ledgerEntries: 4830 },
      studentScopeEquivalence: 23, edgeScopeEquivalence: edgeScopes.length, httpProjectionEquivalence: 23,
      metadataMatchesFullSnapshot: true, idempotent: true, unknownBodyGuardAtomic: true,
      invalidScopeRejected: true, serviceRoleExecution: true, permissions,
      lateRevisionDetected: true, ownTombstoneDetected: true, otherStudentVersionPreserved: true,
      selectorFunctionLoops: { before: beforeLoops, after: afterLoops }, baseline, optimized,
      p95ImprovementPercent: Math.round((1 - optimized.p95Ms / baseline.p95Ms) * 100),
      timingThreshold: 'No machine-dependent timing threshold; query plan loop reduction is asserted',
    };
    await writeFile(resolve(artifactDir, 'results.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  } finally {
    globalThis.fetch = localFetch;
    if (previousPolling === undefined) delete process.env.STORAGE_SCOPED_POLLING; else process.env.STORAGE_SCOPED_POLLING = previousPolling;
    await harness.stop();
  }
});
