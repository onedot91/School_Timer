import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DAILY_WRITING_REWARD,
  cancelDailyWritingRewardInSettings,
  claimDailyWritingRewardInSettings,
  getDailyWritingAssignedDateKeys,
  getNextDailyWritingDateKey,
  hasDailyWritingLetterForDate,
  hasDailyWritingReward,
  normalizeDailyWritingLetterForDisplay,
  markDailyWritingStudentRewarded,
  normalizeDailyWritingState,
  publishDailyWritingAssignment,
  unmarkDailyWritingStudentRewarded,
} from './dailyWriting.ts';
import { getStudentLetters, getUnreadStudentLetterCount, normalizeStudentLifeState } from './studentLife.ts';

test('글밥짓기 발행은 같은 날짜의 편지를 23명에게 한 번씩 전달한다', () => {
  // Given
  const studentLife = normalizeStudentLifeState(null);
  const firstDraft = {
    dateKey: '2026-08-25',
    topic: '내가 가장 좋아하는 아침 풍경',
    requiredWord: '반짝이는',
    requiredWordMeaning: '빛을 받아 밝게 빛나는 모습',
    publishedAt: '2026-08-24T01:00:00.000Z',
  };

  // When
  const first = publishDailyWritingAssignment(normalizeDailyWritingState(null), studentLife, firstDraft);
  const rewarded = markDailyWritingStudentRewarded(first.state, 7, '2026-08-25');
  const revised = publishDailyWritingAssignment(rewarded, first.studentLife, {
    ...firstDraft,
    topic: '비 오는 날의 즐거운 발견',
    publishedAt: '2026-08-24T02:00:00.000Z',
  });

  // Then
  assert.equal(first.state.assignment?.rewardAmount, DAILY_WRITING_REWARD);
  assert.equal(revised.studentLife.letters.length, 23);
  assert.deepEqual(revised.state.completedStudentNumbers, [7]);
  assert.equal(revised.state.assignment?.requiredWordMeaning, firstDraft.requiredWordMeaning);
  assert.equal(getStudentLetters(revised.studentLife, 7, '2026-08-24').length, 0);
  assert.equal(getUnreadStudentLetterCount(revised.studentLife, 7, '2026-08-24'), 0);
  assert.equal(getStudentLetters(revised.studentLife, 7, '2026-08-25').length, 1);
  assert.match(getStudentLetters(revised.studentLife, 7, '2026-08-25')[0]?.content ?? '', /비 오는 날의 즐거운 발견/);
  assert.match(getStudentLetters(revised.studentLife, 7, '2026-08-25')[0]?.content ?? '', /반짝이는/);
  assert.match(getStudentLetters(revised.studentLife, 7, '2026-08-25')[0]?.content ?? '', /^• 글밥 주제\n/);
  assert.match(getStudentLetters(revised.studentLife, 7, '2026-08-25')[0]?.content ?? '', /\n\n• 꼭 쓸 낱말\n/);
  assert.match(getStudentLetters(revised.studentLife, 7, '2026-08-25')[0]?.content ?? '', /\n  뜻: /);
});

test('글밥짓기 편지에서 주제가 할당된 날짜를 중복 없이 찾는다', () => {
  // Given
  const first = publishDailyWritingAssignment(
    normalizeDailyWritingState(null),
    normalizeStudentLifeState(null),
    {
      dateKey: '2026-08-25',
      topic: '내가 가장 좋아하는 아침 풍경',
      requiredWord: '반짝이는',
      requiredWordMeaning: '빛을 받아 밝게 빛나는 모습',
      publishedAt: '2026-08-24T01:00:00.000Z',
    },
  );
  const second = publishDailyWritingAssignment(first.state, first.studentLife, {
    dateKey: '2026-08-27',
    topic: '구름 위에 집을 짓는다면',
    requiredWord: '몽글몽글',
    requiredWordMeaning: '작고 부드러운 덩어리가 모인 모양',
    publishedAt: '2026-08-26T01:00:00.000Z',
  });

  // When
  const assignedDateKeys = getDailyWritingAssignedDateKeys(second.studentLife.letters);

  // Then
  assert.deepEqual(assignedDateKeys, ['2026-08-25', '2026-08-27']);
});

test('오늘 글밥 assignment가 없어도 오늘 편지가 있으면 일일 미션을 표시한다', () => {
  // Given
  const letters = [
    { id: 'daily-writing-letter-2026-08-24-1' },
    { id: 'daily-writing-letter-2026-08-25-1' },
  ];

  // When
  const hasTodayMission = hasDailyWritingLetterForDate(letters, '2026-08-25');

  // Then
  assert.equal(hasTodayMission, true);
  assert.equal(hasDailyWritingLetterForDate(letters, '2026-08-26'), false);
});

test('글밥짓기 보상은 학생과 날짜별로 25고마를 한 번만 지급한다', () => {
  // Given
  const initial = { currencyBalances: { 7: 100 }, currencyHistory: { 7: [] } };

  // When
  const first = claimDailyWritingRewardInSettings(initial, 7, '2026-08-25');
  const second = claimDailyWritingRewardInSettings(first.value, 7, '2026-08-25');

  // Then
  assert.equal(first.awarded, true);
  assert.equal(first.balances['7'], 125);
  assert.equal(second.awarded, false);
  assert.equal(second.balances['7'], 125);
  assert.equal(hasDailyWritingReward(second.history, 7, '2026-08-25'), true);
});

test('글밥짓기 보상 취소는 지급 기록과 완료 표시를 되돌리고 다시 지급할 수 있게 한다', () => {
  // Given
  const dateKey = '2026-08-25';
  const assignmentState = normalizeDailyWritingState({
    assignment: {
      dateKey,
      topic: '우리 반에 비밀 통로가 생긴다면',
      requiredWord: '살금살금',
      requiredWordMeaning: '남이 모르게 조용히 움직이는 모양',
      publishedAt: '2026-08-24T01:00:00.000Z',
    },
  });
  const rewarded = claimDailyWritingRewardInSettings(
    { currencyBalances: { 7: 100 }, currencyHistory: { 7: [] } },
    7,
    dateKey,
  );
  const withLaterTransaction = {
    currencyBalances: { ...rewarded.balances, 7: 130 },
    currencyHistory: {
      ...rewarded.history,
      7: [{
        id: 'later-reward',
        studentNumber: 7,
        delta: 5,
        before: 125,
        after: 130,
        reason: 'manual' as const,
        createdAt: '2026-08-24T02:00:00.000Z',
      }, ...(rewarded.history['7'] ?? []).map((entry) => ({
        ...entry,
        createdAt: '2026-08-24T01:00:00.000Z',
      }))],
    },
  };

  // When
  const cancelled = cancelDailyWritingRewardInSettings(withLaterTransaction, 7, dateKey);
  const stateAfterCancel = unmarkDailyWritingStudentRewarded(
    markDailyWritingStudentRewarded(assignmentState, 7, dateKey),
    7,
    dateKey,
  );
  const rewardedAgain = claimDailyWritingRewardInSettings(cancelled.value, 7, dateKey);

  // Then
  assert.equal(cancelled.cancelled, true);
  assert.equal(cancelled.balances['7'], 105);
  assert.equal(cancelled.history['7']?.[0]?.before, 100);
  assert.equal(cancelled.history['7']?.[0]?.after, 105);
  assert.equal(hasDailyWritingReward(cancelled.history, 7, dateKey), false);
  assert.deepEqual(stateAfterCancel.completedStudentNumbers, []);
  assert.equal(rewardedAgain.awarded, true);
  assert.equal(rewardedAgain.balances['7'], 130);
});

test('저장된 글밥짓기 값은 날짜와 주제와 꼭 쓸 낱말이 모두 있을 때만 복원한다', () => {
  // Given
  const valid = {
    assignment: {
      dateKey: '2026-08-25',
      topic: '우리 반에 비밀 통로가 생긴다면',
      requiredWord: '살금살금',
      requiredWordMeaning: '남이 모르게 조용히 움직이는 모양',
      rewardAmount: 999,
      publishedAt: '2026-08-24T01:00:00.000Z',
    },
  };

  // When
  const normalizedValid = normalizeDailyWritingState(valid);
  const normalizedInvalid = normalizeDailyWritingState({
    assignment: { ...valid.assignment, requiredWord: '' },
  });

  // Then
  assert.equal(normalizedValid.assignment?.rewardAmount, DAILY_WRITING_REWARD);
  assert.equal(normalizedInvalid.assignment, null);
});

test('새 글밥 편지는 낱말 뜻이 있어야 발행된다', () => {
  // Given
  const currentState = normalizeDailyWritingState(null);
  const studentLife = normalizeStudentLifeState(null);

  // When
  const result = publishDailyWritingAssignment(currentState, studentLife, {
    dateKey: '2026-08-25',
    topic: '내가 발견한 작은 모험',
    requiredWord: '살금살금',
    requiredWordMeaning: '',
    publishedAt: '2026-08-24T01:00:00.000Z',
  });

  // Then
  assert.deepEqual(result.state, currentState);
  assert.deepEqual(result.studentLife, studentLife);
});

test('토요일에는 글밥 주제를 발행할 수 없다', () => {
  // Given
  const currentState = normalizeDailyWritingState(null);
  const studentLife = normalizeStudentLifeState(null);

  // When
  const result = publishDailyWritingAssignment(currentState, studentLife, {
    dateKey: '2026-08-29',
    topic: '주말 교실에서 일어난 일',
    requiredWord: '고요히',
    requiredWordMeaning: '조용하고 잠잠하게',
    publishedAt: '2026-08-28T01:00:00.000Z',
  });

  // Then
  assert.deepEqual(result.state, currentState);
  assert.deepEqual(result.studentLife, studentLife);
});

test('일요일에는 글밥 주제를 발행할 수 없다', () => {
  // Given
  const currentState = normalizeDailyWritingState(null);
  const studentLife = normalizeStudentLifeState(null);

  // When
  const result = publishDailyWritingAssignment(currentState, studentLife, {
    dateKey: '2026-08-30',
    topic: '주말 운동장에서 일어난 일',
    requiredWord: '한적한',
    requiredWordMeaning: '사람이 적어 조용한',
    publishedAt: '2026-08-28T01:00:00.000Z',
  });

  // Then
  assert.deepEqual(result.state, currentState);
  assert.deepEqual(result.studentLife, studentLife);
});

test('금요일 다음 글밥 날짜는 월요일로 정한다', () => {
  // Given
  const friday = new Date(2026, 7, 28, 12);

  // When
  const nextDateKey = getNextDailyWritingDateKey(friday);

  // Then
  assert.equal(nextDateKey, '2026-08-31');
});

test('예전에 저장한 글밥 편지도 밥집 아주머니 가히의 멍 말투로 표시한다', () => {
  // Given
  const legacyLetter = {
    id: 'daily-writing-letter-2026-08-25-1',
    recipient: 1,
    senderLabel: '글밥지기 가히',
    senderStudentNumber: null,
    replyToId: null,
    title: '내일의 글밥이 도착했꿀',
    content: '글밥 주제는 “우리 반 이야기”이야. 낱말을 꼭 한 번 넣어 써 보꿀! 제출하면 25고마를 받을 수 있꿀.',
    createdAt: '2026-08-24T01:00:00.000Z',
    readAt: null,
  };

  // When
  const displayed = normalizeDailyWritingLetterForDisplay(legacyLetter);

  // Then
  assert.equal(displayed.senderLabel, '밥집 아주머니 가히');
  assert.equal(displayed.title.includes('꿀'), false);
  assert.equal(displayed.title.startsWith('오늘의 '), true);
  assert.equal(displayed.title.endsWith('도착했다멍'), true);
  assert.equal(displayed.content.includes('꿀'), false);
  assert.equal(displayed.content.startsWith('• 글밥 주제\n'), true);
  assert.equal(displayed.content.includes('\n\n• 꼭 쓸 낱말\n'), true);
  assert.equal(displayed.content.includes('\n  뜻: '), true);
  assert.equal(displayed.content.includes('이멍'), false);
  assert.equal(displayed.content.includes('수 있다멍.'), true);
});
