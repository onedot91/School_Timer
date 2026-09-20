import assert from 'node:assert/strict';
import test from 'node:test';
import { describeTeacherTransaction, reviewTeacherTransaction, teacherCommandScope, teacherStorageDrafts } from './teacherStorageClient.js';
import { getSaveRecoveryStatus, isReviewedRecoveryIssue, requestSaveRecovery } from './saveRecovery.js';
import { retainStorageResponseActor } from './storageResponseOrder.js';
import { canonicalStorageJson } from './storageV2Codec.js';

test('교사 알림 확인은 원래 거래를 보존하고 재전송 없이 서버 확인을 계속한다', async context => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const values = new Map<string, string>([['school-timer-entry-number-v1', '0']]);
  let blocked = false;
  const localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { if (blocked) throw new Error('blocked'); values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage, addEventListener() {}, removeEventListener() {}, dispatchEvent() {} } });
  retainStorageResponseActor(0);
  const action = 'teacher.currency.adjust';
  const payload = { studentNumbers: [7, 9], amount: -3, teacherReason: 'private text' };
  const scope = teacherCommandScope({ action, payload });
  const saved = await teacherStorageDrafts.saveDurable(scope, payload);
  assert.notEqual(saved.status, 'invalid');
  if (saved.status === 'invalid') return;
  let committed = false, unavailable = false;
  const calls: string[] = [];
  context.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    calls.push(init?.method ?? 'GET');
    assert.equal(init?.method ?? 'GET', 'GET');
    if (unavailable) return Response.json({ error: 'UNAVAILABLE' }, { status: 503 });
    if (!committed) return Response.json({ status: 'unknown' });
    const bytes = new TextEncoder().encode(canonicalStorageJson({ action, payload }));
    const payloadHash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
    return Response.json({ status: 'committed', action, payloadHash, committedAt: '2026-09-21T00:00:00Z', value: {}, updatedAt: '2026-09-21T00:00:00Z' });
  });
  try {
    await requestSaveRecovery(0);
    assert.deepEqual(describeTeacherTransaction(saved.draft), { requestId: saved.draft.requestId, createdAt: saved.draft.createdAt, kind: 'adjust', studentNumbers: [7, 9], amount: -3 });
    assert.equal(isReviewedRecoveryIssue(getSaveRecoveryStatus(0).issues[0]), false);
    blocked = true;
    await assert.rejects(reviewTeacherTransaction(saved.draft.requestId));
    assert.equal(isReviewedRecoveryIssue(getSaveRecoveryStatus(0).issues[0]), false);
    blocked = false;
    values.set('school-timer-entry-number-v1', '7');
    retainStorageResponseActor(7);
    await assert.rejects(reviewTeacherTransaction(saved.draft.requestId), /SESSION_CHANGED/);
    values.set('school-timer-entry-number-v1', '0');
    retainStorageResponseActor(0);
    await reviewTeacherTransaction(saved.draft.requestId);
    assert.equal(getSaveRecoveryStatus(0).pending, 1);
    assert.equal(isReviewedRecoveryIssue(getSaveRecoveryStatus(0).issues[0]), true);
    assert.equal(teacherStorageDrafts.load(scope)?.draft.requestId, saved.draft.requestId);
    await teacherStorageDrafts.refresh();
    await requestSaveRecovery(0);
    assert.equal(isReviewedRecoveryIssue(getSaveRecoveryStatus(0).issues[0]), true);
    unavailable = true;
    await requestSaveRecovery(0);
    assert.equal(isReviewedRecoveryIssue(getSaveRecoveryStatus(0).issues[0]), false);
    assert.equal(getSaveRecoveryStatus(0).issues[0].httpStatus, 503);
    unavailable = false;
    committed = true;
    await requestSaveRecovery(0);
    assert.equal(getSaveRecoveryStatus(0).pending, 0);
    assert.equal(teacherStorageDrafts.load(scope), null);
    committed = false;
    const next = await teacherStorageDrafts.saveDurable(scope, payload);
    assert.notEqual(next.status, 'invalid');
    await requestSaveRecovery(0);
    assert.equal(getSaveRecoveryStatus(0).pending, 1);
    assert.equal(isReviewedRecoveryIssue(getSaveRecoveryStatus(0).issues[0]), false);
    assert.notEqual(getSaveRecoveryStatus(0).issues[0].transaction?.requestId, saved.draft.requestId);
    assert.ok(calls.length >= 5 && calls.every(method => method === 'GET'));
  } finally {
    const current = teacherStorageDrafts.load(scope);
    if (current) await teacherStorageDrafts.confirmDurable(scope, current.draft.requestId);
    retainStorageResponseActor(null);
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
