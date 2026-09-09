import { getNumberBaseballGameId, normalizeStudentNumberBaseballProgress } from './numberBaseball.js';
import { createSudokuPuzzle, getSudokuProgressKey, normalizeStudentSudokuProgress, type SudokuDifficulty } from './sudoku.js';

export interface GameProgressEdit<Entry> {
  readonly version: number;
  readonly entry: Entry;
  readonly confirmed: boolean;
}

export type GameProgressEdits<Entry> = Readonly<Record<string, GameProgressEdit<Entry>>>;

export const selectLatestGameDraft = <Draft extends { readonly createdAt: string }>(candidates: readonly ({ readonly action: string; readonly draft: Draft } | null)[]) => (
  candidates.filter((candidate): candidate is { readonly action: string; readonly draft: Draft } => candidate !== null)
    .reduce<{ readonly action: string; readonly draft: Draft } | null>((latest, candidate) => (
      !latest || Date.parse(candidate.draft.createdAt) >= Date.parse(latest.draft.createdAt) ? candidate : latest
    ), null)
);

export const confirmGameProgressEdit = <Entry>(
  edits: GameProgressEdits<Entry>, key: string, version: number,
): GameProgressEdits<Entry> => {
  const current = edits[key];
  return current?.version === version ? { ...edits, [key]: { ...current, confirmed: true } } : edits;
};

/** A confirmed command can precede its refreshed projection; keep its input until that projection arrives. */
export const reconcileGameProgress = <Entry>(
  remote: Readonly<Record<string, Entry>>, edits: GameProgressEdits<Entry>,
  matches: (left: Entry, right: Entry) => boolean,
): { progress: Record<string, Entry>; edits: GameProgressEdits<Entry> } => {
  const remaining: Record<string, GameProgressEdit<Entry>> = {};
  const progress = { ...remote };
  for (const [key, edit] of Object.entries(edits)) {
    const saved = remote[key];
    if (edit.confirmed && saved && matches(saved, edit.entry)) continue;
    remaining[key] = edit;
    progress[key] = edit.entry;
  }
  return { progress, edits: remaining };
};

const record = (value: unknown): Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : {}
);

export const restoreSudokuProgressDraft = (studentNumber: number, weekKey: string, difficulty: SudokuDifficulty, input: unknown) => {
  const payload = record(input), key = getSudokuProgressKey(studentNumber, weekKey, difficulty);
  if (payload.key !== key) return null;
  const puzzle = createSudokuPuzzle(studentNumber, weekKey, difficulty);
  const entry = normalizeStudentSudokuProgress({ [key]: { puzzleId: puzzle.id, cells: payload.cells, completedAt: null } })[key];
  if (!entry || puzzle.puzzle.some((clue, index) => clue !== 0 && entry.cells[index] !== clue)) return null;
  return entry;
};

export const restoreNumberBaseballProgressDraft = (studentNumber: number, weekKey: string, input: unknown) => {
  const payload = record(input), key = `${studentNumber}:${weekKey}`;
  if (payload.key !== key || !Array.isArray(payload.attempts)) return null;
  const entry = normalizeStudentNumberBaseballProgress({ [key]: {
    gameId: getNumberBaseballGameId(studentNumber, weekKey), attempts: payload.attempts, completedAt: null,
  } })[key];
  return entry && entry.attempts.length === payload.attempts.length ? entry : null;
};

export const normalizeNumberBaseballInput = (input: unknown, gameId: string): readonly number[] => {
  const payload = record(input);
  return payload.gameId === gameId && Array.isArray(payload.digits) && payload.digits.length <= 3
    && payload.digits.every((digit) => typeof digit === 'number' && Number.isInteger(digit) && digit >= 1 && digit <= 9)
    && new Set(payload.digits).size === payload.digits.length ? [...payload.digits] : [];
};
