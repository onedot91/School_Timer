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
import { getKoreanWeekDateRange, getPreviousKoreanDateKey } from '../../src/lib/classwordWeeklyMission.js';
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

const shiftDateKey = (dateKey: string, days: number) => {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

test('server checks the question source and internal classword entries independently', async () => {
  const originalFetch = globalThis.fetch;
  const originalSupabaseUrl = process.env.SUPABASE_URL;
  const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const originalSessionSecret = process.env.DEVICE_SESSION_SECRET;
  const rpcBodies: Record<string, unknown>[] = [];
  const weekKey = getKoreanIsoWeekKey();
  const range = getKoreanWeekDateRange();
  const previousDateKey = getPreviousKoreanDateKey();
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
      const roundDate = new URL(url).searchParams.get('round_date');
      return Response.json(roundDate === `eq.${range.today}`
        ? [{ id: 'today-entry-21', student_number: 21 }]
        : [
          { id: 'final-entry-21', student_number: 21, round_date: previousDateKey },
          { id: 'final-entry-8', student_number: 8, round_date: previousDateKey },
        ]);
    }
    if (url.includes('/rest/v1/weekly_mission_rewards?')) return Response.json([]);

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
        p_week_key: previousDateKey,
        p_mission_type: CLASSWORD_WORD_ENTRY_WEEKLY_MISSION_TYPE,
        p_source_event_id: 'final-entry-21',
      },
      {
        p_student_number: 8,
        p_week_key: previousDateKey,
        p_mission_type: CLASSWORD_WORD_ENTRY_WEEKLY_MISSION_TYPE,
        p_source_event_id: 'final-entry-8',
      },
    ]);
    const missions = (result().body as { missions: Array<{ missionType: string; pending: boolean }> }).missions;
    assert.equal(
      missions.find((mission) => mission.missionType === CLASSWORD_WORD_ENTRY_WEEKLY_MISSION_TYPE)?.pending,
      true,
    );
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
  const previousDateKey = getPreviousKoreanDateKey();
  process.env.SUPABASE_URL = 'https://school-timer.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';
  process.env.DEVICE_SESSION_SECRET = SESSION_SECRET;

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith('https://question-news.vercel.app/api/student')) {
      return Response.json({ malformed: true });
    }
    if (url.includes('/rest/v1/classword_entries?')) {
      const roundDate = new URL(url).searchParams.get('round_date');
      return Response.json(roundDate === `lt.${getKoreanWeekDateRange().today}`
        ? [{ id: 'entry-21', student_number: 21, round_date: previousDateKey }]
        : []);
    }
    if (url.includes('/rest/v1/weekly_mission_rewards?')) return Response.json([]);

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

test('월요일 접속 시 주말 동안 미처리된 날짜를 오래된 순서대로 모두 정산한다', async () => {
  const originalFetch = globalThis.fetch;
  const originalSupabaseUrl = process.env.SUPABASE_URL;
  const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const originalSessionSecret = process.env.DEVICE_SESSION_SECRET;
  const classwordRewardKeys: string[] = [];
  const today = getKoreanWeekDateRange().today;
  const friday = shiftDateKey(today, -3);
  const saturday = shiftDateKey(today, -2);
  const sunday = shiftDateKey(today, -1);
  process.env.SUPABASE_URL = 'https://school-timer.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';
  process.env.DEVICE_SESSION_SECRET = SESSION_SECRET;

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith('https://question-news.vercel.app/api/student')) {
      return Response.json({ history: [] });
    }
    if (url.includes('/rest/v1/classword_entries?')) {
      const roundDate = new URL(url).searchParams.get('round_date');
      if (roundDate === `eq.${today}`) return Response.json([]);
      return Response.json([
        { id: 'friday-21', student_number: 21, round_date: friday },
        { id: 'saturday-8', student_number: 8, round_date: saturday },
        { id: 'sunday-21', student_number: 21, round_date: sunday },
      ]);
    }
    if (url.includes('/rest/v1/weekly_mission_rewards?')) {
      return Response.json([{ student_number: 8, week_key: saturday }]);
    }

    const rpcBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    const missionType = String(rpcBody.p_mission_type) as WeeklyMissionType;
    if (missionType === CLASSWORD_WORD_ENTRY_WEEKLY_MISSION_TYPE) {
      classwordRewardKeys.push(String(rpcBody.p_week_key));
    }
    return Response.json({
      missionType,
      weekKey: String(rpcBody.p_week_key),
      completed: rpcBody.p_source_event_id !== null,
      awarded: rpcBody.p_source_event_id !== null,
      rewardAmount: getWeeklyMissionRewardAmount(missionType),
      balance: 105,
    });
  };

  try {
    const { response, result } = createResponse();
    await handler({ method: 'POST', body: { studentNumber: 21 }, headers: deviceHeaders(21) }, response);

    assert.equal(result().statusCode, 200);
    assert.deepEqual(classwordRewardKeys, [friday, sunday]);
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

test('마감 전에 삭제된 전날 낱말은 보상하지 않고 오늘 제출은 진행 중으로 표시한다', async () => {
  const originalFetch = globalThis.fetch;
  const originalSupabaseUrl = process.env.SUPABASE_URL;
  const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const originalSessionSecret = process.env.DEVICE_SESSION_SECRET;
  const rpcBodies: Record<string, unknown>[] = [];
  const weekKey = getKoreanIsoWeekKey();
  const range = getKoreanWeekDateRange();
  const previousDateKey = getPreviousKoreanDateKey();
  process.env.SUPABASE_URL = 'https://school-timer.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';
  process.env.DEVICE_SESSION_SECRET = SESSION_SECRET;

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith('https://question-news.vercel.app/api/student')) {
      return Response.json({ history: [] });
    }
    if (url.includes('/rest/v1/classword_entries?')) {
      const roundDate = new URL(url).searchParams.get('round_date');
      return Response.json(roundDate === `eq.${range.today}`
        ? [{ id: 'today-entry-7', student_number: 7 }]
        : []);
    }
    if (url.includes('/rest/v1/weekly_mission_rewards?')) return Response.json([]);

    const rpcBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    rpcBodies.push(rpcBody);
    const missionType = String(rpcBody.p_mission_type) as WeeklyMissionType;
    return Response.json({
      missionType,
      weekKey: String(rpcBody.p_week_key),
      completed: false,
      awarded: false,
      rewardAmount: getWeeklyMissionRewardAmount(missionType),
      balance: 100,
    });
  };

  try {
    const { response, result } = createResponse();
    await handler({ method: 'POST', body: { studentNumber: 7 }, headers: deviceHeaders(7) }, response);

    assert.equal(result().statusCode, 200);
    assert.deepEqual(rpcBodies[1], {
      p_student_number: 7,
      p_week_key: previousDateKey,
      p_mission_type: CLASSWORD_WORD_ENTRY_WEEKLY_MISSION_TYPE,
      p_source_event_id: null,
    });
    const classwordMission = (result().body as {
      missions: Array<{ missionType: string; pending: boolean; awarded: boolean }>;
    }).missions.find((mission) => mission.missionType === CLASSWORD_WORD_ENTRY_WEEKLY_MISSION_TYPE);
    assert.deepEqual(classwordMission, {
      missionType: CLASSWORD_WORD_ENTRY_WEEKLY_MISSION_TYPE,
      weekKey: previousDateKey,
      completed: false,
      awarded: false,
      rewardAmount: 5,
      balance: 100,
      pending: true,
    });
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
