import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import StudentFailureExhibitionPage from '../components/student/StudentFailureExhibitionPage.tsx';
import StudentFailureMessage from '../components/student/StudentFailureMessage.tsx';
import StudentFailureRelay from '../components/student/StudentFailureRelay.tsx';
import {
  createFailureStory,
  deleteFailureStory,
  FAILURE_PROFILE_IMAGES,
  FAILURE_PROFILE_OPTIONS,
  getRandomAvailableFailureProfile,
  getFailureProfileImage,
  getFailureStoriesNewestFirst,
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

test('실패 이야기는 작성 후 일주일 동안만 전시에 나타난다', () => {
  const referenceTime = Date.parse('2026-09-04T01:00:00.000Z');
  const stories = [
    { ...storyInput, id: 'expired', createdAt: '2026-08-28T01:00:00.000Z', stamps: [] },
    { ...storyInput, id: 'visible-old', createdAt: '2026-08-28T01:00:00.001Z', stamps: [] },
    { ...storyInput, id: 'visible-new', createdAt: '2026-09-04T00:00:00.000Z', stamps: [] },
  ];

  assert.deepEqual(
    getFailureStoriesNewestFirst(stories, referenceTime).map((story) => story.id),
    ['visible-new', 'visible-old'],
  );
});

test('본인 실패 카드는 응원하기 대신 내가 쓴 글 배지를 표시한다', () => {
  const profileAssignments = normalizeFailureProfileAssignments(null);
  const commonProps = {
    story: { ...storyInput, stamps: [] },
    tone: 0 as const,
    profileAssignments,
    isSaving: false,
    isStampMenuOpen: false,
    onStampMenuToggle: () => undefined,
    onStamp: async () => false,
  };

  const ownMarkup = renderToStaticMarkup(createElement(StudentFailureMessage, {
    ...commonProps,
    studentNumber: storyInput.studentNumber,
  }));
  const classmateMarkup = renderToStaticMarkup(createElement(StudentFailureMessage, {
    ...commonProps,
    studentNumber: storyInput.studentNumber + 1,
  }));

  assert.match(ownMarkup, /student-failure-owner-badge/);
  assert.match(ownMarkup, />내가 쓴 글</);
  assert.doesNotMatch(ownMarkup, /응원하기/);
  assert.doesNotMatch(ownMarkup, /student-failure-stamp-trigger/);
  assert.doesNotMatch(classmateMarkup, /student-failure-owner-badge/);
  assert.match(classmateMarkup, /응원하기/);
});

test('실패 카드 본문은 눌러서 내용이 바뀌는 버튼이 아니다', () => {
  const markup = renderToStaticMarkup(createElement(StudentFailureMessage, {
    story: { ...storyInput, stamps: [] },
    tone: 0,
    studentNumber: storyInput.studentNumber + 1,
    profileAssignments: normalizeFailureProfileAssignments(null),
    isSaving: false,
    isStampMenuOpen: false,
    onStampMenuToggle: () => undefined,
    onStamp: async () => false,
  }));

  assert.match(markup, /<div class="student-failure-message-main">/);
  assert.doesNotMatch(markup, /<button[^>]*class="student-failure-message-main"/);
  assert.doesNotMatch(markup, /이야기 전체 보기|이야기 접기/);
});

test('응원 선택지는 멘트 의미에 맞는 서로 다른 아이콘과 색상 키를 가진다', () => {
  const markup = renderToStaticMarkup(createElement(StudentFailureMessage, {
    story: { ...storyInput, stamps: [] },
    tone: 0,
    studentNumber: storyInput.studentNumber + 1,
    profileAssignments: normalizeFailureProfileAssignments(null),
    isSaving: false,
    isStampMenuOpen: true,
    onStampMenuToggle: () => undefined,
    onStamp: async () => false,
  }));

  assert.match(markup, /data-stamp-id="me-too"[^>]*>[\s\S]*?lucide-users-round/);
  assert.match(markup, /data-stamp-id="brave"[^>]*>[\s\S]*?lucide-flag/);
  assert.match(markup, /data-stamp-id="cheer"[^>]*>[\s\S]*?lucide-sparkles/);
});

test('보낸 응원 배지는 선택한 마음의 아이콘과 상태 문구로 바뀐다', () => {
  const profileAssignments = normalizeFailureProfileAssignments(null);
  const expectations = [
    { stampId: 'me-too', icon: 'users-round', label: '공감 보냄' },
    { stampId: 'brave', icon: 'flag', label: '도전 보냄' },
    { stampId: 'cheer', icon: 'sparkles', label: '응원 보냄' },
  ] as const;

  for (const expectation of expectations) {
    const markup = renderToStaticMarkup(createElement(StudentFailureMessage, {
      story: {
        ...storyInput,
        stamps: [{ studentNumber: 3, stampId: expectation.stampId }],
      },
      tone: 0,
      studentNumber: 3,
      profileAssignments,
      isSaving: false,
      isStampMenuOpen: false,
      onStampMenuToggle: () => undefined,
      onStamp: async () => false,
    }));

    assert.match(markup, new RegExp(`student-failure-stamp-trigger is-selected[^>]*data-stamp-id="${expectation.stampId}"`));
    assert.match(markup, new RegExp(`lucide-${expectation.icon}`));
    assert.match(markup, new RegExp(`>${expectation.label}<`));
  }
});

test('빈 실패 자랑소는 전시 카드 구조와 하나의 작성 행동을 제공한다', () => {
  const markup = renderToStaticMarkup(createElement(StudentFailureExhibitionPage, {
    studentNumber: 7,
    profileAssignments: normalizeFailureProfileAssignments(null),
    stories: [],
    isSaving: false,
    onCreate: async () => false,
    onStamp: async () => false,
    onOpenBookshelf: () => undefined,
    onBack: () => undefined,
  }));

  assert.match(markup, /data-empty="true"/);
  assert.match(markup, /student-failure-empty-card/);
  assert.match(markup, /student-failure-empty-action-label/);
  assert.equal(markup.match(/aria-haspopup="dialog"/g)?.length, 1);
  assert.doesNotMatch(markup, /student-failure-relay-toolbar/);
});

test('도서관 게시판 모드는 기존 실패 전시 기능만 포함하고 별도 페이지 머리말을 만들지 않는다', () => {
  const markup = renderToStaticMarkup(createElement(StudentFailureExhibitionPage, {
    studentNumber: 7,
    profileAssignments: normalizeFailureProfileAssignments(null),
    stories: [],
    isSaving: false,
    onCreate: async () => false,
    onStamp: async () => false,
    onOpenBookshelf: () => undefined,
    onBack: () => undefined,
    embedded: true,
    onRequestClose: () => undefined,
  }));

  assert.match(markup, /student-canvas-library-failure-board/);
  assert.match(markup, /role="dialog"/);
  assert.match(markup, /aria-modal="true"/);
  assert.match(markup, /실패 자랑소 닫기/);
  assert.match(markup, /student-failure-empty-card/);
  assert.doesNotMatch(markup, /student-header/);
  assert.doesNotMatch(markup, /책장으로 가기/);
});

test('저장 가능한 프로필 카탈로그는 비둘기를 포함한 79개의 동물만 제공한다', () => {
  assert.equal(FAILURE_PROFILE_IMAGES.length, 79);
  assert.equal(FAILURE_PROFILE_OPTIONS.length, 79);
  assert.equal(new Set(FAILURE_PROFILE_OPTIONS.map((profile) => profile.label)).size, 79);
  assert.deepEqual(
    FAILURE_PROFILE_OPTIONS.slice(-7).map((profile) => profile.label),
    ['나비', '달팽이', '꿀벌', '래서판다', '두루미', '북극곰', '비둘기'],
  );
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

test('학생은 배정 전까지 모두 같은 모노톤 빈 프로필로 시작한다', () => {
  const firstLoad = Array.from({ length: 23 }, (_, index) => getFailureProfileImage(index + 1));
  const secondLoad = Array.from({ length: 23 }, (_, index) => getFailureProfileImage(index + 1));

  assert.equal(normalizeFailureProfileAssignments(null)['1'], undefined);
  assert.equal(new Set(firstLoad).size, 1);
  assert.match(firstLoad[0] ?? '', /empty\.svg$/);
  assert.deepEqual(secondLoad, firstLoad);
});

test('사용하지 않은 프로필로 바꾸면 선택이 유지된다', () => {
  const assignments = normalizeFailureProfileAssignments(null);
  const unusedProfile = FAILURE_PROFILE_IMAGES.find((image) => !Object.values(assignments).includes(image));
  assert.ok(unusedProfile);

  const result = selectFailureProfile(assignments, 1, unusedProfile);

  assert.equal(result.applied, true);
  assert.equal(getFailureProfileImage(1, result.assignments), unusedProfile);
  assert.deepEqual(Object.values(result.assignments), [unusedProfile]);
});

test('다른 학생이 사용 중인 프로필은 선택할 수 없다', () => {
  const assignments = normalizeFailureProfileAssignments({
    1: FAILURE_PROFILE_IMAGES[0],
    2: FAILURE_PROFILE_IMAGES[1],
  });
  const studentTwoProfile = getFailureProfileImage(2, assignments);

  const result = selectFailureProfile(assignments, 1, studentTwoProfile);

  assert.equal(result.applied, false);
  assert.equal(result.reason, 'profile_in_use');
  assert.equal(getFailureProfileImage(1, result.assignments), getFailureProfileImage(1, assignments));
});

test('실패 릴레이는 현재 위치부터 최대 여섯 이야기만 보여 준다', () => {
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
    'failure-6',
  ]);
  assert.deepEqual(lastWindow.map((story) => story.id), [
    'failure-4',
    'failure-5',
    'failure-6',
    'failure-7',
    'failure-8',
    'failure-1',
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
    'failure-5',
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
    'failure-5',
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

test('내 실패 이야기도 다른 이야기와 같은 순서로 릴레이에 섞인다', () => {
  // Given
  const stories = Array.from({ length: 8 }, (_, index) => ({
    ...storyInput,
    id: `relay-${index + 1}`,
    studentNumber: index + 1,
    failure: `실패 이야기 ${index + 1}`,
    stamps: [],
  }));
  const profileAssignments = normalizeFailureProfileAssignments(null);

  // When
  const markup = renderToStaticMarkup(createElement(StudentFailureRelay, {
    studentNumber: 7,
    profileAssignments,
    stories,
    isSaving: false,
    isExternallyPaused: false,
    latestRevealRequest: 0,
    onStamp: async () => false,
  }));

  // Then
  assert.match(markup, /실패 이야기 1/);
  assert.match(markup, /실패 이야기 6/);
  assert.doesNotMatch(markup, /실패 이야기 7/);
});

test('릴레이는 게시글 ID 톤을 DOM에 표시하고 여섯 개를 넘을 때만 탐색 버튼을 보여 준다', () => {
  // Given
  const profileAssignments = normalizeFailureProfileAssignments(null);
  const collidingIds = ['collision-A', 'collision-G', 'collision-M', 'collision-S', 'collision-Y', 'collision-_'];
  const sixStories = Array.from({ length: 6 }, (_, index) => ({
    ...storyInput,
    id: collidingIds[index] ?? `collision-${index}`,
    studentNumber: index + 1,
    createdAt: `2026-08-${String(index + 1).padStart(2, '0')}T09:00:00.000Z`,
    stamps: [],
  }));
  const renderRelay = (stories: typeof sixStories) => renderToStaticMarkup(createElement(StudentFailureRelay, {
    studentNumber: 23,
    profileAssignments,
    stories,
    isSaving: false,
    isExternallyPaused: false,
    latestRevealRequest: 0,
    onStamp: async () => false,
  }));

  // When
  const sixStoryMarkup = renderRelay(sixStories);
  const sevenStoryMarkup = renderRelay([...sixStories, {
    ...storyInput,
    id: 'collision-7',
    studentNumber: 7,
    createdAt: '2026-08-07T09:00:00.000Z',
    stamps: [],
  }]);
  const visibleTones = Array.from(
    sixStoryMarkup.matchAll(/data-story-tone="([0-5])"/g),
    (match) => match[1],
  );

  // Then
  assert.equal(visibleTones.length, 6);
  assert.equal(new Set(visibleTones).size, 6);
  assert.doesNotMatch(sixStoryMarkup, /student-failure-relay-toolbar/);
  assert.match(sevenStoryMarkup, /aria-label="이전 이야기 보기"/);
  assert.match(sevenStoryMarkup, /aria-label="다음 이야기 보기"/);
  assert.doesNotMatch(sevenStoryMarkup, /<span>이전<\/span>|<span>다음<\/span>/);
  assert.doesNotMatch(sevenStoryMarkup, /student-failure-feed-window-motion/);
  assert.match(sevenStoryMarkup, /student-failure-relay-item-motion/);
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
