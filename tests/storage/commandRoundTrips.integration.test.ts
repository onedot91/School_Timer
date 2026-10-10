import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fixtureCookie, startHttpHarness } from './httpHarness.js';
import { isStorageRecord } from '../../src/lib/storageV2Codec.js';

test('combined commands preserve transaction visibility, replay, scope and permissions', async () => {
  const h = await startHttpHarness({ name: `storage_http_test_commands_${process.pid}_${Date.now()}`, port: 0 });
  const original = process.env.STORAGE_COMBINED_COMMANDS;
  try {
    for (const file of ['storage_scoped_polling', 'storage_scope_history_read_performance', 'storage_scoped_read_execution', 'storage_snapshot_execution', 'storage_ancestor_locks']) {
      await h.query(await readFile(new URL(`../../supabase/${file}.sql`, import.meta.url), 'utf8'));
    }
    const sql = await readFile(new URL('../../supabase/storage_command_round_trips.sql', import.meta.url), 'utf8');
    const functions = async () => (await h.query("select oid::regprocedure::text identity,md5(prosrc) body_hash,proconfig from pg_proc where pronamespace='public'::regnamespace and proname not in ('storage_prepare_command','storage_commit_scoped_and_load') order by identity")).rows;
    const before = await functions();
    await h.query(sql);
    await h.query(sql);
    assert.deepEqual(await functions(), before);
    const permissions = (await h.query("select proname,provolatile,prosecdef,proconfig,has_function_privilege('anon',oid,'execute') anon,has_function_privilege('authenticated',oid,'execute') authenticated,has_function_privilege('service_role',oid,'execute') service_role from pg_proc where proname in ('storage_prepare_command','storage_commit_scoped_and_load') order by proname")).rows;
    assert.equal(permissions.length, 2);
    for (const row of permissions) {
      assert.equal(row.anon, false); assert.equal(row.authenticated, false); assert.equal(row.service_role, true); assert.equal(row.prosecdef, true);
      assert.deepEqual(row.proconfig, ['search_path=pg_catalog, public', 'jit=off']);
      assert.equal(row.provolatile, row.proname === 'storage_prepare_command' ? 's' : 'v');
    }
    process.env.STORAGE_COMBINED_COMMANDS = '1';
    const request = async (student: number, id: string, amount = 10) => {
      const response = await fetch(`${h.baseUrl}/api/student-economy`, { method: 'POST', headers: { Cookie: fixtureCookie(student), 'sec-fetch-site': 'same-origin', 'Content-Type': 'application/json', 'X-Storage-Projection': '1' }, body: JSON.stringify({ protocolVersion: 2, studentNumber: student, requestId: id, action: { type: 'deposit', amount } }) });
      const body: unknown = await response.json();
      assert.ok(isStorageRecord(body));
      return { status: response.status, body };
    };
    h.metrics.length = 0;
    const first = await request(1, 'combined-one');
    assert.equal(first.status, 200, JSON.stringify(first.body)); assert.equal(first.body.balance, 90);
    assert.deepEqual(h.metrics.map(row => row.rpc), ['storage_prepare_command', 'storage_commit_scoped_and_load']);
    assert.ok(isStorageRecord(first.body.storagePatch));
    assert.ok(Array.isArray(first.body.storagePatch.wallets));
    assert.deepEqual(first.body.storagePatch.wallets.map(row => { assert.ok(isStorageRecord(row)); return [row.student_number, row.balance]; }), [[1, 90]]);
    h.metrics.length = 0;
    const replay = await request(1, 'combined-one');
    assert.equal(replay.status, 200); assert.equal(replay.body.balance, 90);
    assert.deepEqual(h.metrics.map(row => row.rpc), ['storage_prepare_command']);
    assert.equal((await request(1, 'combined-one', 20)).status, 409);
    assert.equal((await request(2, 'combined-one')).body.balance, 90);
    const concurrent = await Promise.all(Array.from({ length: 8 }, () => request(3, 'combined-concurrent')));
    assert.ok(concurrent.every(row => row.status === 200), JSON.stringify(concurrent));
    assert.equal((await h.query('select balance from wallet_accounts where student_number=3')).rows[0]?.balance, 90);
    assert.equal((await h.query("select count(*)::integer count from storage_receipts where request_id='combined-concurrent'")).rows[0]?.count, 1);
    const scope = { resources: [], wallets: [1], history: [1], writeResources: [], writeWallets: [1] };
    const receiptActor = (await h.query("select actor_key from storage_receipts where request_id='combined-one' order by actor_key limit 1")).rows[0]?.actor_key;
    assert.equal(typeof receiptActor, 'string');
    const walletIds = (prepared: unknown) => {
      assert.ok(isStorageRecord(prepared) && isStorageRecord(prepared.snapshot) && Array.isArray(prepared.snapshot.wallets));
      return prepared.snapshot.wallets.map(row => { assert.ok(isStorageRecord(row)); return row.student_number; });
    };
    const otherScope = { ...scope, wallets: [2], history: [2], writeWallets: [2] };
    assert.deepEqual(walletIds((await h.query('select storage_prepare_command($1,$2,$3) result', [receiptActor, 'combined-one', otherScope])).rows[0]?.result), [1]);
    assert.deepEqual(walletIds((await h.query('select storage_prepare_command($1,$2,$3,$4) result', [receiptActor, 'combined-one', scope, otherScope])).rows[0]?.result), [2]);
    await h.query("update storage_receipts set scope=null where actor_key=$1 and request_id='combined-one'", [receiptActor]);
    assert.deepEqual(walletIds((await h.query('select storage_prepare_command($1,$2,$3) result', [receiptActor, 'combined-one', otherScope])).rows[0]?.result), [2]);
    const award = () => fetch(`${h.baseUrl}/api/shared-settings`, { method: 'POST', headers: { Cookie: fixtureCookie(0), 'sec-fetch-site': 'same-origin', 'Content-Type': 'application/json', 'X-Storage-Projection': '1' }, body: JSON.stringify({ protocolVersion: 2, requestId: 'combined-reward-once', action: 'teacher.currency.adjust', payload: { studentNumbers: [5], amount: 6 } }) });
    const rewards = await Promise.all(Array.from({ length: 8 }, async () => { const response = await award(); const body: unknown = await response.json(); assert.equal(response.status, 200, JSON.stringify(body)); return body; }));
    assert.equal(rewards.length, 8);
    assert.equal((await h.query('select balance from wallet_accounts where student_number=5')).rows[0]?.balance, 106);
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch(`${h.baseUrl}/api/student-economy`, { method: 'POST', headers: { Cookie: fixtureCookie(6), 'sec-fetch-site': 'same-origin', 'Content-Type': 'application/json', 'X-Storage-Projection': '1' }, body: JSON.stringify({ protocolVersion: 2, studentNumber: 6, requestId: 'combined-transfer', action: { type: 'transfer', amount: 20, recipientNumber: 7, dateKey: '2026-10-10' } }) });
      const body: unknown = await response.json();
      assert.equal(response.status, 200, JSON.stringify(body));
      assert.ok(isStorageRecord(body) && isStorageRecord(body.storagePatch));
      assert.deepEqual(walletIds({ snapshot: body.storagePatch }), [6]);
      assert.deepEqual(body.storagePatch.historyStudents, [6]);
    }
    assert.equal((await h.query('select balance from wallet_accounts where student_number=7')).rows[0]?.balance, 120);
    const conflict = (await h.query("select storage_commit_scoped_and_load($1,'[]','[]','[]','student:1','combined-conflict',$2,'test','{}',null,$3) result", [{ 'wallet:1': -1 }, 'a'.repeat(64), scope])).rows[0]?.result;
    assert.ok(isStorageRecord(conflict)); assert.equal(conflict.saved, false); assert.equal('snapshot' in conflict, false);
    await h.query('select storage_set_maintenance(true)');
    assert.equal((await request(4, 'combined-maintenance')).status, 503);
    await h.query('select storage_set_maintenance(false)');
    assert.deepEqual((await h.query('select storage_reconcile_wallets() result')).rows[0]?.result, []);
    console.log(JSON.stringify({ permissions, normalRpcCount: 2, replayRpcCount: 1, concurrentRequests: 8, concurrentDebit: 10, concurrentReward: 6, ownWriteVisible: true, storedScopeAndFallback: true, explicitReplayScope: true, conflictSnapshotAbsent: true, reconciliation: [] }));
  } finally {
    if (original === undefined) delete process.env.STORAGE_COMBINED_COMMANDS; else process.env.STORAGE_COMBINED_COMMANDS = original;
    await h.stop();
  }
});
