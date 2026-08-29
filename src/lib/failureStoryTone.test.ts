import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createFailureStoryToneIndex,
  FAILURE_STORY_TONES,
  getFailureStoryTone,
} from './failureStoryTone.ts';

const stories = Array.from({ length: 12 }, (_, index) => ({
  id: `story-${String(index + 1).padStart(2, '0')}`,
  createdAt: `2026-08-${String(index + 1).padStart(2, '0')}T09:00:00.000Z`,
  failure: `실패 ${index + 1}`,
  lesson: `다음 시도 ${index + 1}`,
  updatedAt: `2026-08-${String(index + 1).padStart(2, '0')}T09:00:00.000Z`,
}));

test('실패 이야기 6톤 해시는 같은 ID에 항상 같은 톤을 배정한다', () => {
  // Given
  const storyId = 'failure-stable-tone';

  // When
  const firstTone = getFailureStoryTone(storyId);
  const secondTone = getFailureStoryTone(storyId);

  // Then
  assert.equal(secondTone, firstTone);
  assert.ok(FAILURE_STORY_TONES.includes(firstTone));
});

test('실패 이야기 6톤은 시간순 첫 여섯과 최신 여섯에 서로 다른 색을 배정한다', () => {
  // Given
  const originalStories = structuredClone(stories);

  // When
  const toneIndex = createFailureStoryToneIndex(stories);
  const firstSix = stories.slice(0, 6).map((story) => toneIndex.get(story.id));
  const latestSix = stories.slice(-6).map((story) => toneIndex.get(story.id));

  // Then
  assert.equal(new Set(firstSix).size, 6);
  assert.equal(new Set(latestSix).size, 6);
  assert.deepEqual(stories, originalStories);
});

test('실패 이야기 6톤은 입력 재정렬·본문 수정·최신 글 추가 후에도 기존 ID 색을 유지한다', () => {
  // Given
  const initialIndex = createFailureStoryToneIndex(stories);
  const changedStories = stories
    .map((story) => ({ ...story, failure: `${story.failure} 수정`, updatedAt: '2026-08-29T12:00:00.000Z' }))
    .reverse();
  const appendedStories = [...stories, {
    id: 'story-13',
    createdAt: '2026-08-13T09:00:00.000Z',
  }];

  // When
  const changedIndex = createFailureStoryToneIndex(changedStories);
  const appendedIndex = createFailureStoryToneIndex(appendedStories);

  // Then
  stories.forEach((story) => {
    assert.equal(changedIndex.get(story.id), initialIndex.get(story.id));
    assert.equal(appendedIndex.get(story.id), initialIndex.get(story.id));
  });
});
