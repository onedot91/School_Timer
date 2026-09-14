import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import handler from '../../api/shared-settings.js';
import { createDeviceSessionToken } from '../../src/server/deviceSession.js';
import { isStorageRecord } from '../../src/lib/storageV2Codec.js';
import { StorageProjectionPatchCache, parseStorageProjectionPatch } from '../../src/lib/storageProjectionPatch.js';
import { compareStorageTimestamps } from '../../src/lib/storageResponseOrder.js';
import { createStorageV2Fixture } from './storageV2Fixture.js';

const secret = 'student-read-scope-test-secret-at-least-32-characters';
const stamp = '2026-09-14T00:00:00.000Z';
const setup = (t: TestContext, value: Record<string, unknown>) => {
  const environment = { ...process.env };
  Object.assign(process.env, { SUPABASE_URL: 'https://student-read-fixture.invalid', SUPABASE_SERVICE_ROLE_KEY: 'fake-key', DEVICE_SESSION_SECRET: secret, STORAGE_PROTOCOL_VERSION: '2' });
  t.after(() => {
    for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'DEVICE_SESSION_SECRET', 'STORAGE_PROTOCOL_VERSION']) {
      if (environment[key] === undefined) delete process.env[key];
      else process.env[key] = environment[key];
    }
  });
  const fixture = createStorageV2Fixture(value, stamp);
  const requests: { path: string; bytes: number; payload: unknown }[] = [];
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const result = await fixture.fetch(input, init);
    const body = await result.text();
    requests.push({ path: new URL(String(input)).pathname, bytes: Buffer.byteLength(body), payload: JSON.parse(String(init?.body ?? '{}')) });
    return new Response(body, { status: result.status, headers: result.headers });
  });
  const read = async (studentNumber?: number) => {
    let status = 200;
    let body: unknown;
    const response = { setHeader: () => undefined, status: (code: number) => { status = code; return response; }, json: (value: unknown) => { body = value; } };
    const session = studentNumber === undefined ? { role: 'teacher' as const } : { role: 'student' as const, studentNumber };
    await handler({ method: 'GET', headers: { cookie: `__Host-school-timer-device=${createDeviceSessionToken(session, secret)}`, 'x-storage-projection': '1' } }, response);
    assert.equal(status, 200);
    assert.ok(isStorageRecord(body));
    assert.ok(isStorageRecord(body.value));
    return { value: body.value, patch: parseStorageProjectionPatch(body.storagePatch) };
  };
  return { read, requests };
};

test('학생 GET은 필요한 범위만 DB에서 읽고 전체 학생 조회 계약과 기록을 유지한다', async t => {
  const ownHistory = [{ id: 'own-entry', studentNumber: 1, before: 100, after: 321, delta: 221, reason: 'manual', createdAt: stamp }];
  const life = { books: [{ id: 'shared-book', studentNumber: 2 }], letters: [
    { id: 'own-mail', recipient: 1, senderStudentNumber: 2 },
    { id: 'other-mail', recipient: 2, senderStudentNumber: 3 },
  ] };
  const screen = setup(t, { currencyBalances: { 1: 321, 2: 987 }, currencyHistory: { 1: ownHistory, 2: [{ id: 'other-history' }] },
    studentPets: { 1: { name: 'fake-own' }, 2: { name: 'fake-other' } },
    studentEconomy: { 1: { inventory: { house_repair: 1 } }, 2: { inventory: { other: 1 } } },
    studentEmotionHistory: { 1: [{ id: 'own-emotion' }], 2: [{ id: 'other-emotion' }] },
    studentSudoku: { '1:week': { solved: true }, '2:week': { solved: false } },
    studentNumberBaseball: { '1:week': { attempts: [] }, '2:week': { attempts: [] } },
    auctionItems: [{ id: 'shared-auction' }], studentLife: life, teacherOnly: 'private-settings',
  });
  const result = await screen.read(1);
  assert.deepEqual(screen.requests.map(request => request.path), ['/rest/v1/rpc/storage_load_scope']);
  const payload = screen.requests[0].payload;
  assert.ok(isStorageRecord(payload) && isStorageRecord(payload.p_scope));
  assert.deepEqual(payload.p_scope.wallets, [1]);
  assert.deepEqual(payload.p_scope.history, [1]);
  assert.deepEqual(payload.p_scope.writeResources, []);
  assert.deepEqual(payload.p_scope.writeWallets, []);
  assert.deepEqual(result.value.currencyBalances, { 1: 321 });
  assert.deepEqual(result.value.currencyHistory, { 1: ownHistory });
  assert.deepEqual(result.value.studentSudoku, { '1:week': { solved: true } });
  assert.deepEqual(result.value.studentNumberBaseball, { '1:week': { attempts: [] } });
  assert.deepEqual(result.value.studentLife, { ...life, letters: [life.letters[0]] });
  assert.deepEqual(result.value.auctionItems, [{ id: 'shared-auction' }]);
  assert.equal(result.value.teacherOnly, undefined);
  assert.equal(result.patch.complete, true);
  assert.ok(Object.hasOwn(result.patch.revisions, 'scope:studentEmotionHistory:1'));
  const projected = new StorageProjectionPatchCache(compareStorageTimestamps).apply(result.patch, stamp);
  assert.deepEqual(projected.currencyHistory, { 1: ownHistory });
  assert.deepEqual(projected.studentPets, { 1: { name: 'fake-own' } });
});

test('학급 거래 기록이 늘어나도 학생 한 명의 DB 응답에는 타인 기록을 싣지 않는다', async t => {
  const numbers = Array.from({ length: 23 }, (_, index) => index + 1);
  const screen = setup(t, { currencyBalances: Object.fromEntries(numbers.map(number => [number, 100])),
    currencyHistory: Object.fromEntries(numbers.map(number => [number, Array.from({ length: 130 }, (_, index) => ({
      id: `fake-${number}-${index}`, studentNumber: number, before: 99, after: 100, delta: 1, reason: 'manual', createdAt: stamp,
    }))])),
  });
  await screen.read();
  await screen.read(1);
  const [full, student] = screen.requests;
  assert.ok(student.bytes < full.bytes / 10, `full=${full.bytes}, student=${student.bytes}`);
  t.diagnostic(`Synthetic DB response: full=${full.bytes} bytes, student=${student.bytes} bytes`);
});

test('동시 학생 조회는 각 학생의 잔액과 기록을 분리한다', async t => {
  const numbers = Array.from({ length: 23 }, (_, index) => index + 1);
  const screen = setup(t, {
    currencyBalances: Object.fromEntries(numbers.map(number => [number, number * 100])),
    currencyHistory: Object.fromEntries(numbers.map(number => [number, [{ id: `student-${number}` }]])),
  });
  const results = await Promise.all(numbers.map(number => screen.read(number)));
  results.forEach((result, index) => {
    const number = numbers[index];
    assert.deepEqual(result.value.currencyBalances, { [number]: number * 100 });
    assert.deepEqual(result.value.currencyHistory, { [number]: [{ id: `student-${number}` }] });
  });
});

test('테스트 학생은 기존 전체 RPC와 호환되고 응답은 본인 범위로 제한된다', async t => {
  const screen = setup(t, { currencyBalances: { 1: 123 }, currencyHistory: { 1: [{ id: 'one' }] } });
  const result = await screen.read(24);
  assert.equal(screen.requests[0].path, '/rest/v1/rpc/storage_load_snapshot');
  assert.deepEqual(result.value.currencyBalances, {});
});
