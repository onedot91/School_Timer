import assert from 'node:assert/strict';
import test from 'node:test';

import handler from '../../api/classword.js';
import { getClasswordEntryRetentionCutoff, getKoreanDateKey } from '../../src/lib/classword.js';
import { getDailyClasswordQuiz } from '../../src/lib/classwordQuiz.js';
import { createDeviceSessionToken } from '../../src/server/deviceSession.js';

const SESSION_SECRET = 'test-device-session-secret-that-is-at-least-32-characters';
const TODAY = getKoreanDateKey();
const QUIZ_ANSWERS: Readonly<Record<string, string>> = {
  'saving-resources': '절약',
  'caring-for-others': '배려',
  'finishing-your-duty': '책임',
  'working-together': '협동',
  'looking-carefully': '관찰',
  'putting-into-action': '실천',
  'showing-respect': '존중',
};

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

test('학생 조회는 전용 라운드와 낱말 행을 내부 응답으로 변환한다', async () => {
  // Given
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    const requestedUrls: string[] = [];
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      requestedUrls.push(url);
      if (init?.method === 'DELETE') return new Response(null, { status: 204 });
      if (url.includes('/classword_rounds')) {
        return Response.json([{ round_date: '2026-08-29', topic: '동물' }]);
      }
      return Response.json([{
        id: 'entry-1', round_date: '2026-08-29', initial: 'ㄱ', word: '강아지',
        student_number: 3, created_at: '2026-08-29T01:00:00.000Z', updated_at: '2026-08-29T01:00:00.000Z',
      }]);
    };

    try {
      // When
      const { response, result } = createResponse();
      await handler({
        method: 'GET',
        query: { dateKey: '2026-08-29' },
        headers: sessionHeaders('student'),
      }, response);

      // Then
      assert.equal(result().statusCode, 200);
      assert.deepEqual(result().body, {
        dateKey: '2026-08-29',
        topic: '동물',
        entries: [{
          id: 'entry-1', dateKey: '2026-08-29', initial: 'ㄱ', word: '강아지', studentNumber: 3,
          createdAt: '2026-08-29T01:00:00.000Z', updatedAt: '2026-08-29T01:00:00.000Z',
        }],
      });
      const legacyHost = ['classword', 'vercel', 'app'].join('.');
      assert.equal(requestedUrls.some((url) => url.includes(legacyHost)), false);
      assert.equal(
        requestedUrls.some((url) => url.includes(
          `classword_entries?round_date=lt.${getClasswordEntryRetentionCutoff(getKoreanDateKey())}`,
        )),
        true,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('학생 세션은 교사 전용 주제 저장을 호출할 수 없다', async () => {
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
      await handler({
        method: 'POST',
        headers: sessionHeaders('student'),
        body: { action: 'save_topic', dateKey: '2026-08-29', topic: '동물' },
      }, response);

      // Then
      assert.equal(result().statusCode, 403);
      assert.deepEqual(result().body, { error: 'TEACHER_REQUIRED' });
      assert.equal(fetchCalled, false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('교사 주제 저장은 PostgREST의 빈 201 성공 응답을 처리한다', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    const requests: Array<{ url: string; method: string }> = [];
    globalThis.fetch = async (input, init) => {
      const method = init?.method ?? 'GET';
      requests.push({ url: String(input), method });
      if (method === 'DELETE') return new Response(null, { status: 204 });
      if (method === 'POST') return new Response(null, { status: 201 });
      return Response.json([]);
    };

    try {
      const { response, result } = createResponse();
      await handler({
        method: 'POST',
        headers: sessionHeaders('teacher'),
        body: { action: 'save_topic', dateKey: '2026-08-30', topic: '음식' },
      }, response);

      assert.equal(result().statusCode, 200);
      assert.deepEqual(result().body, { saved: true });
      assert.equal(requests.some(({ url, method }) => (
        method === 'POST' && url.includes('classword_rounds?on_conflict=round_date')
      )), true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('전체 사용 주제 조회는 교사에게만 허용하고 중복을 제거한다', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => Response.json([
      { topic: '동물' },
      { topic: '동물' },
      { topic: '운동' },
    ]);

    try {
      const studentResponse = createResponse();
      await handler({
        method: 'GET',
        query: { usedTopics: '1' },
        headers: sessionHeaders('student'),
      }, studentResponse.response);
      assert.equal(studentResponse.result().statusCode, 403);

      const teacherResponse = createResponse();
      await handler({
        method: 'GET',
        query: { usedTopics: '1' },
        headers: sessionHeaders('teacher'),
      }, teacherResponse.response);
      assert.equal(teacherResponse.result().statusCode, 200);
      assert.deepEqual(teacherResponse.result().body, ['동물', '운동']);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('학생 제출은 오늘 낱말을 저장하고 당일 5고마를 지급한다', async () => {
  // Given
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    const requestBodies: unknown[] = [];
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (init?.body) requestBodies.push(JSON.parse(String(init.body)));
      if (init?.method === 'DELETE') return new Response(null, { status: 204 });
      if (url.includes('/classword_rounds')) {
        return Response.json([{ round_date: TODAY, topic: '동물' }]);
      }
      if (url.includes('/classword_entries')) return Response.json([{
        id: 'entry-new', round_date: TODAY, initial: 'ㄱ', word: '강아지',
        student_number: 3, created_at: '2026-08-29T01:00:00.000Z', updated_at: '2026-08-29T01:00:00.000Z',
      }]);
      if (url.includes('/rpc/claim_weekly_mission_reward')) return Response.json({
        missionType: 'classword_word_entry',
        weekKey: TODAY,
        completed: true,
        awarded: true,
        rewardAmount: 5,
        balance: 105,
      });
      return Response.json([]);
    };

    try {
      // When
      const { response, result } = createResponse();
      await handler({
        method: 'POST',
        headers: sessionHeaders('student', 3),
        body: { action: 'save_entry', dateKey: TODAY, initial: 'ㄱ', word: '강아지' },
      }, response);

      // Then
      assert.equal(result().statusCode, 200);
      assert.equal(Reflect.get(result().body as object, 'awarded'), true);
      assert.equal(Reflect.get(result().body as object, 'balance'), 105);
      assert.equal(Reflect.get(requestBodies[0] as object, 'student_number'), 3);
      assert.equal(Reflect.get(requestBodies[1] as object, 'p_source_event_id'), 'entry-new');
      assert.equal(requestBodies.length, 2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('학생 화면의 반복 조회 뒤에도 낱말 저장과 퀴즈 조회가 계속 동작한다', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    const headers = {
      ...sessionHeaders('student', 9),
      'x-forwarded-for': '198.51.100.29',
    };
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (init?.method === 'DELETE') return new Response(null, { status: 204 });
      if (url.includes('/classword_rounds')) {
        return Response.json([{ round_date: TODAY, topic: '자연에서 볼 수 있는 것' }]);
      }
      if (url.includes('/classword_quiz_completions')) return Response.json([]);
      if (url.includes('/classword_entries') && init?.method === 'POST') {
        return Response.json([{
          id: 'entry-after-polling', round_date: TODAY, initial: 'ㄱ', word: '고구마',
          student_number: 9, created_at: '2026-08-30T01:00:00.000Z', updated_at: '2026-08-30T01:00:00.000Z',
        }], { status: 201 });
      }
      if (url.includes('/classword_entries')) return Response.json([]);
      return Response.json({
        missionType: 'classword_word_entry', weekKey: '2026-35', completed: true,
        awarded: true, rewardAmount: 5, balance: 105,
      });
    };

    try {
      const pollingStatuses: number[] = [];
      for (let cycle = 0; cycle < 5; cycle += 1) {
        for (const query of [{ dateKey: TODAY }, { quiz: '1', dateKey: TODAY }]) {
          const requestResponse = createResponse();
          await handler({ method: 'GET', query, headers }, requestResponse.response);
          pollingStatuses.push(requestResponse.result().statusCode);
        }
      }

      const saveResponse = createResponse();
      await handler({
        method: 'POST',
        headers,
        body: { action: 'save_entry', dateKey: TODAY, initial: 'ㄱ', word: '고구마' },
      }, saveResponse.response);

      const nextQuizResponse = createResponse();
      await handler({
        method: 'GET',
        query: { quiz: '1', dateKey: TODAY },
        headers,
      }, nextQuizResponse.response);

      assert.deepEqual(pollingStatuses, Array.from({ length: 10 }, () => 200));
      assert.equal(saveResponse.result().statusCode, 200);
      assert.equal(nextQuizResponse.result().statusCode, 200);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('오늘의 주제가 없으면 학생 낱말 제출을 거부한다', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    let entryWriteCalled = false;
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (init?.method === 'DELETE') return new Response(null, { status: 204 });
      if (url.includes('/classword_rounds')) return Response.json([]);
      if (url.includes('/classword_entries') && init?.method === 'POST') entryWriteCalled = true;
      return Response.json([]);
    };

    try {
      const { response, result } = createResponse();
      await handler({
        method: 'POST',
        headers: sessionHeaders('student', 3),
        body: { action: 'save_entry', dateKey: TODAY, initial: 'ㄱ', word: '강아지' },
      }, response);

      assert.equal(result().statusCode, 400);
      assert.deepEqual(result().body, { error: 'CLASSWORD_TOPIC_REQUIRED' });
      assert.equal(entryWriteCalled, false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('동시에 같은 초성을 제출하면 DB UNIQUE 충돌을 이해하기 쉬운 오류로 반환한다', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      if (init?.method === 'DELETE') return new Response(null, { status: 204 });
      if (String(input).includes('/classword_rounds')) {
        return Response.json([{ round_date: TODAY, topic: '동물' }]);
      }
      return Response.json({ code: '23505' }, { status: 409 });
    };

    try {
      const { response, result } = createResponse();
      await handler({
        method: 'POST',
        headers: sessionHeaders('student', 3),
        body: { action: 'save_entry', dateKey: TODAY, initial: 'ㄱ', word: '강아지' },
      }, response);

      assert.equal(result().statusCode, 409);
      assert.deepEqual(result().body, { error: 'CLASSWORD_ENTRY_CONFLICT' });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('학생 삭제는 세션 학생 번호로 제한하고 교사는 날짜 전체를 관리한다', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    const requests: Array<{ url: string; method: string }> = [];
    globalThis.fetch = async (input, init) => {
      requests.push({ url: String(input), method: init?.method ?? 'GET' });
      return init?.headers && Reflect.get(init.headers, 'Prefer') === 'return=representation'
        ? Response.json([{ id: 'entry-1' }])
        : new Response(null, { status: 204 });
    };

    try {
      const studentResponse = createResponse();
      await handler({
        method: 'POST',
        headers: sessionHeaders('student', 3),
        body: { action: 'delete_entry', entryId: 'entry-1' },
      }, studentResponse.response);
      assert.equal(studentResponse.result().statusCode, 200);
      assert.equal(requests.some(({ url }) => /student_number=eq\.3/.test(url)), true);

      const topicResponse = createResponse();
      await handler({
        method: 'POST',
        headers: sessionHeaders('teacher'),
        body: { action: 'save_topic', dateKey: '2026-08-29', topic: '동물' },
      }, topicResponse.response);
      assert.equal(topicResponse.result().statusCode, 200);

      const clearResponse = createResponse();
      await handler({
        method: 'POST',
        headers: sessionHeaders('teacher'),
        body: { action: 'delete_date_entries', dateKey: '2026-08-29', confirmation: 'DELETE' },
      }, clearResponse.response);
      assert.equal(clearResponse.result().statusCode, 200);
      assert.equal(requests.some(({ url }) => url.includes('round_date=eq.2026-08-29')), true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('학생 퀴즈 조회는 힌트와 자신의 완료·보상 상태만 반환한다', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input) => String(input).includes('/weekly_mission_rewards')
      ? Response.json([{ reward_amount: 7 }])
      : Response.json([{
          quiz_date: TODAY,
          question_id: getDailyClasswordQuiz(TODAY).id,
          student_number: 3,
          completed_at: '2026-08-30T01:00:00.000Z',
        }]);

    try {
      const { response, result } = createResponse();
      await handler({
        method: 'GET',
        query: { quiz: '1', dateKey: TODAY },
        headers: sessionHeaders('student', 3),
      }, response);

      assert.equal(result().statusCode, 200);
      assert.equal(Reflect.get(result().body as object, 'completed'), true);
      assert.equal(Reflect.get(result().body as object, 'rewardAmount'), 7);
      const question = Reflect.get(result().body as object, 'question');
      assert.equal(Object.hasOwn(question as object, 'answer'), false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('퀴즈 오답은 저장하지 않고 정답은 학생 번호로 완료 상태를 저장한다', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    const question = getDailyClasswordQuiz(TODAY);
    const answer = QUIZ_ANSWERS[question.id];
    assert.ok(answer);
    let completionSaved = false;
    let rewardClaimed = false;
    let savedStudentNumber: unknown;
    let rewardMissionType: unknown;
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url.includes('/rpc/claim_weekly_mission_reward')) {
        const body = JSON.parse(String(init?.body));
        rewardMissionType = Reflect.get(body as object, 'p_mission_type');
        const awarded = !rewardClaimed;
        rewardClaimed = true;
        return Response.json({
          missionType: 'classword_quiz_correct',
          weekKey: TODAY,
          completed: true,
          awarded,
          rewardAmount: 7,
          balance: 107,
        });
      }
      if (init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        completionSaved = true;
        savedStudentNumber = Reflect.get(body as object, 'student_number');
        return new Response(null, { status: 204 });
      }
      return completionSaved
        ? Response.json([{
            quiz_date: TODAY,
            question_id: question.id,
            student_number: 3,
            completed_at: '2026-08-30T01:00:00.000Z',
          }])
        : Response.json([]);
    };

    try {
      const wrong = createResponse();
      await handler({
        method: 'POST',
        headers: sessionHeaders('student', 3),
        body: { action: 'answer_quiz', dateKey: TODAY, answer: '오답' },
      }, wrong.response);
      assert.equal(Reflect.get(wrong.result().body as object, 'correct'), false);
      assert.equal(completionSaved, false);

      const correct = createResponse();
      await handler({
        method: 'POST',
        headers: sessionHeaders('student', 3),
        body: { action: 'answer_quiz', dateKey: TODAY, answer },
      }, correct.response);
      assert.equal(Reflect.get(correct.result().body as object, 'correct'), true);
      assert.equal(Reflect.get(correct.result().body as object, 'awarded'), true);
      assert.equal(Reflect.get(correct.result().body as object, 'rewardAmount'), 7);
      assert.equal(Reflect.get(correct.result().body as object, 'balance'), 107);
      assert.equal(savedStudentNumber, 3);
      assert.equal(rewardMissionType, 'classword_quiz_correct');

      const repeated = createResponse();
      await handler({
        method: 'POST',
        headers: sessionHeaders('student', 3),
        body: { action: 'answer_quiz', dateKey: TODAY, answer },
      }, repeated.response);
      assert.equal(Reflect.get(repeated.result().body as object, 'awarded'), false);
      assert.equal(Reflect.get(repeated.result().body as object, 'rewardAmount'), 7);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('교사 퀴즈 조회는 선택 날짜의 정답자 번호와 인원을 확인할 수 있다', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    const question = getDailyClasswordQuiz(TODAY);
    globalThis.fetch = async () => Response.json([2, 5].map((studentNumber) => ({
      quiz_date: TODAY,
      question_id: question.id,
      student_number: studentNumber,
      completed_at: '2026-08-30T01:00:00.000Z',
    })));

    try {
      const { response, result } = createResponse();
      await handler({
        method: 'GET',
        query: { quiz: '1', dateKey: TODAY },
        headers: sessionHeaders('teacher'),
      }, response);
      assert.deepEqual(Reflect.get(result().body as object, 'correctStudentNumbers'), [2, 5]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
