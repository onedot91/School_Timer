import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';

import handler from '../../api/classword.js';
import { createDeviceSessionToken } from '../../src/server/deviceSession.js';

const SECRET = 'annual-read-classword-device-session-test-secret';
const setup = (context: TestContext, now = '2026-09-12T01:00:00Z') => {
  context.mock.timers.enable({ apis: ['Date'], now: new Date(now) });
  const originals = { ...process.env };
  process.env.SUPABASE_URL = 'https://annual-read.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'annual-read-test-key';
  process.env.DEVICE_SESSION_SECRET = SECRET;
  context.after(() => {
    for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'DEVICE_SESSION_SECRET']) {
      if (originals[key] === undefined) delete process.env[key];
      else process.env[key] = originals[key];
    }
  });
};

const invoke = async (query: Record<string, string>, role: 'teacher' | 'student' = 'student') => {
  let statusCode = 200;
  let body: unknown;
  const response = {
    setHeader: () => undefined,
    status: (value: number) => { statusCode = value; return response; },
    json: (value: unknown) => { body = value; },
  };
  await handler({ method: 'GET', query, headers: {
    cookie: `__Host-school-timer-device=${createDeviceSessionToken(
      role === 'teacher' ? { role } : { role, studentNumber: 8 }, SECRET,
    )}`,
  } }, response);
  return { statusCode, body };
};

for (const query of [{ dateKey: '2026-09-12' }, { quiz: '1', dateKey: '2026-09-13' }]) {
  test(`student weekend ${query.quiz ? 'quiz' : 'board'} reads Friday without mutations`, async (context) => {
    // Given
    setup(context);
    const requests: Array<{ url: string; method: string }> = [];
    context.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(input), method: init?.method ?? 'GET' });
      return Response.json([]);
    });
    // When
    const result = await invoke(query);
    // Then
    assert.equal(result.statusCode, 200);
    assert.ok(result.body && typeof result.body === 'object' && 'dateKey' in result.body);
    assert.equal(result.body.dateKey, '2026-09-11');
    assert.equal(requests.every(({ method }) => method === 'GET'), true);
    assert.equal(requests.every(({ url }) => url.includes('2026-09-11')), true);
  });
}

test('weekend student lookup honors the Friday teacher topic', async (context) => {
  // Given
  setup(context);
  context.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => (
    Response.json(String(input).includes('/classword_rounds?') ? [{ topic: '교사가 정한 금요일 주제' }] : [])
  ));
  // When
  const result = await invoke({});
  // Then
  assert.deepEqual(result, { statusCode: 200, body: {
    dateKey: '2026-09-11', topic: '교사가 정한 금요일 주제', source: 'teacher', entries: [],
  } });
});

test('teacher weekend editing reads the specifically requested date', async (context) => {
  // Given
  setup(context);
  const requests: string[] = [];
  context.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    requests.push(String(input));
    return Response.json([]);
  });
  // When
  const result = await invoke({ quiz: '1', dateKey: '2026-09-13' }, 'teacher');
  // Then
  assert.equal(result.statusCode, 200);
  assert.ok(result.body && typeof result.body === 'object' && 'dateKey' in result.body);
  assert.equal(result.body.dateKey, '2026-09-13');
  assert.equal(requests.every((url) => url.includes('2026-09-13')), true);
});

test('weekend quiz lookup uses the Friday teacher override without exposing its answer', async (context) => {
  // Given
  setup(context);
  context.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => (
    Response.json(String(input).includes('/classword_quizzes?') ? [{
      question_id: 'teacher-friday', initial_hint: 'ㄷㅇ', meaning: '친구에게 힘을 보탬', answer: '도움',
      written_prefix: '친구에게 ', written_suffix: '을 주었다.', spoken_prefix: '내가 ', spoken_suffix: '을 줄게.',
    }] : [])
  ));
  // When
  const result = await invoke({ quiz: '1' });
  // Then
  assert.equal(result.statusCode, 200);
  assert.ok(result.body && typeof result.body === 'object' && 'question' in result.body);
  const question = result.body.question;
  assert.ok(question && typeof question === 'object' && 'id' in question);
  assert.equal(question.id, 'teacher-friday');
  assert.equal('answer' in question, false);
  assert.equal('answer' in result.body, false);
});

test('teacher calendar merges automatic weekdays with stored legacy and override rounds', async (context) => {
  // Given
  setup(context);
  context.mock.method(globalThis, 'fetch', async () => Response.json([
    { round_date: '2026-09-04', topic: '기존 주제' },
    { round_date: '2026-09-14', topic: '교사 주제' },
  ]));
  // When
  const result = await invoke({ monthKey: '2026-09' }, 'teacher');
  // Then
  assert.equal(result.statusCode, 200);
  assert.ok(Array.isArray(result.body));
  assert.equal(result.body.length, 19);
  assert.deepEqual(result.body.find((row: { dateKey: string }) => row.dateKey === '2026-09-14'), {
    dateKey: '2026-09-14', topic: '교사 주제', source: 'teacher',
  });
  assert.equal(result.body.some((row: { dateKey: string }) => row.dateKey === '2026-09-12'), false);
  assert.equal(result.body.filter((row: { source: string }) => row.source === 'automatic').length, 17);
});

test('used topics include elapsed automatic days and all stored teacher selections', async (context) => {
  // Given
  setup(context, '2026-09-13T15:00:00Z');
  context.mock.method(globalThis, 'fetch', async () => Response.json([
    { topic: '미래에 직접 입력한 주제' }, { topic: '미래에 직접 입력한 주제' },
  ]));
  // When
  const result = await invoke({ usedTopics: '1' }, 'teacher');
  // Then
  assert.equal(result.statusCode, 200);
  assert.ok(Array.isArray(result.body));
  assert.equal(result.body.length, 7);
  assert.ok(result.body.includes('미래에 직접 입력한 주제'));
});

test('invalid requested calendar date returns 400 with no upstream request', async (context) => {
  // Given
  setup(context);
  const fetch = context.mock.method(globalThis, 'fetch', async () => Response.json([]));
  // When
  const result = await invoke({ quiz: '1', dateKey: '2026-09-31' }, 'teacher');
  // Then
  assert.equal(result.statusCode, 400);
  assert.equal(fetch.mock.callCount(), 0);
});
