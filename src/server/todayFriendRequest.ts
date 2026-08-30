import type { TodayFriendPayload } from '../lib/todayFriend.js';
import { parseTodayFriendPayload } from '../lib/todayFriendCodec.js';
import type { TodayFriendQuestion } from '../lib/todayFriendState.js';

export type TodayFriendAction =
  | { readonly type: 'save_draft'; readonly dateKey: string; readonly payload: TodayFriendPayload }
  | { readonly type: 'submit'; readonly dateKey: string }
  | { readonly type: 'review'; readonly submissionId: string; readonly decision: 'revision_requested' | 'approved'; readonly feedback: string }
  | { readonly type: 'reassign_week'; readonly dateKey: string }
  | { readonly type: 'reassign_partners'; readonly dateKey: string }
  | { readonly type: 'assign_pair'; readonly dateKey: string; readonly firstStudentNumber: number; readonly secondStudentNumber: number }
  | { readonly type: 'select_question'; readonly dateKey: string; readonly questionId: string }
  | { readonly type: 'replace_questions'; readonly dateKey: string; readonly questions: readonly TodayFriendQuestion[] };

export type TodayFriendPlanningAction = Exclude<
  TodayFriendAction,
  { readonly type: 'save_draft' | 'submit' | 'review' }
>;

export class TodayFriendApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code);
    this.name = 'TodayFriendApiError';
    this.status = status;
    this.code = code;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

export const isTodayFriendDateKey = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const isStudentNumber = (value: unknown): value is number => (
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 23
);

const parseQuestions = (value: unknown): readonly TodayFriendQuestion[] | null => {
  if (!Array.isArray(value) || value.length > 40) return null;
  const questions = value.flatMap((entry): readonly TodayFriendQuestion[] => {
    if (!isRecord(entry)) return [];
    const { id, text, active, usedDateKeys } = entry;
    if (
      typeof id !== 'string'
      || id.length === 0
      || id.length > 160
      || typeof text !== 'string'
      || text.trim().length === 0
      || [...text.trim()].length > 160
      || typeof active !== 'boolean'
      || !Array.isArray(usedDateKeys)
      || !usedDateKeys.every(isTodayFriendDateKey)
    ) return [];
    return [{ id, text: text.trim(), active, usedDateKeys }];
  });
  return questions.length === value.length ? questions : null;
};

const parseBody = (body: unknown): Record<string, unknown> => {
  let value: unknown;
  try {
    value = typeof body === 'string' ? JSON.parse(body) : body;
  } catch (error) {
    if (error instanceof SyntaxError) throw new TodayFriendApiError(400, 'INVALID_BODY');
    throw error;
  }
  if (!isRecord(value) || Buffer.byteLength(JSON.stringify(value), 'utf8') > 8_192) {
    throw new TodayFriendApiError(400, 'INVALID_BODY');
  }
  return value;
};

export const parseTodayFriendAction = (body: unknown): TodayFriendAction => {
  const value = parseBody(body);
  const action = value.action;
  if (action === 'save_draft') {
    const payload = parseTodayFriendPayload(value.payload);
    if (!isTodayFriendDateKey(value.dateKey) || payload === null) throw new TodayFriendApiError(400, 'INVALID_DRAFT');
    return { type: action, dateKey: value.dateKey, payload };
  }
  if (action === 'submit') {
    if (!isTodayFriendDateKey(value.dateKey)) throw new TodayFriendApiError(400, 'INVALID_DATE');
    return { type: action, dateKey: value.dateKey };
  }
  if (action === 'review') {
    if (
      typeof value.submissionId !== 'string'
      || value.submissionId.length > 160
      || (value.decision !== 'revision_requested' && value.decision !== 'approved')
      || typeof value.feedback !== 'string'
      || [...value.feedback].length > 300
    ) throw new TodayFriendApiError(400, 'INVALID_REVIEW');
    return { type: action, submissionId: value.submissionId, decision: value.decision, feedback: value.feedback };
  }
  if (action === 'reassign_week' || action === 'reassign_partners') {
    if (!isTodayFriendDateKey(value.dateKey)) throw new TodayFriendApiError(400, 'INVALID_DATE');
    return { type: action, dateKey: value.dateKey };
  }
  if (action === 'assign_pair') {
    if (!isTodayFriendDateKey(value.dateKey) || !isStudentNumber(value.firstStudentNumber) || !isStudentNumber(value.secondStudentNumber)) {
      throw new TodayFriendApiError(400, 'INVALID_PARTNER_PAIR');
    }
    return { type: action, dateKey: value.dateKey, firstStudentNumber: value.firstStudentNumber, secondStudentNumber: value.secondStudentNumber };
  }
  if (action === 'select_question') {
    if (!isTodayFriendDateKey(value.dateKey) || typeof value.questionId !== 'string' || value.questionId.length > 160) {
      throw new TodayFriendApiError(400, 'QUESTION_NOT_AVAILABLE');
    }
    return { type: action, dateKey: value.dateKey, questionId: value.questionId };
  }
  if (action === 'replace_questions') {
    const questions = parseQuestions(value.questions);
    if (!isTodayFriendDateKey(value.dateKey) || questions === null) throw new TodayFriendApiError(400, 'INVALID_QUESTIONS');
    return { type: action, dateKey: value.dateKey, questions };
  }
  throw new TodayFriendApiError(400, 'INVALID_ACTION');
};
