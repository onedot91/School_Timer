import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildBootstrapRequest, runStorageCutover, validateCutoverSnapshot } from './storageCutover.js';
import { isStorageRecord, splitStorageState } from '../src/lib/storageV2Codec.js';

const env = { SUPABASE_URL: 'https://cutover-test.invalid', SUPABASE_SERVICE_ROLE_KEY: 'fixture-secret-never-output' };
const source = () => ({ id: 'school-timer-main', updated_at: '2026-09-08T01:00:00.000Z', value: { currencyBalances: Object.fromEntries(Array.from({ length: 23 }, (_, index) => [index + 1, 100 + index])), currencyHistory: { 17: [{ id: 'recovered-id', studentNumber: 17, delta: 6, before: 110, after: 116, reason: 'weekly_mission', createdAt: '2026-09-08T00:00:00.000Z' }] }, rawFutureField: { preserve: null }, studentLife: { books: [], letters: [{ id: 'mail', content: 'private-fixture-text' }] } } });
const fixture = () => {
  let main = source();
  let encoded = splitStorageState(main.value);
  let active = false;
  let maintenance = false;
  const tables: Record<string, Record<string, unknown>[]> = { weekly_mission_rewards: Array.from({ length: 1005 }, (_, index) => ({ student_number: index % 23 + 1, week_key: String(index), mission_type: 'quiz', reward_amount: 6 })) };
  const requests: { path: string; body: unknown }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const name = url.pathname.split('/').at(-1) ?? '';
    const body: unknown = init?.body ? JSON.parse(String(init.body)) : {};
    requests.push({ path: name, body });
    if (name === 'storage_control') return Response.json([{ active, maintenance }]);
    if (name === 'app_settings') return Response.json([main]);
    if (name === 'storage_load_snapshot') return Response.json({ ...encoded, revisions: {}, updated_at: main.updated_at });
    if (name === 'storage_reconcile_wallets') return Response.json([]);
    if (name === 'storage_set_maintenance') {
      assert.ok(isStorageRecord(body));
      maintenance = body.p_maintenance === true;
      if (typeof body.p_active === 'boolean') active = body.p_active;
      return Response.json({ active, maintenance });
    }
    if (name === 'storage_bootstrap') {
      assert.ok(isStorageRecord(body));
      assert.deepEqual(body, buildBootstrapRequest(main));
      encoded = splitStorageState(main.value);
      return Response.json({ migrated: true, verified: true, wallets: 23 });
    }
    const offset = Number(url.searchParams.get('offset') ?? '0');
    return Response.json((tables[name] ?? []).slice(offset, offset + 1000));
  };
  return { fetcher, requests, tables, control: () => ({ active, maintenance }), corruptProjection: () => { encoded = splitStorageState({ ...main.value, rawFutureField: { preserve: 'changed' } }); }, changeSource: () => { main = { ...main, updated_at: '2026-09-08T01:01:00.000Z' }; } };
};
const inDirectory = async (action: (directory: string) => Promise<void>) => {
  const parent = await mkdtemp(join(tmpdir(), 'storage-cutover-test-'));
  try { await action(join(parent, 'backup')); } finally { await rm(parent, { recursive: true, force: true }); }
};
const run = (mock: ReturnType<typeof fixture>, args: string[]) => runStorageCutover(args, { fetcher: mock.fetcher, env });

test('help and missing execute never contact a backend or require secrets', async () => {
  assert.equal(typeof (await runStorageCutover(['--help'], { env: {} })).help, 'string');
  const mock = fixture();
  await assert.rejects(run(mock, ['pause']), { code: 'CUTOVER_EXECUTE_REQUIRED' });
  assert.equal(mock.requests.length, 0);
});

test('backup is private lossless and paginates beyond the 1000 row PostgREST page', async () => inDirectory(async directory => {
  const mock = fixture();
  await run(mock, ['pause', '--execute']);
  const result = await run(mock, ['backup', '--backup-dir', directory]);
  assert.equal(JSON.stringify(result).includes('private-fixture-text'), false);
  assert.equal(JSON.stringify(result).includes(env.SUPABASE_SERVICE_ROLE_KEY), false);
  assert.equal((await stat(directory)).mode & 0o077, 0);
  assert.equal((await stat(join(directory, 'main.json'))).mode & 0o077, 0);
  const preserved: unknown = JSON.parse(await readFile(join(directory, 'weekly_mission_rewards.json'), 'utf8'));
  assert.ok(Array.isArray(preserved));
  assert.equal(preserved.length, 1005);
  assert.deepEqual(JSON.parse(await readFile(join(directory, 'main.json'), 'utf8')), source());
}));

test('migration and activation stay paused; only verified reopen clears maintenance', async () => inDirectory(async directory => {
  const mock = fixture();
  await run(mock, ['pause', '--execute']);
  await run(mock, ['backup', '--backup-dir', directory]);
  await run(mock, ['migrate', '--backup-dir', directory, '--execute']);
  assert.deepEqual(mock.control(), { active: false, maintenance: true });
  await run(mock, ['activate', '--backup-dir', directory, '--execute']);
  assert.deepEqual(mock.control(), { active: true, maintenance: true });
  await run(mock, ['reopen', '--backup-dir', directory, '--execute']);
  assert.deepEqual(mock.control(), { active: true, maintenance: false });
  assert.equal(mock.requests.filter(request => request.path === 'storage_bootstrap').length, 1);
}));

test('raw projection mismatch never activates or reopens storage', async () => inDirectory(async directory => {
  const mock = fixture();
  await run(mock, ['pause', '--execute']);
  await run(mock, ['backup', '--backup-dir', directory]);
  mock.corruptProjection();
  await assert.rejects(run(mock, ['activate', '--backup-dir', directory, '--execute']), { code: 'CUTOVER_PROJECTION_MISMATCH' });
  await assert.rejects(run(mock, ['reopen', '--backup-dir', directory, '--execute']), { code: 'CUTOVER_PROJECTION_MISMATCH' });
  assert.deepEqual(mock.control(), { active: false, maintenance: true });
}));

test('tampered backup and changed source both block bootstrap', async () => inDirectory(async directory => {
  const mock = fixture();
  await run(mock, ['pause', '--execute']);
  await run(mock, ['backup', '--backup-dir', directory]);
  mock.changeSource();
  await assert.rejects(run(mock, ['migrate', '--backup-dir', directory, '--execute']), { code: 'CUTOVER_SOURCE_CHANGED' });
  await writeFile(join(directory, 'main.json'), JSON.stringify({ ...source(), value: {} }));
  await assert.rejects(run(mock, ['migrate', '--backup-dir', directory, '--execute']), { code: 'CUTOVER_BACKUP_HASH_MISMATCH' });
  assert.equal(mock.requests.filter(request => request.path === 'storage_bootstrap').length, 0);
}));

test('preserved reward IDs cannot disappear between backup and reopen', async () => inDirectory(async directory => {
  const mock = fixture();
  await run(mock, ['pause', '--execute']);
  await run(mock, ['backup', '--backup-dir', directory]);
  mock.tables.weekly_mission_rewards.pop();
  await assert.rejects(run(mock, ['activate', '--backup-dir', directory, '--execute']), { code: 'CUTOVER_RECORD_MISMATCH_WEEKLY_MISSION_REWARDS' });
  assert.deepEqual(mock.control(), { active: false, maintenance: true });
}));

test('transport-independent builders preserve repaired history and reject missing wallets or ledger discrepancy', () => {
  const main = source();
  const payload = buildBootstrapRequest(main);
  assert.deepEqual(payload.p_source, main.value);
  const snapshot = { ...splitStorageState(main.value), revisions: {}, updated_at: main.updated_at };
  assert.equal(validateCutoverSnapshot(main, snapshot, []).wallets, 23);
  assert.throws(() => validateCutoverSnapshot(main, snapshot, [{ studentNumber: 17 }]), { code: 'CUTOVER_LEDGER_MISMATCH' });
  assert.throws(() => buildBootstrapRequest({ ...main, value: { currencyBalances: { 1: 0 } } }), { code: 'CUTOVER_INCOMPLETE_WALLETS' });
});
