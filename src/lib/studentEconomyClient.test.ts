import assert from 'node:assert/strict';
import test from 'node:test';

import { StudentEconomyRequestError, updateStudentEconomy } from './studentEconomyClient.js';
import { applyStudentEconomyAction, createStudentEconomyState } from './studentEconomy.js';
import { normalizeStudentLifeState } from './studentLife.js';

const successfulResponse = () => Response.json({
  balance: 115,
  currencyBalanceEntries: { 1: 115 },
  currencyHistoryEntries: { 1: [] },
  studentEconomy: createStudentEconomyState(),
  studentLife: normalizeStudentLifeState({}),
  message: 'saved',
  applied: true,
  updatedAt: 'v2',
});

test('학생 거래는 일시적인 서버 오류 뒤 같은 요청 ID로 한 번 다시 시도한다', async () => {
  // Given
  const originalFetch = globalThis.fetch;
  const requestBodies: string[] = [];
  globalThis.fetch = async (_input, init) => {
    requestBodies.push(String(init?.body));
    return requestBodies.length === 1
      ? Response.json({ error: 'STUDENT_ECONOMY_UPDATE_FAILED' }, { status: 503 })
      : successfulResponse();
  };

  try {
    // When
    const result = await updateStudentEconomy({
      studentNumber: 1,
      action: { type: 'open_deposit', amount: 30, dateKey: '2026-08-26' },
      requestId: 'student-economy-1-retry-server-error',
    });

    // Then
    assert.equal(result.balance, 115);
    assert.deepEqual(result.currencyBalanceEntries, { 1: 115 });
    assert.deepEqual(result.currencyHistoryEntries, { 1: [] });
    assert.equal(requestBodies.length, 2);
    assert.equal(requestBodies[0], requestBodies[1]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('학생 거래는 iPhone 네트워크 오류 뒤 같은 요청 ID로 한 번 다시 시도한다', async () => {
  // Given
  const originalFetch = globalThis.fetch;
  const requestBodies: string[] = [];
  globalThis.fetch = async (_input, init) => {
    requestBodies.push(String(init?.body));
    if (requestBodies.length === 1) throw new TypeError('Load failed');
    return successfulResponse();
  };

  try {
    // When
    const result = await updateStudentEconomy({
      studentNumber: 1,
      action: { type: 'invest', stockId: 'sunny', amount: 30, dateKey: '2026-08-26' },
      requestId: 'student-economy-1-retry-network-error',
    });

    // Then
    assert.equal(result.balance, 115);
    assert.equal(requestBodies.length, 2);
    assert.equal(requestBodies[0], requestBodies[1]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('학생 거래는 잘못된 요청 오류를 재시도하지 않는다', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;
  globalThis.fetch = async () => {
    fetchCount += 1;
    return Response.json({ error: 'INVALID_STUDENT_ECONOMY_ACTION' }, { status: 400 });
  };

  try {
    await assert.rejects(
      updateStudentEconomy({
        studentNumber: 1,
        action: { type: 'open_deposit', amount: 30, dateKey: '2026-08-26' },
        requestId: 'student-economy-1-no-retry-client-error',
      }),
      (error: unknown) => error instanceof StudentEconomyRequestError
        && error.code === 'INVALID_STUDENT_ECONOMY_ACTION'
        && error.status === 400,
    );
    assert.equal(fetchCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('학생 거래는 일시적 오류가 계속되어도 두 번만 요청한다', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;
  globalThis.fetch = async () => {
    fetchCount += 1;
    return Response.json({ error: 'STUDENT_ECONOMY_UPDATE_FAILED' }, { status: 503 });
  };

  try {
    await assert.rejects(
      updateStudentEconomy({
        studentNumber: 1,
        action: { type: 'invest', stockId: 'sunny', amount: 30, dateKey: '2026-08-26' },
        requestId: 'student-economy-1-retry-limit',
      }),
      (error: unknown) => error instanceof StudentEconomyRequestError && error.status === 503,
    );
    assert.equal(fetchCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('거래 응답 본문이 연결 중 끊기면 동일 요청으로 복구한다', async () => {
  const originalFetch = globalThis.fetch;
  const bodies: string[] = [];
  globalThis.fetch = async (_input, init) => {
    bodies.push(String(init?.body));
    return bodies.length === 1 ? new Response(new ReadableStream({
      start(controller) { controller.error(new TypeError('terminated')); },
    })) : successfulResponse();
  };
  try {
    const result = await updateStudentEconomy({ studentNumber: 1, action: { type: 'select_character', characterId: null }, requestId: 'body-loss' });
    assert.equal(result.balance, 115);
    assert.equal(bodies.length, 2);
    assert.equal(bodies[0], bodies[1]);
  } finally { globalThis.fetch = originalFetch; }
});

test('거래 응답이 잘못되면 저장 성공으로 반환하지 않는다', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json(null);
  try {
    await assert.rejects(updateStudentEconomy({ studentNumber: 1, action: { type: 'select_character', characterId: null }, requestId: 'invalid-response' }), /INVALID_RESPONSE/);
  } finally { globalThis.fetch = originalFetch; }
});

test('잘못된 거래 map이나 누락된 상태를 기본값 성공으로 바꾸지 않는다', async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const invalid of [
      { currencyBalanceEntries: { 1: 'bad' } }, { currencyHistoryEntries: { 1: null } },
      { studentEconomy: {} }, { studentLife: {} },
    ]) {
      globalThis.fetch = async () => Response.json({ ...await successfulResponse().json(), ...invalid });
      await assert.rejects(updateStudentEconomy({ studentNumber: 1, action: { type: 'select_character', characterId: null }, requestId: 'invalid-map' }), /INVALID_RESPONSE/);
    }
  } finally { globalThis.fetch = originalFetch; }
});

test('서버 거래 로직의 기존 입금 응답은 저장 성공으로 수신한다', async () => {
  const originalFetch = globalThis.fetch;
  const action = { type: 'deposit' as const, amount: 20 };
  const transaction = applyStudentEconomyAction({ state: createStudentEconomyState(), action, wallet: 100, availableWallet: 100, requestId: 'legacy-deposit' });
  globalThis.fetch = async () => Response.json({ balance: transaction.wallet, currencyBalanceEntries: { 1: transaction.wallet }, currencyHistoryEntries: { 1: [] }, studentEconomy: transaction.state, studentLife: normalizeStudentLifeState({}), message: transaction.message, applied: transaction.applied, updatedAt: 'v2' });
  try {
    const result = await updateStudentEconomy({ studentNumber: 1, action, requestId: 'legacy-deposit' });
    assert.equal(result.balance, 80);
    assert.equal(result.studentEconomy.deposit, 20);
  } finally { globalThis.fetch = originalFetch; }
});

test('거래 시간 초과는 새 signal과 같은 요청 ID로 재시도한다', async () => {
  const originalFetch = globalThis.fetch;
  const signals: (AbortSignal | null | undefined)[] = [];
  globalThis.fetch = async (_input, init) => {
    signals.push(init?.signal);
    if (signals.length === 1) throw new DOMException('timed out', 'TimeoutError');
    return successfulResponse();
  };
  try {
    assert.equal((await updateStudentEconomy({ studentNumber: 1, action: { type: 'select_character', characterId: null }, requestId: 'timeout' })).balance, 115);
    assert.ok(signals[0]);
    assert.ok(signals[1]);
    assert.notEqual(signals[0], signals[1]);
  } finally { globalThis.fetch = originalFetch; }
});

test('서버가 긴 대기를 요청하면 즉시 재전송하지 않는다', async () => {
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts += 1;
    return Response.json({ error: 'TOO_MANY_REQUESTS' }, { status: 429, headers: { 'Retry-After': '60' } });
  };
  try {
    await assert.rejects(updateStudentEconomy({ studentNumber: 1, action: { type: 'select_character', characterId: null }, requestId: 'rate-limit' }), /TOO_MANY_REQUESTS/);
    assert.equal(attempts, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test('본문 연결 실패가 계속되면 성공으로 숨기지 않고 종료한다', async () => {
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts += 1;
    return new Response(new ReadableStream({ start(controller) { controller.error(new TypeError('terminated')); } }));
  };
  try {
    await assert.rejects(updateStudentEconomy({ studentNumber: 1, action: { type: 'select_character', characterId: null }, requestId: 'body-failure' }), /terminated/);
    assert.equal(attempts, 2);
  } finally { globalThis.fetch = originalFetch; }
});
