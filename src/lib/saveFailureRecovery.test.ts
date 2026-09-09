import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

test('자동복구 오류는 마지막에만 보고하고 복구 성공은 기존 경고를 지우지 않는다', async () => {
  const server = await createServer({ configFile: false, envDir: false, logLevel: 'silent', server: { middlewareMode: true, watch: null },
    define: { 'import.meta.env.PROD': 'true', 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://fake.invalid'), 'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('fake') } });
  const originals = new Map(['window', 'navigator', 'document'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const values = new Map<string, string>([['school-timer-entry-number-v1', '3']]);
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: Object.assign(new EventTarget(), { localStorage: storage, location: { hash: '#student-mailbox' } }) });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { querySelector: () => ({ getAttribute: () => '2026-09-09T01:02:03.000Z' }) } });
  try {
    const client = await server.ssrLoadModule('/src/lib/saveFailureClient.ts') as typeof import('./saveFailureClient.js');
    const alerts = () => JSON.parse(values.get(client.SAVE_FAILURE_STORAGE_KEY) ?? '[]');
    const deferred = () => JSON.parse(values.get(client.DEFERRED_SAVE_FAILURE_STORAGE_KEY) ?? '[]');
    const requestId = 'recovering-letter-123';
    for (let retryCount = 0; retryCount < 5; retryCount++) {
      const error = Object.assign(new TypeError('private student answer'), { requestBody: { answer: 'not collected' } });
      await assert.rejects(client.withSaveFailureReporting('studentLife', () => client.withSaveFailureReporting('studentLife', async () => { throw error; }, 3,
        { requestId, deferUntilRecovery: true, stage: 'write', retryCount })), candidate => candidate === error);
      assert.equal(alerts().length, 0);
      assert.equal(deferred().length, 1);
    }
    assert.doesNotMatch(JSON.stringify(deferred()), /private student answer|not collected|requestBody/);
    assert.equal(client.reportDeferredSaveFailure(3, requestId, { retryCount: 5, stage: 'recovery' }), true);
    assert.equal(alerts().length, 1);
    assert.equal(alerts()[0].diagnostics.retryCount, 5);
    assert.equal(alerts()[0].diagnostics.stage, 'recovery');
    assert.equal(alerts()[0].diagnostics.buildVersion, '2026-09-09T01:02:03.000Z');
    assert.equal(deferred().length, 0);
    client.resolveDeferredSaveFailure(3, requestId);
    assert.equal(alerts().length, 1, 'already reported warning remains for teacher review');
    assert.equal(client.reportDeferredSaveFailure(3, requestId), false);
    const nextId = 'recovered-letter-456';
    await assert.rejects(client.withSaveFailureReporting('studentLife', async () => { throw new TypeError('offline'); }, 3,
      { requestId: nextId, deferUntilRecovery: true, stage: 'write' }));
    await client.withSaveFailureReporting('studentLife', async () => 'committed', 3, { requestId: nextId, deferUntilRecovery: true });
    assert.equal(deferred().length, 0);
    assert.equal(alerts().length, 1);
    const conflict = Object.assign(new Error('SHARED_SETTINGS_CONFLICT'), { status: 409 });
    await assert.rejects(client.withSaveFailureReporting('studentLife', async () => { throw conflict; }, 3,
      { requestId: 'conflicting-letter-789', deferUntilRecovery: true }), candidate => candidate === conflict);
    assert.equal(alerts().length, 2, 'a real editing conflict is reported immediately');
    assert.equal(alerts()[1].code, 'conflict');
  } finally {
    await server.close();
    for (const [key, original] of originals) {
      if (original) Object.defineProperty(globalThis, key, original); else Reflect.deleteProperty(globalThis, key);
    }
  }
});
