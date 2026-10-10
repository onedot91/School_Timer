import assert from 'node:assert/strict';
import test from 'node:test';
import sharedSettings from '../../api/shared-settings.js';
import studentEconomy from '../../api/student-economy.js';
import { createDeviceSessionToken } from '../../src/server/deviceSession.js';
import { isStorageRecord } from '../../src/lib/storageV2Codec.js';
import { createStudentEmotionEntry } from '../../src/lib/studentEmotion.js';
import { createStorageV2Fixture } from './storageV2Fixture.js';

const secret = 'combined-commands-local-fixture-secret-only';
const initial = () => ({ version: 1, scheduleNotice: 'original',
  currencyBalances: { 2: 100, 4: 333 }, currencyHistory: { 2: [], 4: [{ id: 'preserved', delta: 0, before: 333, after: 333 }] },
  studentEconomy: { 2: { deposit: 0 }, 4: { deposit: 7, extra: null } },
  studentEmotionHistory: { 4: [createStudentEmotionEntry(4, 'calm', '격리 기록', new Date('2026-10-08T02:00:00Z'))] },
  studentLife: { letters: [{ id: 'private', recipient: 4, senderStudentNumber: 0, senderLabel: '합성', title: '격리', content: '격리', createdAt: new Date().toISOString(), readAt: null }], books: [], failureStories: [], failureProfileAssignments: {} },
});

const environment = async (run: (context: {
  fixture: ReturnType<typeof createStorageV2Fixture>; calls: string[];
  invoke: (route: 'shared' | 'economy', actor: number, body?: unknown, query?: Record<string, string>) => Promise<{ status: number; body: unknown }>;
}) => Promise<void>) => {
  const savedEnv = { ...process.env }, originalFetch = globalThis.fetch;
  Object.assign(process.env, { SUPABASE_URL: 'https://combined-fixture.test', SUPABASE_SERVICE_ROLE_KEY: 'local-fixture',
    DEVICE_SESSION_SECRET: secret, STORAGE_PROTOCOL_VERSION: '2', STORAGE_COMBINED_COMMANDS: '1' });
  const fixture = createStorageV2Fixture(initial()), calls: string[] = [];
  globalThis.fetch = async (input, init) => { calls.push(new URL(String(input)).pathname.split('/').at(-1) ?? ''); return fixture.fetch(input, init); };
  const invoke = async (route: 'shared' | 'economy', actor: number, body?: unknown, query?: Record<string, string>) => {
    let status = 0, output: unknown;
    const response = { setHeader() {}, status(code: number) { status = code; return this; }, json(value: unknown) { output = value; } };
    const token = createDeviceSessionToken(actor ? { role: 'student', studentNumber: actor } : { role: 'teacher' }, secret);
    await (route === 'shared' ? sharedSettings : studentEconomy)({ method: body ? 'POST' : 'GET', body, query,
      headers: { cookie: `__Host-school-timer-device=${token}`, 'sec-fetch-site': 'same-origin', 'x-storage-projection': '1' } }, response);
    return { status, body: output };
  };
  try { await run({ fixture, calls, invoke }); }
  finally { globalThis.fetch = originalFetch; process.env = savedEnv; }
};

test('combined student scoped GET → save preserves other students, null fields and edit conflicts in two RPC trips', t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-09T02:00:00Z') });
  return environment(async ({ fixture, calls, invoke }) => {
    process.env.STORAGE_REQUIRE_EDIT_REVISIONS = '1';
    const other = structuredClone(fixture.read().value);
    const read = await invoke('shared', 2);
    assert.equal(read.status, 200);
    assert.ok(isStorageRecord(read.body) && isStorageRecord(read.body.storagePatch) && isStorageRecord(read.body.storagePatch.revisions));
    const revisionKey = 'scope:studentEmotionHistory:2';
    const command = { protocolVersion: 2, requestId: 'combined-emotion-first', action: 'student.emotion.save',
      payload: { dateKey: '2026-10-09', emotionId: 'happy', comment: '격리 연습', selfMessage: '', expectedRevisions: { [revisionKey]: read.body.storagePatch.revisions[revisionKey] ?? 0 } } };
    calls.length = 0;
    const saved = await invoke('shared', 2, command);
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.deepEqual(calls, ['storage_prepare_command', 'storage_commit_scoped_and_load']);
    assert.equal((await invoke('shared', 2, { ...command, requestId: 'combined-emotion-stale', payload: { ...command.payload, comment: '옛 입력' } })).status, 409);
    assert.equal((await invoke('shared', 2, command)).status, 200);
    const value = fixture.read().value;
    for (const field of ['currencyBalances', 'currencyHistory', 'studentEconomy', 'studentEmotionHistory']) {
      assert.ok(isStorageRecord(value[field]) && isStorageRecord(other[field]));
      assert.deepEqual(value[field]['4'], other[field]['4']);
    }
    assert.equal(fixture.receipts.size, 1);
  });
});

test('combined currency command confirms response loss and rejects a changed payload without another award', () => environment(async ({ fixture, calls, invoke }) => {
  const command = { protocolVersion: 2, requestId: 'combined-award-once', action: 'teacher.currency.adjust', payload: { studentNumbers: [2], amount: 6 } };
  fixture.loseNextCommitResponse();
  assert.equal((await invoke('shared', 0, command)).status, 502);
  const receipt = await invoke('shared', 0, undefined, { requestId: command.requestId, receiptOnly: '1' });
  assert.ok(isStorageRecord(receipt.body)); assert.equal(receipt.body.status, 'committed');
  calls.length = 0;
  assert.equal((await invoke('shared', 0, command)).status, 200);
  assert.deepEqual(calls, ['storage_prepare_command']);
  assert.equal((await invoke('shared', 0, { ...command, payload: { studentNumbers: [2], amount: 7 } })).status, 409);
  const value = fixture.read().value; assert.ok(isStorageRecord(value.currencyBalances) && isStorageRecord(value.currencyHistory));
  assert.equal(value.currencyBalances['2'], 106);
  assert.ok(Array.isArray(value.currencyHistory['2'])); assert.equal(value.currencyHistory['2'].length, 1);
  assert.equal(fixture.receipts.size, 1);
}));

test('combined economy transfer returns only the sender result and retries a revision conflict without losing recipient funds', () => environment(async ({ fixture, calls, invoke }) => {
  const command = { protocolVersion: 2, requestId: 'combined-transfer-once', studentNumber: 2,
    action: { type: 'transfer', recipientNumber: 4, amount: 20, dateKey: new Date().toISOString().slice(0, 10) } };
  const fetcher = globalThis.fetch;
  let conflict = true;
  globalThis.fetch = async (input, init) => {
    if (String(input).endsWith('/storage_commit_scoped_and_load') && conflict) {
      conflict = false; return Response.json({ saved: false });
    }
    return fetcher(input, init);
  };
  const saved = await invoke('economy', 2, command);
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.deepEqual(calls, ['storage_prepare_command', 'storage_prepare_command', 'storage_commit_scoped_and_load']);
  assert.ok(isStorageRecord(saved.body) && isStorageRecord(saved.body.currencyBalanceEntries));
  assert.deepEqual(Object.keys(saved.body.currencyBalanceEntries), ['2']);
  assert.ok(!JSON.stringify(saved.body).includes('private'));
  const value = fixture.read().value; assert.ok(isStorageRecord(value.currencyBalances));
  assert.equal(value.currencyBalances['2'], 80); assert.equal(value.currencyBalances['4'], 353);
  calls.length = 0;
  assert.equal((await invoke('economy', 2, command)).status, 200);
  assert.deepEqual(calls, ['storage_prepare_command']);
  assert.equal(fixture.receipts.size, 1);
}));

test('combined economy normal save uses two RPC trips and response loss remains recoverable', () => environment(async ({ fixture, calls, invoke }) => {
  const command = { protocolVersion: 2, requestId: 'combined-deposit-once', studentNumber: 2, action: { type: 'deposit', amount: 10 } };
  const result = await invoke('economy', 2, command);
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.deepEqual(calls, ['storage_prepare_command', 'storage_commit_scoped_and_load']);
  fixture.loseNextCommitResponse();
  const lost = { ...command, requestId: 'combined-deposit-lost' };
  assert.equal((await invoke('economy', 2, lost)).status, 502);
  assert.equal((await invoke('economy', 2, lost)).status, 200);
  assert.equal(fixture.receipts.size, 2);
  const value = fixture.read().value; assert.ok(isStorageRecord(value.currencyBalances)); assert.equal(value.currencyBalances['2'], 80);
}));

test('a malformed combined commit projection is unconfirmed and never presented as a successful save', () => environment(async ({ fixture, invoke }) => {
  const fetcher = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const result = await fetcher(input, init);
    if (!String(input).endsWith('/storage_commit_scoped_and_load')) return result;
    const body: unknown = await result.json(); assert.ok(isStorageRecord(body));
    return Response.json({ ...body, snapshot: null });
  };
  const command = { protocolVersion: 2, requestId: 'combined-projection-bad', action: 'teacher.currency.adjust', payload: { studentNumbers: [2], amount: 6 } };
  assert.equal((await invoke('shared', 0, command)).status, 502);
  const receipt = await invoke('shared', 0, undefined, { requestId: command.requestId, receiptOnly: '1' });
  assert.ok(isStorageRecord(receipt.body)); assert.equal(receipt.body.status, 'committed');
  assert.equal(fixture.receipts.size, 1);
}));

test('combined prepare and commit lock failures retry without crediting twice', () => environment(async ({ fixture, invoke }) => {
  const fetcher = globalThis.fetch, failed = new Set<string>();
  globalThis.fetch = async (input, init) => {
    const rpc = new URL(String(input)).pathname.split('/').at(-1) ?? '';
    if (['storage_prepare_command', 'storage_commit_scoped_and_load'].includes(rpc) && !failed.has(rpc)) {
      failed.add(rpc); return Response.json({ code: '40P01' }, { status: 500 });
    }
    return fetcher(input, init);
  };
  const command = { protocolVersion: 2, requestId: 'combined-retry-deposit', studentNumber: 2, action: { type: 'deposit', amount: 10 } };
  assert.equal((await invoke('economy', 2, command)).status, 200);
  assert.equal(failed.size, 2); assert.equal(fixture.receipts.size, 1);
  const value = fixture.read().value; assert.ok(isStorageRecord(value.currencyBalances)); assert.equal(value.currencyBalances['2'], 90);
}));
