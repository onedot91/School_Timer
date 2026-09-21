import assert from 'node:assert/strict';
import test from 'node:test';
import { clearDeviceSession, DEVICE_SESSION_MUTATION_TIMEOUT_MS, DEVICE_SESSION_READ_TIMEOUT_MS, deviceSessionMatchesEntry, loadDeviceSession, registerDeviceSession } from './deviceSessionClient.js';

test('교사 기기 세션은 모든 번호 입장에 사용할 수 있다', () => {
  assert.equal(deviceSessionMatchesEntry({ role: 'teacher' }, 0), true);
  assert.equal(deviceSessionMatchesEntry({ role: 'teacher' }, 9), true);
  assert.equal(deviceSessionMatchesEntry({ role: 'student', studentNumber: 9 }, 9), true);
  assert.equal(deviceSessionMatchesEntry({ role: 'student', studentNumber: 9 }, 8), false);
  assert.equal(deviceSessionMatchesEntry(null, 9), false);
});

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

test('등록과 삭제 요청도 응답이 없으면 중단하고 다시 시도할 수 있다', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const calls: RequestInit[] = [];
  t.mock.method(globalThis, 'fetch', (_url: unknown, init?: RequestInit) => {
    calls.push(init ?? {});
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('ABORTED')), { once: true });
    });
  });
  const registered = assert.rejects(registerDeviceSession(2), /ABORTED/);
  const cleared = assert.rejects(clearDeviceSession(), /ABORTED/);
  t.mock.timers.tick(DEVICE_SESSION_MUTATION_TIMEOUT_MS);
  await Promise.all([registered, cleared]);
  assert.deepEqual(calls.map(({ method, signal }) => ({ method, aborted: signal?.aborted })), [
    { method: 'POST', aborted: true }, { method: 'DELETE', aborted: true },
  ]);
  assert.equal(calls.length, 2, 'unconfirmed session changes must not be replayed automatically');
});
