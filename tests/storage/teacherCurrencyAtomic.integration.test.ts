import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile, execFileSync } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import handler from '../../api/shared-settings.js';
import { createDeviceSessionToken } from '../../src/server/deviceSession.js';
import { splitStorageState, isStorageRecord } from '../../src/lib/storageV2Codec.js';
import { createStudentEconomyState } from '../../src/lib/studentEconomy.js';

const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
const json = (value: unknown) => `${literal(JSON.stringify(value))}::jsonb`;

test('real PostgreSQL: one-call teacher grants and sets match the general path, replay and reject changed balances', {
  skip: process.env.STORAGE_AUCTION_PSQL_TEST !== '1', timeout: 60000,
}, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'school-teacher-currency-'));
  const invoke = (program: string, args: string[], input?: string) => execFileSync(program, args, {
    input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024,
  });
  invoke('initdb', ['-D', `${directory}/data`, '-U', 'postgres', '-A', 'trust', '--no-locale', '--encoding=UTF8']);
  invoke('pg_ctl', ['-D', `${directory}/data`, '-l', `${directory}/postgres.log`, '-o', `-F -h '' -k ${directory} -p 55489`, '-w', 'start']);
  const args = ['-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-h', directory, '-p', '55489', '-U', 'postgres', '-d', 'postgres'];
  const query = (sql: string) => invoke('psql', args, sql).trim();
  const asyncQuery = (sql: string): Promise<unknown> => new Promise((resolve, reject) => {
    const child = execFile('psql', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr)); else { try { resolve(JSON.parse(stdout.trim())); } catch (error) { reject(error); } }
    });
    child.stdin?.end(sql);
  });
  const previousEnv = { ...process.env }, previousFetch = globalThis.fetch;
  try {
    query('create role anon; create role authenticated; create role service_role;');
    for (const file of ['app_settings.sql', 'classword.sql', 'library_competition.sql', 'storage_v2.sql',
      'storage_scoped_v2.sql', 'storage_rewards_v2.sql', 'storage_command_round_trips.sql', 'storage_pending_deductions.sql', 'storage_teacher_currency.sql']) {
      query(await readFile(new URL(`../../supabase/${file}`, import.meta.url), 'utf8'));
    }
    const contracts = () => query("select jsonb_agg(jsonb_build_array(proname,md5(prosrc),proconfig) order by proname,oid) from pg_proc where pronamespace='public'::regnamespace;");
    const beforeReapply = contracts();
    query(await readFile(new URL('../../supabase/storage_teacher_currency.sql', import.meta.url), 'utf8'));
    assert.equal(contracts(), beforeReapply);
    const at = '2026-10-30T00:00:00.000Z';
    const studentsWithHistory = Array.from({ length: 22 }, (_, index) => index + 1);
    const source = {
      currencyBalances: Object.fromEntries(Array.from({ length: 23 }, (_, index) => [index + 1, 1000])),
      currencyHistory: Object.fromEntries(studentsWithHistory.map(number => [number, [{ id: `seed-${number}`, studentNumber: number,
        delta: 0, before: 1000, after: 1000, reason: 'manual', createdAt: at }]])),
      studentEconomy: Object.fromEntries(Array.from({ length: 23 }, (_, index) => [index + 1, createStudentEconomyState()])),
      studentLife: { letters: [] },
      retained: 'synthetic untouched data',
    };
    const encoded = splitStorageState(source);
    query(`insert into app_settings(id,value,updated_at) values('school-timer-main',${json(source)},${literal(at)});
      select storage_set_maintenance(true);
      select storage_bootstrap(${literal(at)},${json(source)},${json(encoded.resources)},${json(encoded.wallets)},${json(encoded.history)});
      select storage_set_maintenance(false,true);`);
    const secret = 'teacher-currency-test-only-secret-at-least-32-bytes';
    Object.assign(process.env, { SUPABASE_URL: 'https://teacher-currency.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic',
      DEVICE_SESSION_SECRET: secret, STORAGE_PROTOCOL_VERSION: '2', STORAGE_COMBINED_COMMANDS: '1', STORAGE_ATOMIC_TEACHER_CURRENCY: '1' });
    let calls: string[] = [];
    let loseResponse = false;
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input)); assert.equal(url.origin, 'https://teacher-currency.invalid');
      const rpc = url.pathname.split('/').at(-1) ?? '';
      calls.push(rpc);
      const body: unknown = JSON.parse(String(init?.body)); assert.ok(isStorageRecord(body));
      const parameters = Object.entries(body).map(([key, value]) => {
        assert.match(key, /^p_[a-z_]+$/);
        return `${key} => ${value === null ? 'null' : typeof value === 'string' ? literal(value) : json(value)}`;
      }).join(',');
      let output: unknown;
      try { output = await asyncQuery(`select public.${rpc}(${parameters});`); }
      catch (error) {
        const code = error instanceof Error ? /STORAGE_[A-Z_]+/.exec(error.message)?.[0] : undefined;
        if (!code) throw error;
        return Response.json({ message: code }, { status: 400 });
      }
      if (rpc === 'storage_teacher_currency' && loseResponse) { loseResponse = false; throw new TypeError('synthetic lost response'); }
      return Response.json(output);
    };
    const call = async (id: string, action: string, payload: Record<string, unknown>) => {
      calls = [];
      let status = 0, body: unknown;
      const headers: Record<string, string> = {};
      const response = { setHeader(name: string, value: string) { headers[name] = value; }, status(value: number) { status = value; return this; }, json(value: unknown) { body = value; } };
      const token = createDeviceSessionToken({ role: 'teacher' }, secret);
      await handler({ method: 'POST', headers: { cookie: `__Host-school-timer-device=${token}`, 'sec-fetch-site': 'same-origin', 'x-storage-projection': '1' },
        body: { protocolVersion: 2, requestId: id, action, payload } }, response);
      return { status, body, headers, calls: [...calls] };
    };
    const balance = (student: number) => Number(query(`select balance from wallet_accounts where student_number=${student};`));
    const entry = (id: string) => JSON.parse(query(`select value from wallet_ledger where entry_id=${literal(id)};`) || 'null');

    const granted = await call('atomic-grant-0001', 'teacher.currency.adjust', { studentNumbers: [2, 1, 2], amount: 5 });
    assert.equal(granted.status, 200);
    assert.deepEqual(granted.calls, ['storage_teacher_currency']);
    assert.match(granted.headers['Server-Timing'] ?? '', /desc="1 RPC"/);
    assert.deepEqual([balance(1), balance(2), balance(3)], [1005, 1005, 1000]);
    const value = isStorageRecord(granted.body) && isStorageRecord(granted.body.value) ? granted.body.value : {};
    assert.deepEqual(value.currencyBalances, { 1: 1005, 2: 1005 });
    assert.equal(entry('teacher-atomic-grant-0001-1')?.data.reason, 'bulk_adjust');

    // The general path must write the same history shape for the same command.
    process.env.STORAGE_ATOMIC_TEACHER_CURRENCY = '0';
    const legacy = await call('legacy-grant-0001', 'teacher.currency.adjust', { studentNumbers: [4], amount: 5 });
    assert.equal(legacy.status, 200);
    assert.ok(legacy.calls.length >= 2);
    process.env.STORAGE_ATOMIC_TEACHER_CURRENCY = '1';
    assert.equal((await call('atomic-grant-0002', 'teacher.currency.adjust', { studentNumbers: [5], amount: 5 })).status, 200);
    const shape = (row: { data: Record<string, unknown>; parentKey: string; member: string; kind: string }) => ({
      kind: row.kind, parentKey: row.parentKey.replace(/\d+$/, 'N'), member: row.member.replace(/^@.*$/, '@ID'),
      data: { ...row.data, id: 'ID', studentNumber: 'N', createdAt: typeof row.data.createdAt === 'string' && Number.isFinite(Date.parse(row.data.createdAt)) ? 'ISO' : row.data.createdAt },
    });
    assert.deepEqual(shape(entry('teacher-atomic-grant-0002-5')), shape(entry('teacher-legacy-grant-0001-4')));

    // A lost response is answered from the receipt without a second grant.
    loseResponse = true;
    assert.equal((await call('atomic-grant-replay', 'teacher.currency.adjust', { studentNumbers: [6], amount: 7 })).status, 502);
    const replay = await call('atomic-grant-replay', 'teacher.currency.adjust', { studentNumbers: [6], amount: 7 });
    assert.equal(replay.status, 200);
    assert.deepEqual(replay.calls, ['storage_teacher_currency']);
    assert.equal(balance(6), 1007);
    assert.equal((await call('atomic-grant-replay', 'teacher.currency.adjust', { studentNumbers: [6], amount: 8 })).status, 409);

    const changed = await call('atomic-set-stale', 'teacher.currency.set', { studentNumbers: [7], amount: 300, expectedBalance: 999 });
    assert.deepEqual([changed.status, changed.body], [409, { error: 'CURRENCY_BALANCE_CHANGED', businessRejected: true }]);
    assert.equal(balance(7), 1000);
    const set = await call('atomic-set-fresh', 'teacher.currency.set', { studentNumbers: [7], amount: 300, expectedBalance: 1000 });
    assert.deepEqual([set.status, set.calls], [200, ['storage_teacher_currency']]);
    assert.equal(balance(7), 300);
    assert.equal(entry('teacher-atomic-set-fresh-7')?.data.reason, 'manual');

    // Clamped and unchanged balances write no history row.
    assert.equal((await call('atomic-set-maximum', 'teacher.currency.set', { studentNumbers: [8], amount: 999999, expectedBalance: 1000 })).status, 200);
    assert.equal((await call('atomic-grant-at-max', 'teacher.currency.adjust', { studentNumbers: [8], amount: 10 })).status, 200);
    assert.equal(balance(8), 999999);
    assert.equal(entry('teacher-atomic-grant-at-max-8'), null);

    // Deductions and students without a history container keep the general path.
    const deduction = await call('legacy-deduct-0001', 'teacher.currency.adjust', { studentNumbers: [9], amount: -5 });
    assert.equal(deduction.status, 200, JSON.stringify(deduction.body));
    assert.ok(!deduction.calls.includes('storage_teacher_currency'));
    const fresh = await call('fallback-grant-0001', 'teacher.currency.adjust', { studentNumbers: [23], amount: 5 });
    assert.equal(fresh.status, 200);
    assert.deepEqual(fresh.calls.slice(0, 2), ['storage_teacher_currency', 'storage_prepare_command']);
    assert.equal(balance(23), 1005);

    // A grant to a student with queued teacher deductions keeps the general path, which cancels them first.
    const pending = () => JSON.parse(query("select coalesce(value#>'{data,pendingDeductions}','[]') from storage_resources where resource_key='/studentEconomy/14';"))
      .map((item: { amount: number }) => item.amount);
    assert.equal((await call('atomic-set-low-0001', 'teacher.currency.set', { studentNumbers: [14], amount: 2, expectedBalance: 1000 })).status, 200);
    const queuedResult = await call('legacy-queue-0001', 'teacher.currency.deduct', { studentNumbers: [14], amount: 10, teacherReason: 'fixture', deferIfInsufficient: true });
    assert.equal(queuedResult.status, 200, JSON.stringify(queuedResult.body));
    assert.deepEqual([balance(14), pending()], [0, [8]]);
    const settled = await call('atomic-settle-0001', 'teacher.currency.adjust', { studentNumbers: [14], amount: 5 });
    assert.deepEqual([settled.status, settled.calls.slice(0, 2)], [200, ['storage_teacher_currency', 'storage_prepare_command']]);
    assert.deepEqual([balance(14), pending()], [0, [3]]);
    const settledValue = isStorageRecord(settled.body) && isStorageRecord(settled.body.value) ? settled.body.value : {};
    assert.deepEqual(settledValue.currencyBalances, { 14: 0 });

    const concurrent = await Promise.all(Array.from({ length: 6 }, (_, index) => call(`atomic-concurrent-${index}`, 'teacher.currency.adjust', { studentNumbers: [10, 11], amount: 1 })));
    assert.deepEqual(concurrent.map(result => result.status), Array(6).fill(200));
    assert.deepEqual([balance(10), balance(11)], [1006, 1006]);

    assert.deepEqual(JSON.parse(query('select storage_reconcile_wallets();')), []);
    assert.equal(JSON.parse(query("select value->'data' from storage_resources where resource_key='/retained';")), source.retained);
    for (const role of ['anon', 'authenticated']) assert.equal(query(`select has_function_privilege('${role}','storage_teacher_currency(jsonb)','execute');`), 'f');
    assert.equal(query("select has_function_privilege('service_role','storage_teacher_currency(jsonb)','execute');"), 't');
  } finally {
    globalThis.fetch = previousFetch; process.env = previousEnv;
    invoke('pg_ctl', ['-D', `${directory}/data`, '-m', 'fast', '-w', 'stop']);
  }
});
