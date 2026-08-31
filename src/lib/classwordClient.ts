import {
  getClasswordEntryRetentionCutoff,
  parseClasswordBoard,
  parseClasswordRounds,
  validateClasswordWord,
  type ClasswordBoard,
  type ClasswordEntry,
  type ClasswordInitial,
  type ClasswordRoundSummary,
} from './classword';
import {
  deleteLocalClasswordEntriesByDate,
  deleteLocalClasswordEntry,
  ClasswordLocalError,
  loadLocalClasswordBoard,
  loadLocalClasswordRounds,
  pruneLocalClasswordEntries,
  saveLocalClasswordEntry,
  saveLocalClasswordTopic,
} from './classwordLocalStore';
import {
  parseClasswordQuizStudentState,
  parseClasswordQuizTeacherSummary,
  type ClasswordQuizStudentState,
  type ClasswordQuizTeacherSummary,
} from './classwordQuiz';
import {
  loadLocalClasswordQuizStudentState,
  loadLocalClasswordQuizTeacherSummary,
  submitLocalClasswordQuizAnswer,
} from './classwordQuizLocalStore';
import { claimClasswordQuizRewardInSettings } from './classwordQuizReward';
import { appDataMode } from './dataMode';
import { normalizeCurrencyBalances, normalizeCurrencyHistory } from './currency';
import { loadStoredStudentPetSnapshot, storeStudentPetSnapshot } from './studentPet';

export const CLASSWORD_LOCAL_CHANGE_EVENT = 'school-timer-classword-change';

export type SaveClasswordEntryInput = {
  readonly entryId?: string;
  readonly dateKey: string;
  readonly initial: ClasswordInitial;
  readonly word: string;
  readonly studentNumber: number;
};

export type SaveClasswordEntryResult = {
  readonly entry: ClasswordEntry;
  readonly awarded: boolean;
  readonly balance: number | null;
};

export type SubmitClasswordQuizAnswerResult = {
  readonly correct: boolean;
  readonly state: ClasswordQuizStudentState;
  readonly awarded: boolean;
  readonly rewardAmount: number;
  readonly balance: number | null;
};

export class ClasswordClientError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'ClasswordClientError';
    this.code = code;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const request = async (path: string, init?: RequestInit): Promise<unknown> => {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  });
  const value: unknown = await response.json();
  if (!response.ok) {
    const code = isRecord(value) && typeof value.error === 'string'
      ? value.error
      : `CLASSWORD_HTTP_${response.status}`;
    throw new ClasswordClientError(code);
  }
  return value;
};

const dispatchLocalChange = (): void => {
  window.dispatchEvent(new CustomEvent(CLASSWORD_LOCAL_CHANGE_EVENT));
};

const getPrunedLocalStorage = (): Storage => {
  const storage = window.localStorage;
  pruneLocalClasswordEntries(storage, getClasswordEntryRetentionCutoff());
  return storage;
};

export const loadClasswordBoard = async (dateKey: string): Promise<ClasswordBoard> => {
  if (appDataMode === 'mock') return loadLocalClasswordBoard(getPrunedLocalStorage(), dateKey);
  return parseClasswordBoard(await request(`/api/classword?dateKey=${encodeURIComponent(dateKey)}`));
};

export const loadClasswordRounds = async (monthKey: string): Promise<readonly ClasswordRoundSummary[]> => {
  if (appDataMode === 'mock') {
    return loadLocalClasswordRounds(getPrunedLocalStorage()).filter((round) => round.dateKey.startsWith(`${monthKey}-`));
  }
  return parseClasswordRounds(await request(`/api/classword?monthKey=${encodeURIComponent(monthKey)}`));
};

export const loadClasswordUsedTopics = async (): Promise<readonly string[]> => {
  if (appDataMode === 'mock') {
    return [...new Set(loadLocalClasswordRounds(getPrunedLocalStorage()).map((round) => round.topic.trim()).filter(Boolean))];
  }
  const value = await request('/api/classword?usedTopics=1');
  if (!Array.isArray(value) || !value.every((topic) => typeof topic === 'string')) {
    throw new ClasswordClientError('CLASSWORD_INVALID_RESPONSE');
  }
  return [...new Set(value.map((topic) => topic.trim()).filter(Boolean))];
};

export const loadClasswordQuizStudentState = async (
  dateKey: string,
  studentNumber: number,
): Promise<ClasswordQuizStudentState> => {
  if (appDataMode === 'mock') {
    return loadLocalClasswordQuizStudentState(getPrunedLocalStorage(), dateKey, studentNumber);
  }
  return parseClasswordQuizStudentState(await request(
    `/api/classword?quiz=1&dateKey=${encodeURIComponent(dateKey)}`,
  ));
};

export const loadTeacherClasswordQuizSummary = async (
  dateKey: string,
): Promise<ClasswordQuizTeacherSummary> => {
  if (appDataMode === 'mock') {
    return loadLocalClasswordQuizTeacherSummary(getPrunedLocalStorage(), dateKey);
  }
  return parseClasswordQuizTeacherSummary(await request(
    `/api/classword?quiz=1&dateKey=${encodeURIComponent(dateKey)}`,
  ));
};

export const submitClasswordQuizAnswer = async (input: {
  readonly dateKey: string;
  readonly studentNumber: number;
  readonly answer: string;
}): Promise<SubmitClasswordQuizAnswerResult> => {
  if (appDataMode === 'readonly') throw new ClasswordClientError('BACKEND_WRITE_DISABLED');
  if (appDataMode === 'mock') {
    const result = submitLocalClasswordQuizAnswer(
      getPrunedLocalStorage(),
      input.dateKey,
      input.studentNumber,
      input.answer,
    );
    if (!result.correct) {
      return { ...result, awarded: false, balance: null };
    }
    const snapshot = loadStoredStudentPetSnapshot();
    const reward = claimClasswordQuizRewardInSettings(
      snapshot,
      input.studentNumber,
      input.dateKey,
      result.rewardAmount,
    );
    if (reward.awarded && !storeStudentPetSnapshot({
      ...snapshot,
      currencyBalances: normalizeCurrencyBalances(reward.value.currencyBalances),
      currencyHistory: normalizeCurrencyHistory(reward.value.currencyHistory),
    })) throw new ClasswordClientError('CLASSWORD_REWARD_SAVE_FAILED');
    dispatchLocalChange();
    return {
      ...result,
      awarded: reward.awarded,
      balance: reward.balance,
    };
  }
  const value = await request('/api/classword', {
    method: 'POST',
    body: JSON.stringify({
      action: 'answer_quiz',
      dateKey: input.dateKey,
      answer: input.answer,
    }),
  });
  if (!isRecord(value) || typeof value.correct !== 'boolean') {
    throw new ClasswordClientError('CLASSWORD_INVALID_RESPONSE');
  }
  const state = parseClasswordQuizStudentState(value.state);
  if (!value.correct) {
    return { correct: false, state, awarded: false, rewardAmount: 0, balance: null };
  }
  if (
    typeof value.awarded !== 'boolean'
    || typeof value.rewardAmount !== 'number'
    || !Number.isInteger(value.rewardAmount)
    || value.rewardAmount < 1
    || value.rewardAmount > 10
    || typeof value.balance !== 'number'
  ) throw new ClasswordClientError('CLASSWORD_INVALID_RESPONSE');
  return {
    correct: true,
    state,
    awarded: value.awarded,
    rewardAmount: value.rewardAmount,
    balance: value.balance,
  };
};

export const saveClasswordEntry = async (
  input: SaveClasswordEntryInput,
  topic: string,
): Promise<SaveClasswordEntryResult> => {
  const validation = validateClasswordWord(input.word, input.initial, topic);
  if (validation.ok === false) throw new ClasswordClientError(validation.code);
  if (appDataMode === 'readonly') throw new ClasswordClientError('BACKEND_WRITE_DISABLED');
  if (appDataMode === 'mock') {
    try {
      const entry = saveLocalClasswordEntry(getPrunedLocalStorage(), { ...input, word: validation.word });
      dispatchLocalChange();
      return { entry, awarded: false, balance: null };
    } catch (error) {
      if (error instanceof ClasswordLocalError) throw new ClasswordClientError(error.code);
      throw error;
    }
  }
  const value = await request('/api/classword', {
    method: 'POST',
    body: JSON.stringify({
      action: 'save_entry',
      ...(input.entryId ? { entryId: input.entryId } : {}),
      dateKey: input.dateKey,
      initial: input.initial,
      word: validation.word,
    }),
  });
  if (!isRecord(value)) throw new ClasswordClientError('CLASSWORD_INVALID_RESPONSE');
  const board = parseClasswordBoard({ dateKey: input.dateKey, topic, entries: [value.entry] });
  const entry = board.entries[0];
  const awarded = value.awarded;
  const balance = value.balance;
  if (!entry || typeof awarded !== 'boolean' || (balance !== null && typeof balance !== 'number')) {
    throw new ClasswordClientError('CLASSWORD_INVALID_RESPONSE');
  }
  const parsedBalance = typeof balance === 'number' ? balance : null;
  return { entry, awarded, balance: parsedBalance };
};

export const removeClasswordEntry = async (
  entryId: string,
  studentNumber: number,
  teacher = false,
): Promise<void> => {
  if (appDataMode === 'readonly') throw new ClasswordClientError('BACKEND_WRITE_DISABLED');
  if (appDataMode === 'mock') {
    try {
      deleteLocalClasswordEntry(getPrunedLocalStorage(), entryId, studentNumber, teacher);
      dispatchLocalChange();
      return;
    } catch (error) {
      if (error instanceof ClasswordLocalError) throw new ClasswordClientError(error.code);
      throw error;
    }
  }
  await request('/api/classword', {
    method: 'POST',
    body: JSON.stringify({ action: 'delete_entry', entryId }),
  });
};

export const updateClasswordTopic = async (dateKey: string, topic: string): Promise<void> => {
  if (appDataMode === 'readonly') throw new ClasswordClientError('BACKEND_WRITE_DISABLED');
  if (appDataMode === 'mock') {
    saveLocalClasswordTopic(getPrunedLocalStorage(), dateKey, topic);
    dispatchLocalChange();
    return;
  }
  await request('/api/classword', {
    method: 'POST',
    body: JSON.stringify({ action: 'save_topic', dateKey, topic }),
  });
};

export const clearClasswordDate = async (dateKey: string): Promise<void> => {
  if (appDataMode === 'readonly') throw new ClasswordClientError('BACKEND_WRITE_DISABLED');
  if (appDataMode === 'mock') {
    deleteLocalClasswordEntriesByDate(getPrunedLocalStorage(), dateKey);
    dispatchLocalChange();
    return;
  }
  await request('/api/classword', {
    method: 'POST',
    body: JSON.stringify({ action: 'delete_date_entries', dateKey, confirmation: 'DELETE' }),
  });
};
