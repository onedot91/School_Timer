import assert from 'node:assert/strict';
import test from 'node:test';
import { executeTeacherStorageCommand, reviewTeacherTransaction, teacherCommandScope, teacherCurrencySaveErrorMessage, teacherStorageDrafts } from './teacherStorageClient.js';
import { retainStorageResponseActor } from './storageResponseOrder.js';

const allStudents = Array.from({ length: 23 }, (_, index) => index + 1);
const action = 'teacher.currency.adjust';

test('확인되지 않은 전체 조정은 다음 차감을 막고 그 이유를 안내한다', async context => {
  const posts: { requestId: string; payload: unknown }[] = [];
  context.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    if (init?.method !== 'POST') return Response.json({ status: 'unknown' });
    posts.push(JSON.parse(String(init.body)));
    return Response.json({ error: 'STORAGE_COMMAND_FAILED' }, { status: 502 });
  });
  await assert.rejects(executeTeacherStorageCommand({ requestId: 'plus', action, payload: { studentNumbers: allStudents, amount: 5 } }));
  const blocked = await executeTeacherStorageCommand({ requestId: 'minus', action, payload: { studentNumbers: allStudents, amount: -5 } })
    .then(() => null, (error: unknown) => error);
  assert.equal(posts.length, 1);
  assert.match(teacherCurrencySaveErrorMessage(blocked), /STORAGE_PREVIOUS_CONFIRMATION_REQUIRED/);
  assert.match(teacherCurrencySaveErrorMessage(blocked), /알림 확인 처리/);
  const scope = teacherCommandScope({ action, payload: { studentNumbers: allStudents } });
  const pending = teacherStorageDrafts.load(scope);
  if (pending) await teacherStorageDrafts.confirmDurable(scope, pending.draft.requestId);
});

test('교사가 확인 처리한 거래는 보존하되 새 전체 조정을 막지 않는다', async context => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const values = new Map<string, string>([['school-timer-entry-number-v1', '0']]);
  const localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage, location: { hash: '' }, addEventListener() {}, removeEventListener() {}, dispatchEvent() {} } });
  retainStorageResponseActor(0);
  const posts: { requestId: string; payload: unknown }[] = [];
  let fail = true;
  context.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    if (init?.method !== 'POST') return Response.json({ status: 'unknown' });
    posts.push(JSON.parse(String(init.body)));
    return fail ? Response.json({ error: 'STORAGE_COMMAND_FAILED' }, { status: 502 })
      : Response.json({ value: {}, updatedAt: '2026-10-20T00:00:00Z', result: null });
  });
  try {
    await assert.rejects(executeTeacherStorageCommand({ requestId: 'plus', action, payload: { studentNumbers: allStudents, amount: 5 } }));
    const original = posts[0].requestId;
    await reviewTeacherTransaction(original);
    fail = false;
    await executeTeacherStorageCommand({ requestId: 'minus', action, payload: { studentNumbers: allStudents, amount: -5 } });
    await executeTeacherStorageCommand({ requestId: 'plus-again', action, payload: { studentNumbers: allStudents, amount: 5 } });
    assert.equal(posts.length, 3);
    assert.deepEqual(posts.slice(1).map(post => post.payload), [{ studentNumbers: allStudents, amount: -5 }, { studentNumbers: allStudents, amount: 5 }]);
    assert.equal(new Set(posts.map(post => post.requestId)).size, 3);
    const kept = teacherStorageDrafts.list(0).filter(draft => draft.requestId === original);
    assert.equal(kept.length, 1);
    assert.deepEqual(kept[0].payload, { studentNumbers: allStudents, amount: 5 });
    assert.equal(teacherStorageDrafts.load(teacherCommandScope({ action, payload: { studentNumbers: allStudents } })), null);
    await teacherStorageDrafts.confirmDurable(kept[0].scope, original);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
