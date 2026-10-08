import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
import { fakeClassroom, startHttpHarness } from './httpHarness.js';
import { isStorageRecord, splitStorageState } from '../../src/lib/storageV2Codec.js';
import { buildStorageMutation, parseStorageSnapshot } from '../../src/server/storageV2Repository.js';

const sql = (name: string) => readFile(new URL(`../../supabase/${name}.sql`, import.meta.url), 'utf8');
const students = Array.from({ length: 23 }, (_, index) => index + 1);
type Rows = { rows: Record<string, unknown>[] };
type Connection = { query(text: string, values?: unknown[]): Promise<Rows>; end(): Promise<void> };
const connect = async (database: string): Promise<Connection> => {
  const driver: unknown = createRequire(import.meta.url)(process.env.STORAGE_TEST_PG_MODULE ?? '/tmp/school-storage-runtime/node_modules/pg/lib/index.js');
  assert.ok(isStorageRecord(driver) && typeof driver.Client === 'function');
  const client: unknown = Reflect.construct(driver.Client, [{ host: '127.0.0.1', port: Number(process.env.STORAGE_TEST_PG_PORT ?? 55439), user: 'postgres', database }]);
  assert.ok(isStorageRecord(client) && typeof client.connect === 'function' && typeof client.query === 'function' && typeof client.end === 'function');
  await client.connect();
  const query = client.query.bind(client), end = client.end.bind(client);
  return { query: async (text, values) => {
    const result: unknown = await query(text, values);
    assert.ok(isStorageRecord(result) && Array.isArray(result.rows) && result.rows.every(isStorageRecord));
    return { rows: result.rows };
  }, end: async () => { await end(); } };
};

test('snapshot execution preserves complete data and audit MVCC attributes without temp spills', { timeout: 60_000 }, async () => {
  const h = await startHttpHarness({ name: `storage_http_test_execution_${process.pid}_${Date.now()}`, port: 0 });
  try {
    await h.query(await sql('storage_concurrency_rollback'));
    const source = fakeClassroom();
    source.currencyHistory = Object.fromEntries(students.map(student => [student, Array.from({ length: 210 }, (_, index) => ({
      id: `synthetic-${student}-${index}`, studentNumber: student, delta: 0, before: 100, after: 100,
      reason: 'Synthetic concurrency fixture', createdAt: '2026-09-08T00:00:00Z',
    }))]));
    const encoded = splitStorageState(source);
    await h.query(`insert into wallet_ledger(resource_key,entry_id,student_number,delta,balance_before,balance_after,reason,created_at,operation_id,historical,sort_order,value)
      select item->>'resource_key',item->>'entry_id',(item->>'student_number')::integer,0,100,100,'Synthetic concurrency fixture',
      '2026-09-08T00:00:00Z'::timestamptz,'synthetic-opening',true,(item->>'sort_order')::double precision,item->'value'
      from jsonb_array_elements($1::jsonb) item`, [JSON.stringify(encoded.history)]);
    await h.query('analyze wallet_ledger');
    const read = async () => (await h.query("select storage_load_snapshot() snapshot, storage_reward_audit_source()-'checkedAt' audit")).rows[0];
    const measure = async () => {
      const results = [];
      for (const name of ['storage_load_snapshot', 'storage_reward_audit_source']) {
        for (let sample = 0; sample < 5; sample++) {
          const row = (await h.query(`explain (analyze,buffers,format json) select ${name}()`)).rows[0];
          const plan = row['QUERY PLAN'];
          assert.ok(Array.isArray(plan) && isStorageRecord(plan[0]) && isStorageRecord(plan[0].Plan));
          results.push({ name, ms: Number(plan[0]['Execution Time']), tempWritten: Number(plan[0].Plan['Temp Written Blocks'] ?? 0) });
        }
      }
      return results;
    };
    const before = await read(), baseline = await measure();
    const migration = await sql('storage_snapshot_execution');
    await h.query(migration);
    await h.query(migration);
    assert.deepEqual(await read(), before, 'All fields, history, revisions and audit results must be preserved');
    const after = await measure();
    assert.ok(baseline.some(result => result.tempWritten > 0));
    assert.ok(after.every(result => result.tempWritten === 0));
    const permissions = (await h.query(`select proname,provolatile,prosecdef,
      has_function_privilege('anon',oid,'execute') anon,has_function_privilege('authenticated',oid,'execute') authenticated,
      has_function_privilege('service_role',oid,'execute') service_role
      from pg_proc where proname in ('storage_load_snapshot','storage_reward_audit_source')`)).rows;
    for (const row of permissions) assert.deepEqual(row, { proname: row.proname, provolatile: 's', prosecdef: true, anon: false, authenticated: false, service_role: true });
    await h.query(await sql('storage_concurrency_rollback'));
    assert.deepEqual(await read(), before);
    console.log(JSON.stringify({ snapshotExecution: { historyEntries: 4830, baseline, after } }));
  } finally { await h.stop(); }
});

test('ancestor locks allow independent categories and still block parent replacement and duplicate writes', { timeout: 30_000 }, async () => {
  const initial = { ...fakeClassroom(), fixtureAlpha: { value: 1 }, fixtureBeta: { value: 1 }, fixtureScalar: 'guard', fixtureDeleted: {} };
  const h = await startHttpHarness({ name: `storage_http_test_ancestors_${process.pid}_${Date.now()}`, port: 0, initialValue: initial });
  const first = await connect(h.name), second = await connect(h.name);
  const firstPid = (await first.query('select pg_backend_pid() pid')).rows[0].pid;
  const secondPid = (await second.query('select pg_backend_pid() pid')).rows[0].pid;
  const snapshot = parseStorageSnapshot((await h.query('select storage_load_snapshot() value')).rows[0].value);
  const mutation = (category: 'fixtureAlpha' | 'fixtureBeta', id: string) => buildStorageMutation({
    snapshot, value: { ...initial, [category]: { value: 2 } }, actorKey: 'teacher', requestId: id,
    action: 'fixture', payload: { category }, result: { saved: true },
  });
  const alpha = mutation('fixtureAlpha', 'alpha'), beta = mutation('fixtureBeta', 'beta');
  assert.ok(isStorageRecord(alpha.p_expected));
  const commit = async (client: Connection, payload: Record<string, unknown>) => (await client.query(
    'select storage_commit_mutation($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) result',
    ['p_expected','p_resources','p_wallets','p_ledger','p_actor_key','p_request_id','p_payload_hash','p_action','p_result','p_archive']
      .map(key => typeof payload[key] === 'object' && payload[key] !== null ? JSON.stringify(payload[key]) : payload[key] ?? null),
  )).rows[0].result;
  const waitBlocked = async () => {
    for (let attempt = 0; attempt < 100; attempt++) {
      const row = (await h.query('select cardinality(pg_blocking_pids($1)) count', [secondPid])).rows[0];
      if (Number(row.count) > 0) return;
      await delay(10);
    }
    assert.fail('Expected an actual PostgreSQL lock wait');
  };
  try {
    await h.query(await sql('storage_concurrency_rollback'));
    await first.query('begin'); await second.query('begin');
    await commit(first, alpha);
    const blocked = commit(second, beta);
    await waitBlocked();
    await first.query('rollback');
    assert.ok(isStorageRecord(await blocked));
    await second.query('rollback');

    const migration = await sql('storage_ancestor_locks');
    await h.query(migration); await h.query(migration);
    await h.query("update storage_resources set deleted=true where resource_key='/fixtureDeleted'");
    await first.query('begin');
    await commit(first, { ...alpha, p_expected: { ...alpha.p_expected,
      '/fixtureBeta': snapshot.revisions['/fixtureBeta'], '/fixtureScalar': snapshot.revisions['/fixtureScalar'],
      '/fixtureDeleted': snapshot.revisions['/fixtureDeleted'], '/fixtureAbsent': 0 } });
    for (const [key, mode] of [['', 'ShareLock'], ['/fixtureAlpha', 'ShareLock'], ['/fixtureAlpha/value', 'ExclusiveLock'],
      ['/fixtureBeta', 'ExclusiveLock'], ['/fixtureScalar', 'ExclusiveLock'], ['/fixtureDeleted', 'ExclusiveLock'], ['/fixtureAbsent', 'ExclusiveLock']]) {
      const locks = (await h.query(`select mode from pg_locks where pid=$1 and locktype='advisory'
        and classid=((hashtextextended('resource:'||$2,0)>>32)&4294967295)::oid
        and objid=(hashtextextended('resource:'||$2,0)&4294967295)::oid`, [firstPid, key])).rows;
      assert.ok(locks.some(lock => lock.mode === mode), `${key} must retain ${mode}`);
    }
    await first.query('rollback');
    await first.query('begin'); await second.query('begin');
    await second.query("set local lock_timeout='1s'");
    await commit(first, alpha);
    const independent = await commit(second, beta);
    assert.ok(isStorageRecord(independent) && independent.saved === true);
    await first.query('rollback'); await second.query('rollback');

    const root = snapshot.resources?.find(resource => resource.resource_key === '');
    assert.ok(root);
    const parent = { ...alpha, p_request_id: 'parent', p_expected: { '': snapshot.revisions[''], '/fixtureAlpha/value': snapshot.revisions['/fixtureAlpha/value'] },
      p_resources: [{ ...root, value: { kind: 'array', parentKey: null, member: null, order: null } }] };
    for (const [leader, follower] of [[alpha, parent], [parent, alpha], [alpha, { ...alpha, p_request_id: 'same-leaf' }]]) {
      await first.query('begin'); await second.query('begin');
      await commit(first, leader);
      const pending = commit(second, follower);
      await waitBlocked();
      await first.query('commit');
      const result = await pending;
      assert.ok(isStorageRecord(result) && result.saved === false, 'Changed parent/leaf revision must reject stale write');
      await second.query('rollback');
      await h.query("update storage_resources set value=$1,revision=$2 where resource_key=''", [root.value, snapshot.revisions['']]);
      await h.query("update storage_resources set value=jsonb_set(value,'{data}','1'),revision=$1 where resource_key='/fixtureAlpha/value'", [snapshot.revisions['/fixtureAlpha/value']]);
      await h.query("delete from storage_receipts where actor_key='teacher'");
    }
    assert.deepEqual((await h.query('select storage_reconcile_wallets() value')).rows[0].value, []);
    await h.query(await sql('storage_concurrency_rollback'));
  } finally {
    await first.query('rollback'); await second.query('rollback');
    await first.end(); await second.end(); await h.stop();
  }
});
