import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../../api/weekly-missions.js';
import {
  CLASSWORD_WORD_ENTRY_WEEKLY_MISSION_TYPE,
  getWeeklyMissionRewardAmount,
  getKoreanIsoWeekKey,
  PERSONAL_QUESTION_WEEKLY_MISSION_TYPE,
  type WeeklyMissionType,
} from '../../src/lib/weeklyMission.js';
import { getKoreanWeekDateRange } from '../../src/lib/classwordWeeklyMission.js';
import { createDeviceSessionToken } from '../../src/server/deviceSession.js';

const SESSION_SECRET = 'test-device-session-secret-that-is-at-least-32-characters';
const deviceHeaders = (studentNumber: number) => ({
  cookie: `__Host-school-timer-device=${createDeviceSessionToken({ role: 'student', studentNumber }, SESSION_SECRET)}`,
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
  return { response, result: () => ({ statusCode, body }) };
};

test('server checks the question source and internal classword entries independently', async () => {
  const originalFetch = globalThis.fetch;
  const originalSupabaseUrl = process.env.SUPABASE_URL;
  const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const originalSessionSecret = process.env.DEVICE_SESSION_SECRET;
  const rpcBodies: Record<string, unknown>[] = [];
  const weekKey = getKoreanIsoWeekKey();
  const range = getKoreanWeekDateRange();
  process.env.SUPABASE_URL = 'https://school-timer.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';
  process.env.DEVICE_SESSION_SECRET = SESSION_SECRET;

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith('https://question-news.vercel.app/api/student')) {
      return Response.json({
        history: [{ id: 'personal-21', student_number: 21, question_type: 'personal', week_key: weekKey }],
      });
    }
    if (url.includes('/rest/v1/classword_entries?')) {
      return Response.json([{ id: 'entry-21', round_date: range.today }]);
    }

    const rpcBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    rpcBodies.push(rpcBody);
    const missionType = String(rpcBody.p_mission_type);
    return Response.json({
      missionType,
      weekKey: String(rpcBody.p_week_key),
      completed: rpcBody.p_source_event_id !== null,
      awarded: rpcBody.p_source_event_id !== null,
      rewardAmount: getWeeklyMissionRewardAmount(missionType as WeeklyMissionType),
      balance: missionType === PERSONAL_QUESTION_WEEKLY_MISSION_TYPE ? 110 : 105,
    });
  };

  try {
    const { response, result } = createResponse();
    await handler({ method: 'POST', body: { studentNumber: 21 }, headers: deviceHeaders(21) }, response);

    assert.equal(result().statusCode, 200);
    assert.deepEqual(rpcBodies, [
      {
        p_student_number: 21,
        p_week_key: weekKey,
        p_mission_type: PERSONAL_QUESTION_WEEKLY_MISSION_TYPE,
        p_source_event_id: 'personal-21',
      },
      {
        p_student_number: 21,
        p_week_key: range.today,
        p_mission_type: CLASSWORD_WORD_ENTRY_WEEKLY_MISSION_TYPE,
        p_source_event_id: 'entry-21',
      },
    ]);
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

test('a malformed question response does not block a valid internal classword reward', async () => {
  const originalFetch = globalThis.fetch;
  const originalSupabaseUrl = process.env.SUPABASE_URL;
  const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const originalSessionSecret = process.env.DEVICE_SESSION_SECRET;
  const claimedMissionTypes: string[] = [];
  const weekKey = getKoreanIsoWeekKey();
  const range = getKoreanWeekDateRange();
  process.env.SUPABASE_URL = 'https://school-timer.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';
  process.env.DEVICE_SESSION_SECRET = SESSION_SECRET;

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith('https://question-news.vercel.app/api/student')) {
      return Response.json({ malformed: true });
    }
    if (url.includes('/rest/v1/classword_entries?')) {
      return Response.json([{ id: 'entry-21', round_date: range.today }]);
    }

    const rpcBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    const missionType = String(rpcBody.p_mission_type);
    claimedMissionTypes.push(missionType);
    return Response.json({
      missionType,
      weekKey: String(rpcBody.p_week_key),
      completed: rpcBody.p_source_event_id !== null,
      awarded: rpcBody.p_source_event_id !== null,
      rewardAmount: getWeeklyMissionRewardAmount(missionType as WeeklyMissionType),
      balance: rpcBody.p_source_event_id !== null
        ? 100 + getWeeklyMissionRewardAmount(missionType as WeeklyMissionType)
        : 100,
    });
  };

  try {
    const { response, result } = createResponse();
    await handler({ method: 'POST', body: { studentNumber: 21 }, headers: deviceHeaders(21) }, response);

    assert.equal(result().statusCode, 200);
    assert.deepEqual(claimedMissionTypes, [
      PERSONAL_QUESTION_WEEKLY_MISSION_TYPE,
      CLASSWORD_WORD_ENTRY_WEEKLY_MISSION_TYPE,
    ]);
    const missions = (result().body as { missions: Array<{ missionType: string; awarded: boolean }> }).missions;
    assert.equal(missions.find((mission) => mission.missionType === PERSONAL_QUESTION_WEEKLY_MISSION_TYPE)?.awarded, false);
    assert.equal(missions.find((mission) => mission.missionType === CLASSWORD_WORD_ENTRY_WEEKLY_MISSION_TYPE)?.awarded, true);
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

test('cross-site browser requests are rejected before external mission checks', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return Response.json({});
  };

  try {
    const { response, result } = createResponse();
    await handler({
      method: 'POST',
      body: { studentNumber: 21 },
      headers: { 'sec-fetch-site': 'cross-site' },
    }, response);

    assert.equal(result().statusCode, 403);
    assert.deepEqual(result().body, { error: 'CROSS_SITE_REQUEST_BLOCKED' });
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
