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

test('교사가 추가한 미션은 일일 미션의 가장 앞에 표시된다', () => {
  // Given
  const missionsPage = createElement(StudentMissionsPage, {
    studentNumber: 1,
    profileAssignments: {},
    balance: 100,
    availableBalance: 100,
    reservedAmount: 0,
    isLoading: false,
    auctionMissions: [{ id: 'teacher-mission', content: '인사하기', rewardAmount: 5 }],
    classroomRoleMission: normalizeClassroomRoleMissionSettings({ enabled: false }),
    weeklyMissionStatuses: createWeeklyMissionStatuses('incomplete'),
    hasSyncError: false,
    isDailyEmotionMissionCompleted: false,
    hasDailyWritingMission: false,
    isDailyWritingMissionCompleted: false,
    isWeeklySudokuMissionCompleted: false,
    activeSudokuDifficulty: null,
    completedSudokuDifficulty: null,
    numberBaseballStatus: 'incomplete',
    onOpenEmotions: () => undefined,
    onOpenMailbox: () => undefined,
    onOpenSudoku: () => undefined,
    onOpenNumberBaseball: () => undefined,
    onBack: () => undefined,
  });

  // When
  const markup = renderToStaticMarkup(missionsPage);

  // Then
  const teacherMissionIndex = markup.indexOf('인사하기');
  const emotionMissionIndex = markup.indexOf('감정 구슬 넣기');
  const writingMissionIndex = markup.indexOf('글밥짓기');
  assert.ok(teacherMissionIndex >= 0);
  assert.ok(teacherMissionIndex < emotionMissionIndex);
  assert.ok(teacherMissionIndex < writingMissionIndex);
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
    activeSudokuDifficulty: null,
    completedSudokuDifficulty: null,
    numberBaseballStatus: 'incomplete' as const,
    onOpenEmotions: () => undefined,
    onOpenMailbox: () => undefined,
    onOpenSudoku: () => undefined,
    onOpenNumberBaseball: () => undefined,
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

  assert.match(assignedMarkup, /오늘 역할: 칠판 전문가/);
  assert.doesNotMatch(assignedMarkup.match(/student-mission-card-manual[^>]*>/)?.[0] ?? '', /is-disabled/);
  assert.match(unassignedMarkup, /오늘 역할 없음/);
  assert.match(unassignedMarkup.match(/student-mission-card-manual[^>]*>/)?.[0] ?? '', /is-disabled/);
});
