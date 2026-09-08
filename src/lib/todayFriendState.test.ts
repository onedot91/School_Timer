import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createTodayFriendTextPayload } from './todayFriend';

import {
  ensureTodayFriendDay,
  getTodayFriendStudentMission,
  reviewTodayFriendSubmission,
  saveTodayFriendSubmission,
  submitSavedTodayFriendSubmission,
  TODAY_FRIEND_INITIAL_STATE,
} from './todayFriendState';

test('학생 미션 조회는 오늘 장르와 배정된 파트너를 반환한다', () => {
  // Given
  const prepared = ensureTodayFriendDay(TODAY_FRIEND_INITIAL_STATE, '2026-36', '2026-09-01');

  // When
  const mission = getTodayFriendStudentMission(prepared, '2026-09-01', 7);

  // Then
  assert.equal(mission.studentNumber, 7);
  assert.notEqual(mission.partnerNumber, 7);
  assert.equal(mission.submission, null);
});

test('이미 생성된 날짜의 배정은 다시 준비해도 유지한다', () => {
  const dateKey = '2026-01-06';
  const prepared = ensureTodayFriendDay(TODAY_FRIEND_INITIAL_STATE, '2026-02', dateKey);
  const repeated = ensureTodayFriendDay(prepared, '2026-02', dateKey);
  assert.deepEqual(repeated.partnerDays, prepared.partnerDays);
  assert.equal(prepared.partnerDays[0].assignments.filter(entry => entry.relationKind === 'pair').length, 20);
  assert.equal(prepared.partnerDays[0].assignments.filter(entry => entry.relationKind === 'cycle').length, 3);
});

test('학생 제출은 교사 수정 요청 후 고쳐서 다시 제출할 수 있다', () => {
  // Given
  const prepared = ensureTodayFriendDay(TODAY_FRIEND_INITIAL_STATE, '2026-36', '2026-09-01');
  const mission = getTodayFriendStudentMission(prepared, '2026-09-01', 1);
  const drafted = saveTodayFriendSubmission(prepared, {
    mission,
    payload: createTodayFriendTextPayload(mission.genre, '친구와 이야기한 내용을 적었습니다.'),
  });
  const submitted = submitSavedTodayFriendSubmission(drafted, mission.dateKey, 1, '2026-09-01T01:00:00.000Z');

  // When
  const revisionRequested = reviewTodayFriendSubmission(submitted, {
    submissionId: `today-friend-${mission.dateKey}-1`,
    decision: 'revision_requested',
    feedback: '조금 더 자세히 적어 주세요.',
    reviewedAt: '2026-09-01T01:05:00.000Z',
  });

  // Then
  assert.equal(revisionRequested.submissions[0]?.status, 'revision_requested');
  assert.equal(revisionRequested.submissions[0]?.teacherFeedback, '조금 더 자세히 적어 주세요.');
});
