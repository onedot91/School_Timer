import assert from 'node:assert/strict';
import test from 'node:test';
import handler from './weekly-mission';
import { getKoreanIsoWeekKey } from '../src/lib/weeklyMission';

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
  const rpcBodies: unknown[] = [];
  const currentWeekKey = getKoreanIsoWeekKey();
  process.env.SUPABASE_URL = 'https://school-timer.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';

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
      rewardAmount: 5,
      balance: 105,
    });
  };

  try {
    const { response, result } = createResponse();
    await handler({ method: 'POST', body: { studentNumber: 6 } }, response);
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
  }
});

test('invalid student numbers are rejected before any external request', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return Response.json({});
  };

  try {
    const { response, result } = createResponse();
    await handler({ method: 'POST', body: { studentNumber: 24 } }, response);
    assert.equal(result().statusCode, 400);
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
