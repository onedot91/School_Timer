import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  approveTodayFriendSubmission,
  createTodayFriendPartnerAssignments,
  createTodayFriendRecommendationDelivery,
  createTodayFriendSubmission,
  createTodayFriendWeek,
  formatTodayFriendCommonalities,
  getTodayFriendLayoutPreview,
  getTodayFriendNumber,
  getTodayFriendPreviewGenre,
  parseTodayFriendCommonalities,
  submitTodayFriendSubmission,
  TODAY_FRIEND_GENRES,
  TODAY_FRIEND_REWARD,
} from './todayFriend';

test('추천하기 미션은 수신 친구의 우편함에 저장할 고유 편지를 만든다', () => {
  const delivery = createTodayFriendRecommendationDelivery({
    dateKey: '2026-09-01',
    studentNumber: 3,
    partnerNumber: 14,
    revision: 1,
    payload: {
      kind: 'recommendation',
      category: 'book',
      title: '긴긴밤',
      reason: '서로를 지켜 주는 마음이 따뜻해서 추천해요.',
      letterId: null,
    },
  });

  assert.deepEqual(delivery.letter, {
    id: 'today-friend-recommendation-2026-09-01-3-r1',
    recipient: 14,
    title: '[오늘의 친구] 책 추천',
    content: '추천할 것\n긴긴밤\n\n추천하는 이유\n서로를 지켜 주는 마음이 따뜻해서 추천해요.',
  });
  assert.equal(delivery.payload.letterId, delivery.letter.id);
});

test('공통점 세 가지는 번호 목록으로 저장하고 예전 한 줄 답도 읽는다', () => {
  assert.equal(
    formatTodayFriendCommonalities(['주말에 자전거를 탄다', '떡볶이를 좋아한다', '강아지가 있다']),
    '1. 주말에 자전거를 탄다\n2. 떡볶이를 좋아한다\n3. 강아지가 있다',
  );
  assert.deepEqual(
    parseTodayFriendCommonalities('1. 주말에 자전거를 탄다\n2. 떡볶이를 좋아한다\n3. 강아지가 있다'),
    ['주말에 자전거를 탄다', '떡볶이를 좋아한다', '강아지가 있다'],
  );
  assert.deepEqual(
    parseTodayFriendCommonalities('둘 다 주말에 가족과 자전거를 탄다.'),
    ['둘 다 주말에 가족과 자전거를 탄다.', '', ''],
  );
});

test('현재 장르 탭을 다시 선택해도 저장 버튼을 막는 미리보기 상태가 되지 않는다', () => {
  assert.equal(getTodayFriendPreviewGenre('interview', 'interview'), null);
  assert.equal(getTodayFriendPreviewGenre('interview', 'compliment'), 'compliment');
});

test('주말에도 화면용 미리보기 파트너와 장르를 만든다', () => {
  const preview = getTodayFriendLayoutPreview(1, '2026-09-12');
  assert.ok(preview);
  assert.equal(preview.studentNumber, 1);
  assert.notEqual(preview.partnerNumber, 1);
  assert.equal(preview.genre, 'interview');
  const testPreview = getTodayFriendLayoutPreview(24, '2026-09-12');
  assert.ok(testPreview);
  assert.equal(testPreview.studentNumber, 24);
  assert.notEqual(testPreview.partnerNumber, 24);
  assert.ok(testPreview.partnerNumber >= 1 && testPreview.partnerNumber <= 23);
});

test('기본 파트너는 날짜별로 재현 가능하며 자신과 배정되지 않는다', () => {
  // Given
  const students = Array.from({ length: 23 }, (_, index) => index + 1);
  const firstDateKey = '2026-01-05';
  const secondDateKey = '2026-01-06';

  // When
  const firstPartners = students.map((studentNumber) => getTodayFriendNumber(studentNumber, firstDateKey));
  const secondPartners = students.map((studentNumber) => getTodayFriendNumber(studentNumber, secondDateKey));

  // Then
  assert.deepEqual(students.map((studentNumber) => getTodayFriendNumber(studentNumber, firstDateKey)), firstPartners);
  students.forEach((studentNumber, index) => {
    assert.notEqual(firstPartners[index], studentNumber);
    assert.notEqual(secondPartners[index], studentNumber);

  });
  assert.equal(new Set(firstPartners).size, 23);
  assert.equal(new Set(secondPartners).size, 23);
  assert.equal(firstPartners.includes(24), false);
  assert.equal(secondPartners.includes(24), false);
  assert.equal(getTodayFriendNumber(24, firstDateKey), 24);
});

test('테스트 학생은 오늘의 친구 배정과 제출 대상에서 빠진다', () => {
  const students = Array.from({ length: 23 }, (_, index) => index + 1);
  const assignments = createTodayFriendPartnerAssignments(students, '2026-09-01');
  assert.equal(assignments.some((assignment) => assignment.studentNumber === 24 || assignment.partnerNumber === 24), false);
  assert.throws(
    () => createTodayFriendPartnerAssignments([...students, 24], '2026-09-01'),
    /INVALID_STUDENT_ROSTER/,
  );
  assert.throws(() => createTodayFriendSubmission({
    dateKey: '2026-09-01',
    studentNumber: 24,
    partnerNumber: 3,
    genre: 'interview',
    payload: { kind: 'interview', answer: '테스트' },
  }), /INVALID_SUBMISSION/);
  assert.throws(() => createTodayFriendSubmission({
    dateKey: '2026-09-01',
    studentNumber: 3,
    partnerNumber: 24,
    genre: 'interview',
    payload: { kind: 'interview', answer: '테스트' },
  }), /INVALID_SUBMISSION/);
});

test('날짜별 기본 배정은 10개의 쌍방향 쌍과 3명의 꼬리물기를 만든다', () => {
  const students = Array.from({ length: 23 }, (_, index) => index + 1);
  for (let day = 1; day <= 31; day += 1) {
    const dateKey = `2026-01-${String(day).padStart(2, '0')}`;
    const partner = (student: number) => getTodayFriendNumber(student, dateKey);
    const paired = students.filter(student => partner(partner(student)) === student);
    const cycle = students.filter(student => partner(partner(student)) !== student);
    assert.equal(paired.length, 20);
    assert.equal(cycle.length, 3);
    for (const student of cycle) {
      assert.notEqual(partner(student), student);
      assert.equal(partner(partner(partner(student))), student);
    }
  }
});

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

test('제출한 답은 승인 전에 다시 내면 최신 내용으로 바뀐다', () => {
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
  const resubmitted = submitTodayFriendSubmission({
    ...submitted,
    payload: { kind: 'commonality', commonality: '오늘 대화하며 둘 다 주말에 가족과 자전거를 탄다는 것을 알았다.' },
  }, '2026-09-01T01:10:00.000Z');

  // Then
  assert.equal(resubmitted.status, 'submitted');
  assert.equal(resubmitted.revision, 2);
  assert.equal(resubmitted.payload.kind === 'commonality' ? resubmitted.payload.commonality : '', '오늘 대화하며 둘 다 주말에 가족과 자전거를 탄다는 것을 알았다.');
  assert.throws(
    () => submitTodayFriendSubmission({ ...resubmitted, status: 'approved' }, '2026-09-01T01:20:00.000Z'),
    /SUBMISSION_NOT_EDITABLE/,
  );
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


test('모든 학생의 친구는 평일마다 바뀌며 금요일 다음 배정은 월요일로 이어진다', () => {
  const days = Array.from({ length: 370 }, (_, index) => new Date(Date.UTC(2026, 0, index + 1)))
    .filter(date => date.getUTCDay() >= 1 && date.getUTCDay() <= 5)
    .map(date => date.toISOString().slice(0, 10));
  for (let index = 1; index < days.length; index += 1) {
    for (let student = 1; student <= 23; student += 1) {
      assert.notEqual(getTodayFriendNumber(student, days[index]), getTodayFriendNumber(student, days[index - 1]), `${days[index]} ${student}번`);
    }
  }
});
