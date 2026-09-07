import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../../api/save-alerts.js';
import { createDeviceSessionToken, DEVICE_SESSION_COOKIE_NAME } from '../../src/server/deviceSession.js';
import { SAVE_FAILURE_ROW_PREFIX } from '../../src/lib/saveFailure.js';

const secret = 'save-alerts-disposable-test-secret-at-least-32-characters';
const report = { id: 'failure-test-123', studentNumber: 3, feature: 'emotion', code: 'network', occurredAt: '2026-09-07T01:00:00.000Z' };
const cookie = (teacher: boolean) => `${DEVICE_SESSION_COOKIE_NAME}=${createDeviceSessionToken(teacher ? { role: 'teacher' } : { role: 'student', studentNumber: 3 }, secret)}`;
let requestIndex = 0;
const invoke = async (method: string, body?: unknown, teacher = false, extraHeaders = {}) => {
  let status = 200;
  let value: unknown;
  const response = { setHeader() {}, status(code: number) { status = code; return response; }, json(body: unknown) { value = body; } };
  await handler({ method, body, headers: { cookie: cookie(teacher), 'sec-fetch-site': 'same-origin', 'x-forwarded-for': `test-${++requestIndex}`, ...extraHeaders } }, response);
  return { status, value };
};

test('save alerts use independent rows, enforce roles, and retain acknowledgement across retries', async (t) => {
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, '/rest/v1/app_settings');
    const idFilter = url.searchParams.get('id');
    if (init?.method === 'POST') {
      assert.equal(new Headers(init.headers).get('prefer'), 'resolution=ignore-duplicates,return=minimal');
      const row = JSON.parse(String(init.body));
      assert.ok(row.id.startsWith(SAVE_FAILURE_ROW_PREFIX));
      if (!rows.has(row.id)) rows.set(row.id, row.value);
      return new Response(null, { status: 201 });
    }
    if (init?.method === 'PATCH') {
      rows.set(idFilter!.slice(3), JSON.parse(String(init.body)).value);
      return new Response(null, { status: 204 });
    }
    const selected = idFilter?.startsWith('eq.')
      ? [...rows].filter(([id]) => id === idFilter.slice(3))
      : [...rows].filter(([, value]) => value.acknowledgedAt === null);
    return Response.json(selected.map(([, value]) => ({ value })));
  });
  const rows = new Map<string, Record<string, unknown>>();
  const previous = { ...process.env };
  Object.assign(process.env, { SUPABASE_URL: 'https://save-alerts.invalid', SUPABASE_SERVICE_ROLE_KEY: 'fake-key', DEVICE_SESSION_SECRET: secret });
  try {
    assert.equal((await invoke('GET')).status, 403);
    assert.equal((await invoke('POST', { ...report, studentNumber: 4 })).status, 403);
    assert.equal((await invoke('POST', { ...report }, false, { 'sec-fetch-site': 'cross-site' })).status, 403);
    assert.equal((await invoke('POST', { action: 'acknowledge', alert: report })).status, 403);
    assert.equal((await invoke('POST', {}, true)).status, 400);
    assert.equal((await invoke('POST', report, false, { cookie: '' })).status, 401);
    assert.equal((await invoke('POST', { ...report, message: 'private content' })).status, 200);
    assert.equal(rows.size, 1);
    assert.deepEqual((await invoke('GET', undefined, true)).value, { alerts: [{ ...report, acknowledgedAt: null }], hasMore: false });
    const newer = { ...report, id: 'failure-test-456' };
    assert.equal((await invoke('POST', newer)).status, 200);
    assert.equal((await invoke('POST', { action: 'acknowledge', alert: report }, true)).status, 200);
    assert.equal((await invoke('POST', report)).status, 200);
    assert.deepEqual((await invoke('GET', undefined, true)).value, { alerts: [{ ...newer, acknowledgedAt: null }], hasMore: false });
    assert.equal(rows.size, 2);
    t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 503 }));
    assert.equal((await invoke('GET', undefined, true)).status, 502);
    assert.equal((await invoke('POST', report)).status, 502);
  } finally {
    for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'DEVICE_SESSION_SECRET']) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
  }
});
