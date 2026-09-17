import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

test('응답 미확인 다운로드는 다른 저장 후에도 같은 요청 ID로 복구한다', async () => {
  const server = await createServer({ configFile: false, envDir: false, logLevel: 'silent', server: { middlewareMode: true, watch: null },
    define: { 'import.meta.env.PROD': 'true' } });
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const previousFetch = globalThis.fetch;
  const stored = new Map<string, string>([['school-timer-entry-number-v1', '0']]);
  Object.defineProperty(globalThis, 'window', { configurable: true, value: Object.assign(new EventTarget(), {
    localStorage: { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value), removeItem: (key: string) => stored.delete(key) }, location: { hash: '' },
  }) });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false } });
  const requests: { requestId: string; command: Record<string, unknown> }[] = [];
  let fail = true;
  globalThis.fetch = async (url, init) => {
    assert.equal(url, '/api/newspaper');
    const request = JSON.parse(String(init?.body));
    requests.push(request);
    if (fail) throw new TypeError('fixture timeout');
    return Response.json(request.command.action === 'download' ? { questions: [] } : { ok: true });
  };
  try {
    const client = await server.ssrLoadModule('/src/lib/newspaperClient.ts');
    const download = { action: 'download', weekKey: '2026-37', mode: 'all', cumulative: true };
    await assert.rejects(client.newspaperCommand(0, download), { code: 'QUESTION_CONFIRMATION_REQUIRED' });
    assert.equal(requests.length, 2);
    assert.equal(requests[0].requestId, requests[1].requestId);
    assert.equal(client.readPendingNewspaperRequests(0).length, 1);
    fail = false;
    await client.newspaperCommand(0, { action: 'topic', weekKey: '2026-38', topicText: '자연', expectedUpdatedAt: null });
    assert.equal(client.readPendingNewspaperRequests(0).length, 1);
    await client.newspaperCommand(0, download);
    assert.equal(requests[3].requestId, requests[0].requestId);
    assert.equal(client.readPendingNewspaperRequests(0).length, 0);
    const stamp = '2026-09-17T07:00:00.000Z';
    globalThis.fetch = async () => Response.json({
      question: { id: '11111111-1111-4111-8111-111111111111', student_number: 9, question_type: 'personal', question_text: '어떻게 사람들은 AI나 로봇을 만들까?', week_key: '2026-38', created_at: stamp, updated_at: stamp, downloaded_at: null },
      reward: { missionType: 'personal_question', weekKey: '2026-38' },
    });
    const saved = await client.newspaperCommand(9, { action: 'submit', studentNumber: 9, questionType: 'personal', questionText: '어떻게 사람들은 AI나 로봇을 만들까?', weekKey: '2026-38', expectedUpdatedAt: null });
    assert.equal(Reflect.get(Object(saved.question), 'student_number'), 9);
    assert.equal(saved.reward, null);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else Reflect.deleteProperty(globalThis, 'window');
    if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator); else Reflect.deleteProperty(globalThis, 'navigator');
    await server.close();
  }
});
