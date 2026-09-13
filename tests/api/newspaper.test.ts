import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../../api/newspaper.js';
import { createDeviceSessionToken } from '../../src/server/deviceSession.js';
import { getKoreanIsoWeekKey } from '../../src/lib/weeklyMission.js';

const secret = 'newspaper-test-session-secret-at-least-32-characters';
const headers = (actor: number) => ({ cookie: `__Host-school-timer-device=${createDeviceSessionToken(actor === 0 ? { role: 'teacher' } : { role: 'student', studentNumber: actor }, secret)}`, 'sec-fetch-site': 'same-origin' });
const invoke = async (request: Parameters<typeof handler>[0]) => {
  let status = 200; let body: unknown; const responseHeaders: Record<string, string> = {};
  const response = { setHeader: (name: string, value: string) => { responseHeaders[name] = value; }, status: (code: number) => { status = code; return response; }, json: (value: unknown) => { body = value; } };
  await handler(request, response); return { status, body, responseHeaders };
};
test('신문 API는 권한·학생 범위·주차·본문 검증 후에만 데이터베이스에 접근한다', async () => {
  const original = { secret: process.env.DEVICE_SESSION_SECRET, url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY, privateWords: process.env.NEWSPAPER_PRIVATE_WORDS, fetch: globalThis.fetch };
  process.env.DEVICE_SESSION_SECRET = secret; process.env.SUPABASE_URL = 'https://fixture.invalid'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  process.env.NEWSPAPER_PRIVATE_WORDS = '가상친구';
  const calls: unknown[] = [];
  globalThis.fetch = async (_url, init) => { calls.push(JSON.parse(String(init?.body))); return Response.json({ ok: true }); };
  const weekKey = getKoreanIsoWeekKey();
  const submit = { action: 'submit', studentNumber: 2, questionType: 'personal', questionText: '하늘은 왜 파란가요?', weekKey, expectedUpdatedAt: null };
  const post = (actor: number, command: Record<string, unknown>) => invoke({ method: 'POST', headers: headers(actor), body: { requestId: crypto.randomUUID(), command } });
  try {
    assert.equal((await invoke({ method: 'GET' })).status, 401);
    assert.equal((await invoke({ method: 'PATCH' })).status, 405);
    for (const action of ['update', 'delete', 'topic', 'download', 'reset']) assert.equal((await post(2, { action })).status, 403);
    assert.equal((await post(2, { ...submit, studentNumber: 3 })).status, 403);
    assert.equal((await post(2, { ...submit, weekKey: '2025-01' })).status, 409);
    assert.equal((await post(2, { ...submit, questionText: '가상친구 왜 그럴까요?' })).status, 400);
    assert.equal((await invoke({ method: 'POST', headers: { ...headers(2), 'sec-fetch-site': 'cross-site' }, body: {} })).status, 403);
    assert.equal(calls.length, 0);
    assert.equal((await post(2, submit)).status, 200);
    assert.equal(calls.length, 1);
    assert.equal(Reflect.get(Object(calls[0]), 'p_actor'), 2);
    assert.equal((await post(0, { action: 'reset', confirmation: '아니오' })).status, 403);
    assert.equal((await post(0, { action: 'reset', confirmation: '모든 기록 초기화' })).status, 200);
    const stamp = new Date().toISOString();
    const row = { id: crypto.randomUUID(), student_number: 3, question_type: 'personal', question_text: '하늘은 왜 파란가요?', week_key: weekKey, created_at: stamp, updated_at: stamp, downloaded_at: stamp };
    globalThis.fetch = async () => Response.json({ weekKey, questions: [row], history: [row], topics: [] });
    const projected = await invoke({ method: 'GET', headers: headers(2), query: { weekKey } });
    assert.equal(projected.status, 200);
    assert.deepEqual(Reflect.get(Object(projected.body), 'history'), []);
    assert.equal(Reflect.get(Object(projected.body), 'questions')[0].downloaded_at, null);
  } finally {
    globalThis.fetch = original.fetch;
    for (const [key, value] of Object.entries({ DEVICE_SESSION_SECRET: original.secret, SUPABASE_URL: original.url, SUPABASE_SERVICE_ROLE_KEY: original.key, NEWSPAPER_PRIVATE_WORDS: original.privateWords })) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
