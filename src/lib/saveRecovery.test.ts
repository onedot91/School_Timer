import assert from 'node:assert/strict';
import test from 'node:test';
import { deferSaveRecoveryUntil, getSaveRecoveryDelay, notifySaveRecovery, SAVE_RECOVERY_DELAY_PREFIX, canRetrySaveError, getSaveRecoveryStatus, recoveryRetryDelay, registerSaveRecoveryAdapter, requestSaveRecovery, runSaveRecoveryPass, serializeStudentSave, type RecoveryRequest } from './saveRecovery.js';

const request = (id: string, mode: RecoveryRequest['mode'] = 'automatic'): RecoveryRequest => ({
  id, actor: 3, feature: 'student.letter.send', createdAt: '2026-09-09T01:00:00Z', mode,
});

test('recovery confirms first and retries only the same original unconfirmed request', async () => {
  const confirmed = request('already-committed'), pending = request('response-lost');
  const calls: string[] = [];
  const remove = registerSaveRecoveryAdapter({
    id: 'test-confirm-before-retry', list: async () => [confirmed, pending], eligible: () => true,
    confirm: async value => { calls.push(`confirm:${value.id}`); return value.id === confirmed.id; },
    retry: async value => { assert.equal(value, pending); calls.push(`retry:${value.id}`); },
  });
  try {
    const result = await runSaveRecoveryPass(3);
    assert.equal(result.pending, 0);
    assert.equal(result.failed, false);
    assert.equal(result.retryAfterMs, 0);
    assert.deepEqual(result.failedRequests, []);
    assert.deepEqual(calls, ['confirm:already-committed', 'confirm:response-lost', 'retry:response-lost']);
    assert.equal(getSaveRecoveryStatus(3).recovering, false);
  } finally { remove(); }
});

test('financial confirmation and expired context never automatically repeat a mutation', async () => {
  const money = { ...request('purchase-unchanged', 'confirm-only'), feature: 'student.economy' };
  const expired = { ...request('yesterday-answer'), contextKey: 'yesterday' };
  const calls: string[] = [];
  const remove = registerSaveRecoveryAdapter({
    id: 'test-confirm-only-and-context', list: async () => [money, expired], eligible: value => value.contextKey !== 'yesterday',
    confirm: async value => { calls.push(`confirm:${value.id}`); return false; },
    retry: async value => { calls.push(`retry:${value.id}`); },
  });
  try {
    const result = await runSaveRecoveryPass(3);
    assert.equal(result.pending, 2);
    assert.equal(result.failed, false);
    assert.equal(result.retryAfterMs, 0);
    assert.deepEqual(result.failedRequests, []);
    assert.deepEqual(calls, ['confirm:purchase-unchanged', 'confirm:yesterday-answer']);
  } finally { remove(); }
});

test('switching actor during receipt lookup prevents the retry and remaining requests', async () => {
  const calls: string[] = [];
  let current = true;
  const remove = registerSaveRecoveryAdapter({
    id: 'test-actor-switch', list: async () => [request('lookup-in-flight'), request('next-request')], eligible: () => true,
    confirm: async value => { calls.push(`confirm:${value.id}`); current = false; return false; },
    retry: async value => { calls.push(`retry:${value.id}`); },
  });
  try {
    await runSaveRecoveryPass(3, () => current);
    assert.deepEqual(calls, ['confirm:lookup-in-flight']);
    assert.equal(getSaveRecoveryStatus(3).recovering, false);
  } finally { remove(); }
});

test('a recovery list containing another student cannot issue their receipt or write request', async () => {
  let requests = 0;
  const remove = registerSaveRecoveryAdapter({
    id: 'test-other-student', list: async () => [{ ...request('foreign-request'), actor: 4 }], eligible: () => true,
    confirm: async () => { requests++; return false; }, retry: async () => { requests++; },
  });
  try { await runSaveRecoveryPass(3); assert.equal(requests, 0); }
  finally { remove(); }
});

test('a failed receipt read stays unconfirmed and retains Retry-After without immediate mutation', async () => {
  let retries = 0;
  const remove = registerSaveRecoveryAdapter({
    id: 'test-receipt-throttle', list: async () => [request('throttled-receipt')], eligible: () => true,
    confirm: async () => { throw Object.assign(new Error('RATE_LIMIT_EXCEEDED'), { status: 429, retryAfterMs: 45_000 }); },
    retry: async () => { retries++; },
  });
  try {
    const result = await runSaveRecoveryPass(3);
    assert.equal(result.pending, 1);
    assert.equal(result.failed, true);
    assert.equal(result.retryAfterMs, 45_000);
    assert.deepEqual(result.failedRequests.map(value => value.id), ['throttled-receipt']);
    assert.equal(retries, 0);
  } finally { remove(); }
});

test('retry backoff is jittered, capped at thirty seconds, and obeys a longer Retry-After', () => {
  assert.equal(recoveryRetryDelay(1, 0, () => 0), 800);
  assert.equal(recoveryRetryDelay(1, 0, () => 0.5), 1000);
  assert.ok(Math.abs(recoveryRetryDelay(1, 0, () => 1) - 1200) < 0.001);
  assert.equal(recoveryRetryDelay(3, 0, () => 0.5), 4000);
  assert.equal(recoveryRetryDelay(10, 0, () => 1), 30_000);
  assert.equal(recoveryRetryDelay(1, 45_000, () => 0), 45_000);
  assert.equal(canRetrySaveError(Object.assign(new Error('conflict'), { status: 409 })), false);
  assert.equal(canRetrySaveError(Object.assign(new Error('signed out'), { status: 401 })), false);
  assert.equal(canRetrySaveError(Object.assign(new Error('unavailable'), { status: 503 })), true);
  assert.equal(canRetrySaveError(new TypeError('network')), true);
});

test('requests for one student serialize while another student remains independent', async () => {
  let release: (() => void) | undefined;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const calls: string[] = [];
  const first = serializeStudentSave(3, async () => { calls.push('A-start'); await gate; calls.push('A-end'); });
  const second = serializeStudentSave(3, async () => { calls.push('B'); });
  const independent = serializeStudentSave(4, async () => { calls.push('other'); });
  await independent;
  assert.deepEqual(calls, ['A-start', 'other']);
  release?.();
  await Promise.all([first, second]);
  assert.deepEqual(calls, ['A-start', 'other', 'A-end', 'B']);
});

test('다시 확인은 백그라운드 복구 러너가 없어도 저장 확인을 직접 실행한다', async () => {
  const pending = request('manual-recovery');
  let confirmations = 0;
  const remove = registerSaveRecoveryAdapter({
    id: 'test-manual-recovery', list: async () => [pending], eligible: () => false,
    confirm: async value => { confirmations += 1; assert.equal(value.id, pending.id); return true; },
    retry: async () => undefined,
  });
  try {
    const result = await requestSaveRecovery(3);
    assert.equal(result.pending, 0);
    assert.equal(confirmations, 1);
  } finally { remove(); }
});


test('첫 429 Retry-After는 알림·수동 재개로 단축되지 않으며 대기 자체를 실패로 세지 않는다', async context => {
  let now = Date.parse('2026-09-09T01:00:00Z');
  context.mock.method(Date, 'now', () => now);
  const pending = request('foreground-throttled-request');
  const calls: string[] = [];
  const remove = registerSaveRecoveryAdapter({
    id: 'test-foreground-retry-after', list: async () => [pending], eligible: () => true,
    confirm: async () => { calls.push('GET'); return false; }, retry: async () => { calls.push('POST'); },
  });
  try {
    deferSaveRecoveryUntil(3, pending.id, 60_000);
    notifySaveRecovery();
    let result = await runSaveRecoveryPass(3);
    assert.equal(result.waitingMs, 60_000);
    assert.equal(result.attempted, false);
    assert.equal(result.failed, false);
    assert.deepEqual(result.failedRequests, []);
    now += 1000;
    deferSaveRecoveryUntil(3, pending.id, 1000);
    notifySaveRecovery(true);
    result = await runSaveRecoveryPass(3);
    assert.equal(result.waitingMs, 59_000);
    assert.deepEqual(calls, []);
    assert.equal(getSaveRecoveryDelay(4, pending.id), 0);
    now += 59_000;
    result = await runSaveRecoveryPass(3);
    assert.deepEqual(calls, ['GET', 'POST']);
    assert.equal(result.pending, 0);
    assert.equal(getSaveRecoveryDelay(3, pending.id), 0);
  } finally { remove(); }
});

test('재실행한 브라우저가 읽은 요청별 deadline도 존중하고 메모리 보호를 유지한다', async context => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const now = Date.parse('2026-09-09T02:00:00Z');
  context.mock.method(Date, 'now', () => now);
  const values = new Map([[`${SAVE_RECOVERY_DELAY_PREFIX}3:stored-throttle-request`, String(now + 45_000)]]);
  const localStorage = { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage } });
  try {
    assert.equal(getSaveRecoveryDelay(3, 'stored-throttle-request'), 45_000);
    deferSaveRecoveryUntil(3, 'stored-throttle-request', 10_000);
    assert.equal(Number(values.get(`${SAVE_RECOVERY_DELAY_PREFIX}3:stored-throttle-request`)), now + 45_000);
    context.mock.method(localStorage, 'getItem', () => { throw new DOMException('blocked', 'SecurityError'); });
    context.mock.method(localStorage, 'setItem', () => { throw new DOMException('full', 'QuotaExceededError'); });
    deferSaveRecoveryUntil(3, 'stored-throttle-request', 60_000);
    assert.equal(getSaveRecoveryDelay(3, 'stored-throttle-request'), 60_000);
    assert.equal(getSaveRecoveryDelay(4, 'stored-throttle-request'), 0);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow); else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('영수증 조회 중 같은 요청의 foreground 429가 도착해도 자동 POST를 막는다', async context => {
  let now = Date.parse('2026-09-09T03:00:00Z');
  context.mock.method(Date, 'now', () => now);
  const pending = request('throttle-during-receipt');
  let writes = 0;
  const remove = registerSaveRecoveryAdapter({
    id: 'test-throttle-during-receipt', list: async () => [pending], eligible: () => true,
    confirm: async () => { deferSaveRecoveryUntil(3, pending.id, 60_000); return false; }, retry: async () => { writes++; },
  });
  try {
    const result = await runSaveRecoveryPass(3);
    assert.equal(writes, 0);
    assert.equal(result.waitingMs, 60_000);
    assert.equal(result.failed, false);
    now += 60_000;
  } finally { remove(); }
});
