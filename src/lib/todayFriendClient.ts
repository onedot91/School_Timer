import { appendCurrencyHistoryEntry, normalizeCurrencyBalances } from './currency';
import { appDataMode } from './dataMode';
import { loadStoredStudentPetSnapshot, storeStudentPetSnapshot } from './studentPet';
import {
  approveTodayFriendSubmission,
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

  constructor(code: string) {
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
    const code = isRecord(value) && typeof value.error === 'string' ? value.error : `TODAY_FRIEND_HTTP_${response.status}`;
    throw new TodayFriendClientError(code);
  }
  return value;
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
  return { dateKey, studentNumber, partnerNumber, genre, question, submission };
};

export const loadStudentTodayFriendMission = async (
  studentNumber: number,
  dateKey: string,
): Promise<TodayFriendStudentMission> => {
  if (appDataMode === 'mock') return getTodayFriendStudentMission(prepareLocalState(dateKey), dateKey, studentNumber);
  return parseMission(await request(`/api/today-friend?dateKey=${encodeURIComponent(dateKey)}`));
};

export const saveStudentTodayFriendDraft = async (input: {
  readonly mission: TodayFriendStudentMission;
  readonly payload: TodayFriendPayload;
}): Promise<TodayFriendSubmission> => {
  if (appDataMode === 'readonly') throw new TodayFriendClientError('BACKEND_WRITE_DISABLED');
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
    body: JSON.stringify({ action: 'save_draft', dateKey: input.mission.dateKey, payload: input.payload }),
  });
  const submission = parseTodayFriendSubmission(value);
  if (!submission) throw new TodayFriendClientError('TODAY_FRIEND_INVALID_RESPONSE');
  return submission;
};

export const submitStudentTodayFriendMission = async (input: {
  readonly mission: TodayFriendStudentMission;
  readonly payload: TodayFriendPayload;
}): Promise<TodayFriendSubmission> => {
  await saveStudentTodayFriendDraft(input);
  if (appDataMode === 'mock') {
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
  const value = await request('/api/today-friend', { method: 'POST', body: JSON.stringify({ action: 'submit', dateKey: input.mission.dateKey }) });
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
}): Promise<TodayFriendState> => {
  if (appDataMode === 'readonly') throw new TodayFriendClientError('BACKEND_WRITE_DISABLED');
  if (appDataMode !== 'mock') {
    return parseTodayFriendState(await request('/api/today-friend', { method: 'POST', body: JSON.stringify({ action: 'review', ...input }) }));
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
