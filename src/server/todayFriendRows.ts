import { parseTodayFriendSubmission, parseTodayFriendState } from '../lib/todayFriendCodec.js';
import type { TodayFriendSubmission } from '../lib/todayFriend.js';
import type { TodayFriendState } from '../lib/todayFriendState.js';

export class TodayFriendRowError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'TodayFriendRowError';
    this.code = code;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

export const parseTodayFriendRows = (value: unknown): readonly Record<string, unknown>[] => {
  if (!Array.isArray(value) || !value.every(isRecord)) {
    throw new TodayFriendRowError('TODAY_FRIEND_DATABASE_INVALID_RESPONSE');
  }
  return value;
};

export const parseTodayFriendPlanningRow = (value: unknown): TodayFriendState | null => {
  const row = parseTodayFriendRows(value)[0];
  return row === undefined ? null : parseTodayFriendState(row.state);
};

export const parseTodayFriendSubmissionRow = (row: unknown): TodayFriendSubmission => {
  if (!isRecord(row)) throw new TodayFriendRowError('TODAY_FRIEND_DATABASE_INVALID_RESPONSE');
  const submission = parseTodayFriendSubmission({
    id: row.id,
    dateKey: row.submission_date,
    studentNumber: row.student_number,
    partnerNumber: row.partner_number,
    genre: row.genre,
    payload: row.payload,
    status: row.status,
    revision: row.revision,
    teacherFeedback: row.teacher_feedback,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    rewardStatus: row.reward_status,
  });
  if (!submission) throw new TodayFriendRowError('TODAY_FRIEND_DATABASE_INVALID_RESPONSE');
  return submission;
};

export const serializeTodayFriendSubmission = (submission: TodayFriendSubmission) => ({
  id: submission.id,
  submission_date: submission.dateKey,
  student_number: submission.studentNumber,
  partner_number: submission.partnerNumber,
  genre: submission.genre,
  payload: submission.payload,
  status: submission.status,
  revision: submission.revision,
  teacher_feedback: submission.teacherFeedback,
  submitted_at: submission.submittedAt,
  reviewed_at: submission.reviewedAt,
  reward_status: submission.rewardStatus,
  updated_at: new Date().toISOString(),
});

export const toTodayFriendPlanningState = (state: TodayFriendState): TodayFriendState => ({
  ...state,
  submissions: [],
});
