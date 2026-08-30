import assert from 'node:assert/strict';
import test from 'node:test';

import handler from '../../api/today-friend.js';
import {
  createTodayFriendTextPayload,
  createTodayFriendSubmission,
  submitTodayFriendSubmission,
  type TodayFriendSubmission,
} from '../../src/lib/todayFriend.js';
import {
  ensureTodayFriendDay,
  getTodayFriendStudentMission,
  TODAY_FRIEND_INITIAL_STATE,
} from '../../src/lib/todayFriendState.js';
import { createDeviceSessionToken } from '../../src/server/deviceSession.js';

const SESSION_SECRET = 'test-device-session-secret-that-is-at-least-32-characters';
const DATE_KEY = '2026-09-01';
const WEEK_KEY = '2026-36';
const PREPARED_STATE = ensureTodayFriendDay(TODAY_FRIEND_INITIAL_STATE, WEEK_KEY, DATE_KEY);

const createResponse = () => {
  let statusCode = 200;
  let body: unknown;
  const response = {
    setHeader: () => undefined,
    status: (code: number) => {
      statusCode = code;
      return response;
    },
    json: (value: unknown) => {
      body = value;
    },
  };
  return { response, result: () => ({ statusCode, body }) };
};

const sessionHeaders = (role: 'teacher' | 'student', studentNumber = 3) => ({
  cookie: `__Host-school-timer-device=${createDeviceSessionToken(
    role === 'teacher' ? { role } : { role, studentNumber },
    SESSION_SECRET,
  )}`,
  'sec-fetch-site': 'same-origin',
});

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

const toSubmissionRow = (submission: TodayFriendSubmission) => ({
  id: submission.id,
  submission_date: submission.dateKey,
  student_number: submission.studentNumber,
  partner_number: submission.partnerNumber,
  genre: submission.genre,
  payload: submission.payload,
  status: submission.status,
  revision: submission.revision,
  teacher_feedback: submission.teacherFeedback,
  submitted_at: submission.submittedAt,
  reviewed_at: submission.reviewedAt,
  reward_status: submission.rewardStatus,
});

test('학생 조회는 자신의 오늘 파트너와 장르만 반환한다', async () => {
  // Given
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes('today_friend_settings')) return Response.json([{ state: PREPARED_STATE }]);
      if (url.includes('today_friend_submissions')) return Response.json([]);
      throw new Error(`UNEXPECTED_REQUEST_${url}`);
    };

    try {
      // When
      const { response, result } = createResponse();
      await handler({ method: 'GET', query: { dateKey: DATE_KEY }, headers: sessionHeaders('student', 3) }, response);

      // Then
      const expected = getTodayFriendStudentMission(PREPARED_STATE, DATE_KEY, 3);
      assert.equal(result().statusCode, 200);
      assert.deepEqual(result().body, expected);
      assert.equal(Reflect.has(result().body as object, 'submissions'), false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('학생 세션은 교사 전체 현황을 조회할 수 없다', async () => {
  // Given
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      return Response.json([]);
    };

    try {
      // When
      const { response, result } = createResponse();
      await handler({ method: 'GET', query: { teacher: '1', dateKey: DATE_KEY }, headers: sessionHeaders('student', 3) }, response);

      // Then
      assert.equal(result().statusCode, 403);
      assert.deepEqual(result().body, { error: 'TEACHER_REQUIRED' });
      assert.equal(fetchCalled, false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('학생 임시 저장은 세션 학생 번호와 서버 배정을 사용한다', async () => {
  // Given
  await withEnvironment(async () => {
    const mission = getTodayFriendStudentMission(PREPARED_STATE, DATE_KEY, 3);
    const payload = createTodayFriendTextPayload(mission.genre, '친구와 직접 이야기한 내용입니다.');
    const draft = createTodayFriendSubmission({
      dateKey: DATE_KEY,
      studentNumber: 3,
      partnerNumber: mission.partnerNumber,
      genre: mission.genre,
      payload,
    });
    const originalFetch = globalThis.fetch;
    const requestBodies: unknown[] = [];
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (init?.body) requestBodies.push(JSON.parse(String(init.body)));
      if (url.includes('today_friend_settings')) return Response.json([{ state: PREPARED_STATE }]);
      if (url.includes('today_friend_submissions') && init?.method === 'POST') return Response.json([toSubmissionRow(draft)], { status: 201 });
      if (url.includes('today_friend_submissions')) return Response.json([]);
      throw new Error(`UNEXPECTED_REQUEST_${url}`);
    };

    try {
      // When
      const { response, result } = createResponse();
      await handler({ method: 'POST', headers: sessionHeaders('student', 3), body: { action: 'save_draft', dateKey: DATE_KEY, payload } }, response);

      // Then
      assert.equal(result().statusCode, 200);
      assert.deepEqual(result().body, draft);
      assert.equal(Reflect.get(requestBodies[0] as object, 'student_number'), 3);
      assert.equal(Reflect.get(requestBodies[0] as object, 'partner_number'), mission.partnerNumber);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('교사 승인은 원자적 보상 RPC를 호출하고 승인 상태를 반환한다', async () => {
  // Given
  await withEnvironment(async () => {
    const mission = getTodayFriendStudentMission(PREPARED_STATE, DATE_KEY, 3);
    const approved = {
      ...submitTodayFriendSubmission(createTodayFriendSubmission({
        dateKey: DATE_KEY,
        studentNumber: 3,
        partnerNumber: mission.partnerNumber,
        genre: mission.genre,
        payload: createTodayFriendTextPayload(mission.genre, '제출 내용'),
      }), '2026-09-01T01:00:00.000Z'),
      status: 'approved' as const,
      rewardStatus: 'paid' as const,
      reviewedAt: '2026-09-01T01:05:00.000Z',
    };
    const originalFetch = globalThis.fetch;
    const requestBodies: unknown[] = [];
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (init?.body) requestBodies.push(JSON.parse(String(init.body)));
      if (url.includes('rpc/approve_today_friend_submission')) return Response.json({ awarded: true, rewardAmount: 15, balance: 115 });
      if (url.includes('today_friend_settings')) return Response.json([{ state: PREPARED_STATE }]);
      if (url.includes('today_friend_submissions')) return Response.json([toSubmissionRow(approved)]);
      throw new Error(`UNEXPECTED_REQUEST_${url}`);
    };

    try {
      // When
      const { response, result } = createResponse();
      await handler({
        method: 'POST',
        headers: sessionHeaders('teacher'),
        body: { action: 'review', submissionId: approved.id, decision: 'approved', feedback: '' },
      }, response);

      // Then
      assert.equal(result().statusCode, 200);
      assert.equal(Reflect.get(requestBodies[0] as object, 'p_submission_id'), approved.id);
      assert.equal(Reflect.get((result().body as { submissions: readonly TodayFriendSubmission[] }).submissions[0] ?? {}, 'status'), 'approved');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('교사는 인터뷰 질문 목록을 운영 저장소에 교체할 수 있다', async () => {
  // Given
  await withEnvironment(async () => {
    const questions = [{
      id: 'question-new',
      text: '친구가 요즘 가장 기대하는 일은 무엇인가요?',
      active: true,
      usedDateKeys: [],
    }];
    let storedState = PREPARED_STATE;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url.includes('today_friend_settings') && init?.method === 'POST') {
        const row = JSON.parse(String(init.body)) as { state: typeof PREPARED_STATE };
        storedState = row.state;
        return new Response(null, { status: 204 });
      }
      if (url.includes('today_friend_settings')) return Response.json([{ state: storedState }]);
      if (url.includes('today_friend_submissions')) return Response.json([]);
      throw new Error(`UNEXPECTED_REQUEST_${url}`);
    };

    try {
      // When
      const { response, result } = createResponse();
      await handler({
        method: 'POST',
        headers: sessionHeaders('teacher'),
        body: { action: 'replace_questions', dateKey: DATE_KEY, questions },
      }, response);

      // Then
      assert.equal(result().statusCode, 200);
      assert.deepEqual(storedState.questions, questions);
      assert.deepEqual((result().body as { questions: unknown }).questions, questions);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
