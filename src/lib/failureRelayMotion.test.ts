import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getStudentFailureRelayButtonMove,
  splitStudentFailureRelayRows,
  STUDENT_FAILURE_RELAY_AUTOMATIC_MOVE,
  STUDENT_FAILURE_PAPER_TRANSITION,
  STUDENT_FAILURE_RELAY_TRANSITION,
  studentFailureRelayMotionVariants,
  studentFailurePaperMotionVariants,
} from '../components/student/studentFailureRelayMotion.js';

test('실패 이야기 여섯 장은 가로 이동을 위한 두 행으로 나뉜다', () => {
  // Given
  const stories = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

  // When
  const rows = splitStudentFailureRelayRows(stories);

  // Then
  assert.deepEqual(rows, [['A', 'B', 'C'], ['D', 'E', 'F']]);
});

test('행 경계 카드도 세로축 없이 가로축으로만 퇴장하고 진입한다', () => {
  // Given
  const direction = 'newer';

  // When
  const exit = studentFailureRelayMotionVariants.exit(direction);
  const enter = studentFailureRelayMotionVariants.enter(direction);

  // Then
  assert.deepEqual(exit, { transform: 'translateX(105%)' });
  assert.deepEqual(enter, { transform: 'translateX(-105%)' });
});

test('좌우 탐색 버튼은 화살표와 같은 방향으로 카드를 이동한다', () => {
  // Given
  const buttonDirections = ['left', 'right'] as const;

  // When
  const moveAmounts = buttonDirections.map(getStudentFailureRelayButtonMove);

  // Then
  assert.deepEqual(moveAmounts, [1, -1]);
});

test('자동 릴레이는 오른쪽 버튼과 같은 방향으로 이동한다', () => {
  // Given
  const rightButtonMove = getStudentFailureRelayButtonMove('right');

  // When
  const automaticMove = STUDENT_FAILURE_RELAY_AUTOMATIC_MOVE;

  // Then
  assert.equal(automaticMove, rightButtonMove);
});

test('종이 착지는 위치를 바꾸지 않고 이동 방향의 미세 회전만 수평으로 복원한다', () => {
  // Given
  const directions = ['older', 'newer'] as const;

  // When
  const entrances = directions.map(studentFailurePaperMotionVariants.enter);
  const settled = studentFailurePaperMotionVariants.center;

  // Then
  assert.deepEqual(entrances, [
    { transform: 'rotate(0.4deg)' },
    { transform: 'rotate(-0.4deg)' },
  ]);
  assert.deepEqual(settled, { transform: 'rotate(0deg)' });
});

test('카드 이동과 종이 착지는 360ms 동안 낮은 반동으로 함께 부드럽게 정착한다', () => {
  // Given
  const expectedDurationSeconds = 0.36;

  // When
  const cardTransition = STUDENT_FAILURE_RELAY_TRANSITION;
  const paperTransition = STUDENT_FAILURE_PAPER_TRANSITION;

  // Then
  assert.deepEqual(cardTransition, {
    type: 'spring',
    duration: expectedDurationSeconds,
    bounce: 0,
  });
  assert.deepEqual(paperTransition, {
    type: 'spring',
    duration: expectedDurationSeconds,
    bounce: 0.1,
  });
});
