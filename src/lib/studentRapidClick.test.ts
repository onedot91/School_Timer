import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createStudentRapidClickState,
  trackStudentRapidClick,
} from './studentRapidClick.js';

test('같은 버튼을 2초 안에 여덟 번 누르면 마지막 동작을 경고한다', () => {
  // Given
  const button = {};
  let state = createStudentRapidClickState();

  // When
  const results = Array.from({ length: 8 }, (_, index) => {
    const result = trackStudentRapidClick(state, button, index * 200);
    state = result.state;
    return result.shouldWarn;
  });

  // Then
  assert.deepEqual(results, [false, false, false, false, false, false, false, true]);
});

test('다른 버튼을 누르거나 클릭 간격이 길어지면 연속 횟수를 다시 센다', () => {
  // Given
  const firstButton = {};
  const secondButton = {};
  let state = createStudentRapidClickState();

  // When
  for (let index = 0; index < 7; index += 1) {
    state = trackStudentRapidClick(state, firstButton, index * 200).state;
  }
  const differentButton = trackStudentRapidClick(state, secondButton, 1500);
  const delayedSameButton = trackStudentRapidClick(differentButton.state, secondButton, 4000);

  // Then
  assert.equal(differentButton.shouldWarn, false);
  assert.equal(differentButton.state.clicks.length, 1);
  assert.equal(delayedSameButton.shouldWarn, false);
  assert.equal(delayedSameButton.state.clicks.length, 1);
});
