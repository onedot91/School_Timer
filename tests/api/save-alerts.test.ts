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
    const diagnosticReport = { ...report, id: 'failure-diagnostic-789', diagnostics: { errorCode: 'SHARED_SETTINGS_WRITE_FAILED', httpStatus: 502, endpoint: '/api/shared-settings', online: false, requestId: 'original-save-request-123', buildVersion: '2026-09-09T01:00:00.000Z', stage: 'recovery', retryCount: 5 } };
    assert.equal((await invoke('POST', { ...diagnosticReport, diagnostics: { ...diagnosticReport.diagnostics, message: 'private content', requestBody: 'secret' } })).status, 200);
    const stored = [...rows.values()].find(value => value.diagnostics !== undefined);
    assert.ok(stored && typeof stored.id === 'string');
    const canonicalReport = { ...diagnosticReport, id: stored.id };
    assert.deepEqual((await invoke('GET', undefined, true)).value, { alerts: [{ ...newer, acknowledgedAt: null }, { ...canonicalReport, acknowledgedAt: null }], hasMore: false });
    assert.equal((await invoke('POST', { action: 'acknowledge', alert: canonicalReport }, true)).status, 200);
    assert.equal((await invoke('POST', diagnosticReport)).status, 200);
    assert.equal((await invoke('POST', { ...diagnosticReport, id: 'fresh-delivery-id-456' })).status, 200);
    const storedDiagnostic = rows.get(`${SAVE_FAILURE_ROW_PREFIX}3-${canonicalReport.id}`);
    assert.equal(rows.size, 3, 'a new delivery ID for the same mutation cannot resurrect an acknowledged alert');
    assert.deepEqual(storedDiagnostic?.diagnostics, diagnosticReport.diagnostics);
    assert.equal(typeof storedDiagnostic?.acknowledgedAt, 'string');
    assert.deepEqual((await invoke('GET', undefined, true)).value, { alerts: [{ ...newer, acknowledgedAt: null }], hasMore: false });
    t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 503 }));
    assert.equal((await invoke('GET', undefined, true)).status, 502);
    assert.equal((await invoke('POST', report)).status, 502);
  } finally {
    for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'DEVICE_SESSION_SECRET']) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
  }
});

test('bulk acknowledgement batches existing alerts, preserves diagnostics and new arrivals, and is teacher-only', async (t) => {
  const rows = new Map<string, { id: string; value: typeof report & { acknowledgedAt: string | null }; updated_at: string }>(Array.from({ length: 205 }, (_, index) => {
    const value = { ...report, id: `bulk-alert-${index}`, acknowledgedAt: null as string | null };
    const id = `${SAVE_FAILURE_ROW_PREFIX}3-${value.id}`;
    return [id, { id, value, updated_at: '2026-09-07T01:00:00.000Z' }] as const;
  }));
  let calls = 0;
  let failWrite = false;
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    calls++;
    const url = new URL(String(input));
    if (init?.method === 'POST') {
      assert.equal(new Headers(init.headers).get('prefer'), 'resolution=merge-duplicates,return=minimal');
      if (failWrite) return new Response(null, { status: 503 });
      const updates = JSON.parse(String(init.body)) as Array<{ id: string; value: typeof report & { acknowledgedAt: string }; updated_at: string }>;
      assert.ok(updates.length <= 100);
      for (const update of updates) {
        assert.ok(rows.has(update.id));
        assert.deepEqual(update.value, { ...rows.get(update.id)!.value, acknowledgedAt: update.value.acknowledgedAt });
        assert.equal(update.updated_at, rows.get(update.id)!.updated_at);
        rows.set(update.id, update);
      }
      return new Response(null, { status: 201 });
    }
    const before = url.searchParams.get('updated_at')?.slice(4);
    assert.ok(before);
    return Response.json([...rows.values()].filter(row => row.value.acknowledgedAt === null && Date.parse(row.updated_at) <= Date.parse(before)).slice(0, 101));
  });
  const previous = { ...process.env };
  Object.assign(process.env, { SUPABASE_URL: 'https://save-alerts.invalid', SUPABASE_SERVICE_ROLE_KEY: 'fake-key', DEVICE_SESSION_SECRET: secret });
  try {
    assert.equal((await invoke('POST', { action: 'acknowledgeAll' })).status, 403);
    assert.equal((await invoke('POST', { action: 'acknowledgeAll' }, true, { 'sec-fetch-site': 'cross-site' })).status, 403);
    assert.equal((await invoke('POST', { action: 'acknowledgeAll', before: 'bad' }, true)).status, 400);
    assert.equal(calls, 0);
    const first = await invoke('POST', { action: 'acknowledgeAll' }, true);
    assert.equal(first.status, 200);
    assert.ok(first.value && typeof first.value === 'object');
    const before: unknown = Reflect.get(first.value, 'before');
    assert.equal(typeof before, 'string');
    assert.deepEqual(first.value, { ok: true, acknowledged: 100, hasMore: true, before });
    const incoming = { ...report, id: 'incoming-alert-999', acknowledgedAt: null };
    const incomingId = `${SAVE_FAILURE_ROW_PREFIX}3-${incoming.id}`;
    rows.set(incomingId, { id: incomingId, value: incoming, updated_at: new Date(Date.parse(String(before)) + 1000).toISOString() });
    failWrite = true;
    assert.equal((await invoke('POST', { action: 'acknowledgeAll', before }, true)).status, 502);
    assert.equal([...rows.values()].filter(row => row.value.acknowledgedAt === null).length, 106);
    failWrite = false;
    assert.deepEqual((await invoke('POST', { action: 'acknowledgeAll', before }, true)).value, { ok: true, acknowledged: 100, hasMore: true, before });
    assert.deepEqual((await invoke('POST', { action: 'acknowledgeAll', before }, true)).value, { ok: true, acknowledged: 5, hasMore: false, before });
    assert.deepEqual((await invoke('POST', { action: 'acknowledgeAll', before }, true)).value, { ok: true, acknowledged: 0, hasMore: false, before });
    assert.equal(rows.size, 206, 'acknowledging never deletes records');
    assert.equal(rows.get(incomingId)?.value.acknowledgedAt, null);
  } finally {
    for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'DEVICE_SESSION_SECRET']) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
  }
});
