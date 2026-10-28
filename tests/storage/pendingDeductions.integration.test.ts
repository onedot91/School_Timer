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
  assert.ok(isStorageRecord(balances()));
  assert.equal(load(own()).value.currencyBalances && JSON.stringify(load(own()).value.currencyBalances), '{"14":2}');
  assert.equal(economy().pendingDeductions.length, 1);
  assert.equal(JSON.stringify(load(own()).value).includes('isolated-private-fixture'), false);
  assert.ok(isStorageRecord(read(queued.sql)));
  assert.equal(economy().pendingDeductions.length, 1);
  command('teacher.currency.adjust', { studentNumbers: [14], amount: 5 }, 'credit-5');
  assert.equal(economy().pendingDeductions.length, 1);
  const paid = command('teacher.currency.adjust', { studentNumbers: [14], amount: 5 }, 'credit-5-again');
  const paidSnapshot = parseScopedStorageSnapshot(paid.result.snapshot);
  assert.equal(paidSnapshot.wallets[0]?.balance, 2);
  assert.equal(economy().pendingDeductions.length, 0);
  assert.equal(query("select count(*) from wallet_ledger where student_number=14 and reason='teacher_deduction';"), '1');
  assert.deepEqual(read("select value->'data' from storage_resources where resource_key='/studentEconomy/3';"), source.studentEconomy['3']);

  command('teacher.currency.deduct', { studentNumbers: [14], amount: 10, teacherReason: 'concurrent', deferIfInsufficient: true }, 'queue-concurrent');
  const credits = [1, 2].map(index => `select storage_apply_wallet_delta(14,'concurrent-${index}',5,'weekly_mission',now(),'concurrent-${index}');`);
  const responses = await Promise.all(credits.map(sql => run('psql', [...cli(), '-c', sql])));
  assert.equal(responses.length, 2);
  assert.equal(economy().pendingDeductions.length, 0);
  assert.equal(query('select balance from wallet_accounts where student_number=14;'), '2');
  assert.equal(query("select count(*) from wallet_ledger where student_number=14 and reason='teacher_deduction';"), '2');
  query(credits[0]);
  assert.equal(query('select balance from wallet_accounts where student_number=14;'), '2');

  command('teacher.currency.deduct', { studentNumbers: [14], amount: 20, teacherReason: 'oldest', deferIfInsufficient: true }, 'queue-oldest');
  command('teacher.currency.deduct', { studentNumbers: [14], amount: 10, teacherReason: 'newer', deferIfInsufficient: true }, 'queue-newer');
  query("select storage_apply_wallet_delta(14,'small-reward',10,'weekly_mission',now(),'small-reward');");
  assert.equal(query('select balance from wallet_accounts where student_number=14;'), '12');
  assert.deepEqual(economy().pendingDeductions.map(item => item.amount), [20, 10]);
  query("select storage_apply_wallet_delta(14,'large-reward',18,'weekly_mission',now(),'large-reward');");
  assert.equal(query('select balance from wallet_accounts where student_number=14;'), '0');
  assert.equal(economy().pendingDeductions.length, 0);

  command('teacher.currency.deduct', { studentNumbers: [14], amount: 10, teacherReason: 'deposit-fixture', deferIfInsufficient: true }, 'queue-deposit');
  const depositState = { ...economy(), deposit: 12, deposits: [{ id: 'fixture-deposit', principal: 12, interest: 1, openedOn: '2026-10-14', maturityDate: '2026-10-21' }] };
  const scope = storageCommandScope('teacher.currency.deduct', { studentNumbers: [14] }, { role: 'teacher', expiresAt: 0 });
  const snapshot = load(scope);
  const args = buildScopedStorageMutation({ snapshot, value: { ...snapshot.value, studentEconomy: { '14': depositState } }, actorKey: 'teacher:0', requestId: 'deposit-fixture', action: 'teacher.fixture', payload: {}, result: null });
  const depositResult = read(`select storage_commit_scoped_and_load(${Object.entries(args).map(([key, value]) => `${key} => ${typeof value === 'string' ? literal(value) : value === null ? 'null' : json(value)}`).join(',')},p_result_scope => ${json(scope)});`);
  assert.ok(isStorageRecord(depositResult));
  assert.equal(depositResult.saved, true);
  assert.equal(economy().deposit, 2);
  assert.equal(economy().deposits[0]?.interest, 0);
  assert.equal(economy().pendingDeductions.length, 0);
  assert.equal(query("select delta from wallet_ledger where entry_id like 'currency-economy-pending-%-14' order by recorded_at desc limit 1;"), '0');
  command('teacher.currency.deduct', { studentNumbers: [14], amount: 10, teacherReason: 'investment-fixture', deferIfInsufficient: true }, 'queue-investment');
  const investmentSnapshot = load(scope);
  const investmentState = { ...economy(), investments: { sunny: { investedAmount: 20, currentAmount: 12, lastSettledDateKey: '2026-10-14', lastChangeAmount: 4, lastStage: 'rise' } } };
  const investmentArgs = buildScopedStorageMutation({ snapshot: investmentSnapshot, value: { ...investmentSnapshot.value, studentEconomy: { '14': investmentState } }, actorKey: 'teacher:0', requestId: 'investment-fixture', action: 'teacher.fixture', payload: {}, result: null });
  const investmentResult = read(`select storage_commit_scoped_and_load(${Object.entries(investmentArgs).map(([key, value]) => `${key} => ${typeof value === 'string' ? literal(value) : value === null ? 'null' : json(value)}`).join(',')},p_result_scope => ${json(scope)});`);
  assert.ok(isStorageRecord(investmentResult));
  assert.equal(investmentResult.saved, true);
  assert.equal(economy().pendingDeductions.length, 0);
  assert.equal(economy().deposit, 0);
  assert.equal(economy().investments.sunny?.currentAmount, 4);
  assert.equal(economy().investments.sunny?.investedAmount, 7);
  assert.equal(economy().investments.sunny?.lastChangeAmount, 1);
  assert.match(JSON.stringify(load(own()).value.studentLife), /증권사 투자금/);
  // Reset disposable investment fixture before the independent weekly-reward scenario.
  const resetSnapshot = load(scope);
  const resetArgs = buildScopedStorageMutation({ snapshot: resetSnapshot, value: { ...resetSnapshot.value, studentEconomy: { '14': { ...economy(), deposit: 2, deposits: [{ id: 'fixture-deposit', principal: 2, interest: 0, openedOn: '2026-10-14', maturityDate: '2026-10-21' }], investments: {} } } }, actorKey: 'teacher:0', requestId: 'investment-reset', action: 'teacher.fixture', payload: {}, result: null });
  read(`select storage_commit_scoped_and_load(${Object.entries(resetArgs).map(([key, value]) => `${key} => ${typeof value === 'string' ? literal(value) : value === null ? 'null' : json(value)}`).join(',')},p_result_scope => ${json(scope)});`);
  command('teacher.currency.deduct', { studentNumbers: [14], amount: 10, teacherReason: 'weekly-reward', deferIfInsufficient: true }, 'queue-weekly-reward');
  const reward = read("select claim_weekly_mission_reward_v2(14,'2026-10','personal_question','fixture-question',2);");
  assert.ok(isStorageRecord(reward));
  assert.equal(reward.balance, 5);
  assert.equal(reward.awarded, true);
  assert.equal(economy().pendingDeductions.length, 0);
  const repeatedReward = read("select claim_weekly_mission_reward_v2(14,'2026-10','personal_question','fixture-question',2);");
  assert.ok(isStorageRecord(repeatedReward));
  assert.equal(repeatedReward.awarded, false);
  assert.equal(repeatedReward.balance, 5);
  assert.deepEqual(read('select storage_reconcile_wallets();'), []);
  assert.equal(query("select has_function_privilege('anon','storage_settle_pending_deductions(integer)','execute');"), 'f');
  query('select storage_set_maintenance(true);');
  assert.throws(() => query("select storage_apply_wallet_delta(14,'paused',5,'weekly_mission',now(),'paused');"), /STORAGE_MAINTENANCE/);
});
