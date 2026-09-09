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
import { storagePayloadHash } from '../../src/server/storageV2Repository.js';

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

test('다른 탭에서 인증 학생이 바뀌면 친구 제출·임시 저장·영수증 조회를 차단한다', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    const originalRequirement = process.env.STORAGE_REQUIRE_EDIT_REVISIONS;
    let accesses = 0;
    globalThis.fetch = async () => { accesses += 1; return Response.json([]); };
    try {
      for (const strict of ['0', '1']) {
        process.env.STORAGE_REQUIRE_EDIT_REVISIONS = strict;
        for (const action of ['save_draft', 'submit']) {
          const result = createResponse();
          await handler({ method: 'POST', headers: sessionHeaders('student', 2), body: {
            protocolVersion: 2, requestId: 'actor-bound-friend', expectedRevision: 0, expectedStudentNumber: 1,
            action, dateKey: DATE_KEY, payload: { kind: 'interview', answer: '합성 내용' },
          } }, result.response);
          assert.deepEqual(result.result(), { statusCode: 403, body: { error: 'STUDENT_FORBIDDEN' } });
        }
      }
      const missing = createResponse();
      await handler({ method: 'POST', headers: sessionHeaders('student', 2), body: {
        protocolVersion: 2, requestId: 'actor-missing-friend', expectedRevision: 0,
        action: 'submit', dateKey: DATE_KEY, payload: { kind: 'interview', answer: '합성 내용' },
      } }, missing.response);
      assert.deepEqual(missing.result(), { statusCode: 426, body: { error: 'STORAGE_PROTOCOL_UPGRADE_REQUIRED' } });
      const receipt = createResponse();
      await handler({ method: 'GET', headers: sessionHeaders('student', 2), query: { requestId: 'actor-bound-friend', receiptOnly: '1', expectedStudentNumber: '1' } }, receipt.response);
      assert.deepEqual(receipt.result(), { statusCode: 403, body: { error: 'STUDENT_FORBIDDEN' } });
      assert.equal(accesses, 0);
    } finally {
      globalThis.fetch = originalFetch;
      if (originalRequirement === undefined) delete process.env.STORAGE_REQUIRE_EDIT_REVISIONS;
      else process.env.STORAGE_REQUIRE_EDIT_REVISIONS = originalRequirement;
    }
  });
});

test('학생 조회는 자신의 오늘 파트너와 장르만 반환한다', async () => {
  // Given
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes('rpc/load_today_friend_planning_v2')) return Response.json(PREPARED_STATE);
      if (url.includes('rpc/load_today_friend_context_v2')) return Response.json({ state: PREPARED_STATE, revision: 'fixture-plan' });
      if (url.includes('storage_get_receipt')) return Response.json({ found: false });
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
      assert.deepEqual(result().body, { ...expected, planningRevision: 'fixture-plan' });
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
      if (url.includes('rpc/load_today_friend_planning_v2')) return Response.json(PREPARED_STATE);
      if (url.includes('rpc/load_today_friend_context_v2')) return Response.json({ state: PREPARED_STATE, revision: 'fixture-plan' });
      if (url.includes('storage_get_receipt')) return Response.json({ found: false });
      if (url.includes('rpc/persist_today_friend_submission_v2')) return Response.json([toSubmissionRow(draft)], { status: 201 });
      if (url.includes('today_friend_submissions')) return Response.json([]);
      throw new Error(`UNEXPECTED_REQUEST_${url}`);
    };

    try {
      // When
      const { response, result } = createResponse();
      await handler({ method: 'POST', headers: sessionHeaders('student', 3), body: { protocolVersion: 2, action: 'save_draft', dateKey: DATE_KEY, payload, requestId: 'draft-three', expectedRevision: 0 } }, response);

      // Then
      assert.equal(result().statusCode, 200);
      assert.deepEqual(result().body, draft);
      const mutation = requestBodies.find((body) => body && typeof body === 'object' && Reflect.has(body, 'p_submission'));
      assert.ok(mutation && typeof mutation === 'object');
      const saved = Reflect.get(mutation, 'p_submission');
      assert.equal(saved.student_number, 3);
      assert.equal(saved.partner_number, mission.partnerNumber);
      assert.equal(Reflect.get(mutation, 'p_expected_revision'), 0);
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
      if (url.includes('rpc/load_today_friend_planning_v2')) return Response.json(PREPARED_STATE);
      if (url.includes('rpc/load_today_friend_context_v2')) return Response.json({ state: PREPARED_STATE, revision: 'fixture-plan' });
      if (url.includes('storage_get_receipt')) return Response.json({ found: false });
      if (url.includes('today_friend_submissions')) return Response.json([toSubmissionRow(approved)]);
      throw new Error(`UNEXPECTED_REQUEST_${url}`);
    };

    try {
      // When
      const { response, result } = createResponse();
      await handler({
        method: 'POST',
        headers: sessionHeaders('teacher'),
        body: { protocolVersion: 2, action: 'review', submissionId: approved.id, decision: 'approved', feedback: '', expectedRevision: 0, requestId: 'review-three' },
      }, response);

      // Then
      assert.equal(result().statusCode, 200);
      const approval = requestBodies.find((body) => body && typeof body === 'object' && Reflect.has(body, 'p_submission_id'));
      assert.ok(approval && typeof approval === 'object');
      assert.equal(Reflect.get(approval, 'p_submission_id'), approved.id);
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
      if (url.includes('rpc/save_today_friend_planning_v2')) {
        const row = JSON.parse(String(init?.body)) as { p_state: typeof PREPARED_STATE };
        storedState = row.p_state;
        return new Response(null, { status: 204 });
      }
      if (url.includes('rpc/load_today_friend_planning_v2')) return Response.json(storedState);
      if (url.includes('today_friend_submissions')) return Response.json([]);
      throw new Error(`UNEXPECTED_REQUEST_${url}`);
    };

    try {
      // When
      const { response, result } = createResponse();
      await handler({
        method: 'POST',
        headers: sessionHeaders('teacher'),
        body: { protocolVersion: 2, action: 'replace_questions', dateKey: DATE_KEY, questions },
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

test('old TodayFriend clients cannot write and conflict checks preserve the current submission', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    let writes = 0;
    const mission = getTodayFriendStudentMission(PREPARED_STATE, DATE_KEY, 3);
    const payload = createTodayFriendTextPayload(mission.genre, 'local draft');
    const current = { ...createTodayFriendSubmission({ dateKey: DATE_KEY, studentNumber: 3, partnerNumber: mission.partnerNumber, genre: mission.genre, payload }), storageRevision: 3 };
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes('storage_get_receipt')) return Response.json({ found: false });
      if (url.includes('load_today_friend_planning_v2')) return Response.json(PREPARED_STATE);
      if (url.includes('load_today_friend_context_v2')) return Response.json({ state: PREPARED_STATE, revision: 'fixture-plan' });
      if (url.includes('today_friend_submissions?')) return Response.json([{ ...toSubmissionRow(current), storage_revision: 3 }]);
      writes++;
      throw new Error('Unexpected mutation');
    };
    try {
      const old = createResponse();
      await handler({ method: 'POST', headers: sessionHeaders('student', 3), body: { action: 'save_draft', dateKey: DATE_KEY, payload } }, old.response);
      assert.equal(old.result().statusCode, 409);
      const stale = createResponse();
      await handler({ method: 'POST', headers: sessionHeaders('student', 3), body: { protocolVersion: 2, action: 'submit', dateKey: DATE_KEY, payload, requestId: 'stale', expectedRevision: 2 } }, stale.response);
      assert.equal(stale.result().statusCode, 409);
      assert.deepEqual(stale.result().body, { error: 'TODAY_FRIEND_SUBMISSION_CONFLICT' });
      assert.equal(writes, 0);
    } finally { globalThis.fetch = originalFetch; }
  });
});

test('TodayFriend receipt queries are scoped to the signed student and return committed submissions', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    const mission = getTodayFriendStudentMission(PREPARED_STATE, DATE_KEY, 3);
    const saved = submitTodayFriendSubmission(createTodayFriendSubmission({ dateKey: DATE_KEY, studentNumber: 3, partnerNumber: mission.partnerNumber, genre: mission.genre, payload: createTodayFriendTextPayload(mission.genre, 'saved answer') }), '2026-09-01T01:00:00Z');
    globalThis.fetch = async (input, init) => {
      assert.ok(String(input).endsWith('storage_get_receipt'));
      assert.deepEqual(JSON.parse(String(init?.body)), { p_actor_key: 'student:3', p_request_id: 'known-request' });
      return Response.json({ found: true, action: 'today_friend_submission', payloadHash: 'a'.repeat(64), result: [{ ...toSubmissionRow(saved), storage_revision: 1 }], committedAt: '2026-09-01T01:00:00Z' });
    };
    try {
      const result = createResponse();
      await handler({ method: 'GET', headers: sessionHeaders('student', 3), query: { requestId: 'known-request' } }, result.response);
      assert.equal(result.result().statusCode, 200);
      assert.deepEqual(result.result().body, { found: true, submission: { ...saved, storageRevision: 1 } });
    } finally { globalThis.fetch = originalFetch; }
  });
});

test('receiptOnly returns the normalized submission and identity without a planning-state read', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    const mission = getTodayFriendStudentMission(PREPARED_STATE, DATE_KEY, 3);
    const saved = createTodayFriendSubmission({ dateKey: DATE_KEY, studentNumber: 3, partnerNumber: mission.partnerNumber,
      genre: mission.genre, payload: createTodayFriendTextPayload(mission.genre, 'fixture saved') });
    const hash = 'a'.repeat(64), committedAt = '2026-09-01T01:00:00Z';
    globalThis.fetch = async (input, init) => {
      assert.ok(String(input).endsWith('storage_get_receipt'));
      assert.deepEqual(JSON.parse(String(init?.body)), { p_actor_key: 'student:3', p_request_id: 'receipt-only-0001' });
      return Response.json({ found: true, action: 'today_friend_submission', payloadHash: hash, committedAt, result: [toSubmissionRow(saved)] });
    };
    try {
      const result = createResponse();
      await handler({ method: 'GET', headers: sessionHeaders('student', 3), query: { requestId: 'receipt-only-0001', receiptOnly: '1' } }, result.response);
      assert.equal(result.result().statusCode, 200);
      assert.deepEqual(result.result().body, { status: 'committed', action: 'today_friend_submission', payloadHash: hash, committedAt, result: saved });
    } finally { globalThis.fetch = originalFetch; }
  });
});

test('a submission committed between first lookup and mission validation is confirmed, not rejected', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    const mission = getTodayFriendStudentMission(PREPARED_STATE, DATE_KEY, 3);
    const payload = createTodayFriendTextPayload(mission.genre, 'fixture answer');
    const expectedMission = { partnerNumber: mission.partnerNumber, genre: mission.genre, question: mission.question, planningRevision: 'old-plan' };
    const body = { protocolVersion: 2, action: 'submit', dateKey: DATE_KEY, payload, requestId: 'race-submission-0001', expectedRevision: 0, expectedMission };
    const requestPayload = { action: body.action, dateKey: DATE_KEY, payload, expectedRevision: 0,
      expectedMission: { partnerNumber: expectedMission.partnerNumber, genre: expectedMission.genre, question: expectedMission.question } };
    const saved = submitTodayFriendSubmission(createTodayFriendSubmission({ dateKey: DATE_KEY, studentNumber: 3,
      partnerNumber: mission.partnerNumber, genre: mission.genre, payload }), '2026-09-01T01:00:00Z');
    let lookups = 0;
    let failConfirmation = false;
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.endsWith('storage_get_receipt')) {
        if (++lookups === 1) return Response.json({ found: false });
        if (failConfirmation) throw new TypeError('Fixture confirmation unavailable');
        return Response.json({ found: true, action: 'today_friend_submission', payloadHash: storagePayloadHash('today_friend_submission', requestPayload),
          committedAt: '2026-09-01T01:00:00Z', result: [toSubmissionRow(saved)] });
      }
      if (url.includes('load_today_friend_context_v2')) return Response.json({ state: PREPARED_STATE, revision: 'new-plan' });
      if (url.includes('today_friend_submissions?')) return Response.json([]);
      throw new Error('No second mutation is allowed');
    };
    try {
      const result = createResponse();
      await handler({ method: 'POST', headers: sessionHeaders('student', 3), body }, result.response);
      assert.equal(result.result().statusCode, 200);
      assert.deepEqual(result.result().body, saved);
      assert.equal(lookups, 2);
      lookups = 0; failConfirmation = true;
      const unknown = createResponse();
      await handler({ method: 'POST', headers: sessionHeaders('student', 3), body }, unknown.response);
      assert.equal(unknown.result().statusCode, 502);
      assert.deepEqual(unknown.result().body, { error: 'TODAY_FRIEND_CONFIRMATION_UNAVAILABLE' });
    } finally { globalThis.fetch = originalFetch; }
  });
});
