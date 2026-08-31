import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../../api/weekly-mission.js';
import { getKoreanIsoWeekKey } from '../../src/lib/weeklyMission.js';
import { createDeviceSessionToken } from '../../src/server/deviceSession.js';

const SESSION_SECRET = 'test-device-session-secret-that-is-at-least-32-characters';
const deviceHeaders = (studentNumber: number) => ({
  cookie: `__Host-school-timer-device=${createDeviceSessionToken({ role: 'student', studentNumber }, SESSION_SECRET)}`,
});
const teacherHeaders = () => ({
  cookie: `__Host-school-timer-device=${createDeviceSessionToken({ role: 'teacher' }, SESSION_SECRET)}`,
});

const createResponse = () => {
  let statusCode = 200;
  let body: unknown;

  const response = {
    setHeader: () => undefined,
    status: (nextStatusCode: number) => {
      statusCode = nextStatusCode;
      return response;
    },
    json: (nextBody: unknown) => {
      body = nextBody;
    },
  };

  return {
    response,
    result: () => ({ statusCode, body }),
  };
};

test('server verifies a personal question and forwards only its id to the atomic RPC', async () => {
  const originalFetch = globalThis.fetch;
  const originalSupabaseUrl = process.env.SUPABASE_URL;
  const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const originalSessionSecret = process.env.DEVICE_SESSION_SECRET;
  const rpcBodies: unknown[] = [];
  const currentWeekKey = getKoreanIsoWeekKey();
  process.env.SUPABASE_URL = 'https://school-timer.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';
  process.env.DEVICE_SESSION_SECRET = SESSION_SECRET;

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith('https://question-news.vercel.app/api/student')) {
      return Response.json({
        history: [
          { id: 'topic-1', student_number: 6, question_type: 'topic', week_key: currentWeekKey },
          { id: 'personal-1', student_number: 6, question_type: 'personal', week_key: currentWeekKey },
        ],
      });
    }

    rpcBodies.push(JSON.parse(String(init?.body)));
    return Response.json({
      missionType: 'personal_question',
      weekKey: currentWeekKey,
      completed: true,
      awarded: true,
      rewardAmount: 15,
      balance: 115,
    });
  };

  try {
    const { response, result } = createResponse();
    await handler({ method: 'POST', body: { studentNumber: 6 }, headers: deviceHeaders(6) }, response);
    assert.equal(result().statusCode, 200);
    assert.deepEqual(rpcBodies, [{
      p_student_number: 6,
      p_week_key: currentWeekKey,
      p_source_question_id: 'personal-1',
    }]);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalSupabaseUrl;
    if (originalServiceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRoleKey;
    if (originalSessionSecret === undefined) delete process.env.DEVICE_SESSION_SECRET;
    else process.env.DEVICE_SESSION_SECRET = originalSessionSecret;
  }
});

test('invalid student numbers are rejected before any external request', async () => {
  const originalFetch = globalThis.fetch;
  const originalSessionSecret = process.env.DEVICE_SESSION_SECRET;
  let fetchCalled = false;
  process.env.DEVICE_SESSION_SECRET = SESSION_SECRET;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return Response.json({});
  };

  try {
    const { response, result } = createResponse();
    await handler({ method: 'POST', body: { studentNumber: 24 }, headers: teacherHeaders() }, response);
    assert.equal(result().statusCode, 400);
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalSessionSecret === undefined) delete process.env.DEVICE_SESSION_SECRET;
    else process.env.DEVICE_SESSION_SECRET = originalSessionSecret;
  }
});

test('an unregistered device is rejected before external mission checks', async () => {
  const originalFetch = globalThis.fetch;
  const originalSessionSecret = process.env.DEVICE_SESSION_SECRET;
  let fetchCalled = false;
  process.env.DEVICE_SESSION_SECRET = 'test-device-session-secret-that-is-long-enough';
  globalThis.fetch = async () => {
    fetchCalled = true;
    return Response.json({});
  };

  try {
    const { response, result } = createResponse();
    await handler({ method: 'POST', body: { studentNumber: 6 } }, response);

    assert.equal(result().statusCode, 401);
    assert.deepEqual(result().body, { error: 'DEVICE_REGISTRATION_REQUIRED' });
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalSessionSecret === undefined) delete process.env.DEVICE_SESSION_SECRET;
    else process.env.DEVICE_SESSION_SECRET = originalSessionSecret;
  }
});

test('repeated requests from the same client are rate limited before external calls', async () => {
  const originalFetch = globalThis.fetch;
  const originalSupabaseUrl = process.env.SUPABASE_URL;
  const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const originalSessionSecret = process.env.DEVICE_SESSION_SECRET;
  let fetchCount = 0;
  process.env.SUPABASE_URL = 'https://school-timer.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';
  process.env.DEVICE_SESSION_SECRET = SESSION_SECRET;

  globalThis.fetch = async () => {
    fetchCount += 1;
    return Response.json(fetchCount % 2 === 1
      ? { history: [] }
      : {
          missionType: 'personal_question',
          weekKey: getKoreanIsoWeekKey(),
          completed: false,
          awarded: false,
          rewardAmount: 15,
          balance: 100,
        });
  };

  try {
    for (let index = 0; index < 10; index += 1) {
      const { response, result } = createResponse();
      await handler({
        method: 'POST',
        body: { studentNumber: 23 },
        headers: { ...deviceHeaders(23), 'x-forwarded-for': '203.0.113.99' },
      }, response);
      assert.equal(result().statusCode, 200);
    }

    const { response, result } = createResponse();
    await handler({
      method: 'POST',
      body: { studentNumber: 23 },
      headers: { ...deviceHeaders(23), 'x-forwarded-for': '203.0.113.99' },
    }, response);

    assert.equal(result().statusCode, 429);
    assert.deepEqual(result().body, { error: 'TOO_MANY_REQUESTS' });
    assert.equal(fetchCount, 20);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalSupabaseUrl;
    if (originalServiceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRoleKey;
    if (originalSessionSecret === undefined) delete process.env.DEVICE_SESSION_SECRET;
    else process.env.DEVICE_SESSION_SECRET = originalSessionSecret;
  }
});
