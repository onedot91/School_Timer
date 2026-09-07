import assert from 'node:assert/strict';
import test from 'node:test';
import { clearDeviceSession, DEVICE_SESSION_READ_TIMEOUT_MS, loadDeviceSession, registerDeviceSession } from './deviceSessionClient.js';

test('기기 인증 GET은 응답 본문까지 시간 제한을 적용한다', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let requestSignal: AbortSignal | null | undefined;
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    requestSignal = init?.signal;
    return { status: 200, ok: true, json: () => new Promise((_resolve, reject) => {
      requestSignal?.addEventListener('abort', () => reject(new Error('ABORTED')), { once: true });
    }) };
  });
  const request = loadDeviceSession();
  const rejected = assert.rejects(request, /ABORTED/);
  await Promise.resolve();
  t.mock.timers.tick(DEVICE_SESSION_READ_TIMEOUT_MS);
  await rejected;
  assert.equal(requestSignal?.aborted, true);
});

test('기기 인증 조회는 정상 세션과 만료를 구분하고 네트워크 실패를 전달한다', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ role: 'student', studentNumber: 2 })));
  assert.deepEqual(await loadDeviceSession(), { role: 'student', studentNumber: 2 });
  fetchMock.mock.mockImplementation(async () => new Response(null, { status: 401 }));
  assert.equal(await loadDeviceSession(), null);
  fetchMock.mock.mockImplementation(async () => { throw new Error('OFFLINE'); });
  await assert.rejects(loadDeviceSession(), /OFFLINE/);
});

test('인증 조회 해제는 진행 중 요청을 중단한다', async (t) => {
  t.mock.method(globalThis, 'fetch', (_url: unknown, init?: RequestInit) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error('ABORTED')), { once: true });
  }));
  const controller = new AbortController();
  const rejected = assert.rejects(loadDeviceSession(controller.signal), /ABORTED/);
  controller.abort();
  await rejected;
});

test('등록과 삭제 요청에는 GET 시간 제한을 적용하지 않는다', async (t) => {
  const calls: RequestInit[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    calls.push(init ?? {});
    return new Response(null, { status: 204 });
  });
  await registerDeviceSession(2);
  await clearDeviceSession();
  assert.deepEqual(calls.map(({ method, signal }) => ({ method, signal })), [
    { method: 'POST', signal: undefined }, { method: 'DELETE', signal: undefined },
  ]);
});
