import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { shouldPauseStudentFailureRelay } from '../components/student/studentFailureRelayState.js';

test('탐색 버튼을 누르는 동안 실패 릴레이 자동 이동을 멈춘다', () => {
  // Given
  const idleState = {
    isExternallyPaused: false,
    isPointerPaused: false,
    isFocusPaused: false,
    isStampMenuOpen: false,
    isNavigationPressed: false,
  } as const;

  // When
  const isPaused = shouldPauseStudentFailureRelay({ ...idleState, isNavigationPressed: true });

  // Then
  assert.equal(isPaused, true);
});

test('실패 카드는 세로 스크롤과 위아래 방향키로 이동하지 않는다', async () => {
  // Given
  const source = await readFile(new URL('../components/student/StudentFailureRelay.tsx', import.meta.url), 'utf8');

  // Then
  assert.doesNotMatch(source, /onWheel=/);
  assert.doesNotMatch(source, /case 'Arrow(?:Up|Down)'/);
  assert.doesNotMatch(source, /move\(verticalDistance > 0 \? 1 : -1\)/);
  assert.match(source, /move\(horizontalDistance > 0 \? 1 : -1\)/);
});
