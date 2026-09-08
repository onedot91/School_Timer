import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';

import handler from '../../api/classword.js';
import { createDeviceSessionToken } from '../../src/server/deviceSession.js';

const SECRET = 'annual-classword-device-session-secret-for-tests';
const setup = (context: TestContext, now: string) => {
  context.mock.timers.enable({ apis: ['Date'], now: new Date(now) });
  const originals = { ...process.env };
  process.env.SUPABASE_URL = 'https://annual-classword.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'annual-test-key';
  process.env.DEVICE_SESSION_SECRET = SECRET;
  context.after(() => {
    for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'DEVICE_SESSION_SECRET']) {
      if (originals[key] === undefined) delete process.env[key];
      else process.env[key] = originals[key];
    }
  });
};

const invoke = async (body: unknown) => {
  let statusCode = 200;
  let responseBody: unknown;
  const response = {
    setHeader: () => undefined,
    status: (value: number) => { statusCode = value; return response; },
    json: (value: unknown) => { responseBody = value; },
  };
  assert.ok(body && typeof body === 'object');
  await handler({ method: 'POST', body: { protocolVersion: 2, requestId: 'annual-test-request', ...body }, headers: {
    cookie: `__Host-school-timer-device=${createDeviceSessionToken({ role: 'student', studentNumber: 8 }, SECRET)}`,
    'sec-fetch-site': 'same-origin',
  } }, response);
  return { statusCode, body: responseBody };
};

for (const today of ['2026-09-12', '2026-09-13']) {
  for (const body of [
    { action: 'save_entry', dateKey: '2026-09-11', initial: 'ㄱ', word: '강아지' },
    { action: 'answer_quiz', dateKey: today, answer: '정답' },
    { action: 'delete_entry', entryId: 'friday-entry', dateKey: '2026-09-11' },
  ]) {
    test(`${today} ${body.action} rejects before any upstream operation`, async (context) => {
      // Given
      setup(context, `${today}T01:00:00Z`);
      const fetch = context.mock.method(globalThis, 'fetch', async () => Response.json([]));
      // When
      const result = await invoke(body);
      // Then
      assert.deepEqual(result, { statusCode: 403, body: { error: 'CLASSWORD_WEEKEND_CLOSED' } });
      assert.equal(fetch.mock.callCount(), 0);
    });
  }
}

for (const action of ['save_entry', 'answer_quiz']) {
  test(`${action} rejects Friday participation after Korean Monday rollover`, async (context) => {
    // Given
    setup(context, '2026-09-13T15:00:00Z');
    const fetch = context.mock.method(globalThis, 'fetch', async () => Response.json([]));
    // When
    const result = await invoke({ action, dateKey: '2026-09-11', initial: 'ㄱ', word: '강아지', answer: '정답' });
    // Then
    assert.deepEqual(result, { statusCode: 403, body: { error: 'TODAY_ONLY' } });
    assert.equal(fetch.mock.callCount(), 0);
  });
}

test('invalid calendar dates return 400 before an upstream operation', async (context) => {
  // Given
  setup(context, '2026-09-07T01:00:00Z');
  const fetch = context.mock.method(globalThis, 'fetch', async () => Response.json([]));
  // When
  const result = await invoke({ action: 'save_entry', dateKey: '2026-09-31', initial: 'ㄱ', word: '강아지' });
  // Then
  assert.equal(result.statusCode, 400);
  assert.equal(fetch.mock.callCount(), 0);
});

test('fresh weekday participation uses the automatic topic without saving a round', async (context) => {
  // Given
  setup(context, '2026-09-07T01:00:00Z');
  const requests: Array<{ url: string; method: string }> = [];
  context.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    requests.push({ url, method });
    if (method === 'DELETE') return new Response(null, { status: 204 });
    if (url.includes('/classword_rounds?')) return Response.json([]);
    if (url.endsWith('/rpc/classword_command_v2') && JSON.parse(String(init?.body)).p_action === 'save_entry') return Response.json({entry:{
      id: 'monday-entry', round_date: '2026-09-07', initial: 'ㄱ', word: '강아지', student_number: 8,
      created_at: '2026-09-07T01:00:00Z', updated_at: '2026-09-07T01:00:00Z',
    },reward:{weekKey:'2026-09-07',missionType:'classword_word_entry',completed:true,awarded:true,rewardAmount:5,balance:15}});
    return Response.json({ weekKey: '2026-09-07', missionType: 'classword_word_entry', completed: true, awarded: true, rewardAmount: 5, balance: 15 });
  });
  // When
  const result = await invoke({ action: 'save_entry', dateKey: '2026-09-07', initial: 'ㄱ', word: '강아지' });
  // Then
  assert.equal(result.statusCode, 200);
  assert.equal(requests.some(({ url, method }) => url.includes('/classword_rounds?') && method !== 'GET'), false);
  assert.equal(requests.filter(({ url }) => url.includes('/rpc/claim_weekly_mission_reward')).length, 0);
  assert.equal(requests.filter(({ url }) => url.endsWith('/rpc/classword_command_v2')).length, 2);
});

for (const action of ['save_entry', 'delete_entry']) {
  test(`${action} cannot change an old entry ID by supplying today's date`, async (context) => {
    // Given
    setup(context, '2026-09-07T01:00:00Z');
    const requests: Array<{url:string;body:Record<string, unknown>}> = [];
    context.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body ?? '{}'));
      requests.push({url,body});
      if (body.p_action && body.p_action !== 'prune') return Response.json({message:'CLASSWORD_ENTRY_FORBIDDEN'},{status:400});
      if (url.includes('/classword_rounds?')) return Response.json([{ topic: '동물' }]);
      return Response.json([]);
    });
    // When
    const result = await invoke({ action, entryId: 'old-entry', expectedRevision: '2026-09-04T01:00:00Z', dateKey: '2026-09-07', initial: 'ㄱ', word: '강아지' });
    // Then
    assert.deepEqual(result, { statusCode: 403, body: { error: 'CLASSWORD_ENTRY_FORBIDDEN' } });
    const target = requests.find(({body}) => body.p_action === action);
    assert.equal(target?.body.p_actor, 8);
    assert.ok(target?.body.p_payload && typeof target.body.p_payload === 'object');
    assert.equal(Reflect.get(target.body.p_payload,'dateKey'), '2026-09-07');
    assert.equal(Reflect.get(target.body.p_payload,'entryId'), 'old-entry');
  });
}

test('replaying a completed annual quiz preserves completion and receives the idempotent reward result', async (context) => {
  // Given
  setup(context, '2026-09-07T01:00:00Z');
  const mutations: string[] = [];
  context.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === 'POST') {
      mutations.push(url);
      return Response.json({completion:{quiz_date:'2026-09-07',question_id:'teacher-annual',student_number:8,completed_at:'2026-09-07T00:00:00Z'},reward:{missionType:'classword_quiz_correct',completed:true,awarded:false,rewardAmount:3,balance:13}});
    }
    if (url.includes('/classword_quizzes?')) return Response.json([{
      question_id: 'teacher-annual', initial_hint: 'ㄷㅇ', meaning: '친구에게 힘을 보탬', answer: '도움',
      written_prefix: '친구에게 ', written_suffix: '을 주었다.', spoken_prefix: '내가 ', spoken_suffix: '을 줄게.',
    }]);
    if (url.includes('/classword_quiz_completions?')) return Response.json([{
      quiz_date: '2026-09-07', question_id: 'teacher-annual', student_number: 8, completed_at: '2026-09-07T00:00:00Z',
    }]);
    return Response.json({ missionType: 'classword_quiz_correct', awarded: false, rewardAmount: 3, balance: 13 });
  });
  // When
  const result = await invoke({ action: 'answer_quiz', dateKey: '2026-09-07', answer: '도움' });
  // Then
  assert.equal(result.statusCode, 200);
  assert.ok(result.body && typeof result.body === 'object' && 'awarded' in result.body);
  assert.equal(result.body.awarded, false);
  assert.equal(mutations.length, 1);
  assert.ok(mutations[0]?.endsWith('/rpc/classword_command_v2'));
});
