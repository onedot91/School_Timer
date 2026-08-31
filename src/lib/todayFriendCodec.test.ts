import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseTodayFriendPayload, parseTodayFriendState } from './todayFriendCodec';
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

test('칭찬 답변은 기존 한 항목과 새 세 항목 형식을 모두 복원한다', () => {
  assert.deepEqual(parseTodayFriendPayload({ kind: 'compliment', compliment: '친구를 도왔어요.' }), {
    kind: 'compliment',
    compliment: '친구를 도왔어요.',
  });
  assert.deepEqual(parseTodayFriendPayload({
    kind: 'compliment',
    compliment: '친구를 도왔어요.',
    reason: '먼저 살펴봐 줘서 좋았어요.',
    message: '네가 있어서 든든해!',
  }), {
    kind: 'compliment',
    compliment: '친구를 도왔어요.',
    reason: '먼저 살펴봐 줘서 좋았어요.',
    message: '네가 있어서 든든해!',
  });
});
