import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advanceFailureRelayOffsets,
  getFailureRelayOffsetsForAnchors,
  getFailureRelayRows,
  getFailureRelayWindow,
  type FailureRelayOffsets,
  type FailureStory,
} from './failureExhibition.js';

const createStories = (count: number): readonly FailureStory[] => Array.from({ length: count }, (_, index) => ({
  id: String.fromCharCode(65 + index),
  studentNumber: index + 1,
  failure: String.fromCharCode(65 + index),
  lesson: '다시 시도하기',
  stamps: [],
  createdAt: `2026-08-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
  updatedAt: `2026-08-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
}));

test('실패 이야기는 여섯 슬롯을 모두 지나고 한 바퀴 뒤 첫 슬롯로 돌아온다', () => {
  // Given
  const stories = createStories(7);

  // When
  const positions = Array.from({ length: stories.length + 1 }, (_, step) => (
    getFailureRelayWindow(stories, -step).findIndex((story) => story.id === 'A')
  ));

  // Then
  assert.deepEqual(positions, [0, 1, 2, 3, 4, 5, -1, 0]);
});

test('이야기가 여덟 개 이상이면 한 번 이동할 때 각 행에서 한 장씩 교체된다', () => {
  // Given
  const stories = createStories(8);
  const beforeRows = getFailureRelayRows(stories, [0, 0]);

  // When
  const nextOffsets = advanceFailureRelayOffsets(stories, [0, 0], -1);
  const afterRows = getFailureRelayRows(stories, nextOffsets);

  // Then
  const retainedByRow = beforeRows.map((row, index) => (
    row.filter((story) => afterRows[index]?.some((candidate) => candidate.id === story.id)).length
  ));
  const beforeIds = new Set(beforeRows.flatMap((row) => row.map((story) => story.id)));
  const incomingIds = afterRows.flatMap((row) => row.map((story) => story.id)).filter((id) => !beforeIds.has(id));
  assert.deepEqual(retainedByRow, [2, 2]);
  assert.equal(new Set(incomingIds).size, 2);
});

test('이야기가 일곱 개면 기존처럼 한 번에 한 장만 새로 보인다', () => {
  // Given
  const stories = createStories(7);
  const beforeRows = getFailureRelayRows(stories, [0, 0]);

  // When
  const nextOffsets = advanceFailureRelayOffsets(stories, [0, 0], -1);
  const afterRows = getFailureRelayRows(stories, nextOffsets);

  // Then
  const beforeIds = new Set(beforeRows.flatMap((row) => row.map((story) => story.id)));
  const incomingIds = afterRows.flatMap((row) => row.map((story) => story.id)).filter((id) => !beforeIds.has(id));
  assert.equal(new Set(incomingIds).size, 1);
});

test('홀수 개 이야기의 두 행은 중복 없이 모두 순환하고 시작 위치로 돌아온다', () => {
  // Given
  const stories = createStories(9);
  const seenIds = new Set<string>();
  let offsets: FailureRelayOffsets = [0, 0];
  const initialRows = getFailureRelayRows(stories, offsets);

  // When
  for (let step = 0; step < 20; step += 1) {
    const rows = getFailureRelayRows(stories, offsets);
    rows.flat().forEach((story) => seenIds.add(story.id));
    offsets = advanceFailureRelayOffsets(stories, offsets, -1);
  }
  const wrappedRows = getFailureRelayRows(stories, offsets);

  // Then
  assert.equal(seenIds.size, stories.length);
  assert.equal(new Set(wrappedRows.flat().map((story) => story.id)).size, 6);
  assert.deepEqual(wrappedRows, initialRows);
});

test('읽는 중 새 이야기가 들어와도 두 행의 첫 카드는 유지할 수 있다', () => {
  // Given
  const stories = createStories(8);
  const beforeRows = getFailureRelayRows(stories, [0, 0]);
  const anchors = [beforeRows[0][0]?.id ?? null, beforeRows[1][0]?.id ?? null] as const;
  const nextStories = [{ ...stories[0], id: 'Z' }, ...stories];

  // When
  const nextOffsets = getFailureRelayOffsetsForAnchors(nextStories, anchors, [0, 0]);
  const afterRows = getFailureRelayRows(nextStories, nextOffsets);

  // Then
  assert.deepEqual(afterRows.map((row) => row.map((story) => story.id)), beforeRows.map((row) => row.map((story) => story.id)));
});
