import assert from 'node:assert/strict';
import test from 'node:test';
import { createSudokuPuzzle, getSudokuProgressKey } from './sudoku.js';
import { getNumberBaseballGameId } from './numberBaseball.js';
import { confirmGameProgressEdit, normalizeNumberBaseballInput, reconcileGameProgress, restoreNumberBaseballProgressDraft, restoreSudokuProgressDraft, selectLatestGameDraft, type GameProgressEdits } from './studentGameProgressDraft.js';

test('a correction after a failed completion restores the newer save draft instead of the old completion', () => {
  const completion = { action: 'student.sudoku.complete', draft: { createdAt: '2026-09-09T01:00:00.000Z', payload: { cells: [1, 2, 3] } } };
  const correction = { action: 'student.sudoku.save', draft: { createdAt: '2026-09-09T01:00:01.000Z', payload: { cells: [1, 0, 3] } } };
  assert.deepEqual(selectLatestGameDraft([completion, correction]), correction);
  assert.deepEqual(selectLatestGameDraft([correction, completion]), correction);
  assert.equal(selectLatestGameDraft([null, null]), null);
});

test('game progress preserves B and C while the older A save and refresh arrive', () => {
  const A = { cells: [1, 0, 0] }, B = { cells: [1, 2, 0] }, C = { cells: [1, 2, 3] };
  const matches = (left: typeof A, right: typeof A) => JSON.stringify(left) === JSON.stringify(right);
  let edits: GameProgressEdits<typeof A> = { puzzle: { version: 2, entry: B, confirmed: false } };
  edits = confirmGameProgressEdit(edits, 'puzzle', 1);
  assert.deepEqual(reconcileGameProgress({ puzzle: A }, edits, matches).progress.puzzle, B);
  edits = { puzzle: { version: 3, entry: C, confirmed: false } };
  edits = confirmGameProgressEdit(edits, 'puzzle', 2);
  assert.deepEqual(reconcileGameProgress({ puzzle: B }, edits, matches).progress.puzzle, C);
  edits = confirmGameProgressEdit(edits, 'puzzle', 3);
  assert.deepEqual(reconcileGameProgress({ puzzle: A }, edits, matches).progress.puzzle, C);
  const current = reconcileGameProgress({ puzzle: C }, edits, matches);
  assert.deepEqual(current.edits, {});
  assert.deepEqual(current.progress.puzzle, C);
});

test('an unrelated student projection cannot remove unconfirmed local game progress', () => {
  const entry = { attempts: [[1, 2, 3]] };
  const edits = { '3:2026-37': { version: 1, entry, confirmed: false } };
  const result = reconcileGameProgress({ '4:2026-37': { attempts: [[4, 5, 6]] } }, edits, (a, b) => JSON.stringify(a) === JSON.stringify(b));
  assert.deepEqual(result.progress['3:2026-37'], entry);
  assert.deepEqual(result.progress['4:2026-37'], { attempts: [[4, 5, 6]] });
  assert.equal(result.edits['3:2026-37'].confirmed, false);
});

test('queued Sudoku cells restore only for their original student, week and valid puzzle', () => {
  const puzzle = createSudokuPuzzle(3, '2026-37', 'basic');
  const cells = [...puzzle.puzzle];
  cells[puzzle.puzzle.findIndex(value => value === 0)] = 1;
  const payload = { key: getSudokuProgressKey(3, '2026-37', 'basic'), cells };
  assert.deepEqual(restoreSudokuProgressDraft(3, '2026-37', 'basic', payload)?.cells, cells);
  assert.equal(restoreSudokuProgressDraft(4, '2026-37', 'basic', payload), null);
  assert.equal(restoreSudokuProgressDraft(3, '2026-38', 'basic', payload), null);
  const wrongClue = [...cells];
  wrongClue[puzzle.puzzle.findIndex(value => value !== 0)] = 0;
  assert.equal(restoreSudokuProgressDraft(3, '2026-37', 'basic', { ...payload, cells: wrongClue }), null);
});

test('number baseball submission restores the original attempts without appending a retry', () => {
  const payload = { key: '3:2026-37', attempts: [{ guess: [1, 2, 3] }] };
  const first = restoreNumberBaseballProgressDraft(3, '2026-37', payload);
  const retry = restoreNumberBaseballProgressDraft(3, '2026-37', payload);
  assert.equal(first?.attempts.length, 1);
  assert.deepEqual(first, retry);
  assert.equal(restoreNumberBaseballProgressDraft(3, '2026-38', payload), null);
  assert.equal(restoreNumberBaseballProgressDraft(4, '2026-37', payload), null);
  assert.equal(restoreNumberBaseballProgressDraft(3, '2026-37', { ...payload, attempts: [{ guess: [1, 1, 2] }] }), null);
});

test('unsubmitted baseball digits remain separate from submitted attempts and scoped to the game', () => {
  const gameId = getNumberBaseballGameId(3, '2026-37');
  assert.deepEqual(normalizeNumberBaseballInput({ gameId, digits: [3, 2] }, gameId), [3, 2]);
  assert.deepEqual(normalizeNumberBaseballInput({ gameId, digits: [3, 2] }, getNumberBaseballGameId(4, '2026-37')), []);
  assert.deepEqual(normalizeNumberBaseballInput({ gameId, digits: [3, 3] }, gameId), []);
});
