import assert from 'node:assert/strict';
import test from 'node:test';
import { TodayFriendTeacherCache } from './todayFriendTeacherCache';
import { TODAY_FRIEND_INITIAL_STATE } from './todayFriendState';
import { captureStorageResponseContext } from './storageResponseOrder';

test('teacher display cache revalidates, coalesces reads, and isolates dates, actors, mutations and failures', async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let actor = '0';
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: { getItem: () => actor } } });
  const cache = new TodayFriendTeacherCache();
  const state = TODAY_FRIEND_INITIAL_STATE;
  let reads = 0;
  const loader = async () => { reads += 1; return state; };
  try {
    await Promise.all(Array.from({ length: 8 }, () => cache.load('2026-09-14', loader)));
    assert.equal(reads, 1);
    assert.equal(cache.peek('2026-09-14'), state);
    assert.equal(cache.peek('2026-09-15'), null);
    await cache.load('2026-09-14', loader);
    assert.equal(reads, 2);
    await assert.rejects(cache.load('2026-09-14', async () => { throw new Error('offline'); }));
    assert.equal(cache.peek('2026-09-14'), state);
    await cache.load('2026-09-14', loader);
    assert.equal(reads, 3);
    let release!: (value: typeof state) => void;
    const pending = cache.load('2026-09-14', () => new Promise(resolve => { release = resolve; }));
    cache.invalidate();
    release(state);
    await pending;
    assert.equal(cache.peek('2026-09-14'), null);
    await cache.load('2026-09-14', loader);
    actor = '1';
    assert.equal(cache.peek('2026-09-14'), null);
    actor = '0';
    const switched = cache.load('2026-09-14', () => new Promise(resolve => { release = resolve; }));
    actor = '2';
    captureStorageResponseContext();
    actor = '0';
    release(state);
    await assert.rejects(switched, /SESSION_CHANGED/);
    assert.equal(cache.peek('2026-09-14'), null);
    const originalNow = Date.now;
    try {
      await cache.load('2026-09-14', loader);
      const now = Date.now();
      Date.now = () => now + 60_001;
      assert.equal(cache.peek('2026-09-14'), null);
    } finally { Date.now = originalNow; }
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
