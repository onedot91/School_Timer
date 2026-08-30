import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseTodayFriendState } from './todayFriendCodec';
import { ensureTodayFriendDay, TODAY_FRIEND_INITIAL_STATE } from './todayFriendState';

test('저장된 오늘의 친구 상태는 직렬화 후 같은 배정을 복원한다', () => {
  // Given
  const prepared = ensureTodayFriendDay(TODAY_FRIEND_INITIAL_STATE, '2026-36', '2026-09-01');

  // When
  const restored = parseTodayFriendState(JSON.parse(JSON.stringify(prepared)));

  // Then
  assert.deepEqual(restored, prepared);
});

test('손상된 저장값은 빈 초기 상태로 복구한다', () => {
  // Given
  const corrupted = { version: 1, weeks: 'broken' };

  // When
  const restored = parseTodayFriendState(corrupted);

  // Then
  assert.deepEqual(restored, TODAY_FRIEND_INITIAL_STATE);
});
