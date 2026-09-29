import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

test('금융 거래는 재연결 뒤 실패·미확정 영수증만 재조회하고 늦은 저장을 복구하거나 5회 뒤 멈춘다', async context => {
  const server = await createServer({ configFile: false, envDir: false, logLevel: 'silent', server: { middlewareMode: true, watch: null },
    define: { 'import.meta.env.PROD': 'true' } });
  const originals = new Map(['window', 'navigator', 'document'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const values = new Map<string, string>([['school-timer-entry-number-v1', '3']]);
  const localStorage = { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  const browser = Object.assign(new EventTarget(), { localStorage, location: { hash: '' } });
  const network = { onLine: false };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: browser });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: network });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: Object.assign(new EventTarget(), { visibilityState: 'visible', querySelector: () => null }) });
  let stop: (() => void) | undefined;
  let unregister: (() => void) | undefined;
  try {
    const recovery = await server.ssrLoadModule('/src/lib/saveRecovery.ts') as typeof import('./saveRecovery.js');
    const reporting = await server.ssrLoadModule('/src/lib/saveFailureClient.ts') as typeof import('./saveFailureClient.js');
    context.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date('2026-09-29T03:00:00Z') });
    context.mock.method(Math, 'random', () => 0.5);
    let pending: import('./saveRecovery.js').RecoveryRequest | undefined = {
      id: 'delayed-financial-receipt', actor: 3, feature: 'student.economy', createdAt: new Date().toISOString(), mode: 'confirm-only',
    };
    const reads: string[] = [];
    let recovered = 0;
    browser.addEventListener(recovery.SAVE_RECOVERED_EVENT, () => { recovered++; });
    unregister = recovery.registerSaveRecoveryAdapter({ id: 'financial-confirmation', list: async () => pending ? [pending] : [],
      eligible: () => false,
      confirm: async request => {
        reads.push(request.id);
        if (reads.length === 1) throw new TypeError('private network detail');
        if (request.id === 'delayed-financial-receipt' && reads.length === 5) { pending = undefined; return true; }
        return false;
      },
      retry: async () => assert.fail('never repeat a financial mutation automatically'),
    });
    const drain = () => new Promise<void>(resolve => setImmediate(resolve));
    stop = recovery.startSaveRecovery(3);
    context.mock.timers.tick(60_000);
    await drain();
    assert.equal(reads.length, 0, 'offline time must not consume receipt attempts');
    network.onLine = true;
    browser.dispatchEvent(new Event('online'));
    context.mock.timers.tick(750);
    await drain();
    assert.equal(reads.length, 1);
    assert.equal(recovery.getSaveRecoveryStatus(3).paused, false);
    const deferred = JSON.parse(values.get(reporting.DEFERRED_SAVE_FAILURE_STORAGE_KEY) ?? '[]');
    assert.equal(deferred[0].feature, 'economy', 'recovery keeps the original feature even on another screen');
    assert.doesNotMatch(JSON.stringify(deferred), /private network detail/);
    for (const delay of [1000, 2000, 4000, 8000]) {
      context.mock.timers.tick(delay);
      await drain();
    }
    assert.equal(reads.length, 5);
    assert.ok(reads.every(id => id === 'delayed-financial-receipt'));
    assert.equal(recovered, 1);
    assert.equal(recovery.getSaveRecoveryStatus(3).pending, 0);
    assert.equal(values.get(reporting.DEFERRED_SAVE_FAILURE_STORAGE_KEY), '[]');
    assert.equal(values.get(reporting.SAVE_FAILURE_STORAGE_KEY) ?? '[]', '[]');

    pending = { id: 'still-unknown-receipt', actor: 3, feature: 'student.economy', createdAt: new Date().toISOString(), mode: 'confirm-only' };
    reporting.deferSaveFailure('economy', new TypeError('response lost'), 3, { requestId: pending.id });
    recovery.notifySaveRecovery(true);
    for (const delay of [750, 1000, 2000, 4000, 8000]) {
      context.mock.timers.tick(delay);
      await drain();
    }
    assert.equal(reads.length, 10);
    assert.equal(recovery.getSaveRecoveryStatus(3).paused, true);
    assert.equal(recovery.getSaveRecoveryStatus(3).pending, 1);
    assert.equal(recovered, 1, 'unknown is never counted as a saved result');
    const alerts = JSON.parse(values.get(reporting.SAVE_FAILURE_STORAGE_KEY) ?? '[]');
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].diagnostics.retryCount, 5);
    context.mock.timers.tick(90_000);
    await drain();
    assert.equal(reads.length, 10);
  } finally {
    stop?.();
    unregister?.();
    context.mock.timers.reset();
    await server.close();
    for (const [key, original] of originals) {
      if (original) Object.defineProperty(globalThis, key, original); else Reflect.deleteProperty(globalThis, key);
    }
  }
});
