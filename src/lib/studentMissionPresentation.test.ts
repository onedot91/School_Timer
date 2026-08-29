import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import StudentMissionCard from '../components/student/StudentMissionCard';
import StudentMissionsPage from '../components/student/StudentMissionsPage';
import { createWeeklyMissionStatuses } from './weeklyMission';
import { getTodayClassroomRoleDateKey, normalizeClassroomRoleMissionSettings } from './classroomRoleMission';

test('수동 미션 카드는 상태 표정 대신 선생님 얼굴을 표시한다', () => {
  // Given
  const missionCard = createElement(StudentMissionCard, {
    title: '글밥짓기',
    rewardAmount: 25,
    verificationMode: 'manual',
    actionLabel: '글밥 편지 확인',
    onAction: () => undefined,
  });

  // When
  const markup = renderToStaticMarkup(missionCard);

  // Then
  assert.match(markup, /student-mission-teacher-face/);
  assert.match(markup, /data-mood="happy"/);
  assert.match(markup, /src="\/mission-status-faces\/teacher\.png"/);
  assert.doesNotMatch(markup, /student-mission-teacher-portrait/);
  assert.doesNotMatch(markup, /data-status=/);
});

test('자동 미션 카드는 현재 진행 상태 얼굴을 표시한다', () => {
  // Given
  const missionCard = createElement(StudentMissionCard, {
    title: '스도쿠',
    rewardAmount: [5, 15],
    verificationMode: 'automatic',
    status: 'inProgress',
    actionLabel: '이어 풀기',
    onAction: () => undefined,
  });

  // When
  const markup = renderToStaticMarkup(missionCard);

  // Then
  assert.match(markup, /student-mission-status-face/);
  assert.match(markup, /data-status="inProgress"/);
  assert.match(markup, /src="\/mission-status-faces\/in-progress\.png"/);
  assert.doesNotMatch(markup, /student-mission-face-mouth/);
});

test('완료 상태는 생성된 초록 웃는 얼굴 이미지를 표시한다', () => {
  // Given
  const missionCard = createElement(StudentMissionCard, {
    title: '감정 구슬 넣기',
    rewardAmount: 5,
    verificationMode: 'automatic',
    status: 'completed',
    actionLabel: '감정 보기',
    onAction: () => undefined,
  });

  // When
  const markup = renderToStaticMarkup(missionCard);

  // Then
  assert.match(markup, /src="\/mission-status-faces\/completed\.png"/);
});

test('오류 상태 카드는 오류 발생 안내를 제공한다', () => {
  // Given
  const missionCard = createElement(StudentMissionCard, {
    title: '스도쿠',
    rewardAmount: [5, 15],
    verificationMode: 'automatic',
    status: 'error',
    actionLabel: '문제 풀기',
    onAction: () => undefined,
  });

  // When
  const markup = renderToStaticMarkup(missionCard);

  // Then
  assert.match(markup, /상태: 오류 발생/);
});

test('전용 일러스트 카드는 별도 설명을 그림 위에 표시하지 않는다', () => {
  // Given
  const missionCard = createElement(StudentMissionCard, {
    title: '숫자 야구',
    description: '이번 주의 숫자를 맞히고 있어요.',
    illustrationSrc: '/mission-illustrations/number-baseball.png',
    rewardAmount: [5, 20],
    verificationMode: 'automatic',
    status: 'inProgress',
    actionLabel: '이어 하기',
    onAction: () => undefined,
  });

  // When
  const markup = renderToStaticMarkup(missionCard);

  // Then
  assert.match(markup, /student-mission-card[^\"]*has-illustration/);
  assert.doesNotMatch(markup, /student-mission-card-copy/);
  assert.match(markup, /aria-label="[^"]*이번 주의 숫자를 맞히고 있어요/);
});

test('1인 1역 일러스트는 역할 캡션을 표시한다', () => {
  // Given
  const missionCard = createElement(StudentMissionCard, {
    title: '1인 1역',
    illustrationSrc: '/mission-illustrations/classroom-role.png',
    illustrationCaption: '칠판 전문가',
    rewardAmount: 20,
    verificationMode: 'manual',
    actionLabel: '역할 수행',
  });

  // When
  const markup = renderToStaticMarkup(missionCard);

  // Then
  assert.match(markup, /student-mission-card-copy/);
  assert.match(markup, />칠판 전문가</);
});

test('교사가 추가한 미션은 일일 미션의 가장 앞에 표시된다', () => {
  // Given
  const missionsPage = createElement(StudentMissionsPage, {
    studentNumber: 1,
    profileAssignments: {},
    balance: 100,
    availableBalance: 100,
    reservedAmount: 0,
    isLoading: false,
    auctionMissions: [{ id: 'teacher-mission', content: '인사하기', rewardAmount: 5, illustrationIndex: 2 }],
    classroomRoleMission: normalizeClassroomRoleMissionSettings({ enabled: false }),
    weeklyMissionStatuses: createWeeklyMissionStatuses('incomplete'),
    hasSyncError: false,
    isDailyEmotionMissionCompleted: false,
    hasDailyWritingMission: false,
    isDailyWritingMissionCompleted: false,
    isWeeklySudokuMissionCompleted: false,
    isFailureExhibitionMissionCompleted: false,
    isBookStackMissionCompleted: false,
    activeSudokuDifficulty: null,
    completedSudokuDifficulty: null,
    numberBaseballStatus: 'incomplete',
    onOpenEmotions: () => undefined,
    onOpenMailbox: () => undefined,
    onOpenFailureExhibition: () => undefined,
    onOpenBookStack: () => undefined,
    onOpenSudoku: () => undefined,
    onOpenNumberBaseball: () => undefined,
    onOpenClassword: () => undefined,
    onBack: () => undefined,
  });

  // When
  const markup = renderToStaticMarkup(missionsPage);

  // Then
  const teacherMissionIndex = markup.indexOf('인사하기');
  const emotionMissionIndex = markup.indexOf('감정 구슬 넣기');
  const writingMissionIndex = markup.indexOf('글밥짓기');
  const classwordMissionIndex = markup.indexOf('ㄱㄴㄷ 게임');
  const weeklyMissionIndex = markup.indexOf('주간 미션');
  const personalQuestionMissionIndex = markup.indexOf('신문에 개인 질문하기');
  const failureExhibitionMissionIndex = markup.indexOf('실패 전시하기');
  const sudokuMissionIndex = markup.indexOf('스도쿠');
  assert.ok(teacherMissionIndex >= 0);
  assert.ok(teacherMissionIndex < emotionMissionIndex);
  assert.ok(teacherMissionIndex < writingMissionIndex);
  assert.ok(writingMissionIndex < classwordMissionIndex);
  assert.ok(classwordMissionIndex < weeklyMissionIndex);
  assert.ok(weeklyMissionIndex < personalQuestionMissionIndex);
  assert.ok(personalQuestionMissionIndex < failureExhibitionMissionIndex);
  assert.ok(failureExhibitionMissionIndex < sudokuMissionIndex);
  assert.match(markup, /src="\/mission-illustrations\/teacher-mission-3\.png"/);
  assert.match(markup, /student-mission-illustration-title/);
  assert.match(markup, />인사하기</);
  assert.match(markup, /student-mission-card-manual/);
  assert.match(markup, /일일 미션/);
  assert.match(markup, /매일매일 할 수 있는 미션/);
  assert.match(markup, /주간 미션/);
  assert.match(markup, /일주일에 한 번 할 수 있는 미션/);
  assert.match(markup, /실패 전시하기/);
  assert.match(markup, /읽은 책 쌓기/);
  assert.match(markup, /보상 10고마/);
  assert.match(markup, /ㄱㄴㄷ 게임[\s\S]*?보상 5고마/);
  assert.doesNotMatch(markup, /\d+개|\d+\/\d+ 완료/);
});

test('1인 1역 카드는 배정된 역할 또는 오늘 역할 없음을 표시한다', () => {
  const baseProps = {
    profileAssignments: {},
    balance: 100,
    availableBalance: 100,
    reservedAmount: 0,
    isLoading: false,
    auctionMissions: [],
    weeklyMissionStatuses: createWeeklyMissionStatuses('incomplete'),
    hasSyncError: false,
    isDailyEmotionMissionCompleted: false,
    hasDailyWritingMission: false,
    isDailyWritingMissionCompleted: false,
    isWeeklySudokuMissionCompleted: false,
    isFailureExhibitionMissionCompleted: false,
    isBookStackMissionCompleted: false,
    activeSudokuDifficulty: null,
    completedSudokuDifficulty: null,
    numberBaseballStatus: 'incomplete' as const,
    onOpenEmotions: () => undefined,
    onOpenMailbox: () => undefined,
    onOpenFailureExhibition: () => undefined,
    onOpenBookStack: () => undefined,
    onOpenSudoku: () => undefined,
    onOpenNumberBaseball: () => undefined,
    onOpenClassword: () => undefined,
    onBack: () => undefined,
  };
  const settings = normalizeClassroomRoleMissionSettings({
    enabled: true,
    anchorDateKey: getTodayClassroomRoleDateKey(),
    anchorStartStudentNumber: 1,
  });

  const assignedMarkup = renderToStaticMarkup(createElement(StudentMissionsPage, {
    ...baseProps,
    studentNumber: 1,
    classroomRoleMission: settings,
  }));
  const unassignedMarkup = renderToStaticMarkup(createElement(StudentMissionsPage, {
    ...baseProps,
    studentNumber: 23,
    classroomRoleMission: settings,
  }));

  assert.match(assignedMarkup, />칠판 전문가</);
  assert.doesNotMatch(assignedMarkup, /오늘 역할:/);
  assert.doesNotMatch(assignedMarkup.match(/student-mission-card-manual[^>]*>/)?.[0] ?? '', /is-disabled/);
  assert.match(unassignedMarkup, /오늘 역할 없음/);
  assert.match(unassignedMarkup.match(/student-mission-card-manual[^>]*>/)?.[0] ?? '', /is-disabled/);
});

test('전용 일러스트가 있는 미션 카드는 해당 4대3 이미지를 표시한다', () => {
  // Given
  const missionsPage = createElement(StudentMissionsPage, {
    studentNumber: 1,
    profileAssignments: {},
    balance: 100,
    availableBalance: 100,
    reservedAmount: 0,
    isLoading: false,
    auctionMissions: [],
    classroomRoleMission: normalizeClassroomRoleMissionSettings({ enabled: false }),
    weeklyMissionStatuses: createWeeklyMissionStatuses('incomplete'),
    hasSyncError: false,
    isDailyEmotionMissionCompleted: false,
    hasDailyWritingMission: false,
    isDailyWritingMissionCompleted: false,
    isWeeklySudokuMissionCompleted: false,
    isFailureExhibitionMissionCompleted: false,
    isBookStackMissionCompleted: false,
    activeSudokuDifficulty: null,
    completedSudokuDifficulty: null,
    numberBaseballStatus: 'incomplete',
    onOpenEmotions: () => undefined,
    onOpenMailbox: () => undefined,
    onOpenFailureExhibition: () => undefined,
    onOpenBookStack: () => undefined,
    onOpenSudoku: () => undefined,
    onOpenNumberBaseball: () => undefined,
    onOpenClassword: () => undefined,
    onBack: () => undefined,
  });

  // When
  const markup = renderToStaticMarkup(missionsPage);

  // Then
  assert.match(markup, /src="\/mission-illustrations\/classroom-role\.png"/);
  assert.match(markup, /src="\/mission-illustrations\/emotion-orbs\.png"/);
  assert.match(markup, /src="\/mission-illustrations\/writing\.png"/);
  assert.match(markup, /src="\/mission-illustrations\/sudoku\.png"/);
  assert.match(markup, /src="\/mission-illustrations\/number-baseball\.png"/);
  assert.match(markup, /src="\/mission-illustrations\/newspaper-question\.png"/);
  assert.match(markup, /src="\/mission-illustrations\/failure-exhibition\.png"/);
  assert.match(markup, /src="\/mission-illustrations\/book-stacking\.png"/);
  assert.match(markup, /src="\/mission-illustrations\/classword-game\.png"/);
});
