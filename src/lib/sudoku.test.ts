import assert from 'node:assert/strict';
import test from 'node:test';
import * as sudoku from './sudoku';
import { claimSudokuRewardInSettings, hasSudokuReward, normalizeCurrencyBalances } from './currency';
import { mergeConcurrentCurrencyUpdatesIntoSettings } from './weeklyMission';
import {
  SUDOKU_DIFFICULTIES,
  SUDOKU_REWARDS,
  countSudokuSolutions,
  createSudokuPuzzle,
  getKoreanDateKey,
  getSudokuConflicts,
  getSudokuProgressKey,
  isSudokuSolved,
  normalizeStudentSudokuProgress,
} from './sudoku';

test('한국 날짜와 학생 번호 및 난이도마다 하나의 해답을 가진 문제를 배정한다', () => {
  // Given
  const dateKey = '2026-08-20';

  // When
  const puzzles = SUDOKU_DIFFICULTIES.flatMap((difficulty) => (
    Array.from({ length: 23 }, (_, index) => createSudokuPuzzle(index + 1, dateKey, difficulty))
  ));

  // Then
  assert.equal(new Set(puzzles.map((puzzle) => puzzle.id)).size, 46);
  SUDOKU_DIFFICULTIES.forEach((difficulty) => {
    const assignedBoards = puzzles
      .filter((puzzle) => puzzle.difficulty === difficulty)
      .map((puzzle) => puzzle.puzzle.join(''));
    assert.equal(new Set(assignedBoards).size, 23);
  });
  puzzles.forEach((puzzle) => {
    const expectedCellCount = puzzle.difficulty === 'basic' ? 36 : 81;
    assert.equal(puzzle.puzzle.length, expectedCellCount);
    assert.equal(puzzle.solution.length, expectedCellCount);
    assert.equal(countSudokuSolutions(puzzle.puzzle), 1);
    assert.equal(isSudokuSolved(puzzle, puzzle.solution), true);
  });
});

test('기본은 6x6과 2x3 구역 및 1부터 6까지의 숫자를 사용한다', () => {
  // Given
  const dateKey = '2026-08-20';

  // When
  const basic = createSudokuPuzzle(7, dateKey, 'basic');

  // Then
  assert.deepEqual(
    { gridSize: basic.gridSize, boxRows: basic.boxRows, boxColumns: basic.boxColumns },
    { gridSize: 6, boxRows: 2, boxColumns: 3 },
  );
  assert.equal(basic.puzzle.length, 36);
  assert.equal(basic.puzzle.filter(Boolean).length, 24);
  assert.ok(basic.solution.every((digit) => digit >= 1 && digit <= 6));
});

test('도전은 변경 전 기본과 같은 9x9 문제를 사용한다', () => {
  // Given
  const dateKey = '2026-08-20';
  const previousBasicPuzzle = [
    1, 0, 0, 0, 3, 0, 0, 4, 0,
    0, 0, 0, 6, 0, 8, 0, 0, 0,
    3, 5, 0, 7, 0, 4, 0, 0, 0,
    0, 0, 6, 3, 0, 5, 0, 0, 9,
    8, 0, 5, 9, 0, 0, 4, 6, 1,
    2, 9, 7, 0, 0, 0, 0, 5, 3,
    5, 2, 0, 4, 7, 0, 0, 0, 8,
    7, 4, 0, 0, 0, 3, 5, 0, 2,
    6, 8, 0, 0, 0, 9, 7, 1, 4,
  ];

  // When
  const challenge = createSudokuPuzzle(7, dateKey, 'challenge');

  // Then
  assert.deepEqual(
    { gridSize: challenge.gridSize, boxRows: challenge.boxRows, boxColumns: challenge.boxColumns },
    { gridSize: 9, boxRows: 3, boxColumns: 3 },
  );
  assert.deepEqual(challenge.puzzle, previousBasicPuzzle);
});

test('행 열과 삼각 구역에서 겹친 입력을 모두 충돌로 표시한다', () => {
  // Given
  const cells = Array<number>(81).fill(0);
  cells[0] = 4;
  cells[4] = 4;
  cells[9] = 4;

  // When
  const conflicts = getSudokuConflicts(cells);

  // Then
  assert.deepEqual([...conflicts].sort((left, right) => left - right), [0, 4, 9]);
});

test('6x6의 행 열과 2x3 구역에서 겹친 입력을 모두 충돌로 표시한다', () => {
  // Given
  const cells = Array<number>(36).fill(0);
  cells[0] = 4;
  cells[2] = 4;
  cells[6] = 4;

  // When
  const conflicts = getSudokuConflicts(cells);

  // Then
  assert.deepEqual([...conflicts].sort((left, right) => left - right), [0, 2, 6]);
});

test('선택한 숫자와 같은 모든 칸을 찾는다', () => {
  // Given
  const cells = Array<number>(81).fill(0);
  cells[4] = 9;
  cells[18] = 9;
  cells[80] = 9;

  // When
  const matches = sudoku.getSudokuMatchingIndices(cells, 18);

  // Then
  assert.deepEqual([...matches], [4, 18, 80]);
});

test('빈칸을 선택하면 같은 숫자 하이라이트를 만들지 않는다', () => {
  // Given
  const cells = Array<number>(81).fill(0);
  cells[4] = 9;

  // When
  const matches = sudoku.getSudokuMatchingIndices(cells, 18);

  // Then
  assert.deepEqual([...matches], []);
});

test('같은 숫자를 아홉 칸 채우면 완료 숫자로 표시한다', () => {
  // Given
  const cells = Array<number>(81).fill(0);
  cells.fill(7, 0, 9);
  cells.fill(4, 9, 17);

  // When
  const completedDigits = sudoku.getSudokuCompletedDigits(cells);

  // Then
  assert.deepEqual([...completedDigits], [7]);
});

test('6x6에서는 같은 숫자를 여섯 칸 채우면 완료 숫자로 표시한다', () => {
  // Given
  const cells = Array<number>(36).fill(0);
  cells.fill(6, 0, 6);
  cells.fill(4, 6, 11);

  // When
  const completedDigits = sudoku.getSudokuCompletedDigits(cells);

  // Then
  assert.deepEqual([...completedDigits], [6]);
});

test('저장 경계는 기본 36칸과 도전 81칸 입력만 각각 복구한다', () => {
  // Given
  const basicKey = getSudokuProgressKey(7, '2026-08-20', 'basic');
  const challengeKey = getSudokuProgressKey(7, '2026-08-20', 'challenge');
  const legacyBasicKey = getSudokuProgressKey(8, '2026-08-20', 'basic');
  const basicCells = Array<number>(36).fill(0);
  const challengeCells = Array<number>(81).fill(0);
  basicCells[10] = 6;
  challengeCells[10] = 8;

  // When
  const normalized = normalizeStudentSudokuProgress({
    [basicKey]: { puzzleId: 'sudoku-v2-7-2026-08-20-basic', cells: basicCells, completedAt: null },
    [challengeKey]: { puzzleId: 'sudoku-v2-7-2026-08-20-challenge', cells: challengeCells, completedAt: null },
    [legacyBasicKey]: { puzzleId: 'sudoku-8-2026-08-20-basic', cells: challengeCells, completedAt: null },
    invalid: { puzzleId: '', cells: [12], completedAt: 42 },
  });

  // Then
  assert.equal(normalized[basicKey]?.cells[10], 6);
  assert.equal(normalized[challengeKey]?.cells[10], 8);
  assert.equal(legacyBasicKey in normalized, false);
  assert.equal('invalid' in normalized, false);
});

test('스도쿠 보상은 문제별로 정확히 한 번만 지급한다', () => {
  // Given
  const initial = { currencyBalances: { 7: 100 }, currencyHistory: { 7: [] } };
  const puzzleId = 'sudoku-7-2026-08-20-basic';

  // When
  const first = claimSudokuRewardInSettings(initial, 7, puzzleId, SUDOKU_REWARDS.basic, '2026-08-20T01:00:00.000Z');
  const second = claimSudokuRewardInSettings(first.value, 7, puzzleId, SUDOKU_REWARDS.basic, '2026-08-20T01:00:01.000Z');

  // Then
  assert.equal(first.awarded, true);
  assert.equal(second.awarded, false);
  assert.equal(second.balance, 105);
  assert.equal(hasSudokuReward(second.value.currencyHistory, 7, puzzleId), true);
  assert.equal(second.history['7'].filter((entry) => entry.reason === 'sudoku_mission').length, 1);
});

test('교사 자동 저장은 동시에 완료된 스도쿠 보상을 보존한다', () => {
  // Given
  const puzzleId = 'sudoku-7-2026-08-20-challenge';
  const progressKey = getSudokuProgressKey(7, '2026-08-20', 'challenge');
  const remote = claimSudokuRewardInSettings(
    {
      currencyBalances: { 7: 100 },
      currencyHistory: { 7: [] },
      studentSudoku: {
        [progressKey]: { puzzleId, cells: Array<number>(81).fill(1), completedAt: '2026-08-20T01:00:00.000Z' },
      },
    },
    7,
    puzzleId,
    SUDOKU_REWARDS.challenge,
    '2026-08-20T01:00:00.000Z',
  ).value;
  const staleTeacherValue = {
    currencyBalances: { 7: 100 },
    currencyHistory: { 7: [] },
    studentSudoku: {},
  };

  // When
  const merged = mergeConcurrentCurrencyUpdatesIntoSettings(remote, staleTeacherValue);

  // Then
  assert.equal(normalizeStudentSudokuProgress(merged.studentSudoku)[progressKey]?.puzzleId, puzzleId);
  assert.equal(hasSudokuReward(merged.currencyHistory, 7, puzzleId), true);
  assert.equal(normalizeCurrencyBalances(merged.currencyBalances)['7'], 115);
});

test('한국 자정 기준 날짜 키를 만든다', () => {
  // Given
  const beforeMidnight = new Date('2026-08-19T14:59:59.000Z');
  const afterMidnight = new Date('2026-08-19T15:00:00.000Z');

  // When
  const dateKeys = [getKoreanDateKey(beforeMidnight), getKoreanDateKey(afterMidnight)];

  // Then
  assert.deepEqual(dateKeys, ['2026-08-19', '2026-08-20']);
});

test('오늘 시작한 미완료 스도쿠 난이도를 잠근다', () => {
  // Given
  const dateKey = '2026-08-20';
  const key = getSudokuProgressKey(7, dateKey, 'challenge');
  const progress = {
    [key]: {
      puzzleId: 'sudoku-v2-7-2026-08-20-challenge',
      cells: Array<number>(81).fill(0),
      completedAt: null,
    },
  };

  // When
  const difficulty = sudoku.getActiveSudokuDifficulty(progress, 7, dateKey);

  // Then
  assert.equal(difficulty, 'challenge');
});

test('오늘의 스도쿠를 완료하면 난이도 잠금을 해제한다', () => {
  // Given
  const dateKey = '2026-08-20';
  const key = getSudokuProgressKey(7, dateKey, 'basic');
  const progress = {
    [key]: {
      puzzleId: 'sudoku-v2-7-2026-08-20-basic',
      cells: Array<number>(36).fill(1),
      completedAt: '2026-08-20T01:00:00.000Z',
    },
  };

  // When
  const difficulty = sudoku.getActiveSudokuDifficulty(progress, 7, dateKey);

  // Then
  assert.equal(difficulty, null);
});

test('완료한 오늘의 스도쿠 난이도를 다시 보기용으로 찾는다', () => {
  // Given
  const dateKey = '2026-08-20';
  const key = getSudokuProgressKey(7, dateKey, 'challenge');
  const progress = {
    [key]: {
      puzzleId: 'sudoku-v2-7-2026-08-20-challenge',
      cells: Array<number>(81).fill(1),
      completedAt: '2026-08-20T01:00:00.000Z',
    },
  };

  // When
  const difficulty = sudoku.getCompletedSudokuDifficulty(progress, 7, dateKey);

  // Then
  assert.equal(difficulty, 'challenge');
});
