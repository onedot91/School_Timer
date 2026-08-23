import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import StudentFailureRelay from '../components/student/StudentFailureRelay.tsx';
import {
  createFailureStory,
  deleteFailureStory,
  FAILURE_PROFILE_IMAGES,
  FAILURE_PROFILE_OPTIONS,
  getRandomAvailableFailureProfile,
  getFailureProfileImage,
  getFailureRelayWindow,
  getSelectedFailureStamp,
  normalizeFailureProfileAssignments,
  selectFailureProfile,
  normalizeFailureStories,
  toggleFailureStamp,
  updateFailureStory,
} from './failureExhibition.ts';

const storyInput = {
  id: 'failure-1',
  studentNumber: 7,
  failure: '발표할 말을 잊었어요.',
  lesson: '천천히 다시 시작하면 돼요.',
  createdAt: '2026-08-23T01:00:00.000Z',
  updatedAt: '2026-08-23T01:00:00.000Z',
};

test('저장 가능한 프로필 카탈로그는 70개의 동물만 제공한다', () => {
  assert.equal(FAILURE_PROFILE_IMAGES.length, 70);
  assert.equal(FAILURE_PROFILE_OPTIONS.length, 70);
  assert.equal(new Set(FAILURE_PROFILE_OPTIONS.map((profile) => profile.label)).size, 70);
  assert.equal(FAILURE_PROFILE_OPTIONS.some((profile) => String(profile.label) === '익명'), false);
  assert.equal(FAILURE_PROFILE_OPTIONS.some((profile) => profile.label.startsWith('동물 프로필')), false);
});

test('랜덤 프로필은 다른 학생이 쓰지 않는 동물만 고른다', () => {
  const assignments = normalizeFailureProfileAssignments(null);
  const availableProfiles = FAILURE_PROFILE_IMAGES.filter((image) => !Object.values(assignments).includes(image));

  assert.equal(getRandomAvailableFailureProfile(assignments, 1, () => 0), availableProfiles[0]);
  assert.equal(getRandomAvailableFailureProfile(assignments, 1, () => 0.999), availableProfiles.at(-1));
});

test('익명 이미지는 학생 프로필로 저장할 수 없다', () => {
  const assignments = normalizeFailureProfileAssignments(null);
  const result = selectFailureProfile(assignments, 1, '/failure-profiles/thumbs/anonymous.png');
  const normalized = normalizeFailureProfileAssignments({
    ...assignments,
    1: '/failure-profiles/thumbs/anonymous.png',
  });

  assert.equal(result.applied, false);
  assert.equal(result.reason, 'invalid_profile');
  assert.notEqual(normalized['1'], '/failure-profiles/thumbs/anonymous.png');
});

test('학생 23명의 기본 프로필은 겹치지 않고 날짜와 관계없이 고정된다', () => {
  const firstLoad = Array.from({ length: 23 }, (_, index) => getFailureProfileImage(index + 1));
  const secondLoad = Array.from({ length: 23 }, (_, index) => getFailureProfileImage(index + 1));

  assert.equal(new Set(firstLoad).size, 23);
  assert.deepEqual(secondLoad, firstLoad);
});

test('사용하지 않은 프로필로 바꾸면 선택이 유지된다', () => {
  const assignments = normalizeFailureProfileAssignments(null);
  const unusedProfile = FAILURE_PROFILE_IMAGES.find((image) => !Object.values(assignments).includes(image));
  assert.ok(unusedProfile);

  const result = selectFailureProfile(assignments, 1, unusedProfile);

  assert.equal(result.applied, true);
  assert.equal(getFailureProfileImage(1, result.assignments), unusedProfile);
  assert.equal(new Set(Object.values(result.assignments)).size, 23);
});

test('다른 학생이 사용 중인 프로필은 선택할 수 없다', () => {
  const assignments = normalizeFailureProfileAssignments(null);
  const studentTwoProfile = getFailureProfileImage(2, assignments);

  const result = selectFailureProfile(assignments, 1, studentTwoProfile);

  assert.equal(result.applied, false);
  assert.equal(result.reason, 'profile_in_use');
  assert.equal(getFailureProfileImage(1, result.assignments), getFailureProfileImage(1, assignments));
});

test('실패 릴레이는 현재 위치부터 최대 다섯 이야기만 보여 준다', () => {
  const stories = Array.from({ length: 8 }, (_, index) => ({
    ...storyInput,
    id: `failure-${index + 1}`,
    stamps: [],
  }));

  const firstWindow = getFailureRelayWindow(stories, 0);
  const lastWindow = getFailureRelayWindow(stories, 99);

  assert.deepEqual(firstWindow.map((story) => story.id), [
    'failure-1',
    'failure-2',
    'failure-3',
    'failure-4',
    'failure-5',
  ]);
  assert.deepEqual(lastWindow.map((story) => story.id), [
    'failure-4',
    'failure-5',
    'failure-6',
    'failure-7',
    'failure-8',
  ]);
});

test('실패 릴레이는 마지막 이야기 다음에 첫 이야기를 이어 보여 준다', () => {
  const stories = Array.from({ length: 8 }, (_, index) => ({
    ...storyInput,
    id: `failure-${index + 1}`,
    stamps: [],
  }));

  const wrappedWindow = getFailureRelayWindow(stories, 7);

  assert.deepEqual(wrappedWindow.map((story) => story.id), [
    'failure-8',
    'failure-1',
    'failure-2',
    'failure-3',
    'failure-4',
  ]);
});

test('실패 릴레이는 첫 이야기 이전에 마지막 이야기를 이어 보여 준다', () => {
  const stories = Array.from({ length: 8 }, (_, index) => ({
    ...storyInput,
    id: `failure-${index + 1}`,
    stamps: [],
  }));

  const wrappedWindow = getFailureRelayWindow(stories, -1);

  assert.deepEqual(wrappedWindow.map((story) => story.id), [
    'failure-8',
    'failure-1',
    'failure-2',
    'failure-3',
    'failure-4',
  ]);
});

test('실패 릴레이는 스크롤 방향대로 다음 이야기를 아래쪽에 이어 붙인다', () => {
  // Given
  const stories = Array.from({ length: 6 }, (_, index) => ({
    ...storyInput,
    id: `relay-${index + 1}`,
    studentNumber: index + 1,
    stamps: [],
  }));
  const profileAssignments = normalizeFailureProfileAssignments(null);

  // When
  const markup = renderToStaticMarkup(createElement(StudentFailureRelay, {
    studentNumber: 23,
    profileAssignments,
    stories,
    isSaving: false,
    isExternallyPaused: false,
    latestRevealRequest: 0,
    onStamp: async () => false,
  }));

  // Then
  const visibleProfilePositions = stories.slice(0, 5).map((story) => (
    markup.indexOf(getFailureProfileImage(story.studentNumber, profileAssignments))
  ));
  assert.deepEqual(visibleProfilePositions, [...visibleProfilePositions].sort((left, right) => left - right));
});

test('실패 이야기는 같은 ID로 한 번만 등록된다', () => {
  const once = createFailureStory([], storyInput);
  const twice = createFailureStory(once, storyInput);

  assert.equal(twice.length, 1);
  assert.equal(twice[0]?.stamps.length, 0);
});

test('실패 이야기는 작성자만 수정하고 삭제할 수 있다', () => {
  const stories = createFailureStory([], storyInput);
  const blocked = updateFailureStory(stories, storyInput.id, 3, '바꾼 실패', '바꾼 교훈', 'later');
  const updated = updateFailureStory(blocked, storyInput.id, 7, ' 바꾼 실패 ', ' 바꾼 교훈 ', 'later');

  assert.equal(updated[0]?.failure, '바꾼 실패');
  assert.equal(deleteFailureStory(updated, storyInput.id, 3).length, 1);
  assert.equal(deleteFailureStory(updated, storyInput.id, 7).length, 0);
});

test('응원 도장은 다른 사람 글에 하나만 선택하고 다시 누르면 취소한다', () => {
  const stories = createFailureStory([], storyInput);
  const first = toggleFailureStamp(stories, storyInput.id, 3, 'me-too');
  const changed = toggleFailureStamp(first, storyInput.id, 3, 'cheer');
  const cleared = toggleFailureStamp(changed, storyInput.id, 3, 'cheer');
  const ownStory = toggleFailureStamp(stories, storyInput.id, 7, 'brave');

  assert.equal(changed[0]?.stamps.length, 1);
  assert.equal(changed[0] ? getSelectedFailureStamp(changed[0], 3) : null, 'cheer');
  assert.equal(cleared[0]?.stamps.length, 0);
  assert.equal(ownStory[0]?.stamps.length, 0);
});

test('저장된 응원 도장은 학생마다 첫 선택 하나만 복구한다', () => {
  const stories = normalizeFailureStories([{ ...storyInput, stamps: [
    { studentNumber: 3, stampId: 'cheer' },
    { studentNumber: 3, stampId: 'me-too' },
    { studentNumber: 4, stampId: 'invalid' },
  ] }]);

  assert.equal(stories[0]?.stamps.length, 1);
  assert.equal(stories[0]?.stamps[0]?.stampId, 'cheer');
});
