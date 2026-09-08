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

test('학생 거래는 v2 요청을 한 번 보내고 업무 거절은 재전송하지 않는다', async () => {
  const originalFetch = globalThis.fetch;
  const bodies: unknown[] = [];
  globalThis.fetch = async (_input, init) => {
    bodies.push(JSON.parse(String(init?.body)));
    return Response.json({ error: 'INSUFFICIENT_AVAILABLE_CURRENCY', businessRejected: true }, { status: 400 });
  };
  try {
    await assert.rejects(updateStudentEconomy({ studentNumber: 1, action: { type: 'deposit', amount: 30 }, requestId: 'insufficient-money' }),
      (error: unknown) => error instanceof StudentEconomyRequestError && error.code === 'INSUFFICIENT_AVAILABLE_CURRENCY');
    assert.deepEqual(bodies, [{ protocolVersion: 2, studentNumber: 1, action: { type: 'deposit', amount: 30 }, requestId: 'insufficient-money' }]);
  } finally { globalThis.fetch = originalFetch; }
});

test('거래 응답이 끊겨도 전송을 반복하지 않고 같은 요청의 확정 영수증을 조회한다', async () => {
  const originalFetch = globalThis.fetch;
  const requests: { url: string; method: string }[] = [];
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), method: init?.method ?? 'GET' });
    if (init?.method === 'POST') throw new TypeError('Load failed');
    return Response.json({ status: 'committed', result: await successfulResponse().json() });
  };
  try {
    const result = await updateStudentEconomy({ studentNumber: 1, action: { type: 'deposit', amount: 30 }, requestId: 'lost-response-id' });
    assert.equal(result.balance, 115);
    assert.deepEqual(requests.map(({ method }) => method), ['POST', 'GET']);
    const query = new URL(requests[1].url, 'https://school.example').searchParams;
    assert.equal(query.get('requestId'), 'lost-response-id');
    assert.equal(query.get('studentNumber'), '1');
  } finally { globalThis.fetch = originalFetch; }
});

test('조회로 저장을 확정하지 못하면 수동 재시도 필요 상태를 유지한다', async () => {
  const originalFetch = globalThis.fetch;
  let writes = 0;
  globalThis.fetch = async (_input, init) => {
    if (init?.method === 'POST') { writes += 1; throw new DOMException('timed out', 'TimeoutError'); }
    return Response.json({ status: 'unknown' });
  };
  try {
    await assert.rejects(updateStudentEconomy({ studentNumber: 1, action: { type: 'deposit', amount: 30 }, requestId: 'uncertain-request' }),
      (error: unknown) => error instanceof StudentEconomyRequestError && error.code === 'STUDENT_ECONOMY_CONFIRMATION_REQUIRED');
    assert.equal(writes, 1);
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

test('서버 점검이나 긴 대기 응답은 자동 재전송하지 않는다', async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const [status, error] of [[503, 'STORAGE_MAINTENANCE'], [429, 'TOO_MANY_REQUESTS']] as const) {
      let attempts = 0;
      globalThis.fetch = async () => { attempts += 1; return Response.json({ error }, { status }); };
      await assert.rejects(updateStudentEconomy({ studentNumber: 1, action: { type: 'select_character', characterId: null }, requestId: 'paused-request' }), new RegExp(error));
      assert.equal(attempts, 1);
    }
  } finally { globalThis.fetch = originalFetch; }
});

test('본문 연결 실패와 상태 조회 실패가 계속되어도 성공으로 숨기지 않는다', async () => {
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts += 1;
    return new Response(new ReadableStream({ start(controller) { controller.error(new TypeError('terminated')); } }));
  };
  try {
    await assert.rejects(updateStudentEconomy({ studentNumber: 1, action: { type: 'select_character', characterId: null }, requestId: 'body-failure' }), /CONFIRMATION_REQUIRED/);
    assert.equal(attempts, 2);
  } finally { globalThis.fetch = originalFetch; }
});
