import assert from 'node:assert/strict';
import test from 'node:test';

import handler from '../../api/student-economy.js';
import { createDeviceSessionToken } from '../../src/server/deviceSession.js';

const SESSION_SECRET = 'test-device-session-secret-that-is-at-least-32-characters';

const createResponse = () => {
  let statusCode = 200;
  let body: unknown;
  const response = {
    setHeader: () => undefined,
    status: (code: number) => { statusCode = code; return response; },
    json: (value: unknown) => { body = value; },
  };
  return { response, result: () => ({ statusCode, body }) };
};

const withEnvironment = async (run: () => Promise<void>) => {
  const originals = {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    secret: process.env.DEVICE_SESSION_SECRET,
  };
  process.env.SUPABASE_URL = 'https://school-timer.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
  process.env.DEVICE_SESSION_SECRET = SESSION_SECRET;
  try {
    await run();
  } finally {
    if (originals.url === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originals.url;
    if (originals.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originals.key;
    if (originals.secret === undefined) delete process.env.DEVICE_SESSION_SECRET;
    else process.env.DEVICE_SESSION_SECRET = originals.secret;
  }
};

const studentHeaders = (studentNumber: number) => ({
  cookie: `__Host-school-timer-device=${createDeviceSessionToken({ role: 'student', studentNumber }, SESSION_SECRET)}`,
  'sec-fetch-site': 'same-origin',
  'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
});

const previousValue = {
  schedule: ['수학'],
  currencyBalances: { 1: 145, 2: 222 },
  currencyHistory: { 1: [], 2: [{ id: 'keep-history' }] },
  studentEconomy: { 2: { deposit: 7, legacyField: 'keep-economy' } },
  studentLife: { letters: [], books: [], failureStories: [], failureProfileAssignments: {} },
  auctionBids: {},
  auctionAwards: {},
};

const runStudentAction = async (action: Record<string, unknown>, requestId: string) => {
  const originalFetch = globalThis.fetch;
  const upstreamBodies: unknown[] = [];
  const upstreamUrls: string[] = [];
  let fetchCount = 0;
  globalThis.fetch = async (input, init) => {
    fetchCount += 1;
    upstreamUrls.push(String(input));
    if (fetchCount === 1) {
      return Response.json([{ id: 'school-timer-main', value: previousValue, updated_at: 'v1' }]);
    }
    upstreamBodies.push(JSON.parse(String(init?.body)));
    return Response.json([{ id: 'school-timer-main' }]);
  };
  try {
    const { response, result } = createResponse();
    await handler({
      method: 'POST',
      headers: studentHeaders(1),
      body: { studentNumber: 1, action, requestId },
    }, response);
    return { ...result(), upstreamBodies, upstreamUrls, fetchCount };
  } finally {
    globalThis.fetch = originalFetch;
  }
};

test('iPhone 학생 예금은 전체 설정 PUT 없이 본인 고마만 원자적으로 저장한다', async () => {
  await withEnvironment(async () => {
    const result = await runStudentAction(
      { type: 'open_deposit', amount: 30, dateKey: '2026-08-26' },
      'student-economy-1-deposit-request',
    );

    assert.equal(result.statusCode, 200);
    assert.equal(result.fetchCount, 2);
    assert.equal(new URL(result.upstreamUrls[1]).searchParams.get('select'), 'id');
    assert.equal(Reflect.get(result.body as object, 'balance'), 115);
    assert.equal(Reflect.get(Reflect.get(result.body as object, 'studentEconomy') as object, 'deposit'), 30);

    const savedValue = Reflect.get(result.upstreamBodies[0] as object, 'value') as Record<string, unknown>;
    assert.deepEqual(Reflect.get(savedValue.studentEconomy as object, '2'), previousValue.studentEconomy[2]);
    assert.deepEqual(savedValue.schedule, previousValue.schedule);
  });
});

test('학생 거래 API는 10고마보다 적은 예금을 거부한다', async () => {
  await withEnvironment(async () => {
    const result = await runStudentAction(
      { type: 'open_deposit', amount: 9, dateKey: '2026-08-26' },
      'student-economy-deposit-below-minimum',
    );

    assert.equal(result.statusCode, 400);
    assert.deepEqual(result.body, { error: 'INVALID_BANK_AMOUNT' });
    assert.equal(result.fetchCount, 1);
    assert.equal(result.upstreamBodies.length, 0);
  });
});

test('iPhone 학생 증권 투자는 학생 세션에서 고마를 차감하고 포지션을 저장한다', async () => {
  await withEnvironment(async () => {
    const result = await runStudentAction(
      { type: 'invest', stockId: 'sunny', amount: 30, dateKey: '2026-08-26' },
      'student-economy-1-invest-request',
    );

    assert.equal(result.statusCode, 200);
    assert.equal(Reflect.get(result.body as object, 'balance'), 115);
    const economy = Reflect.get(result.body as object, 'studentEconomy') as Record<string, unknown>;
    const investments = economy.investments as Record<string, { investedAmount: number }>;
    assert.equal(investments.sunny?.investedAmount, 30);
  });
});

test('학생 거래 API는 다른 번호로 거래할 수 없다', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;
    globalThis.fetch = async () => { fetchCalled = true; return Response.json([]); };
    try {
      const { response, result } = createResponse();
      await handler({
        method: 'POST',
        headers: studentHeaders(1),
        body: {
          studentNumber: 2,
          action: { type: 'open_deposit', amount: 30, dateKey: '2026-08-26' },
          requestId: 'student-economy-2-wrong-student',
        },
      }, response);

      assert.equal(result().statusCode, 403);
      assert.equal(fetchCalled, false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
