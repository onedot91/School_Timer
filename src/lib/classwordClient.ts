import { browserDraftStorage } from './featureInputDraft.js';
import { deferSaveRecoveryUntil, getSaveRecoveryDelay, notifySaveRecovery, registerSaveRecoveryAdapter, serializeStudentSave } from './saveRecovery.js';
import { invalidateSharedSettingsCache } from './supabaseSettings.js';
import { featurePayloadHash, featureRetryAfterMs } from './featureReceipt.js';
import { prepareClasswordRequest, finishClasswordRequest, classwordRequestTransportHash, listClasswordRequests } from './classwordRequestStore';
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

  constructor(code: string, readonly status?: number, readonly retryAfterMs?: number) {
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
  const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
  const requestId = isRecord(body) && typeof body.requestId === 'string' ? body.requestId : new URLSearchParams(path.split('?')[1]).get('requestId');
  const actor = Number(context.actor ?? 0);
  if (init?.method && init.method !== 'GET' && requestId) {
    const delay = getSaveRecoveryDelay(actor, requestId);
    if (delay > 0) throw new ClasswordClientError('CLASSWORD_HTTP_429', 429, delay);
  }
  const response = await fetch(path, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(!init?.method || init.method === 'GET' ? 12_000 : 45_000),
    headers: {
      Accept: 'application/json',
      ...(init?.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  });
  let value: unknown;
  try { value = await response.json(); } catch (error) { if (response.ok) throw error; }
  if (!isStorageResponseContextCurrent(context)) throw new StorageResponseActorChangedError();
  if (!response.ok) {
    const code = isRecord(value) && typeof value.error === 'string'
      ? value.error
      : `CLASSWORD_HTTP_${response.status}`;
    const retryAfterMs = featureRetryAfterMs(response);
    if (requestId && retryAfterMs && (response.status === 429 || response.status >= 500)) deferSaveRecoveryUntil(actor, requestId, retryAfterMs);
    throw new ClasswordClientError(code, response.status, retryAfterMs);
  }
  return value;
};


const validateCommandResult = (value: unknown, body: Record<string, unknown>): unknown => {
  if (!isRecord(value)) throw new ClasswordClientError('CLASSWORD_INVALID_RESPONSE');
  if (body.action === 'save_entry') {
    const board = parseClasswordBoard({ dateKey: body.dateKey, topic: '', entries: [value.entry] });
    const entry = board.entries[0];
    const actor = Number(captureStorageResponseContext().actor);
    if (!entry || entry.dateKey !== body.dateKey || entry.initial !== body.initial || entry.word !== String(body.word).trim()
      || (actor > 0 && entry.studentNumber !== actor)
      || typeof value.awarded !== 'boolean' || typeof value.balance !== 'number' || !Number.isFinite(value.balance)) throw new ClasswordClientError('CLASSWORD_INVALID_RESPONSE');
  } else if (body.action === 'answer_quiz') {
    const state = parseClasswordQuizStudentState(value.state);
    if (state.dateKey !== body.dateKey || (body.expectedQuestionId !== undefined && state.question.id !== body.expectedQuestionId)
      || (value.correct === true && !state.completed)) throw new ClasswordClientError('CLASSWORD_INVALID_RESPONSE');
    if (typeof value.correct !== 'boolean' || (value.correct && (typeof value.awarded !== 'boolean' || typeof value.balance !== 'number' || !Number.isFinite(value.balance) || typeof value.rewardAmount !== 'number' || !Number.isInteger(value.rewardAmount) || value.rewardAmount < 1 || value.rewardAmount > 10))) throw new ClasswordClientError('CLASSWORD_INVALID_RESPONSE');
  } else if (value.saved !== true && value.deleted !== true) throw new ClasswordClientError('CLASSWORD_INVALID_RESPONSE');
  return value;
};

export const loadClasswordCommandReceipt = async (body: Record<string, unknown>, transportHash: boolean): Promise<unknown | null> => {
  const actor = captureStorageResponseContext().actor;
  const query = new URLSearchParams({ receiptOnly: '1', requestId: String(body.requestId), ...(actor !== null && Number(actor) > 0 ? { expectedStudentNumber: actor } : {}) });
  const status = await requestWithoutReporting(`/api/classword?${query}`);
  if (!isRecord(status)) throw new ClasswordClientError('CLASSWORD_INVALID_RESPONSE');
  if (status.status === 'unknown') return null;
  // During server rollout, only a previously issued legacy request uses the legacy result contract.
  if (!transportHash && status.committed === true) {
    const result = validateCommandResult(status.result, body);
    invalidateSharedSettingsCache();
    return result;
  }
  if (status.status !== 'committed' || typeof status.committedAt !== 'string' || !Number.isFinite(Date.parse(status.committedAt))) {
    throw new ClasswordClientError('CLASSWORD_INVALID_RESPONSE');
  }
  if (!transportHash || status.legacy === true) throw new ClasswordClientError('CLASSWORD_LEGACY_CONFIRMATION_REQUIRED');
  const { action, requestId: _requestId, protocolVersion: _protocolVersion, ...payload } = body;
  const expectedAction = action === 'answer_quiz' ? 'classword:complete_quiz' : 'classword:save_entry';
  if (status.action !== expectedAction || status.hashAlgorithm !== 'sha256-transport-v1'
    || status.payloadHash !== await featurePayloadHash(String(action), payload)) {
    throw new ClasswordClientError('CLASSWORD_REQUEST_REUSED', 409);
  }
  const result = validateCommandResult(status.result, body);
  invalidateSharedSettingsCache();
  return result;
};

const request = async (path: string, init?: RequestInit): Promise<unknown> => {
  if (!init?.method || init.method === 'GET') return requestWithoutReporting(path, init);
  const raw: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : null;
  if (!isRecord(raw)) throw new ClasswordClientError('CLASSWORD_INVALID_REQUEST');
  const context = captureStorageResponseContext();
  const actor = Number(context.actor ?? 0);
  let storage: Storage | null = null;
  try { storage = window.localStorage; } catch { storage = null; }
  const body = await prepareClasswordRequest(storage, actor, raw);
  const transportHash = await classwordRequestTransportHash(storage, actor, body.requestId);
  if (!isStorageResponseContextCurrent(context)) throw new StorageResponseActorChangedError();
  try {
    const result = await serializeStudentSave(actor, () => withSaveFailureReporting('classword', async () => {
      if (!isStorageResponseContextCurrent(context)) throw new StorageResponseActorChangedError();
      if (actor > 0 && (body.action === 'save_entry' || body.action === 'answer_quiz') && body.expectedStudentNumber === undefined) {
        const confirmed = await loadClasswordCommandReceipt(body, transportHash);
        if (confirmed !== null) return confirmed;
        throw new ClasswordClientError('CLASSWORD_LEGACY_CONFIRMATION_REQUIRED', 409);
      }
      try {
        return validateCommandResult(await requestWithoutReporting(path, { ...init, headers: { ...init.headers, ...(transportHash && (body.action === 'save_entry' || body.action === 'answer_quiz') ? { 'x-storage-receipt': '1' } : {}) }, body: JSON.stringify(body) }), body);
      } catch (error) {
        if (!isStorageResponseContextCurrent(context)) throw new StorageResponseActorChangedError();
        if (getStorageAvailability(error) || error instanceof StorageResponseActorChangedError
          || (error instanceof ClasswordClientError && error.status !== undefined && error.status < 500 && error.status !== 408)) throw error;
        let retryAfterMs = error instanceof ClasswordClientError ? error.retryAfterMs : undefined;
        try {
          const confirmed = await loadClasswordCommandReceipt(body, transportHash);
          if (confirmed !== null) return confirmed;
        } catch (confirmationError) {
          if (confirmationError instanceof StorageResponseActorChangedError) throw confirmationError;
          if (!(confirmationError instanceof Error)) throw confirmationError;
          if (confirmationError instanceof ClasswordClientError && confirmationError.retryAfterMs !== undefined) retryAfterMs = Math.max(retryAfterMs ?? 0, confirmationError.retryAfterMs);
        }
        if (!isStorageResponseContextCurrent(context)) throw new StorageResponseActorChangedError();
        throw new ClasswordClientError('CLASSWORD_CONFIRMATION_REQUIRED', 502, retryAfterMs);
      }
    }, actor, { requestId: String(body.requestId), deferUntilRecovery: actor > 0 && body.expectedStudentNumber === actor && transportHash && (body.action === 'save_entry' || (body.action === 'answer_quiz' && typeof body.expectedQuestionId === 'string')), stage: 'write', retryCount: 0 }));
    invalidateSharedSettingsCache();
    await finishClasswordRequest(storage, actor, String(body.action), body.requestId);
    return result;
  } catch (error) {
    if (error instanceof ClasswordClientError && ['CLASSWORD_INITIAL_OCCUPIED', 'CLASSWORD_STUDENT_ALREADY_ENTERED', 'CLASSWORD_ENTRY_CHANGED'].includes(error.code)) {
      await finishClasswordRequest(storage, actor, String(body.action), body.requestId);
    }
    throw error;
  } finally { notifySaveRecovery(); }
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
  readonly expectedQuestionId?: string;
}): Promise<SubmitClasswordQuizAnswerResult> => {
  if (appDataMode === 'readonly') throw new ClasswordClientError('BACKEND_WRITE_DISABLED');
  assertClientParticipation(input.dateKey);
  const actor = captureStorageResponseContext().actor;
  if (appDataMode === 'production' && actor !== null && actor !== String(input.studentNumber)) throw new StorageResponseActorChangedError();
  if (appDataMode === 'mock') {
    return withSaveFailureReporting('classword', async () => {
      try {
        const storage = getPrunedLocalStorage();
        const result = submitLocalClasswordQuizAnswer(
          storage,
          input.dateKey,
          input.studentNumber,
          input.answer,
        );
        if (!result.correct) return result;
        saveClasswordQuizAnswer(storage, {
          dateKey: result.state.dateKey,
          studentNumber: input.studentNumber,
          questionId: result.state.question.id,
        }, input.answer);
        dispatchLocalChange();
        return result;
      } catch (error) {
        if (error instanceof Error && (
          error.message === 'CLASSWORD_REWARD_SAVE_FAILED'
          || error.message === 'CLASSWORD_REWARD_PENDING'
        )) throw new ClasswordClientError(error.message);
        throw error;
      }
    }, input.studentNumber);
  }
  const value = await request('/api/classword', {
    method: 'POST',
    body: JSON.stringify({
      protocolVersion: 2,
      action: 'answer_quiz',
      expectedStudentNumber: input.studentNumber,
      ...(input.expectedQuestionId ? { expectedQuestionId: input.expectedQuestionId } : {}),
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
  saveClasswordQuizAnswer(browserDraftStorage(), {
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
  const actor = captureStorageResponseContext().actor;
  if (appDataMode === 'production' && actor !== null && actor !== String(input.studentNumber)) throw new StorageResponseActorChangedError();
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
      expectedStudentNumber: input.studentNumber,
      expectedTopic: topic,
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

const pendingClasswordFor = async (actor: number, id: string) => {
  const context = captureStorageResponseContext();
  if (context.actor !== null && context.actor !== String(actor)) throw new StorageResponseActorChangedError();
  let storage: Storage | null = null;
  try { storage = window.localStorage; } catch { /* The common store also keeps requests in memory. */ }
  const pending = (await listClasswordRequests(storage, actor)).find(entry => entry.draft.requestId === id);
  if (!isStorageResponseContextCurrent(context)) throw new StorageResponseActorChangedError();
  return { storage, pending };
};
registerSaveRecoveryAdapter({
  id: 'classword',
  list: async (actor) => {
    if (appDataMode !== 'production') return [];
    let storage: Storage | null = null;
    try { storage = window.localStorage; } catch { /* Memory fallback still participates in recovery. */ }
    return (await listClasswordRequests(storage, actor)).map(({ draft, body, transportHash }) => ({
      id: draft.requestId, actor, feature: 'classword', createdAt: draft.createdAt,
      mode: actor > 0 && body.expectedStudentNumber === actor && transportHash && (body.action === 'save_entry' || (body.action === 'answer_quiz' && typeof body.expectedQuestionId === 'string')) ? 'automatic' : 'confirm-only',
      ...(typeof body.dateKey === 'string' ? { contextKey: body.dateKey } : {}),
    }));
  },
  eligible: (request) => request.actor > 0 && request.contextKey === getKoreanDateKey(),
  confirm: async (entry) => {
    const { storage, pending } = await pendingClasswordFor(entry.actor, entry.id);
    if (!pending) return true;
    const confirmed = await loadClasswordCommandReceipt({ ...pending.body, requestId: entry.id }, pending.transportHash);
    if (confirmed === null) return false;
    await finishClasswordRequest(storage, entry.actor, String(pending.body.action), entry.id);
    return true;
  },
  retry: async (entry) => {
    const { pending } = await pendingClasswordFor(entry.actor, entry.id);
    if (!pending) return;
    const date = pending.body.dateKey;
    if (date !== getKoreanDateKey()) throw new ClasswordClientError('TODAY_ONLY', 409);
    if (pending.body.action === 'save_entry') {
      const board = await loadClasswordBoard(String(date));
      if (board.topic !== pending.body.expectedTopic) throw new ClasswordClientError('CLASSWORD_TOPIC_CHANGED', 409);
    } else if (pending.body.action === 'answer_quiz') {
      const quiz = await loadClasswordQuizStudentState(String(date), entry.actor);
      if (quiz.question.id !== pending.body.expectedQuestionId) throw new ClasswordClientError('CLASSWORD_QUESTION_CHANGED', 409);
    } else throw new ClasswordClientError('CLASSWORD_CONFIRMATION_REQUIRED', 409);
    await request('/api/classword', { method: 'POST', body: JSON.stringify({ ...pending.body, requestId: entry.id }) });
  },
});
