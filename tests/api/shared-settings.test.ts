import assert from 'node:assert/strict';
import test from 'node:test';

import handler from '../../api/shared-settings.js';
import { createDeviceSessionToken } from '../../src/server/deviceSession.js';

const SESSION_SECRET = 'test-device-session-secret-that-is-at-least-32-characters';
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

const studentHeaders = (studentNumber: number) => ({
  cookie: `__Host-school-timer-device=${createDeviceSessionToken({ role: 'student', studentNumber }, SESSION_SECRET)}`,
  'sec-fetch-site': 'same-origin',
});

test('unregistered devices cannot read shared classroom settings', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;
    globalThis.fetch = async () => { fetchCalled = true; return Response.json([]); };
    try {
      const { response, result } = createResponse();
      await handler({ method: 'GET' }, response);
      assert.equal(result().statusCode, 401);
      assert.equal(fetchCalled, false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('student sessions cannot change teacher-owned settings', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    let fetchCount = 0;
    globalThis.fetch = async () => {
      fetchCount += 1;
      return Response.json([{ id: 'school-timer-main', value: { schedule: ['수학'], currencyBalances: { 7: 100 } }, updated_at: 'v1' }]);
    };
    try {
      const { response, result } = createResponse();
      await handler({
        method: 'PUT',
        headers: studentHeaders(7),
        body: { value: { schedule: ['체육'], currencyBalances: { 7: 100 } }, expectedUpdatedAt: 'v1' },
      }, response);
      assert.equal(result().statusCode, 403);
      assert.equal(fetchCount, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('student sessions can update only their own balance entry', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    const requests: string[] = [];
    globalThis.fetch = async (input) => {
      requests.push(String(input));
      if (requests.length === 1) {
        return Response.json([{ id: 'school-timer-main', value: { schedule: ['수학'], currencyBalances: { 7: 100, 8: 100 } }, updated_at: 'v1' }]);
      }
      return Response.json([{ id: 'school-timer-main' }]);
    };
    try {
      const { response, result } = createResponse();
      await handler({
        method: 'PUT',
        headers: studentHeaders(7),
        body: { value: { schedule: ['수학'], currencyBalances: { 7: 105, 8: 100 } }, expectedUpdatedAt: 'v1' },
      }, response);
      assert.equal(result().statusCode, 200);
      assert.equal(requests.length, 2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('student sessions cannot change another student balance entry', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    let fetchCount = 0;
    globalThis.fetch = async () => {
      fetchCount += 1;
      return Response.json([{ id: 'school-timer-main', value: { currencyBalances: { 7: 100, 8: 100 } }, updated_at: 'v1' }]);
    };
    try {
      const { response, result } = createResponse();
      await handler({
        method: 'PUT',
        headers: studentHeaders(7),
        body: { value: { currencyBalances: { 7: 100, 8: 999 } }, expectedUpdatedAt: 'v1' },
      }, response);
      assert.equal(result().statusCode, 403);
      assert.equal(fetchCount, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
