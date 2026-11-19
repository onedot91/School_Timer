import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

// 2026-11-19 장애: 탭 전환(focus/visibilitychange)마다 남은 저장 기록의 receipt를 다시 읽어 요청이 불어났다.
test('창 복귀로 인한 저장 확인은 1분에 한 번만 하고, 온라인 복귀와 명시적 재개는 그대로 깨운다', async context => {
  const server = await createServer({ configFile: false, envDir: false, logLevel: 'silent', server: { middlewareMode: true, watch: null },
    define: { 'import.meta.env.PROD': 'true' } });
  const originals = new Map(['window', 'navigator', 'document'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const values = new Map<string, string>([['school-timer-entry-number-v1', '4']]);
  const localStorage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  const browser = Object.assign(new EventTarget(), { localStorage, location: { hash: '#student-mailbox' } });
  const page = Object.assign(new EventTarget(), { visibilityState: 'visible', querySelector: () => null });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: browser });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: page });
  let stop: (() => void) | undefined;
  let unregister: (() => void) | undefined;
  try {
    const recovery = await server.ssrLoadModule('/src/lib/saveRecovery.ts') as typeof import('./saveRecovery.js');
    context.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date('2026-11-19T02:00:00Z') });
    // A stale draft that cannot be retried: every pass only reads its receipt.
    const stale: import('./saveRecovery.js').RecoveryRequest = { id: 'stale-context-draft', actor: 4, feature: 'student.emotion.save', createdAt: new Date().toISOString(), mode: 'automatic' };
    let reads = 0, writes = 0;
    unregister = recovery.registerSaveRecoveryAdapter({ id: 'focus-wake-throttle', list: async () => [stale], eligible: () => false,
      confirm: async () => { reads++; return false; }, retry: async () => { writes++; } });
    stop = recovery.startSaveRecovery(4);
    const drain = () => new Promise<void>(resolve => setImmediate(resolve));
    const settle = async () => { context.mock.timers.tick(1250); await drain(); };
    await settle();
    assert.equal(reads, 1);

    for (let index = 0; index < 10; index++) {
      browser.dispatchEvent(new Event('focus'));
      page.dispatchEvent(new Event('visibilitychange'));
      await settle();
    }
    assert.equal(reads, 1, '1분 안의 창 복귀는 receipt를 다시 읽지 않는다');

    context.mock.timers.tick(60_000);
    browser.dispatchEvent(new Event('focus'));
    await settle();
    assert.equal(reads, 2, '1분이 지나면 창 복귀로 다시 확인한다');

    browser.dispatchEvent(new Event('online'));
    await settle();
    assert.equal(reads, 3, '온라인 복귀는 쿨다운과 관계없이 확인한다');

    recovery.notifySaveRecovery(true);
    await settle();
    assert.equal(reads, 4, '명시적 재개는 쿨다운과 관계없이 확인한다');
    assert.equal(writes, 0);
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
