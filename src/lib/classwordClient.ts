import { prepareClasswordRequest, finishClasswordRequest } from './classwordRequestStore';
import { withSaveFailureReporting } from './saveFailureClient.js';
import { getStorageAvailability } from './storageAvailability.js';
import { captureStorageResponseContext, isStorageResponseContextCurrent, StorageResponseActorChangedError } from './storageResponseOrder.js';
import {
  getClasswordEntryRetentionCutoff,
  getKoreanDateKey,
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
  type ClasswordQuizTeacherInput,
  type ClasswordQuizTeacherSummary,
} from './classwordQuiz';
import { saveClasswordQuizAnswer } from './classwordQuizAnswerStore';
import {
  loadLocalClasswordQuizStudentState,
  loadLocalClasswordQuizTeacherSummary,
  deleteLocalTeacherClasswordQuiz,
  saveLocalTeacherClasswordQuiz,
  submitLocalClasswordQuizAnswer,
} from './classwordQuizLocalStore';
import { claimClasswordQuizRewardInSettings } from './classwordQuizReward';
import {
  CLASSWORD_WORD_ENTRY_WEEKLY_MISSION_TYPE,
  claimWeeklyMissionRewardInSettings,
} from './weeklyMission';
import { appDataMode } from './dataMode';
import { assertClasswordParticipation, ClasswordScheduleError, isClasswordWeekday } from './classwordSchedule';
import { getElapsedClasswordTopics, resolveClasswordMonth } from './classwordTopics';
import { normalizeCurrencyBalances, normalizeCurrencyHistory } from './currency';
import { loadStoredStudentPetSnapshot, storeStudentPetSnapshot } from './studentPet';

export const CLASSWORD_LOCAL_CHANGE_EVENT = 'school-timer-classword-change';

export type SaveClasswordEntryInput = {
  readonly entryId?: string;
  readonly expectedRevision?: string;
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

  constructor(code: string, readonly status?: number) {
    super(code);
    this.name = 'ClasswordClientError';
    this.code = code;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const requestWithoutReporting = async (path: string, init?: RequestInit): Promise<unknown> => {
  const context = captureStorageResponseContext();
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  });
  const value: unknown = await response.json();
  if (!isStorageResponseContextCurrent(context)) throw new StorageResponseActorChangedError();
  if (!response.ok) {
    const code = isRecord(value) && typeof value.error === 'string'
      ? value.error
      : `CLASSWORD_HTTP_${response.status}`;
    throw new ClasswordClientError(code, response.status);
  }
  return value;
};


const validateCommandResult = (value: unknown, body: Record<string, unknown>): unknown => {
  if (!isRecord(value)) throw new ClasswordClientError('CLASSWORD_INVALID_RESPONSE');
  if (body.action === 'save_entry') {
    const board = parseClasswordBoard({ dateKey: body.dateKey, topic: '', entries: [value.entry] });
    if (!board.entries[0] || typeof value.awarded !== 'boolean' || typeof value.balance !== 'number' || !Number.isFinite(value.balance)) throw new ClasswordClientError('CLASSWORD_INVALID_RESPONSE');
  } else if (body.action === 'answer_quiz') {
    parseClasswordQuizStudentState(value.state);
    if (typeof value.correct !== 'boolean' || (value.correct && (typeof value.awarded !== 'boolean' || typeof value.balance !== 'number' || !Number.isFinite(value.balance) || typeof value.rewardAmount !== 'number' || !Number.isInteger(value.rewardAmount) || value.rewardAmount < 1 || value.rewardAmount > 10))) throw new ClasswordClientError('CLASSWORD_INVALID_RESPONSE');
  } else if (value.saved !== true && value.deleted !== true) throw new ClasswordClientError('CLASSWORD_INVALID_RESPONSE');
  return value;
};

const request = async (path: string, init?: RequestInit): Promise<unknown> => {
  if (!init?.method || init.method === 'GET') return requestWithoutReporting(path, init);
  const raw: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : null;
  if (!isRecord(raw)) throw new ClasswordClientError('CLASSWORD_INVALID_REQUEST');
  let storage: Storage | null = null;
  let actor = 0;
  try { storage = window.localStorage; actor = Number(storage.getItem('school-timer-entry-number-v1') ?? 0); } catch { storage = null; }
  const body = prepareClasswordRequest(storage, actor, raw);
  const context = captureStorageResponseContext();
  try {
    const result = await withSaveFailureReporting('classword', async () => {
      try {
        return validateCommandResult(await requestWithoutReporting(path, { ...init, body: JSON.stringify(body) }), body);
      } catch (error) {
        if (!isStorageResponseContextCurrent(context)) throw new StorageResponseActorChangedError();
        if (getStorageAvailability(error) || error instanceof StorageResponseActorChangedError
          || (error instanceof ClasswordClientError && error.status !== undefined && error.status < 500 && error.status !== 408)) throw error;
        try {
          const status = await requestWithoutReporting(`${path}?requestId=${encodeURIComponent(String(body.requestId))}`);
          if (isRecord(status) && status.committed === true) return validateCommandResult(status.result, body);
        } catch (confirmationError) {
          if (confirmationError instanceof StorageResponseActorChangedError) throw confirmationError;
          if (!(confirmationError instanceof Error)) throw confirmationError;
        }
        if (!isStorageResponseContextCurrent(context)) throw new StorageResponseActorChangedError();
        throw new ClasswordClientError('CLASSWORD_CONFIRMATION_REQUIRED', 502);
      }
    });
    finishClasswordRequest(storage, actor, String(body.action), body.requestId);
    return result;
  } catch (error) {
    if (error instanceof ClasswordClientError && ['CLASSWORD_INITIAL_OCCUPIED', 'CLASSWORD_STUDENT_ALREADY_ENTERED', 'CLASSWORD_ENTRY_CHANGED'].includes(error.code)) {
      finishClasswordRequest(storage, actor, String(body.action), body.requestId);
    }
    throw error;
  }
};
const dispatchLocalChange = (): void => {
  window.dispatchEvent(new CustomEvent(CLASSWORD_LOCAL_CHANGE_EVENT));
};

const getPrunedLocalStorage = (): Storage => {
  const storage = window.localStorage;
  if (isClasswordWeekday(getKoreanDateKey())) pruneLocalClasswordEntries(storage, getClasswordEntryRetentionCutoff());
  return storage;
};

const assertClientParticipation = (dateKey: string): void => {
  try {
    assertClasswordParticipation(dateKey);
  } catch (error) {
    if (error instanceof ClasswordScheduleError) throw new ClasswordClientError(error.code);
    throw error;
  }
};

export const loadClasswordBoard = async (dateKey: string): Promise<ClasswordBoard> => {
  if (appDataMode === 'mock') return loadLocalClasswordBoard(getPrunedLocalStorage(), dateKey);
  return parseClasswordBoard(await request(`/api/classword?dateKey=${encodeURIComponent(dateKey)}`));
};

export const loadClasswordRounds = async (monthKey: string): Promise<readonly ClasswordRoundSummary[]> => {
  if (appDataMode === 'mock') {
    return resolveClasswordMonth(monthKey, loadLocalClasswordRounds(getPrunedLocalStorage()));
  }
  return parseClasswordRounds(await request(`/api/classword?monthKey=${encodeURIComponent(monthKey)}`));
};

export const loadClasswordUsedTopics = async (): Promise<readonly string[]> => {
  if (appDataMode === 'mock') {
    return [...new Set([
      ...loadLocalClasswordRounds(getPrunedLocalStorage()).map((round) => round.topic.trim()).filter(Boolean),
      ...getElapsedClasswordTopics(),
    ])];
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

export const updateTeacherClasswordQuiz = async (input: ClasswordQuizTeacherInput): Promise<void> => {
  if (appDataMode === 'readonly') throw new ClasswordClientError('BACKEND_WRITE_DISABLED');
  if (appDataMode === 'mock') {
    saveLocalTeacherClasswordQuiz(getPrunedLocalStorage(), input);
    dispatchLocalChange();
    return;
  }
  await request('/api/classword', {
    method: 'POST',
    body: JSON.stringify({ protocolVersion: 2, action: 'save_quiz', ...input }),
  });
};

export const resetTeacherClasswordQuiz = async (dateKey: string): Promise<void> => {
  if (appDataMode === 'readonly') throw new ClasswordClientError('BACKEND_WRITE_DISABLED');
  if (appDataMode === 'mock') {
    deleteLocalTeacherClasswordQuiz(getPrunedLocalStorage(), dateKey);
    dispatchLocalChange();
    return;
  }
  await request('/api/classword', {
    method: 'POST',
    body: JSON.stringify({ protocolVersion: 2, action: 'delete_quiz', dateKey }),
  });
};

export const submitClasswordQuizAnswer = async (input: {
  readonly dateKey: string;
  readonly studentNumber: number;
  readonly answer: string;
}): Promise<SubmitClasswordQuizAnswerResult> => {
  if (appDataMode === 'readonly') throw new ClasswordClientError('BACKEND_WRITE_DISABLED');
  assertClientParticipation(input.dateKey);
  if (appDataMode === 'mock') {
    const storage = getPrunedLocalStorage();
    const result = submitLocalClasswordQuizAnswer(
      storage,
      input.dateKey,
      input.studentNumber,
      input.answer,
    );
    if (!result.correct) {
      return { ...result, awarded: false, balance: null };
    }
    saveClasswordQuizAnswer(storage, {
      dateKey: result.state.dateKey,
      studentNumber: input.studentNumber,
      questionId: result.state.question.id,
    }, input.answer);
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
      protocolVersion: 2,
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
  saveClasswordQuizAnswer(window.localStorage, {
    dateKey: state.dateKey,
    studentNumber: input.studentNumber,
    questionId: state.question.id,
  }, input.answer);
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
  assertClientParticipation(input.dateKey);
  if (appDataMode === 'mock') {
    try {
      const entry = saveLocalClasswordEntry(getPrunedLocalStorage(), { ...input, word: validation.word });
      const snapshot = loadStoredStudentPetSnapshot();
      const reward = claimWeeklyMissionRewardInSettings(
        snapshot,
        input.studentNumber,
        input.dateKey,
        CLASSWORD_WORD_ENTRY_WEEKLY_MISSION_TYPE,
      );
      if (reward.awarded && !storeStudentPetSnapshot({
        ...snapshot,
        currencyBalances: normalizeCurrencyBalances(reward.value.currencyBalances),
        currencyHistory: normalizeCurrencyHistory(reward.value.currencyHistory),
      })) throw new ClasswordClientError('CLASSWORD_REWARD_SAVE_FAILED');
      dispatchLocalChange();
      return { entry, awarded: reward.awarded, balance: reward.balance };
    } catch (error) {
      if (error instanceof ClasswordLocalError || error instanceof ClasswordScheduleError) throw new ClasswordClientError(error.code);
      throw error;
    }
  }
  const value = await request('/api/classword', {
    method: 'POST',
    body: JSON.stringify({
      protocolVersion: 2,
      action: 'save_entry',
      ...(input.entryId ? { entryId: input.entryId, expectedRevision: input.expectedRevision } : {}),
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
  if (!teacher) assertClientParticipation(getKoreanDateKey());
  if (appDataMode === 'mock') {
    try {
      deleteLocalClasswordEntry(getPrunedLocalStorage(), entryId, studentNumber, teacher);
      dispatchLocalChange();
      return;
    } catch (error) {
      if (error instanceof ClasswordLocalError || error instanceof ClasswordScheduleError) throw new ClasswordClientError(error.code);
      throw error;
    }
  }
  await request('/api/classword', {
    method: 'POST',
    body: JSON.stringify({ protocolVersion: 2, action: 'delete_entry', entryId }),
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
    body: JSON.stringify({ protocolVersion: 2, action: 'save_topic', dateKey, topic }),
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
    body: JSON.stringify({ protocolVersion: 2, action: 'delete_date_entries', dateKey, confirmation: 'DELETE' }),
  });
};
