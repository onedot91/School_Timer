import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../../public/app-startup.js', import.meta.url), 'utf8');

function setup(storage = new Map<string, string>(), online = true, storageBlocked = false) {
  const listeners = new Map<string, (event?: { preventDefault: () => void }) => void>();
  const startup = { isConnected: true };
  const message = { textContent: '로딩' };
  let click: (() => void) | undefined;
  const reload = { hidden: true, addEventListener: (_name: string, handler: () => void) => { click = handler; } };
  let timeout: (() => void) | undefined;
  let observe: (() => void) | undefined;
  let reloadCount = 0;
  let disconnected = false;
  const documentElement = { dataset: {} };
  const context = {
    navigator: { onLine: online },
    sessionStorage: {
      getItem: (key: string) => { if (storageBlocked) throw new Error('blocked'); return storage.get(key) ?? null; },
      setItem: (key: string, value: string) => storage.set(key, value),
    },
    document: {
      documentElement,
      getElementById: (id: string) => ({ 'app-startup': startup, 'app-startup-message': message, 'app-startup-reload': reload })[id],
    },
    window: {
      schoolChunkRecovery: undefined as { canReload: () => boolean; stop: () => void; tryReload: () => boolean } | undefined,
      setTimeout: (callback: () => void, delay: number) => { assert.equal(delay, 15000); timeout = callback; return 1; },
      clearTimeout: () => { timeout = undefined; },
      addEventListener: (name: string, handler: (event?: { preventDefault: () => void }) => void) => listeners.set(name, handler),
      removeEventListener: (name: string) => listeners.delete(name),
      location: { reload: () => { reloadCount++; } },
    },
    MutationObserver: class {
      constructor(callback: () => void) { observe = callback; }
      observe() {}
      disconnect() { disconnected = true; }
    },
  };
  runInNewContext(source, context);
  assert.ok(context.window.schoolChunkRecovery);
  return {
    recovery: context.window.schoolChunkRecovery,
    startup, message, reload, listeners, documentElement,
    tick: () => timeout?.(), commit: () => { startup.isConnected = false; observe?.(); },
    click: () => click?.(), reloadCount: () => reloadCount, disconnected: () => disconnected,
  };
}

test('앱이 시작되지 않아도 15초 후 복구 버튼을 표시하며 자동 새로고침하지 않는다', () => {
  const state = setup();
  assert.equal(state.reload.hidden, true);
  state.tick();
  assert.equal(state.reload.hidden, false);
  assert.match(state.message.textContent, /시간이 걸리고/);
  assert.equal(state.reloadCount(), 0);
  state.click();
  assert.equal(state.reloadCount(), 1);
});

test('React 시작 후 초기 안내 타이머와 오류 감시를 해제한다', () => {
  const state = setup();
  state.commit();
  state.tick();
  assert.equal(state.reload.hidden, true);
  assert.equal(state.disconnected(), true);
  assert.equal(state.listeners.has('error'), false);
  assert.equal(state.listeners.has('unhandledrejection'), false);
});

test('이미 조작한 화면의 청크 오류는 자동 새로고침하지 않는다', () => {
  const state = setup();
  state.listeners.get('pointerdown')?.();
  state.listeners.get('vite:preloadError')?.();
  assert.match(state.message.textContent, /새 버전/);
  assert.deepEqual(state.documentElement.dataset, { appChunkFailed: 'true' });
  assert.equal(state.reloadCount(), 0);
});

test('초기 청크 오류는 탭당 한 번만 새로고침하고 반복 실패는 복구 화면으로 전달한다', () => {
  const storage = new Map<string, string>();
  const state = setup(storage);
  let prevented = 0;
  state.listeners.get('vite:preloadError')?.({ preventDefault: () => { prevented++; } });
  state.listeners.get('vite:preloadError')?.({ preventDefault: () => { prevented++; } });
  assert.equal(state.reloadCount(), 1);
  assert.equal(prevented, 2);
  assert.deepEqual(state.documentElement.dataset, {});
  const nextPage = setup(storage);
  nextPage.listeners.get('vite:preloadError')?.();
  assert.equal(nextPage.reloadCount(), 0);
  assert.deepEqual(nextPage.documentElement.dataset, { appChunkFailed: 'true' });
});

test('오프라인과 저장소 차단은 자동 복구하지 않는다', () => {
  for (const state of [setup(new Map(), false), setup(new Map(), true, true)]) {
    state.listeners.get('vite:preloadError')?.();
    assert.equal(state.reloadCount(), 0);
  }
});

test('미보관 내용 또는 앱 화면 표시 후에는 자동 복구하지 않는다', () => {
  const unsafe = setup();
  unsafe.recovery.canReload = () => false;
  const ready = setup();
  ready.recovery.stop();
  for (const state of [unsafe, ready]) {
    state.listeners.get('vite:preloadError')?.();
    assert.equal(state.reloadCount(), 0);
    assert.deepEqual(state.documentElement.dataset, { appChunkFailed: 'true' });
  }
});
