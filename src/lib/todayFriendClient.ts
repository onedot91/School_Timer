import { deferSaveRecoveryUntil, getSaveRecoveryDelay, notifySaveRecovery, registerSaveRecoveryAdapter, serializeStudentSave } from './saveRecovery.js';
import { invalidateSharedSettingsCache } from './supabaseSettings.js';
import { createTodayFriendSubmissionDraftStore } from './todayFriendSubmissionDraft.js';
import { featurePayloadHash, featureRetryAfterMs } from './featureReceipt.js';
import { withSaveFailureReporting } from './saveFailureClient.js';
import { captureStorageResponseContext, isStorageResponseContextCurrent, StorageResponseActorChangedError } from './storageResponseOrder.js';
import { appendCurrencyHistoryEntry, normalizeCurrencyBalances } from './currency';
import { appDataMode } from './dataMode';
import { loadStoredStudentPetSnapshot, storeStudentPetSnapshot } from './studentPet';
import {
  approveTodayFriendSubmission,
  getTodayFriendDateKey,
  type TodayFriendGenre,
  type TodayFriendPayload,
  type TodayFriendSubmission,
} from './todayFriend';
import { parseTodayFriendState, parseTodayFriendSubmission } from './todayFriendCodec';
import {
  loadLocalTodayFriendState,
  saveLocalTodayFriendState,
  updateLocalTodayFriendState,
} from './todayFriendLocalStore';
import {
  assignTodayFriendPair,
  ensureTodayFriendDay,
  getTodayFriendStudentMission,
  reassignTodayFriendPartners,
  reassignTodayFriendWeek,
  reviewTodayFriendSubmission,
  saveTodayFriendSubmission,
  selectTodayFriendQuestion,
  submitSavedTodayFriendSubmission,
  type TodayFriendState,
  type TodayFriendStudentMission,
} from './todayFriendState';
import { getKoreanIsoWeekKey } from './weeklyMission';

export class TodayFriendClientError extends Error {
  readonly code: string;

  constructor(code: string, readonly status?: number, readonly retryAfterMs?: number) {
    super(code);
    this.name = 'TodayFriendClientError';
    this.code = code;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isGenre = (value: unknown): value is TodayFriendGenre => (
  value === 'interview'
  || value === 'commonality'
  || value === 'recommendation'
  || value === 'compliment'
  || value === 'emotion'
);

const isNullableString = (value: unknown): value is string | null => value === null || typeof value === 'string';

const getWeekKey = (dateKey: string): string => getKoreanIsoWeekKey(new Date(`${dateKey}T12:00:00+09:00`));

const requestWithoutReporting = async (path: string, init?: RequestInit): Promise<unknown> => {
  const context = captureStorageResponseContext();
  const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
  const requestId = isRecord(body) && typeof body.requestId === 'string' ? body.requestId : new URLSearchParams(path.split('?')[1]).get('requestId');
  const actor = Number(context.actor ?? 0);
  if (init?.method && init.method !== 'GET' && requestId) {
    const delay = getSaveRecoveryDelay(actor, requestId);
    if (delay > 0) throw new TodayFriendClientError('TODAY_FRIEND_HTTP_429', 429, delay);
  }
  const response = await fetch(path, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(!init?.method || init.method === 'GET' ? 12_000 : 45_000),
    ...(typeof init?.body === 'string' ? { body: JSON.stringify({ ...JSON.parse(init.body), protocolVersion: 2 }) } : {}),
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
    const code = isRecord(value) && typeof value.error === 'string' ? value.error : `TODAY_FRIEND_HTTP_${response.status}`;
    const retryAfterMs = featureRetryAfterMs(response);
    if (requestId && retryAfterMs && (response.status === 429 || response.status >= 500)) deferSaveRecoveryUntil(actor, requestId, retryAfterMs);
    throw new TodayFriendClientError(code, response.status, retryAfterMs);
  }
  return value;
};


const request = async (path: string, init?: RequestInit): Promise<unknown> => {
  const context = captureStorageResponseContext();
  const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
  const actor = Number(context.actor ?? 0);
  const canDefer = actor > 0 && isRecord(body) && typeof body.requestId === 'string'
    && body.expectedStudentNumber === actor
    && (body.action === 'submit' || body.action === 'save_draft')
    && (await recoveryDrafts.list(actor)).some(entry => entry.pending.requestId === body.requestId);
  return init?.method && init.method !== 'GET'
    ? serializeStudentSave(Number(context.actor ?? 0), () => withSaveFailureReporting('todayFriend', async () => {
      if (!isStorageResponseContextCurrent(context)) throw new StorageResponseActorChangedError();
      let value: unknown;
      try {
        if (isRecord(body) && (body.action === 'submit' || body.action === 'save_draft') && body.expectedStudentNumber === undefined) {
          const receipt = await loadTodayFriendSubmissionReceipt(String(body.requestId), body);
          if (!receipt.found || !receipt.submission) throw new TodayFriendClientError('TODAY_FRIEND_LEGACY_CONFIRMATION_REQUIRED', 409);
          value = receipt.submission;
        } else value = await requestWithoutReporting(path, init);
      }
      catch (error) {
        if (error instanceof StorageResponseActorChangedError
          || (error instanceof TodayFriendClientError && error.status !== undefined && error.status < 500 && error.status !== 408)) throw error;
        if (!isRecord(body) || typeof body.requestId !== 'string' || (body.action !== 'save_draft' && body.action !== 'submit')) throw error;
        const receipt = await loadTodayFriendSubmissionReceipt(body.requestId, body);
        if (!receipt.found || !receipt.submission) throw new TodayFriendClientError('TODAY_FRIEND_CONFIRMATION_REQUIRED', 502, error instanceof TodayFriendClientError ? error.retryAfterMs : undefined);
        value = receipt.submission;
      }
      if (isRecord(body) && (body.action === 'save_draft' || body.action === 'submit')) {
        if (!parseTodayFriendSubmission(value)) throw new TodayFriendClientError('TODAY_FRIEND_INVALID_RESPONSE');
      } else {
        if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.weeks)
          || !Array.isArray(value.partnerDays) || !Array.isArray(value.submissions)
          || !Array.isArray(value.questions) || !isRecord(value.selectedQuestionIdByDate)) throw new TodayFriendClientError('TODAY_FRIEND_INVALID_RESPONSE');
        const parsed = parseTodayFriendState(value);
        if (parsed.weeks.length !== value.weeks.length || parsed.partnerDays.length !== value.partnerDays.length
          || parsed.submissions.length !== value.submissions.length || parsed.questions.length !== value.questions.length
          || Object.keys(parsed.selectedQuestionIdByDate).length !== Object.keys(value.selectedQuestionIdByDate).length) throw new TodayFriendClientError('TODAY_FRIEND_INVALID_RESPONSE');
      }
      invalidateSharedSettingsCache();
      return value;
    }, actor, isRecord(body) && typeof body.requestId === 'string' ? { requestId: body.requestId, deferUntilRecovery: canDefer, stage: 'write', retryCount: 0 } : undefined)).finally(notifySaveRecovery)
    : requestWithoutReporting(path, init);
};
const prepareLocalState = (dateKey: string): TodayFriendState => {
  const prepared = ensureTodayFriendDay(loadLocalTodayFriendState(window.localStorage), getWeekKey(dateKey), dateKey);
  saveLocalTodayFriendState(window.localStorage, prepared);
  return prepared;
};

const parseMission = (value: unknown): TodayFriendStudentMission => {
  if (!isRecord(value)) throw new TodayFriendClientError('TODAY_FRIEND_INVALID_RESPONSE');
  const dateKey = Reflect.get(value, 'dateKey');
  const studentNumber = Reflect.get(value, 'studentNumber');
  const partnerNumber = Reflect.get(value, 'partnerNumber');
  const genre = Reflect.get(value, 'genre');
  const question = Reflect.get(value, 'question');
  const submissionValue = Reflect.get(value, 'submission');
  const submission = submissionValue === null ? null : parseTodayFriendSubmission(submissionValue);
  if (
    typeof dateKey !== 'string'
    || typeof studentNumber !== 'number'
    || typeof partnerNumber !== 'number'
    || !isGenre(genre)
    || !isNullableString(question)
    || (submissionValue !== null && submission === null)
  ) throw new TodayFriendClientError('TODAY_FRIEND_INVALID_RESPONSE');
  return { dateKey, studentNumber, partnerNumber, genre, question, submission, ...(typeof value.planningRevision === 'string' ? { planningRevision: value.planningRevision } : {}) };
};

export const loadStudentTodayFriendMission = async (
  studentNumber: number,
  dateKey: string,
): Promise<TodayFriendStudentMission | null> => {
  const weekday = new Date(`${dateKey}T12:00:00+09:00`).getUTCDay();
  if (weekday === 0 || weekday === 6) return null;
  if (appDataMode === 'mock') return getTodayFriendStudentMission(prepareLocalState(dateKey), dateKey, studentNumber);
  return parseMission(await request(`/api/today-friend?dateKey=${encodeURIComponent(dateKey)}&expectedStudentNumber=${studentNumber}`));
};

export const todayFriendSubmissionCommand = (input: {
  readonly mission: TodayFriendStudentMission; readonly payload: TodayFriendPayload;
  readonly requestId?: string; readonly expectedRevision?: number;
  readonly expectedStudentNumber?: number | null;
}, submit: boolean): Record<string, unknown> => ({
  action: submit ? 'submit' : 'save_draft', dateKey: input.mission.dateKey,
  ...(input.expectedStudentNumber === null ? {} : { expectedStudentNumber: input.expectedStudentNumber ?? input.mission.studentNumber }),
  expectedMission: { partnerNumber: input.mission.partnerNumber, genre: input.mission.genre, question: input.mission.question,
    ...(input.mission.planningRevision === undefined ? {} : { planningRevision: input.mission.planningRevision }) },
  payload: input.payload, requestId: input.requestId ?? crypto.randomUUID(), expectedRevision: input.expectedRevision ?? input.mission.submission?.storageRevision ?? 0,
});

export const saveStudentTodayFriendDraft = async (input: {
  readonly mission: TodayFriendStudentMission;
  readonly payload: TodayFriendPayload;
  readonly requestId?: string;
  readonly expectedRevision?: number;
  readonly expectedStudentNumber?: number | null;
}): Promise<TodayFriendSubmission> => {
  if (appDataMode === 'readonly') throw new TodayFriendClientError('BACKEND_WRITE_DISABLED');
  const actor = captureStorageResponseContext().actor;
  if (appDataMode === 'production' && actor !== null && actor !== String(input.mission.studentNumber)) throw new StorageResponseActorChangedError();
  if (appDataMode === 'mock') {
    const state = updateLocalTodayFriendState((current) => saveTodayFriendSubmission(
      ensureTodayFriendDay(current, getWeekKey(input.mission.dateKey), input.mission.dateKey),
      input,
    ));
    const submission = state.submissions.find((entry) => entry.id === `today-friend-${input.mission.dateKey}-${input.mission.studentNumber}`);
    if (!submission) throw new TodayFriendClientError('SUBMISSION_SAVE_FAILED');
    return submission;
  }
  const value = await request('/api/today-friend', {
    method: 'POST',
    body: JSON.stringify(todayFriendSubmissionCommand(input, false)),
  });
  const submission = parseTodayFriendSubmission(value);
  if (!submission) throw new TodayFriendClientError('TODAY_FRIEND_INVALID_RESPONSE');
  return submission;
};

export const submitStudentTodayFriendMission = async (input: {
  readonly mission: TodayFriendStudentMission;
  readonly payload: TodayFriendPayload;
  readonly requestId?: string;
  readonly expectedRevision?: number;
  readonly expectedStudentNumber?: number | null;
}): Promise<TodayFriendSubmission> => {
  if (appDataMode === 'readonly') throw new TodayFriendClientError('BACKEND_WRITE_DISABLED');
  const actor = captureStorageResponseContext().actor;
  if (appDataMode === 'production' && actor !== null && actor !== String(input.mission.studentNumber)) throw new StorageResponseActorChangedError();
  if (appDataMode === 'mock') {
    await saveStudentTodayFriendDraft(input);
    const state = updateLocalTodayFriendState((current) => submitSavedTodayFriendSubmission(
      current,
      input.mission.dateKey,
      input.mission.studentNumber,
      new Date().toISOString(),
    ));
    const submission = state.submissions.find((entry) => entry.id === `today-friend-${input.mission.dateKey}-${input.mission.studentNumber}`);
    if (!submission) throw new TodayFriendClientError('SUBMISSION_SAVE_FAILED');
    return submission;
  }
  const value = await request('/api/today-friend', { method: 'POST', body: JSON.stringify(todayFriendSubmissionCommand(input, true)) });
  const submission = parseTodayFriendSubmission(value);
  if (!submission) throw new TodayFriendClientError('TODAY_FRIEND_INVALID_RESPONSE');
  return submission;
};

export const loadTeacherTodayFriendState = async (dateKey: string): Promise<TodayFriendState> => {
  if (appDataMode === 'mock') return prepareLocalState(dateKey);
  return parseTodayFriendState(await request(`/api/today-friend?teacher=1&dateKey=${encodeURIComponent(dateKey)}`));
};

export const reviewStudentTodayFriendSubmission = async (input: {
  readonly submissionId: string;
  readonly decision: 'revision_requested' | 'approved';
  readonly feedback: string;
  readonly expectedRevision?: number;
  readonly requestId?: string;
}): Promise<TodayFriendState> => {
  if (appDataMode === 'readonly') throw new TodayFriendClientError('BACKEND_WRITE_DISABLED');
  if (appDataMode !== 'mock') {
    return parseTodayFriendState(await request('/api/today-friend', { method: 'POST', body: JSON.stringify({ action: 'review', ...input, expectedRevision: input.expectedRevision ?? 0, requestId: input.requestId ?? crypto.randomUUID() }) }));
  }
  const current = loadLocalTodayFriendState(window.localStorage);
  const submission = current.submissions.find((entry) => entry.id === input.submissionId);
  if (!submission) throw new TodayFriendClientError('SUBMISSION_NOT_FOUND');
  if (input.decision === 'approved' && submission.status !== 'approved') {
    const snapshot = loadStoredStudentPetSnapshot();
    const studentKey = String(submission.studentNumber);
    const before = snapshot.currencyBalances[studentKey] ?? 0;
    const approval = approveTodayFriendSubmission(submission, before, new Date().toISOString());
    const saved = storeStudentPetSnapshot({
      ...snapshot,
      currencyBalances: normalizeCurrencyBalances({ ...snapshot.currencyBalances, [studentKey]: approval.balance }),
      currencyHistory: appendCurrencyHistoryEntry(snapshot.currencyHistory, {
        studentNumber: submission.studentNumber,
        before,
        after: approval.balance,
        reason: 'weekly_mission',
      }),
    });
    if (!saved) throw new TodayFriendClientError('REWARD_SAVE_FAILED');
  }
  return updateLocalTodayFriendState((state) => reviewTodayFriendSubmission(state, {
    ...input,
    reviewedAt: new Date().toISOString(),
  }));
};

export type TeacherTodayFriendPlanAction = {
  readonly action: 'reassign_week' | 'reassign_partners' | 'assign_pair' | 'select_question';
  readonly dateKey: string;
  readonly firstStudentNumber?: number;
  readonly secondStudentNumber?: number;
  readonly questionId?: string;
};

export const updateTeacherTodayFriendPlan = (input: TeacherTodayFriendPlanAction): Promise<TodayFriendState> => {
  if (appDataMode !== 'mock') return request('/api/today-friend', { method: 'POST', body: JSON.stringify(input) }).then(parseTodayFriendState);
  return Promise.resolve(updateLocalTodayFriendState((state) => {
    switch (input.action) {
      case 'reassign_week':
        return reassignTodayFriendWeek(state, getWeekKey(input.dateKey));
      case 'reassign_partners':
        return reassignTodayFriendPartners(state, input.dateKey);
      case 'assign_pair':
        if (input.firstStudentNumber === undefined || input.secondStudentNumber === undefined) throw new TodayFriendClientError('INVALID_PARTNER_PAIR');
        return assignTodayFriendPair(state, { dateKey: input.dateKey, firstStudentNumber: input.firstStudentNumber, secondStudentNumber: input.secondStudentNumber });
      case 'select_question':
        if (input.questionId === undefined) throw new TodayFriendClientError('QUESTION_NOT_AVAILABLE');
        return selectTodayFriendQuestion(state, input.dateKey, input.questionId);
    }
  }));
};

export const updateTeacherTodayFriendQuestions = (
  dateKey: string,
  questions: TodayFriendState['questions'],
): Promise<TodayFriendState> => {
  if (appDataMode !== 'mock') {
    return request('/api/today-friend', {
      method: 'POST',
      body: JSON.stringify({ action: 'replace_questions', dateKey, questions }),
    }).then(parseTodayFriendState);
  }
  return Promise.resolve(updateLocalTodayFriendState((state) => ({ ...state, questions })));
};

export const loadTodayFriendSubmissionReceipt = async (requestId: string, command?: Record<string, unknown>): Promise<{ readonly found: boolean; readonly submission: TodayFriendSubmission | null }> => {
  if (appDataMode === 'mock') return { found: false, submission: null };
  const actor = captureStorageResponseContext().actor;
  const query = new URLSearchParams({ ...(command ? { receiptOnly: '1' } : {}), requestId, ...(actor !== null && Number(actor) > 0 ? { expectedStudentNumber: actor } : {}) });
  const value = await request(`/api/today-friend?${query}`);
  if (!isRecord(value)) throw new TodayFriendClientError('TODAY_FRIEND_INVALID_RESPONSE');
  if (command) {
    if (value.status === 'unknown') return { found: false, submission: null };
    const mission = isRecord(command.expectedMission) ? command.expectedMission : null;
    const payload = { action: command.action, dateKey: command.dateKey, payload: command.payload, expectedRevision: command.expectedRevision,
      ...(mission ? { expectedMission: { partnerNumber: mission.partnerNumber, genre: mission.genre, question: mission.question } } : {}) };
    if (value.status !== 'committed' || value.action !== 'today_friend_submission'
      || value.payloadHash !== await featurePayloadHash('today_friend_submission', payload)
      || typeof value.committedAt !== 'string' || !Number.isFinite(Date.parse(value.committedAt))) throw new TodayFriendClientError('TODAY_FRIEND_REQUEST_REUSED', 409);
    const submission = parseTodayFriendSubmission(value.result);
    const actor = Number(captureStorageResponseContext().actor);
    if (!submission || submission.dateKey !== command.dateKey || (actor > 0 && submission.studentNumber !== actor)
      || (mission && submission.partnerNumber !== mission.partnerNumber)) throw new TodayFriendClientError('TODAY_FRIEND_INVALID_RESPONSE');
    invalidateSharedSettingsCache();
    return { found: true, submission };
  }
  if (typeof value.found !== 'boolean') throw new TodayFriendClientError('TODAY_FRIEND_INVALID_RESPONSE');
  const submission = value.submission === null ? null : parseTodayFriendSubmission(value.submission);
  if (value.found && !submission) throw new TodayFriendClientError('TODAY_FRIEND_INVALID_RESPONSE');
  if (value.found) invalidateSharedSettingsCache();
  return { found: value.found, submission };
};

const recoveryDrafts = createTodayFriendSubmissionDraftStore();
const pendingTodayFriendFor = async (actor: number, id: string) => {
  const context = captureStorageResponseContext();
  if (context.actor !== null && context.actor !== String(actor)) throw new StorageResponseActorChangedError();
  const pending = (await recoveryDrafts.list(actor)).find((entry) => entry.pending.requestId === id);
  if (!isStorageResponseContextCurrent(context)) throw new StorageResponseActorChangedError();
  return pending;
};
registerSaveRecoveryAdapter({
  id: 'today-friend',
  list: async (actor) => appDataMode !== 'production' ? [] : (await recoveryDrafts.list(actor)).map(({ draft, mission, pending }) => ({
    id: draft.requestId, actor, feature: 'todayFriend', createdAt: draft.createdAt, mode: pending.expectedStudentNumber === actor ? 'automatic' : 'confirm-only', contextKey: mission.dateKey,
  })),
  eligible: request => request.actor > 0 && request.contextKey === getTodayFriendDateKey(),
  confirm: async (entry) => {
    const stored = await pendingTodayFriendFor(entry.actor, entry.id);
    if (!stored) return true;
    const { mission, pending } = stored;
    const command = todayFriendSubmissionCommand({ mission: { ...mission, planningRevision: pending.planningRevision }, ...pending }, pending.submit);
    const receipt = await loadTodayFriendSubmissionReceipt(entry.id, command);
    if (!receipt.found) return false;
    await recoveryDrafts.confirm(mission, entry.id);
    return true;
  },
  retry: async (entry) => {
    const stored = await pendingTodayFriendFor(entry.actor, entry.id);
    if (!stored) return;
    const { mission, pending } = stored;
    if (mission.dateKey !== getTodayFriendDateKey()) throw new TodayFriendClientError('TODAY_FRIEND_MISSION_CHANGED', 409);
    const current = await loadStudentTodayFriendMission(entry.actor, mission.dateKey);
    if (!current || current.partnerNumber !== mission.partnerNumber || current.genre !== mission.genre || current.question !== mission.question
      || current.planningRevision !== pending.planningRevision) throw new TodayFriendClientError('TODAY_FRIEND_MISSION_CHANGED', 409);
    const input = { mission: { ...mission, planningRevision: pending.planningRevision }, ...pending };
    if (pending.submit) await submitStudentTodayFriendMission(input);
    else await saveStudentTodayFriendDraft(input);
    await recoveryDrafts.confirm(mission, entry.id);
  },
});
