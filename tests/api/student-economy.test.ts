import { normalizeStudentLifeState } from '../../src/lib/studentLife.js';
import { normalizeCurrencyHistory } from '../../src/lib/currency.js';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';
import test from 'node:test';

import handler from '../../api/student-economy.js';
import { FAILURE_PROFILE_IMAGES } from '../../src/lib/failureExhibition.js';
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
      return Response.json([{ id: 'school-timer-main', value: previousValue, updated_at: '2026-09-05T00:00:00.000Z' }]);
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
    const history = Reflect.get(savedValue.currencyHistory as object, '1') as Array<{ id: string }>;
    assert.equal(history[0]?.id, 'currency-economy-student-economy-1-deposit-request-1');
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

test('학생 송금 원장은 같은 서버 요청 ID로 송신자와 수신자를 연결한다', async () => {
  await withEnvironment(async () => {
    const result = await runStudentAction(
      { type: 'transfer', amount: 20, recipientNumber: 2, dateKey: '2026-09-03' },
      'student-economy-1-transfer-request',
    );

    assert.equal(result.statusCode, 200);
    const savedValue = Reflect.get(result.upstreamBodies[0] as object, 'value') as Record<string, unknown>;
    const history = savedValue.currencyHistory as Record<string, Array<{ id: string }>>;
    assert.equal(history['1'][0]?.id, 'currency-economy-student-economy-1-transfer-request-1');
    assert.equal(history['2'][0]?.id, 'currency-economy-student-economy-1-transfer-request-2');
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

test('학생 프로필 뽑기는 학생 거래 API에서 권한을 확인하고 프로필을 저장한다', async () => {
  await withEnvironment(async () => {
    const result = await runStudentAction(
      { type: 'draw_profile' },
      'student-profile-1-first-draw',
    );

    assert.equal(result.statusCode, 200);
    assert.equal(Reflect.get(result.body as object, 'applied'), true);
    assert.equal(Reflect.get(result.body as object, 'balance'), 145);
    const profileImage = Reflect.get(result.body as object, 'profileImage');
    assert.equal(typeof profileImage, 'string');
    assert.equal(FAILURE_PROFILE_IMAGES.includes(profileImage as typeof FAILURE_PROFILE_IMAGES[number]), true);

    const savedValue = Reflect.get(result.upstreamBodies[0] as object, 'value') as Record<string, unknown>;
    const savedStudentLife = savedValue.studentLife as Record<string, unknown>;
    assert.equal(
      Reflect.get(savedStudentLife.failureProfileAssignments as object, '1'),
      profileImage,
    );
    assert.deepEqual(savedValue.schedule, previousValue.schedule);
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

test('고정된 같은 밀리초에서도 저장 버전은 현재 행보다 1ms 증가한다', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    const originalNow = Date.now;
    const currentUpdatedAt = '2026-08-26T00:00:00.000Z';
    let savedUpdatedAt = '';
    Date.now = () => Date.parse(currentUpdatedAt);
    globalThis.fetch = async (_input, init) => {
      if (!init?.method) {
        return Response.json([{ id: 'school-timer-main', value: previousValue, updated_at: currentUpdatedAt }]);
      }
      savedUpdatedAt = Reflect.get(JSON.parse(String(init.body)), 'updated_at') as string;
      return Response.json([{ id: 'school-timer-main' }]);
    };
    try {
      const { response, result } = createResponse();
      await handler({
        method: 'POST', headers: studentHeaders(1),
        body: {
          studentNumber: 1,
          action: { type: 'open_deposit', amount: 30, dateKey: '2026-08-26' },
          requestId: 'student-economy-monotonic-version',
        },
      }, response);
      assert.equal(result().statusCode, 200);
      assert.equal(Date.parse(savedUpdatedAt), Date.parse(currentUpdatedAt) + 1);
    } finally {
      Date.now = originalNow;
      globalThis.fetch = originalFetch;
    }
  });
});

test('스킨 뽑기 API는 저장 충돌 때 확률을 다시 굴리지 않고 획득 목록과 100고마를 함께 저장한다', async (context) => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    let rollCalls = 0;
    const random = context.mock.method(crypto, 'randomInt', () => rollCalls++ === 0 ? 0 : 9);
    syncBuiltinESMExports();
    const writes: Record<string, unknown>[] = [];
    globalThis.fetch = async (_input, init) => {
      if (init?.method !== 'PATCH') return Response.json([{
        id: 'school-timer-main',
        value: writes.length === 0 ? previousValue : { ...previousValue, currencyBalances: { 1: 145, 2: 333 } },
        updated_at: writes.length === 0 ? '2026-09-05T00:00:00.000Z' : '2026-09-05T00:00:00.001Z',
      }]);
      const body: unknown = JSON.parse(String(init.body));
      assert.ok(body && typeof body === 'object');
      const value: unknown = Reflect.get(body, 'value');
      assert.ok(value && typeof value === 'object');
      writes.push(value as Record<string, unknown>);
      return Response.json(writes.length === 1 ? [] : [{ id: 'school-timer-main' }]);
    };
    try {
      const { response, result } = createResponse();
      await handler({ method: 'POST', headers: studentHeaders(1), body: { studentNumber: 1, action: { type: 'draw_character' }, requestId: 'skin-draw-conflict-retry' } }, response);
      const output = result();
      assert.equal(output.statusCode, 200);
      assert.equal(writes.length, 2);
      assert.equal(random.mock.callCount(), 1);
      assert.deepEqual(random.mock.calls[0].arguments, [10]);
      const firstEconomy = Reflect.get(writes[0].studentEconomy as object, '1');
      const savedEconomy = Reflect.get(writes[1].studentEconomy as object, '1');
      assert.deepEqual(savedEconomy, firstEconomy);
      const ids: unknown = Reflect.get(savedEconomy, 'ownedCharacterIds');
      assert.ok(Array.isArray(ids) && ids.length === 2);
      assert.equal(new Set(ids).size, ids.length);
      assert.equal(Reflect.get(savedEconomy, 'activeCharacterId'), ids[0]);
      assert.equal(Reflect.get(writes[1].currencyBalances as object, '1'), 45);
      assert.equal(Reflect.get(writes[1].currencyBalances as object, '2'), 333);
      assert.deepEqual(Reflect.get(writes[1].studentEconomy as object, '2'), previousValue.studentEconomy[2]);
      assert.deepEqual(Reflect.get(output.body as object, 'studentEconomy'), savedEconomy);
    } finally {
      globalThis.fetch = originalFetch;
      random.mock.restore();
      syncBuiltinESMExports();
    }
  });
});

test('학생 집 구매는 제작자 보상과 고키리 편지를 함께 저장하고 재시도에도 중복 지급하지 않는다', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    const untouched = { id: 'untouched', studentNumber: 2, before: 200, after: 222, delta: 22, reason: 'manual', createdAt: '2026-09-01T00:00:00.000Z' };
    let value = {
      ...previousValue,
      currencyBalances: { 1: 500, 2: 222, 7: 75 },
      currencyHistory: { 1: [], 2: [untouched], 7: [] },
      studentEconomy: { ...previousValue.studentEconomy, 1: { inventory: { house_repair: 1 } }, 7: { inventory: { house_repair: 1 } } },
    };
    let conflict = true;
    let writes = 0;
    globalThis.fetch = async (_input, init) => {
      if (init?.method !== 'PATCH') return Response.json([{ id: 'school-timer-main', value, updated_at: '2026-09-05T00:00:00.000Z' }]);
      writes += 1;
      if (conflict) {
        conflict = false;
        value.currencyBalances[7] += 5;
        return Response.json([]);
      }
      value = JSON.parse(String(init.body)).value;
      return Response.json([{ id: 'school-timer-main' }]);
    };
    const buy = async (studentNumber: number, requestId: string, action: Record<string, unknown> = { type: 'buy_house', houseId: 'student-house-7' }) => {
      const { response, result } = createResponse();
      await handler({ method: 'POST', headers: studentHeaders(studentNumber), body: { studentNumber, requestId, action } }, response);
      return result();
    };
    try {
      assert.equal((await buy(1, 'house-purchase-one')).statusCode, 200);
      assert.equal(writes, 2);
      assert.equal(value.currencyBalances[1], 400);
      assert.equal(value.currencyBalances[7], 90);
      assert.deepEqual(value.currencyHistory[2], [untouched]);
      assert.deepEqual(value.studentEconomy[2], previousValue.studentEconomy[2]);
      assert.deepEqual(value.schedule, ['수학']);
      const life = normalizeStudentLifeState(value.studentLife);
      assert.equal(life.letters.length, 1);
      assert.equal(life.letters[0].recipient, 7);
      assert.equal(life.letters[0].senderLabel, '목수 고키리');
      assert.equal(life.letters[0].senderStudentNumber, null);
      assert.match(life.letters[0].content, /10고마/);
      assert.equal(normalizeCurrencyHistory(value.currencyHistory)['7'][0].reason, 'house_creator_reward');
      assert.equal((await buy(1, 'house-purchase-one')).statusCode, 200);
      assert.equal((await buy(1, 'house-purchase-two')).statusCode, 400);
      assert.equal(value.currencyBalances[7], 90);
      assert.equal(normalizeStudentLifeState(value.studentLife).letters.length, 1);
      assert.equal((await buy(1, 'house-select', { type: 'select_house', houseId: 'student-house-7' })).statusCode, 200);
      assert.equal(value.currencyBalances[7], 90);
      value.currencyBalances[7] = 300;
      assert.equal((await buy(7, 'house-self-purchase')).statusCode, 200);
      assert.equal(value.currencyBalances[7], 200);
      assert.equal(normalizeStudentLifeState(value.studentLife).letters.length, 1);
    } finally { globalThis.fetch = originalFetch; }
  });
});
