import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createTodayFriendRevealSequence,
  hasSeenTodayFriendReveal,
  markTodayFriendRevealSeen,
  shouldAnimateTodayFriendReveal,
} from './todayFriendReveal';

test('파트너 공개 애니메이션은 미방문이며 감소 모션을 사용하지 않을 때만 실행한다', () => {
  // Given
  const hasSeenReveal = false;

  // When
  const standardMotion = shouldAnimateTodayFriendReveal(hasSeenReveal, false);

  // Then
  assert.equal(standardMotion, true);
  assert.equal(shouldAnimateTodayFriendReveal(hasSeenReveal, true), false);
  assert.equal(shouldAnimateTodayFriendReveal(true, false), false);
});

test('파트너 공개 순서는 학생과 최종 파트너를 후보에서 제외하고 최종 배정으로 끝난다', () => {
  // Given
  const identity = { dateKey: '2026-09-01', studentNumber: 1, partnerNumber: 8 };

  // When
  const sequence = createTodayFriendRevealSequence(identity, () => 0);

  // Then
  assert.equal(sequence.length, 8);
  assert.equal(sequence.at(-1), identity.partnerNumber);
  assert.equal(new Set(sequence).size, sequence.length);
  assert.equal(sequence.slice(0, -1).includes(identity.studentNumber), false);
});

test('파트너 공개 완료 표시는 학생과 날짜와 배정 파트너별로 해당 기기에 남는다', () => {
  // Given
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
  const identity = { dateKey: '2026-09-01', studentNumber: 1, partnerNumber: 8 };

  // When
  const marked = markTodayFriendRevealSeen(storage, identity);

  // Then
  assert.equal(marked, true);
  assert.equal(hasSeenTodayFriendReveal(storage, identity), true);
  assert.equal(hasSeenTodayFriendReveal(storage, { ...identity, studentNumber: 2 }), false);
  assert.equal(hasSeenTodayFriendReveal(storage, { ...identity, dateKey: '2026-09-02' }), false);
});
