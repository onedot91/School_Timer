export const SUDOKU_DIFFICULTIES = ['basic', 'challenge'] as const;

export type SudokuDifficulty = (typeof SUDOKU_DIFFICULTIES)[number];

export type SudokuPuzzle = {
  readonly id: string;
  readonly studentNumber: number;
  readonly dateKey: string;
  readonly difficulty: SudokuDifficulty;
  readonly gridSize: number;
  readonly boxRows: number;
  readonly boxColumns: number;
  readonly puzzle: readonly number[];
  readonly solution: readonly number[];
};

export type SudokuRules = {
  readonly gridSize: number;
  readonly boxRows: number;
  readonly boxColumns: number;
  readonly clueCount: number;
};

export type SudokuProgressEntry = {
  readonly puzzleId: string;
  readonly cells: readonly number[];
  readonly completedAt: string | null;
};

export type StudentSudokuProgress = Record<string, SudokuProgressEntry>;

export const SUDOKU_REWARDS: Record<SudokuDifficulty, number> = {
  basic: 5,
  challenge: 15,
};

export const STUDENT_SUDOKU_STORAGE_KEY = 'school-timer-student-sudoku-v1';

const SUDOKU_RULES: Record<SudokuDifficulty, SudokuRules> = {
  basic: { gridSize: 6, boxRows: 2, boxColumns: 3, clueCount: 24 },
  challenge: { gridSize: 9, boxRows: 3, boxColumns: 3, clueCount: 40 },
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

const createSeed = (value: string) => {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const createRandom = (initialSeed: number) => {
  let seed = initialSeed;
  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffled = (values: readonly number[], random: () => number) => {
  const next = [...values];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = next[index] ?? 0;
    next[index] = next[swapIndex] ?? 0;
    next[swapIndex] = current;
  }
  return next;
};

const createUnitOrder = (gridSize: number, groupSize: number, random: () => number) => (
  shuffled(Array.from({ length: gridSize / groupSize }, (_, index) => index), random).flatMap((group) => (
    shuffled(Array.from({ length: groupSize }, (_, index) => index), random)
      .map((offset) => group * groupSize + offset)
  ))
);

const getRulesByCellCount = (cellCount: number) => (
  SUDOKU_DIFFICULTIES.map((difficulty) => SUDOKU_RULES[difficulty])
    .find((rules) => rules.gridSize * rules.gridSize === cellCount) ?? null
);

const getCandidates = (cells: readonly number[], index: number, rules: SudokuRules) => {
  const { gridSize, boxRows, boxColumns } = rules;
  const row = Math.floor(index / gridSize);
  const column = index % gridSize;
  const boxRow = Math.floor(row / boxRows) * boxRows;
  const boxColumn = Math.floor(column / boxColumns) * boxColumns;
  const used = new Set<number>();
  for (let offset = 0; offset < gridSize; offset += 1) {
    used.add(cells[row * gridSize + offset] ?? 0);
    used.add(cells[offset * gridSize + column] ?? 0);
    used.add(cells[
      (boxRow + Math.floor(offset / boxColumns)) * gridSize + boxColumn + (offset % boxColumns)
    ] ?? 0);
  }
  return Array.from({ length: gridSize }, (_, digitIndex) => digitIndex + 1)
    .filter((digit) => !used.has(digit));
};

export const getSudokuRules = (difficulty: SudokuDifficulty) => SUDOKU_RULES[difficulty];

export const getKoreanDateKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const valueByType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${valueByType.year ?? ''}-${valueByType.month ?? ''}-${valueByType.day ?? ''}`;
};

export const getSudokuProgressKey = (
  studentNumber: number,
  dateKey: string,
  difficulty: SudokuDifficulty,
) => `${studentNumber}:${dateKey}:${difficulty}`;

export const getSudokuPuzzleId = (
  studentNumber: number,
  dateKey: string,
  difficulty: SudokuDifficulty,
) => `sudoku-v2-${studentNumber}-${dateKey}-${difficulty}`;

export const getSudokuWeeklyMissionId = (
  studentNumber: number,
  weekKey: string,
) => `sudoku-weekly-${studentNumber}-${weekKey}`;

export const getActiveSudokuDifficulty = (
  progress: StudentSudokuProgress,
  studentNumber: number,
  dateKey: string,
): SudokuDifficulty | null => SUDOKU_DIFFICULTIES.find((difficulty) => {
  const entry = progress[getSudokuProgressKey(studentNumber, dateKey, difficulty)];
  return entry?.puzzleId === getSudokuPuzzleId(studentNumber, dateKey, difficulty)
    && entry.completedAt === null;
}) ?? null;

export const getCompletedSudokuDifficulty = (
  progress: StudentSudokuProgress,
  studentNumber: number,
  dateKey: string,
): SudokuDifficulty | null => SUDOKU_DIFFICULTIES.find((difficulty) => {
  const entry = progress[getSudokuProgressKey(studentNumber, dateKey, difficulty)];
  return entry?.puzzleId === getSudokuPuzzleId(studentNumber, dateKey, difficulty)
    && entry.completedAt !== null;
}) ?? null;

export const createSudokuPuzzle = (
  studentNumber: number,
  dateKey: string,
  difficulty: SudokuDifficulty,
): SudokuPuzzle => {
  const rules = SUDOKU_RULES[difficulty];
  const { gridSize, boxRows, boxColumns, clueCount: targetClueCount } = rules;
  const generationProfile = difficulty === 'challenge' ? 'basic' : 'basic-6x6';
  const random = createRandom(createSeed(`${dateKey}:${studentNumber}:${generationProfile}`));
  const rows = createUnitOrder(gridSize, boxRows, random);
  const columns = createUnitOrder(gridSize, boxColumns, random);
  const digits = shuffled(Array.from({ length: gridSize }, (_, index) => index + 1), random);
  const solution = rows.flatMap((row) => columns.map((column) => {
    const baseDigit = (row * boxColumns + Math.floor(row / boxRows) + column) % gridSize;
    return digits[baseDigit] ?? baseDigit + 1;
  }));
  const puzzle = [...solution];
  const cellCount = gridSize * gridSize;
  let clueCount = cellCount;
  for (const index of shuffled(Array.from({ length: cellCount }, (_, cellIndex) => cellIndex), random)) {
    if (clueCount <= targetClueCount) break;
    const previous = puzzle[index] ?? 0;
    puzzle[index] = 0;
    if (countSudokuSolutions(puzzle) === 1) clueCount -= 1;
    else puzzle[index] = previous;
  }
  return {
    id: getSudokuPuzzleId(studentNumber, dateKey, difficulty),
    studentNumber,
    dateKey,
    difficulty,
    gridSize,
    boxRows,
    boxColumns,
    puzzle,
    solution,
  };
};

export const countSudokuSolutions = (cells: readonly number[], limit = 2) => {
  const rules = getRulesByCellCount(cells.length);
  if (!rules) return 0;
  const cellCount = rules.gridSize * rules.gridSize;
  const board = cells.map((value) => (
    Number.isInteger(value) && value >= 0 && value <= rules.gridSize ? value : 0
  ));
  let solutionCount = 0;
  const search = () => {
    if (solutionCount >= limit) return;
    let selectedIndex = -1;
    let selectedCandidates: number[] = [];
    for (let index = 0; index < cellCount; index += 1) {
      if (board[index] !== 0) continue;
      const candidates = getCandidates(board, index, rules);
      if (candidates.length === 0) return;
      if (selectedIndex === -1 || candidates.length < selectedCandidates.length) {
        selectedIndex = index;
        selectedCandidates = candidates;
        if (candidates.length === 1) break;
      }
    }
    if (selectedIndex === -1) {
      solutionCount += 1;
      return;
    }
    for (const candidate of selectedCandidates) {
      board[selectedIndex] = candidate;
      search();
      board[selectedIndex] = 0;
      if (solutionCount >= limit) return;
    }
  };
  search();
  return solutionCount;
};

export const getSudokuConflicts = (cells: readonly number[]) => {
  const rules = getRulesByCellCount(cells.length);
  const conflicts = new Set<number>();
  if (!rules) return conflicts;
  const { gridSize, boxRows, boxColumns } = rules;
  const boxColumnCount = gridSize / boxColumns;
  const groups = Array.from({ length: gridSize }, (_, index) => [
    Array.from({ length: gridSize }, (_, offset) => index * gridSize + offset),
    Array.from({ length: gridSize }, (_, offset) => offset * gridSize + index),
    Array.from({ length: gridSize }, (_, offset) => (
      (Math.floor(index / boxColumnCount) * boxRows + Math.floor(offset / boxColumns)) * gridSize
        + (index % boxColumnCount) * boxColumns + (offset % boxColumns)
    )),
  ]).flat();
  groups.forEach((group) => {
    const indicesByDigit = new Map<number, number[]>();
    group.forEach((index) => {
      const value = cells[index] ?? 0;
      if (value === 0) return;
      indicesByDigit.set(value, [...(indicesByDigit.get(value) ?? []), index]);
    });
    indicesByDigit.forEach((indices) => {
      if (indices.length > 1) indices.forEach((index) => conflicts.add(index));
    });
  });
  return conflicts;
};

export const getSudokuMatchingIndices = (cells: readonly number[], selectedIndex: number) => {
  const selectedValue = cells[selectedIndex] ?? 0;
  if (selectedValue === 0) return new Set<number>();
  return cells.reduce<Set<number>>((matches, value, index) => {
    if (value === selectedValue) matches.add(index);
    return matches;
  }, new Set<number>());
};

export const getSudokuCompletedDigits = (cells: readonly number[]) => new Set(
  Array.from({ length: getRulesByCellCount(cells.length)?.gridSize ?? 0 }, (_, index) => index + 1)
    .filter((digit) => cells.filter((value) => value === digit).length >= Math.sqrt(cells.length)),
);

export const isSudokuSolved = (puzzle: SudokuPuzzle, cells: readonly number[]) => (
  cells.length === puzzle.gridSize * puzzle.gridSize
    && cells.every((value, index) => value === puzzle.solution[index])
);

export const normalizeStudentSudokuProgress = (value: unknown): StudentSudokuProgress => {
  if (!isRecord(value)) return {};
  return Object.entries(value).reduce<StudentSudokuProgress>((progress, [key, rawEntry]) => {
    if (!/^(?:[1-9]|1\d|2[0-3]):\d{4}-(?:\d{2}-\d{2}|\d{2}):(?:basic|challenge)$/.test(key) || !isRecord(rawEntry)) {
      return progress;
    }
    const difficulty = key.endsWith(':basic') ? 'basic' : 'challenge';
    const rules = SUDOKU_RULES[difficulty];
    const cells = Array.isArray(rawEntry.cells) ? rawEntry.cells : [];
    const hasValidCells = cells.length === rules.gridSize * rules.gridSize && cells.every((cell) => (
      typeof cell === 'number' && Number.isInteger(cell) && cell >= 0 && cell <= rules.gridSize
    ));
    if (typeof rawEntry.puzzleId !== 'string' || !rawEntry.puzzleId.trim() || !hasValidCells) return progress;
    const completedAt = typeof rawEntry.completedAt === 'string' && rawEntry.completedAt.trim()
      ? rawEntry.completedAt
      : null;
    progress[key] = { puzzleId: rawEntry.puzzleId.slice(0, 128), cells: [...cells], completedAt };
    return progress;
  }, {});
};

export const getStudentSudokuProgressFromSettings = (value: unknown) => (
  isRecord(value) ? normalizeStudentSudokuProgress(value.studentSudoku) : {}
);

export const loadStoredStudentSudokuProgress = () => {
  if (typeof window === 'undefined') return {};
  try {
    const stored = window.localStorage.getItem(STUDENT_SUDOKU_STORAGE_KEY);
    return stored ? normalizeStudentSudokuProgress(JSON.parse(stored)) : {};
  } catch (error) {
    if (error instanceof Error) return {};
    throw error;
  }
};

export const storeStudentSudokuProgress = (progress: StudentSudokuProgress) => {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(STUDENT_SUDOKU_STORAGE_KEY, JSON.stringify(normalizeStudentSudokuProgress(progress)));
    return true;
  } catch (error) {
    if (error instanceof Error) return false;
    throw error;
  }
};
