import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  approveTodayFriendSubmission,
  createTodayFriendPartnerAssignments,
  createTodayFriendSubmission,
  createTodayFriendWeek,
  requestTodayFriendRevision,
  submitTodayFriendSubmission,
  TODAY_FRIEND_GENRES,
  TODAY_FRIEND_REWARD,
} from './todayFriend';

test('주간 장르는 월요일부터 금요일까지 중복 없이 한 번씩 배정된다', () => {
  // Given
  const weekKey = '2026-36';

  // When
  const week = createTodayFriendWeek(weekKey);

  // Then
  assert.deepEqual(new Set(week.days.map((day) => day.genre)), new Set(TODAY_FRIEND_GENRES));
  assert.equal(week.days.length, 5);
  assert.deepEqual(createTodayFriendWeek(weekKey), week);
});

test('23명 파트너는 10개 쌍과 3인 단방향 순환으로 배정된다', () => {
  // Given
  const students = Array.from({ length: 23 }, (_, index) => index + 1);

  // When
  const assignments = createTodayFriendPartnerAssignments(students, '2026-09-01');

  // Then
  assert.equal(assignments.length, 23);
  assert.equal(new Set(assignments.map((assignment) => assignment.partnerNumber)).size, 23);
  assert.equal(assignments.filter((assignment) => assignment.relationKind === 'pair').length, 20);
  assert.equal(assignments.filter((assignment) => assignment.relationKind === 'cycle').length, 3);
  assignments.forEach((assignment) => assert.notEqual(assignment.studentNumber, assignment.partnerNumber));

  const cycle = assignments.filter((assignment) => assignment.relationKind === 'cycle');
  const partnerByStudent = new Map(cycle.map((assignment) => [assignment.studentNumber, assignment.partnerNumber]));
  const first = cycle[0];
  assert.ok(first);
  const secondNumber = partnerByStudent.get(first.studentNumber);
  assert.ok(secondNumber);
  const thirdNumber = partnerByStudent.get(secondNumber);
  assert.ok(thirdNumber);
  assert.equal(partnerByStudent.get(thirdNumber), first.studentNumber);
});

test('수정 요청된 제출은 수정 후 다시 제출할 수 있다', () => {
  // Given
  const draft = createTodayFriendSubmission({
    dateKey: '2026-09-01',
    studentNumber: 1,
    partnerNumber: 2,
    genre: 'commonality',
    payload: { kind: 'commonality', commonality: '둘 다 주말에 가족과 자전거를 탄다.' },
  });
  const submitted = submitTodayFriendSubmission(draft, '2026-09-01T01:00:00.000Z');

  // When
  const revisionRequested = requestTodayFriendRevision(
    submitted,
    '언제 알게 되었는지 더 자세히 적어 주세요.',
    '2026-09-01T01:05:00.000Z',
  );
  const resubmitted = submitTodayFriendSubmission({
    ...revisionRequested,
    payload: { kind: 'commonality', commonality: '오늘 대화하며 둘 다 주말에 가족과 자전거를 탄다는 것을 알았다.' },
  }, '2026-09-01T01:10:00.000Z');

  // Then
  assert.equal(revisionRequested.status, 'revision_requested');
  assert.equal(resubmitted.status, 'submitted');
  assert.equal(resubmitted.revision, 2);
  assert.equal(resubmitted.teacherFeedback, null);
});

test('교사 승인은 15고마를 한 번만 지급한다', () => {
  // Given
  const submitted = submitTodayFriendSubmission(createTodayFriendSubmission({
    dateKey: '2026-09-01',
    studentNumber: 1,
    partnerNumber: 2,
    genre: 'compliment',
    payload: {
      kind: 'compliment',
      compliment: '친구가 어려운 문제를 함께 풀어 주어서 고마웠고 마음이 든든했다.',
    },
  }), '2026-09-01T01:00:00.000Z');

  // When
  const firstApproval = approveTodayFriendSubmission(submitted, 100, '2026-09-01T01:05:00.000Z');
  const secondApproval = approveTodayFriendSubmission(firstApproval.submission, firstApproval.balance, '2026-09-01T01:06:00.000Z');

  // Then
  assert.equal(TODAY_FRIEND_REWARD, 15);
  assert.equal(firstApproval.awarded, true);
  assert.equal(firstApproval.balance, 115);
  assert.equal(secondApproval.awarded, false);
  assert.equal(secondApproval.balance, 115);
});
