import assert from 'node:assert/strict';
import { test } from 'node:test';

import { loadLocalTodayFriendState, saveLocalTodayFriendState } from './todayFriendLocalStore';
import { ensureTodayFriendDay, TODAY_FRIEND_INITIAL_STATE } from './todayFriendState';

test('로컬 저장소는 준비된 주간 배정과 파트너를 보존한다', () => {
  // Given
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
  const prepared = ensureTodayFriendDay(TODAY_FRIEND_INITIAL_STATE, '2026-36', '2026-09-01');

  // When
  saveLocalTodayFriendState(storage, prepared);
  const restored = loadLocalTodayFriendState(storage);

  // Then
  assert.deepEqual(restored, prepared);
});
