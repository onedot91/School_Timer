import assert from 'node:assert/strict';
import test from 'node:test';
import handler from './weekly-missions';
import {
  CLASSWORD_QUIZ_WEEKLY_MISSION_TYPE,
  CLASSWORD_WORD_ENTRY_WEEKLY_MISSION_TYPE,
  getKoreanIsoWeekKey,
  PERSONAL_QUESTION_WEEKLY_MISSION_TYPE,
} from '../src/lib/weeklyMission';
import { getKoreanWeekDateRange } from '../src/lib/classwordWeeklyMission';

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

test('server checks both sources and claims each completed mission independently', async () => {
  const originalFetch = globalThis.fetch;
  const originalSupabaseUrl = process.env.SUPABASE_URL;
  const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const rpcBodies: Record<string, unknown>[] = [];
  const weekKey = getKoreanIsoWeekKey();
  const range = getKoreanWeekDateRange();
  process.env.SUPABASE_URL = 'https://school-timer.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith('https://question-news.vercel.app/api/student')) {
      return Response.json({
        history: [{ id: 'personal-21', student_number: 21, question_type: 'personal', week_key: weekKey }],
      });
    }
    if (url.startsWith('https://classword.vercel.app/api/mission-status')) {
      return Response.json({
        data: {
          studentNumber: 21,
          startDate: range.startDate,
          endDate: range.endDate,
          wordEntryDates: [range.today],
          quizCorrectDates: [range.today],
        },
      });
    }

    const rpcBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    rpcBodies.push(rpcBody);
    const missionType = String(rpcBody.p_mission_type);
    return Response.json({
      missionType,
      weekKey,
      completed: rpcBody.p_source_event_id !== null,
      awarded: rpcBody.p_source_event_id !== null,
      rewardAmount: 5,
      balance: 105,
    });
  };

  try {
    const { response, result } = createResponse();
    await handler({ method: 'POST', body: { studentNumber: 21 } }, response);

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
        p_week_key: weekKey,
        p_mission_type: CLASSWORD_WORD_ENTRY_WEEKLY_MISSION_TYPE,
        p_source_event_id: null,
      },
      {
        p_student_number: 21,
        p_week_key: weekKey,
        p_mission_type: CLASSWORD_QUIZ_WEEKLY_MISSION_TYPE,
        p_source_event_id: `${range.today}:quiz_correct`,
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalSupabaseUrl;
    if (originalServiceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRoleKey;
  }
});

test('a malformed question response does not block a valid classword reward', async () => {
  const originalFetch = globalThis.fetch;
  const originalSupabaseUrl = process.env.SUPABASE_URL;
  const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const claimedMissionTypes: string[] = [];
  const weekKey = getKoreanIsoWeekKey();
  const range = getKoreanWeekDateRange();
  process.env.SUPABASE_URL = 'https://school-timer.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith('https://question-news.vercel.app/api/student')) {
      return Response.json({ malformed: true });
    }
    if (url.startsWith('https://classword.vercel.app/api/mission-status')) {
      return Response.json({
        data: {
          studentNumber: 21,
          startDate: range.startDate,
          endDate: range.endDate,
          wordEntryDates: [],
          quizCorrectDates: [range.today],
        },
      });
    }

    const rpcBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    const missionType = String(rpcBody.p_mission_type);
    claimedMissionTypes.push(missionType);
    return Response.json({
      missionType,
      weekKey,
      completed: rpcBody.p_source_event_id !== null,
      awarded: rpcBody.p_source_event_id !== null,
      rewardAmount: 5,
      balance: rpcBody.p_source_event_id !== null ? 105 : 100,
    });
  };

  try {
    const { response, result } = createResponse();
    await handler({ method: 'POST', body: { studentNumber: 21 } }, response);

    assert.equal(result().statusCode, 200);
    assert.deepEqual(claimedMissionTypes, [
      PERSONAL_QUESTION_WEEKLY_MISSION_TYPE,
      CLASSWORD_WORD_ENTRY_WEEKLY_MISSION_TYPE,
      CLASSWORD_QUIZ_WEEKLY_MISSION_TYPE,
    ]);
    const missions = (result().body as { missions: Array<{ missionType: string; awarded: boolean }> }).missions;
    assert.equal(missions.find((mission) => mission.missionType === PERSONAL_QUESTION_WEEKLY_MISSION_TYPE)?.awarded, false);
    assert.equal(missions.find((mission) => mission.missionType === CLASSWORD_QUIZ_WEEKLY_MISSION_TYPE)?.awarded, true);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalSupabaseUrl;
    if (originalServiceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRoleKey;
  }
});
