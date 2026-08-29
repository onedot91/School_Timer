import {
  parseClasswordBoard,
  parseClasswordRounds,
  type ClasswordBoard,
  type ClasswordEntry,
  type ClasswordInitial,
  type ClasswordRoundSummary,
} from './classword';

const CLASSWORD_LOCAL_STORAGE_KEY = 'school-timer-classword-v1';

type LocalClasswordState = {
  readonly rounds: readonly ClasswordRoundSummary[];
  readonly entries: readonly ClasswordEntry[];
};

export type SaveLocalClasswordEntryInput = {
  readonly entryId?: string;
  readonly dateKey: string;
  readonly initial: ClasswordInitial;
  readonly word: string;
  readonly studentNumber: number;
};

export class ClasswordLocalError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'ClasswordLocalError';
    this.code = code;
  }
}

const emptyState = (): LocalClasswordState => ({ rounds: [], entries: [] });

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const readState = (storage: Storage): LocalClasswordState => {
  const raw = storage.getItem(CLASSWORD_LOCAL_STORAGE_KEY);
  if (!raw) return emptyState();
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return emptyState();
    const rounds = parseClasswordRounds(value.rounds);
    const entries = parseClasswordBoard({
      dateKey: '2000-01-01',
      topic: '',
      entries: value.entries,
    }).entries;
    return { rounds, entries };
  } catch (error) {
    if (error instanceof Error) return emptyState();
    throw error;
  }
};

const writeState = (storage: Storage, state: LocalClasswordState): void => {
  storage.setItem(CLASSWORD_LOCAL_STORAGE_KEY, JSON.stringify(state));
};

export const loadLocalClasswordBoard = (storage: Storage, dateKey: string): ClasswordBoard => {
  const state = readState(storage);
  return {
    dateKey,
    topic: state.rounds.find((round) => round.dateKey === dateKey)?.topic ?? '',
    entries: state.entries
      .filter((entry) => entry.dateKey === dateKey)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
  };
};

export const loadLocalClasswordRounds = (storage: Storage): readonly ClasswordRoundSummary[] => (
  readState(storage).rounds
);

export const pruneLocalClasswordEntries = (storage: Storage, cutoffDateKey: string): number => {
  const state = readState(storage);
  const entries = state.entries.filter((entry) => entry.dateKey >= cutoffDateKey);
  const removedCount = state.entries.length - entries.length;
  if (removedCount > 0) writeState(storage, { ...state, entries });
  return removedCount;
};

export const saveLocalClasswordTopic = (
  storage: Storage,
  dateKey: string,
  topic: string,
): ClasswordBoard => {
  const state = readState(storage);
  const rounds = state.rounds.some((round) => round.dateKey === dateKey)
    ? state.rounds.map((round) => round.dateKey === dateKey ? { dateKey, topic: topic.trim() } : round)
    : [...state.rounds, { dateKey, topic: topic.trim() }];
  writeState(storage, { ...state, rounds });
  return loadLocalClasswordBoard(storage, dateKey);
};

export const saveLocalClasswordEntry = (
  storage: Storage,
  input: SaveLocalClasswordEntryInput,
): ClasswordEntry => {
  const state = readState(storage);
  const currentEntry = input.entryId
    ? state.entries.find((entry) => entry.id === input.entryId)
    : undefined;
  if (input.entryId && !currentEntry) throw new ClasswordLocalError('CLASSWORD_ENTRY_NOT_FOUND');
  if (currentEntry && currentEntry.studentNumber !== input.studentNumber) {
    throw new ClasswordLocalError('CLASSWORD_ENTRY_FORBIDDEN');
  }
  const studentEntry = state.entries.find((entry) => (
    entry.dateKey === input.dateKey
    && entry.studentNumber === input.studentNumber
    && entry.id !== input.entryId
  ));
  if (studentEntry) throw new ClasswordLocalError('CLASSWORD_STUDENT_ALREADY_ENTERED');
  const occupiedEntry = state.entries.find((entry) => (
    entry.dateKey === input.dateKey
    && entry.initial === input.initial
    && entry.id !== input.entryId
  ));
  if (occupiedEntry) throw new ClasswordLocalError('CLASSWORD_INITIAL_OCCUPIED');

  const timestamp = new Date().toISOString();
  const nextEntry: ClasswordEntry = currentEntry
    ? { ...currentEntry, initial: input.initial, word: input.word, updatedAt: timestamp }
    : {
        id: crypto.randomUUID(),
        dateKey: input.dateKey,
        initial: input.initial,
        word: input.word,
        studentNumber: input.studentNumber,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
  const entries = currentEntry
    ? state.entries.map((entry) => entry.id === currentEntry.id ? nextEntry : entry)
    : [...state.entries, nextEntry];
  const rounds = state.rounds.some((round) => round.dateKey === input.dateKey)
    ? state.rounds
    : [...state.rounds, { dateKey: input.dateKey, topic: '' }];
  writeState(storage, { rounds, entries });
  return nextEntry;
};

export const deleteLocalClasswordEntry = (
  storage: Storage,
  entryId: string,
  studentNumber: number,
  teacher: boolean,
): void => {
  const state = readState(storage);
  const entry = state.entries.find((candidate) => candidate.id === entryId);
  if (!entry) throw new ClasswordLocalError('CLASSWORD_ENTRY_NOT_FOUND');
  if (!teacher && entry.studentNumber !== studentNumber) {
    throw new ClasswordLocalError('CLASSWORD_ENTRY_FORBIDDEN');
  }
  writeState(storage, {
    ...state,
    entries: state.entries.filter((candidate) => candidate.id !== entryId),
  });
};

export const deleteLocalClasswordEntriesByDate = (storage: Storage, dateKey: string): void => {
  const state = readState(storage);
  writeState(storage, {
    ...state,
    entries: state.entries.filter((entry) => entry.dateKey !== dateKey),
  });
};
