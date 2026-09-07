import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';
import { parseSaveFailureAlert } from './saveFailure.js';

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
        return Response.json({ updatedAt: '2026-09-07T00:00:01Z' }, { status });
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
    t.mock.method(localStorage, 'setItem', () => { throw new DOMException('full', 'QuotaExceededError'); });
    const original = new TypeError('original save failed');
    await assert.rejects(client.withSaveFailureReporting('emotion', async () => { throw original; }, 3), (error) => error === original);
  } finally {
    await server.close();
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else Reflect.deleteProperty(globalThis, 'window');
    if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator); else Reflect.deleteProperty(globalThis, 'navigator');
  }
});
