import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import StudentSudokuBoard from '../components/student/StudentSudokuBoard';

test('중복 숫자를 입력해도 학생에게 정답 여부를 드러내지 않는다', () => {
  const markup = renderToStaticMarkup(createElement(StudentSudokuBoard, {
    cells: [1, 1, 0, 0, 0, 0],
    puzzleCells: [1, 0, 0, 0, 0, 0],
    selectedIndex: 1,
    matchingIndices: new Set([0, 1]),
    lastEditedIndex: 1,
    feedbackSequence: 1,
    interactionMode: 'pointer',
    difficultyLabel: '기본',
    gridSize: 6,
    boxRows: 2,
    boxColumns: 3,
    onSelect: () => undefined,
  }));

  assert.doesNotMatch(markup, /is-conflict|aria-invalid="true"|has-conflict-feedback/);
});

test('숫자 입력 안내는 틀린 위치를 알려 주지 않고 완성 판정은 유지한다', () => {
  const pageSource = readFileSync(
    new URL('../components/student/StudentSudokuPage.tsx', import.meta.url),
    'utf8',
  );

  assert.doesNotMatch(pageSource, /같은 줄이나 구역에 겹친 숫자가 있어요/);
  assert.doesNotMatch(pageSource, /아직 맞지 않는 칸이 있어요/);
  assert.doesNotMatch(pageSource, /getSudokuConflicts/);
  assert.doesNotMatch(pageSource, /입력 내용이 자동으로 저장됩니다|자동 저장/);
  assert.match(pageSource, /빈칸을 선택하고 숫자를 입력하세요/);
  assert.match(pageSource, /매주 월요일 새 문제로 바뀌어요/);
  assert.match(pageSource, /isSudokuSolved\(puzzle, nextCells\)/);
  assert.match(pageSource, /입력을 저장하지 못했습니다/);
});
