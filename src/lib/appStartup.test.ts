import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../../public/app-startup.js', import.meta.url), 'utf8');

function setup() {
  const listeners = new Map<string, () => void>();
  const startup = { isConnected: true };
  const message = { textContent: '로딩' };
  let click: (() => void) | undefined;
  const reload = { hidden: true, addEventListener: (_name: string, handler: () => void) => { click = handler; } };
  let timeout: (() => void) | undefined;
  let observe: (() => void) | undefined;
  let reloadCount = 0;
  let disconnected = false;
  const documentElement = { dataset: {} };
  runInNewContext(source, {
    document: {
      documentElement,
      getElementById: (id: string) => ({ 'app-startup': startup, 'app-startup-message': message, 'app-startup-reload': reload })[id],
    },
    window: {
      setTimeout: (callback: () => void, delay: number) => { assert.equal(delay, 15000); timeout = callback; return 1; },
      clearTimeout: () => { timeout = undefined; },
      addEventListener: (name: string, handler: () => void) => listeners.set(name, handler),
      removeEventListener: (name: string) => listeners.delete(name),
      location: { reload: () => { reloadCount++; } },
    },
    MutationObserver: class {
      constructor(callback: () => void) { observe = callback; }
      observe() {}
      disconnect() { disconnected = true; }
    },
  });
  return {
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

test('앱 초기화 전 청크 오류를 이후 Error Boundary에 전달한다', () => {
  const state = setup();
  state.listeners.get('vite:preloadError')?.();
  assert.match(state.message.textContent, /새 버전/);
  assert.deepEqual(state.documentElement.dataset, { appChunkFailed: 'true' });
  assert.equal(state.reloadCount(), 0);
});
