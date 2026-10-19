import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';
import { parseSaveFailureAlert } from './saveFailure.js';

test('일괄 복사는 100건 이후의 진단도 조회하며 중간 실패나 반복 커서를 성공으로 처리하지 않는다', async t => {
  const server = await createServer({ configFile: false, envDir: false, logLevel: 'silent', server: { middlewareMode: true, watch: null },
    define: { 'import.meta.env.PROD': 'true', 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://fake.invalid'), 'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('fake') } });
  const at = '2026-10-15T03:00:00Z';
  const alerts = Array.from({ length: 101 }, (_, index) => ({ id: `fixture-alert-${index}`, studentNumber: 3, feature: 'studentLife', code: 'server', occurredAt: at, acknowledgedAt: null }));
  let mode = 'success'; const urls: URL[] = [];
  t.mock.method(globalThis, 'fetch', async (input, init) => {
    assert.equal(init?.method ?? 'GET', 'GET');
    const url = new URL(String(input), 'https://fake.invalid'); urls.push(url);
    if (url.searchParams.has('cursorId') && mode === 'failure') return Response.json({}, { status: 502 });
    return Response.json(!url.searchParams.has('cursorId') || mode === 'repeat'
      ? { alerts: alerts.slice(0, 100), hasMore: true, before: at, nextCursor: { updatedAt: at, id: 'school-timer-save-alert-3-fixture-099' } }
      : { alerts: alerts.slice(100), hasMore: false, before: at });
  });
  try {
    const client = await server.ssrLoadModule('/src/lib/saveFailureClient.ts') as typeof import('./saveFailureClient.js');
    assert.equal((await client.loadAllSaveFailureAlerts()).length, 101);
    assert.equal(urls[1].searchParams.get('before'), at);
    mode = 'failure'; await assert.rejects(client.loadAllSaveFailureAlerts(), /SAVE_ALERTS_UNAVAILABLE/);
    mode = 'repeat'; await assert.rejects(client.loadAllSaveFailureAlerts(), /SAVE_ALERTS_INVALID_RESPONSE/);
  } finally { await server.close(); }
});

test('alert reads and acknowledgements allow the server to finish its database requests', async (t) => {
  const server = await createServer({
    configFile: false, envDir: false, logLevel: 'silent', server: { middlewareMode: true, watch: null },
    define: { 'import.meta.env.PROD': 'true', 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://fake.invalid'), 'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('fake') },
  });
  const alert = { id: 'slow-alert-123', studentNumber: 0, feature: 'settings', code: 'conflict', occurredAt: '2026-09-29T00:00:00Z', acknowledgedAt: null };
  const timeouts: number[] = [];
  t.mock.method(AbortSignal, 'timeout', (milliseconds: number) => {
    timeouts.push(milliseconds);
    return new AbortController().signal;
  });
  t.mock.method(globalThis, 'fetch', async (_input: string | URL | Request, init?: RequestInit) => {
    assert.ok(init?.signal);
    const timeout = timeouts.at(-1)!;
    const serverRequestBudget = init?.method === 'POST' ? 16_000 : 8_000;
    if (timeout <= serverRequestBudget) throw new DOMException('timed out', 'TimeoutError');
    return Response.json(init?.method === 'POST' ? { ok: true } : { alerts: [alert], hasMore: false });
  });
  try {
    const client = await server.ssrLoadModule('/src/lib/saveFailureClient.ts') as typeof import('./saveFailureClient.js');
    const result = await client.loadSaveFailureAlerts();
    assert.equal(result.alerts.length, 1);
    await client.acknowledgeSaveFailure(result.alerts[0]);
    t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'SAVE_ALERTS_UNAVAILABLE' }, { status: 502 }));
    await assert.rejects(client.loadSaveFailureAlerts(), /SAVE_ALERTS_UNAVAILABLE/);
    await assert.rejects(client.acknowledgeSaveFailure(result.alerts[0]), /SAVE_ALERT_ACKNOWLEDGE_FAILED/);
  } finally {
    await server.close();
  }
});

test('actual save client reports final failures, preserves offline reports, and retries delivery without hiding the save error', async (t) => {
  const server = await createServer({
    configFile: false, envDir: false, logLevel: 'silent', server: { middlewareMode: true, watch: null },
    define: { 'import.meta.env.PROD': 'true', 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://fake.invalid'), 'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('fake') },
  });
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const storage = new Map<string, string>([['school-timer-entry-number-v1', '3']]);
  const localStorage = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); } };
  const location = { hash: '#student-number-baseball' };
  const navigator = { onLine: false };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: Object.assign(new EventTarget(), { localStorage, location }) });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: navigator });
  try {
    const client = await server.ssrLoadModule('/src/lib/saveFailureClient.ts') as typeof import('./saveFailureClient.js');
    const settings = await server.ssrLoadModule('/src/lib/supabaseSettings.ts') as typeof import('./supabaseSettings.js');
    let status = 502;
    let conflictOnce = false;
    let alertStatus = 502;
    const sent: unknown[] = [];
    t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input) === '/api/save-alerts') { sent.push(JSON.parse(String(init?.body))); return Response.json({ ok: alertStatus === 200 }, { status: alertStatus }); }
      assert.equal(String(input), '/api/shared-settings');
      if (init?.method === 'PUT') {
        if (conflictOnce) { conflictOnce = false; return Response.json({}, { status: 409 }); }
        return Response.json(status === 502 ? { error: 'SHARED_SETTINGS_WRITE_FAILED', message: 'private student content' } : { updatedAt: '2026-09-07T00:00:01Z' }, { status });
      }
      return Response.json({ id: 'school-timer-main', scope: 'full', value: {}, updated_at: '2026-09-07T00:00:00Z' });
    });
    const pending = () => {
      const raw: unknown = JSON.parse(storage.get(client.SAVE_FAILURE_STORAGE_KEY) ?? '[]');
      assert.ok(Array.isArray(raw));
      return raw.map(parseSaveFailureAlert);
    };
    for (const [hash, feature] of [['#student-number-baseball', 'numberBaseball'], ['#student-emotions', 'emotion'], ['#student-store-auction', 'auction']]) {
      location.hash = hash;
      await assert.rejects(settings.updateStudentSharedSettings(3, () => ({})), /SHARED_SETTINGS_SAVE_UNCONFIRMED/);
      assert.equal(pending().at(-1)?.feature, feature);
      assert.equal(pending().at(-1)?.code, 'response');
      assert.deepEqual(pending().at(-1)?.diagnostics, { errorCode: 'SHARED_SETTINGS_SAVE_UNCONFIRMED', causeCode: 'SHARED_SETTINGS_WRITE_FAILED', httpStatus: 502, errorName: 'Error', endpoint: '/api/shared-settings', view: hash.slice('#student-'.length), online: false });
    }
    assert.equal(sent.length, 0, 'offline reports stay on the device');
    assert.equal(pending().length, 3);
    await assert.rejects(settings.updateStudentSharedSettings(3, () => ({})), /SHARED_SETTINGS_SAVE_UNCONFIRMED/);
    assert.equal(pending().length, 3, 'a pending duplicate is coalesced');
    const stopError = new Error('BID_TOO_LOW');
    await assert.rejects(client.withSaveFailureReporting('auction', async () => { throw stopError; }), (error) => error === stopError);
    status = 200; conflictOnce = true;
    await settings.updateStudentSharedSettings(3, () => ({}));
    assert.equal(pending().length, 3, 'successful retry creates no alert and does not clear earlier failures');
    status = 409;
    await assert.rejects(settings.updateStudentSharedSettings(3, () => ({})), /SHARED_SETTINGS_CONFLICT/);
    assert.equal(pending().at(-1)?.code, 'conflict');
    navigator.onLine = true;
    await client.flushSaveFailureReports();
    assert.equal(pending().length, 4, 'failed delivery retains all reports');
    alertStatus = 200;
    storage.set('school-timer-entry-number-v1', '4');
    await client.flushSaveFailureReports();
    assert.equal(pending().length, 4, 'another signed actor must not send this queue');
    storage.set('school-timer-entry-number-v1', '3');
    await client.flushSaveFailureReports();
    assert.equal(pending().length, 0);
    assert.equal(sent.length, 5);
    navigator.onLine = false;
    location.hash = '#student-number-baseball';
    await assert.rejects(client.withSaveFailureReporting('numberBaseball', async () => {
      location.hash = '#student-overview';
      storage.set('school-timer-entry-number-v1', '4');
      throw new TypeError('private answer must not be reported');
    }), TypeError);
    assert.equal(pending().at(-1)?.studentNumber, 3, 'an in-flight failure retains the initiating student');
    assert.equal(pending().at(-1)?.diagnostics?.view, 'number-baseball', 'navigation does not relabel the failing screen');
    assert.ok(!JSON.stringify(pending()).includes('private answer'));
    storage.set('school-timer-entry-number-v1', '3');
    const before = '2026-09-14T03:00:00.000Z';
    const batches: unknown[] = [];
    const progress: number[] = [];
    let batchIndex = 0;
    t.mock.method(globalThis, 'fetch', async (_input: string | URL | Request, init?: RequestInit) => {
      batches.push(JSON.parse(String(init?.body)));
      const acknowledged = [100, 100, 5][batchIndex++];
      return Response.json({ ok: true, acknowledged, hasMore: batchIndex < 3, before });
    });
    assert.equal(await client.acknowledgeAllSaveFailures(count => progress.push(count)), 205);
    assert.deepEqual(progress, [100, 200, 205]);
    assert.deepEqual(batches, [{ action: 'acknowledgeAll' }, { action: 'acknowledgeAll', before }, { action: 'acknowledgeAll', before }]);
    let failedBatch = 0;
    t.mock.method(globalThis, 'fetch', async () => ++failedBatch === 1
      ? Response.json({ ok: true, acknowledged: 100, hasMore: true, before })
      : Response.json({ error: 'SAVE_ALERTS_UNAVAILABLE' }, { status: 502 }));
    await assert.rejects(client.acknowledgeAllSaveFailures(count => assert.equal(count, 100)), /SAVE_ALERT_ACKNOWLEDGE_FAILED/);
    assert.equal(failedBatch, 2, 'a failed batch stops instead of hiding remaining alerts');
    t.mock.method(localStorage, 'setItem', () => { throw new DOMException('full', 'QuotaExceededError'); });
    const original = new TypeError('original save failed');
    await assert.rejects(client.withSaveFailureReporting('emotion', async () => { throw original; }, 3), (error) => error === original);
  } finally {
    await server.close();
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else Reflect.deleteProperty(globalThis, 'window');
    if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator); else Reflect.deleteProperty(globalThis, 'navigator');
  }
});

test('401 저장 실패는 기기 세션 재확인을 요청하고, 건너뛰기 표시된 실패는 알림을 남기지 않는다', async () => {
  const server = await createServer({
    configFile: false, envDir: false, logLevel: 'silent', server: { middlewareMode: true, watch: null },
    define: { 'import.meta.env.PROD': 'true' },
  });
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const storage = new Map<string, string>([['school-timer-entry-number-v1', '5']]);
  const target = Object.assign(new EventTarget(), {
    localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); } },
    location: { hash: '#student-store-shop' },
  });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: target });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
  try {
    const client = await server.ssrLoadModule('/src/lib/saveFailureClient.ts') as typeof import('./saveFailureClient.js');
    const session = await server.ssrLoadModule('/src/lib/deviceSessionClient.ts') as typeof import('./deviceSessionClient.js');
    let rejected = 0;
    target.addEventListener(session.DEVICE_SESSION_REJECTED_EVENT, () => { rejected += 1; });
    const unauthorized = Object.assign(new Error('WEEKLY_MISSIONS_HTTP_401'), { status: 401 });
    await assert.rejects(client.withSaveFailureReporting('economy', async () => { throw unauthorized; }, 5), (error) => error === unauthorized);
    assert.equal(rejected, 1);
    const forbidden = Object.assign(new Error('HTTP_403'), { status: 403 });
    await assert.rejects(client.withSaveFailureReporting('economy', async () => { throw forbidden; }, 5));
    assert.equal(rejected, 1, 'a scope rejection is not a missing device session');
    const alertCount = () => JSON.parse(storage.get(client.SAVE_FAILURE_STORAGE_KEY) ?? '[]').length;
    const before = alertCount();
    const skipped = new TypeError('offline');
    client.skipSaveFailureReport(skipped);
    await assert.rejects(client.withSaveFailureReporting('economy', async () => { throw skipped; }, 5));
    assert.equal(alertCount(), before);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else Reflect.deleteProperty(globalThis, 'window');
    if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator); else Reflect.deleteProperty(globalThis, 'navigator');
    await server.close();
  }
});
