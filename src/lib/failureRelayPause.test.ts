import assert from 'node:assert/strict';
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
