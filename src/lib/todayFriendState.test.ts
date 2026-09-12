import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createTodayFriendTextPayload } from './todayFriend';

import {
  assignTodayFriendPair,
  ensureTodayFriendDay,
  ensureTodayFriendPracticeSubmissions,
  getTodayFriendStudentMission,
  saveTodayFriendSubmission,
  submitSavedTodayFriendSubmission,
  TODAY_FRIEND_INITIAL_STATE,
} from './todayFriendState';

test('연습 예시 제출은 그날 제출이 없을 때만 장르별 대기·완료를 채운다', () => {
  const dateKey = '2026-09-12';
  const prepared = ensureTodayFriendDay(TODAY_FRIEND_INITIAL_STATE, '2026-37', dateKey);
  const seeded = ensureTodayFriendPracticeSubmissions(prepared, dateKey);
  const dateSubmissions = seeded.submissions.filter((entry) => entry.dateKey === dateKey);

  assert.equal(dateSubmissions.length, 8);
  assert.equal(dateSubmissions.filter((entry) => entry.status === 'submitted').length, 7);
  assert.equal(dateSubmissions.filter((entry) => entry.status === 'approved').length, 1);
  assert.equal(new Set(dateSubmissions.map((entry) => entry.payload.kind)).size, 5);
  assert.deepEqual(ensureTodayFriendPracticeSubmissions(seeded, dateKey), seeded);
});

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
  assert.equal(prepared.partnerDays[0].assignments.some((entry) => entry.studentNumber === 24 || entry.partnerNumber === 24), false);
});

test('테스트 학생은 오늘의 친구 미션과 수동 짝 지정에서 제외된다', () => {
  const prepared = ensureTodayFriendDay(TODAY_FRIEND_INITIAL_STATE, '2026-36', '2026-09-01');
  assert.throws(() => getTodayFriendStudentMission(prepared, '2026-09-01', 24), /TODAY_FRIEND_STUDENT_EXCLUDED/);
  assert.throws(() => assignTodayFriendPair(prepared, {
    dateKey: '2026-09-01',
    firstStudentNumber: 24,
    secondStudentNumber: 3,
  }), /INVALID_PARTNER_PAIR/);
});

test('학생 제출은 승인 전에 답을 고쳐서 다시 제출할 수 있다', () => {
  // Given
  const prepared = ensureTodayFriendDay(TODAY_FRIEND_INITIAL_STATE, '2026-36', '2026-09-01');
  const mission = getTodayFriendStudentMission(prepared, '2026-09-01', 1);
  const drafted = saveTodayFriendSubmission(prepared, {
    mission,
    payload: createTodayFriendTextPayload(mission.genre, '친구와 이야기한 내용을 적었습니다.'),
  });
  const submitted = submitSavedTodayFriendSubmission(drafted, mission.dateKey, 1, '2026-09-01T01:00:00.000Z');
  const submittedMission = getTodayFriendStudentMission(submitted, mission.dateKey, 1);

  // When
  const rewritten = saveTodayFriendSubmission(submitted, {
    mission: submittedMission,
    payload: createTodayFriendTextPayload(mission.genre, '대화로 알게 된 내용을 다시 적었습니다.'),
  });
  const resubmitted = submitSavedTodayFriendSubmission(rewritten, mission.dateKey, 1, '2026-09-01T01:10:00.000Z');

  // Then
  assert.equal(resubmitted.submissions[0]?.status, 'submitted');
  assert.equal(resubmitted.submissions[0]?.revision, 2);
  assert.match(JSON.stringify(resubmitted.submissions[0]?.payload), /대화로 알게 된 내용을 다시 적었습니다/);
});
