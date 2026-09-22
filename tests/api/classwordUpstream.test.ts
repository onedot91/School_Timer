import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../../api/classword.js';
import { createDeviceSessionToken } from '../../src/server/deviceSession.js';

const SESSION_SECRET = 'classword-upstream-test-session-secret-32-characters';

const withEnvironment = async (run: () => Promise<void>) => {
  const overrides = {
    SUPABASE_URL: 'https://example.invalid',
    SUPABASE_SERVICE_ROLE_KEY: 'private-test-service-key',
    DEVICE_SESSION_SECRET: SESSION_SECRET,
  };
  const originals = Object.fromEntries(Object.keys(overrides).map((key) => [key, process.env[key]]));
  Object.assign(process.env, overrides);
  try { await run(); }
  finally {
    for (const key of Object.keys(overrides)) {
      if (originals[key] === undefined) delete process.env[key];
      else process.env[key] = originals[key];
    }
  }
};

const createResponse = () => {
  let statusCode = 200;
  let body: unknown;
  const response = {
    setHeader: () => undefined,
    status: (code: number) => { statusCode = code; return response; },
    json: (value: unknown) => { body = value; },
  };
  return { response, result: () => ({ statusCode, body }) };
};

const sessionHeaders = () => ({
  cookie: `__Host-school-timer-device=${createDeviceSessionToken({ role: 'teacher' }, SESSION_SECRET)}`,
  'sec-fetch-site': 'same-origin',
});

for (const scenario of [
  { name: 'network failure', code: 'CLASSWORD_DATABASE_UNAVAILABLE', response: async (): Promise<Response> => { throw new TypeError('private upstream key and payload'); } },
  { name: 'timeout', code: 'CLASSWORD_DATABASE_TIMEOUT', response: async (): Promise<Response> => { throw new DOMException('private timeout details', 'TimeoutError'); } },
  { name: 'malformed success JSON', code: 'CLASSWORD_DATABASE_INVALID_RESPONSE', response: async () => new Response('<private database response>') },
  { name: 'HTTP failure', code: 'CLASSWORD_DATABASE_HTTP_503', response: async () => new Response('private unavailable details', { status: 503 }) },
]) {
  test(`handler returns 502 with safe diagnostic metadata when a command has ${scenario.name}`, async () => {
    await withEnvironment(async () => {
      // Given: an authenticated teacher command and an upstream failure.
      const originalFetch = globalThis.fetch;
      const originalError = console.error;
      const logs: unknown[][] = [];
      let calls = 0;
      globalThis.fetch = async () => { calls += 1; return scenario.response(); };
      console.error = (...values: unknown[]) => { logs.push(values); };
      try {
        const recorder = createResponse();
        // When: the command reaches the handler's final error boundary.
        await handler({ method: 'POST', headers: sessionHeaders(), body: {
          action: 'delete_quiz', dateKey: '2026-09-08', protocolVersion: 2, requestId: 'upstream-test-request',
        } }, recorder.response);
        // Then: response and the single log contain only stable diagnostic fields; no replay occurs.
        assert.deepEqual(recorder.result(), { statusCode: 502, body: { error: scenario.code } });
        assert.deepEqual(logs, [['Failed to handle classword request.', { route: '/api/classword', status: 502, code: scenario.code }]]);
        assert.equal(calls, 1);
      } finally { globalThis.fetch = originalFetch; console.error = originalError; }
    });
  });
}

test('handler sanitizes unexpected in-process failures without changing their 500 status', async () => {
  await withEnvironment(async () => {
    // Given: an unexpected error while the API reads request metadata.
    const originalError = console.error;
    const logs: unknown[][] = [];
    console.error = (...values: unknown[]) => { logs.push(values); };
    try {
      const recorder = createResponse();
      // When: request processing throws outside the repository.
      await handler({ method: 'GET', headers: sessionHeaders(), get query(): undefined {
        throw new Error('private in-process details');
      } }, recorder.response);
      // Then: no raw error object or message reaches the log or response.
      assert.deepEqual(recorder.result(), { statusCode: 500, body: { error: 'CLASSWORD_REQUEST_FAILED' } });
      assert.deepEqual(logs, [['Failed to handle classword request.', {
        route: '/api/classword', status: 500, code: 'CLASSWORD_REQUEST_FAILED',
      }]]);
    } finally { console.error = originalError; }
  });
});

test('handler keeps domain conflicts as 409 without an operational error log', async () => {
  await withEnvironment(async () => {
    // Given: the RPC rejects a duplicate request using an approved business code.
    const originalFetch = globalThis.fetch;
    const originalError = console.error;
    const logs: unknown[][] = [];
    globalThis.fetch = async () => Response.json({ message: 'STORAGE_REQUEST_REUSED' }, { status: 400 });
    console.error = (...values: unknown[]) => { logs.push(values); };
    try {
      const recorder = createResponse();
      // When: the authenticated command is rejected.
      await handler({ method: 'POST', headers: sessionHeaders(), body: {
        action: 'delete_quiz', dateKey: '2026-09-08', protocolVersion: 2, requestId: 'upstream-conflict-request',
      } }, recorder.response);
      // Then: business rejection is preserved and does not become an operational incident.
      assert.deepEqual(recorder.result(), { statusCode: 409, body: { error: 'STORAGE_REQUEST_REUSED' } });
      assert.deepEqual(logs, []);
    } finally { globalThis.fetch = originalFetch; console.error = originalError; }
  });
});
