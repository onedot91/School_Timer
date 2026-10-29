import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile, execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { applyTeacherStorageCommand } from '../../src/server/teacherStorageCommands.js';
import { storageCommandScope } from '../../src/server/storageCommandScope.js';
import { buildScopedStorageMutation, parseScopedStorageSnapshot } from '../../src/server/storageV2Repository.js';
import { splitStorageState, isStorageRecord } from '../../src/lib/storageV2Codec.js';
import { createStudentEconomyState, getStudentEconomyState, normalizeStudentEconomyStates } from '../../src/lib/studentEconomy.js';

const run = promisify(execFile);
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
const json = (value: unknown) => `${literal(JSON.stringify(value))}::jsonb`;
const enabled = process.env.STORAGE_PENDING_PSQL_TEST === '1';

test('real PostgreSQL: pending deductions are atomic, private, FIFO, idempotent and safe under concurrent rewards', { skip: !enabled, timeout: 60000 }, async () => {
  const host = process.env.PGHOST;
  assert.ok(host?.startsWith('/private/tmp/school-pending-pg.'), 'Only this task\'s disposable Unix-socket fixture is allowed');
  const database = `pending_fixture_${process.pid}_${Date.now()}`;
  const cli = (db = database) => ['-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-h', host, '-p', process.env.PGPORT ?? '55487', '-U', 'postgres', '-d', db];
  const query = (sql: string, db = database) => execFileSync('psql', cli(db), { input: sql, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }).trim();
  const read = (sql: string): unknown => JSON.parse(query(sql));
  query(`create database ${database};`, 'postgres');
  query("do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if; end $$;", 'postgres');
  for (const file of ['app_settings.sql', 'classword.sql', 'library_competition.sql', 'storage_v2.sql', 'storage_scoped_v2.sql', 'storage_rewards_v2.sql', 'storage_command_round_trips.sql', 'storage_pending_deductions.sql']) {
    query(await readFile(new URL(`../../supabase/${file}`, import.meta.url), 'utf8'));
  }
  query(await readFile(new URL('../../supabase/storage_pending_deductions.sql', import.meta.url), 'utf8'));
  const createdAt = '2026-10-14T00:00:00.000Z';
  const source = {
    currencyBalances: Object.fromEntries(Array.from({ length: 23 }, (_, i) => [String(i + 1), i === 13 ? 2 : 100])), currencyHistory: {},
    studentEconomy: { '14': createStudentEconomyState(), '3': { deposit: 777, opaque: [9, null] } },
    studentLife: { letters: [{ id: 'other-private', recipient: 3, content: 'isolated-private-fixture' }] },
    opaque: { keep: [9, null] },
  };
  const encoded = splitStorageState(source);
  query(`insert into app_settings(id,value,updated_at) values('school-timer-main',${json(source)},${literal(createdAt)});
    select storage_set_maintenance(true);
    select storage_bootstrap(${literal(createdAt)},${json(source)},${json(encoded.resources)},${json(encoded.wallets)},${json(encoded.history)});
    select storage_set_maintenance(false,true);`);
  const load = (scope: unknown) => parseScopedStorageSnapshot(read(`select storage_load_scope(${json(scope)});`));
  const command = (action: string, payload: Record<string, unknown>, requestId: string) => {
    const scope = storageCommandScope(action, payload, { role: 'teacher', expiresAt: 0 });
    const snapshot = load(scope);
    const mutation = applyTeacherStorageCommand(snapshot.value, action, payload, { requestId, createdAt });
    assert.ok(mutation);
    const args = buildScopedStorageMutation({ snapshot, value: mutation.value, actorKey: 'teacher:0', requestId, action, payload, result: mutation.result });
    const sql = `select storage_commit_scoped_and_load(${Object.entries(args).map(([key, value]) => `${key} => ${typeof value === 'string' ? literal(value) : value === null ? 'null' : json(value)}`).join(',')},p_result_scope => ${json(scope)});`;
    const result = read(sql);
    assert.ok(isStorageRecord(result));
    assert.equal(result.saved, true);
    return { result, sql, scope };
  };
  const own = (number = 14) => ({ resources: [{ path: `/studentEconomy/${number}` }, { path: '/studentLife/letters', mail: { actor: number, direction: 'recipient' } }], wallets: [number], history: [number], writeResources: [], writeWallets: [] });
  const balances = () => read('select jsonb_object_agg(student_number,balance) from wallet_accounts;');
  const economy = () => getStudentEconomyState(normalizeStudentEconomyStates(load(own()).value.studentEconomy), 14);

  const queued = command('teacher.currency.deduct', { studentNumbers: [13, 14], amount: 10, teacherReason: 'fixture', deferIfInsufficient: true }, 'queue-group');
  assert.equal(query('select balance from wallet_accounts where student_number=14;'), '0');
  assert.deepEqual(economy().pendingDeductions.map(item => item.amount), [8]);
  assert.ok(isStorageRecord(read(queued.sql)));
  assert.deepEqual(economy().pendingDeductions.map(item => item.amount), [8]);
  assert.equal(JSON.stringify(load(own()).value).includes('isolated-private-fixture'), false);
  command('teacher.currency.adjust', { studentNumbers: [14], amount: 5 }, 'correct-5');
  assert.deepEqual(economy().pendingDeductions.map(item => item.amount), [3]);
  assert.equal(query('select balance from wallet_accounts where student_number=14;'), '0');
  query("select storage_apply_wallet_delta(14,'reward-2',2,'weekly_mission',now(),'reward-2');");
  assert.deepEqual(economy().pendingDeductions.map(item => item.amount), [1]);
  assert.equal(query('select balance from wallet_accounts where student_number=14;'), '0');
  query("select storage_apply_wallet_delta(14,'reward-2',2,'weekly_mission',now(),'reward-2');");
  assert.deepEqual(economy().pendingDeductions.map(item => item.amount), [1]);
  const credits = [1, 2].map(index => `select storage_apply_wallet_delta(14,'concurrent-${index}',5,'weekly_mission',now(),'concurrent-${index}');`);
  const responses = await Promise.all(credits.map(sql => run('psql', [...cli(), '-c', sql])));
  assert.equal(responses.length, 2);
  assert.equal(economy().pendingDeductions.length, 0);
  assert.equal(query('select balance from wallet_accounts where student_number=14;'), '9');
  query(credits[0]);
  assert.equal(query('select balance from wallet_accounts where student_number=14;'), '9');
  command('teacher.currency.deduct', { studentNumbers: [14], amount: 20, teacherReason: 'oldest', deferIfInsufficient: true }, 'queue-oldest');
  command('teacher.currency.deduct', { studentNumbers: [14], amount: 10, teacherReason: 'newer', deferIfInsufficient: true }, 'queue-newer');
  assert.deepEqual(economy().pendingDeductions.map(item => item.amount), [11, 10]);
  query("select storage_apply_wallet_delta(14,'small-reward',5,'weekly_mission',now(),'small-reward');");
  assert.deepEqual(economy().pendingDeductions.map(item => item.amount), [6, 10]);
  assert.equal(query('select balance from wallet_accounts where student_number=14;'), '0');
  query("select storage_apply_wallet_delta(14,'large-reward',30,'weekly_mission',now(),'large-reward');");
  assert.equal(query('select balance from wallet_accounts where student_number=14;'), '14');
  assert.equal(economy().pendingDeductions.length, 0);
  assert.deepEqual(read("select value->'data' from storage_resources where resource_key='/studentEconomy/3';"), source.studentEconomy['3']);
  command('teacher.currency.deduct', { studentNumbers: [14], amount: 20, teacherReason: 'assets', deferIfInsufficient: true }, 'queue-assets');
  assert.deepEqual(economy().pendingDeductions.map(item => item.amount), [6]);
  const assetScope = storageCommandScope('teacher.currency.deduct', { studentNumbers: [14] }, { role: 'teacher', expiresAt: 0 });
  const assetSnapshot = load(assetScope);
  const assets = { ...economy(), deposit: 2,
    deposits: [{ id: 'fixture-deposit', principal: 2, interest: 0, openedOn: '2026-10-14', maturityDate: '2026-10-21' }],
    investments: { sunny: { investedAmount: 3, currentAmount: 3, lastSettledDateKey: '2026-10-14', lastChangeAmount: 0, lastStage: 'rise' } } };
  const assetArgs = buildScopedStorageMutation({ snapshot: assetSnapshot, value: { ...assetSnapshot.value, studentEconomy: { '14': assets } }, actorKey: 'teacher:0', requestId: 'asset-fixture', action: 'teacher.fixture', payload: {}, result: null });
  read(`select storage_commit_scoped_and_load(${Object.entries(assetArgs).map(([key, value]) => `${key} => ${typeof value === 'string' ? literal(value) : value === null ? 'null' : json(value)}`).join(',')},p_result_scope => ${json(assetScope)});`);
  assert.equal(economy().deposit, 0);
  assert.equal(economy().investments.sunny, undefined);
  assert.deepEqual(economy().pendingDeductions.map(item => item.amount), [1]);
  query("select storage_apply_wallet_delta(14,'last-reward',1,'weekly_mission',now(),'last-reward');");
  assert.equal(economy().pendingDeductions.length, 0);
  assert.equal(query('select balance from wallet_accounts where student_number=14;'), '0');
  // Simulate a pending item created by the old whole-amount implementation.
  query("select storage_apply_wallet_delta(14,'legacy-assets',3,'weekly_mission',now(),'legacy-assets');");
  query(`select storage_write_resource(resource_key, category, owner_number,
    jsonb_set(value, '{data,pendingDeductions}', ${json([{ id: 'legacy-14', settlementRequestId: 'pending-legacy', amount: 10, teacherReason: 'fixture', createdAt }])}))
    from storage_resources where resource_key='/studentEconomy/14';`);
  query(await readFile(new URL('../../supabase/settle_existing_pending_deductions.sql', import.meta.url), 'utf8'));
  assert.equal(query('select balance from wallet_accounts where student_number=14;'), '0');
  assert.deepEqual(economy().pendingDeductions.map(item => item.amount), [7]);
  query(await readFile(new URL('../../supabase/settle_existing_pending_deductions.sql', import.meta.url), 'utf8'));
  assert.deepEqual(economy().pendingDeductions.map(item => item.amount), [7]);
  assert.deepEqual(read('select storage_reconcile_wallets();'), []);
  assert.equal(query("select has_function_privilege('anon','storage_settle_pending_deductions(integer)','execute');"), 'f');
  query('select storage_set_maintenance(true);');
  assert.throws(() => query("select storage_apply_wallet_delta(14,'paused',5,'weekly_mission',now(),'paused');"), /STORAGE_MAINTENANCE/);
});
