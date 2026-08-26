import assert from 'node:assert/strict';
import test from 'node:test';

import { StudentEconomyRequestError, updateStudentEconomy } from './studentEconomyClient.js';

const successfulResponse = () => Response.json({
  balance: 115,
  currencyBalanceEntries: { 1: 115 },
  currencyHistoryEntries: { 1: [] },
  studentEconomy: {},
  studentLife: {},
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
