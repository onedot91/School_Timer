import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

test('초기 429 대기는 실패 횟수를 쓰지 않고 온라인·수동 재개 후에도 실제 재시도 5회에서 멈춘다', async context => {
  const server = await createServer({ configFile: false, envDir: false, logLevel: 'silent', server: { middlewareMode: true, watch: null },
    define: { 'import.meta.env.PROD': 'true' } });
  const originals = new Map(['window', 'navigator', 'document'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const values = new Map<string, string>([['school-timer-entry-number-v1', '3']]);
  const localStorage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  const browser = Object.assign(new EventTarget(), { localStorage, location: { hash: '#student-mailbox' } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: browser });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: Object.assign(new EventTarget(), { visibilityState: 'visible', querySelector: () => null }) });
  let stop: (() => void) | undefined;
  let unregister: (() => void) | undefined;
  try {
    const recovery = await server.ssrLoadModule('/src/lib/saveRecovery.ts') as typeof import('./saveRecovery.js');
    context.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date('2026-09-09T04:00:00Z') });
    const pending: import('./saveRecovery.js').RecoveryRequest = { id: 'foreground-engine-throttle', actor: 3, feature: 'student.letter.send', createdAt: new Date().toISOString(), mode: 'automatic' };
    let reads = 0, writes = 0;
    unregister = recovery.registerSaveRecoveryAdapter({ id: 'retry-after-engine', list: async () => [pending], eligible: () => true,
      confirm: async () => { reads++; return false; }, retry: async () => {
        writes++;
        recovery.notifySaveRecovery();
        throw Object.assign(new Error('STORAGE_TEMPORARY_UNAVAILABLE'), { status: 503 });
      } });
    recovery.deferSaveRecoveryUntil(3, pending.id, 60_000);
    stop = recovery.startSaveRecovery(3);
    const drain = () => new Promise<void>(resolve => setImmediate(resolve));
    context.mock.timers.tick(1250);
    await drain();
    assert.equal(reads, 0);
    assert.equal(recovery.getSaveRecoveryStatus(3).paused, false);
    recovery.notifySaveRecovery(true);
    context.mock.timers.tick(1250);
    await drain();
    browser.dispatchEvent(new Event('online'));
    context.mock.timers.tick(1250);
    await drain();
    assert.equal(writes, 0);
    assert.equal(reads, 0);
    context.mock.timers.tick(56_250);
    await drain();
    assert.equal(writes, 1);
    for (let expected = 2; expected <= 5; expected++) {
      context.mock.timers.tick(30_000);
      await drain();
      assert.equal(writes, expected);
    }
    assert.equal(recovery.getSaveRecoveryStatus(3).paused, true);
    context.mock.timers.tick(90_000);
    await drain();
    assert.equal(writes, 5);
    assert.equal(reads, 5);
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
