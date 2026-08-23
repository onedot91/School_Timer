import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createFailureStory,
  deleteFailureStory,
  getFailureProfileImage,
  getFailureRelayWindow,
  getSelectedFailureStamp,
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

test('같은 날에는 학생 23명의 프로필이 겹치지 않고 고정된다', () => {
  const firstLoad = Array.from(
    { length: 23 },
    (_, index) => getFailureProfileImage(index + 1, '2026-08-24'),
  );
  const secondLoad = Array.from(
    { length: 23 },
    (_, index) => getFailureProfileImage(index + 1, '2026-08-24'),
  );

  assert.equal(new Set(firstLoad).size, 23);
  assert.deepEqual(secondLoad, firstLoad);
});

test('날짜가 바뀌면 모든 학생의 프로필이 바뀐다', () => {
  const today = Array.from(
    { length: 23 },
    (_, index) => getFailureProfileImage(index + 1, '2026-08-24'),
  );
  const tomorrow = Array.from(
    { length: 23 },
    (_, index) => getFailureProfileImage(index + 1, '2026-08-25'),
  );

  assert.ok(today.every((profile, index) => profile !== tomorrow[index]));
});

test('1970년 이전 날짜에도 학생 프로필이 겹치지 않는다', () => {
  const profiles = Array.from(
    { length: 23 },
    (_, index) => getFailureProfileImage(index + 1, '1969-12-31'),
  );

  assert.equal(new Set(profiles).size, 23);
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
