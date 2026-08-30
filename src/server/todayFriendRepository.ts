import {
  requestTodayFriendRevision,
  submitTodayFriendSubmission,
  type TodayFriendPayload,
  type TodayFriendSubmission,
} from '../lib/todayFriend.js';
import {
  ensureTodayFriendDay,
  getTodayFriendStudentMission,
  saveTodayFriendSubmission,
  TODAY_FRIEND_INITIAL_STATE,
  type TodayFriendState,
  type TodayFriendStudentMission,
} from '../lib/todayFriendState.js';
import { getKoreanIsoWeekKey } from '../lib/weeklyMission.js';
import {
  parseTodayFriendPlanningRow,
  parseTodayFriendRows,
  parseTodayFriendSubmissionRow,
  serializeTodayFriendSubmission,
  toTodayFriendPlanningState,
  TodayFriendRowError,
} from './todayFriendRows.js';

export type TodayFriendRepositoryConfiguration = {
  readonly url: string;
  readonly key: string;
};

export class TodayFriendRepositoryError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code);
    this.name = 'TodayFriendRepositoryError';
    this.status = status;
    this.code = code;
  }
}

const headers = (key: string, content = false): Record<string, string> => ({
  Accept: 'application/json',
  apikey: key,
  Authorization: `Bearer ${key}`,
  ...(content ? { 'Content-Type': 'application/json' } : {}),
});

const request = async (
  configuration: TodayFriendRepositoryConfiguration,
  path: string,
  init?: RequestInit,
): Promise<unknown> => {
  const response = await fetch(`${configuration.url}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers(configuration.key, init?.body !== undefined), ...init?.headers },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new TodayFriendRepositoryError(502, `TODAY_FRIEND_DATABASE_HTTP_${response.status}`);
  if (response.status === 204) return null;
  const text = await response.text();
  return text.length === 0 ? null : JSON.parse(text);
};

const getWeekKey = (dateKey: string): string => (
  getKoreanIsoWeekKey(new Date(`${dateKey}T12:00:00+09:00`))
);

const savePlanningState = async (
  configuration: TodayFriendRepositoryConfiguration,
  state: TodayFriendState,
): Promise<void> => {
  await request(configuration, 'today_friend_settings?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ id: 'main', state: toTodayFriendPlanningState(state), updated_at: new Date().toISOString() }),
  });
};

export const loadTodayFriendPlanningState = async (
  configuration: TodayFriendRepositoryConfiguration,
  dateKey: string,
): Promise<TodayFriendState> => {
  try {
    const value = await request(configuration, 'today_friend_settings?id=eq.main&select=state');
    const current = parseTodayFriendPlanningRow(value) ?? TODAY_FRIEND_INITIAL_STATE;
    const hasWeek = current.weeks.some((week) => week.weekKey === getWeekKey(dateKey));
    const hasPartnerDay = current.partnerDays.some((day) => day.dateKey === dateKey);
    if (hasWeek && hasPartnerDay) return current;
    const prepared = ensureTodayFriendDay(current, getWeekKey(dateKey), dateKey);
    await savePlanningState(configuration, prepared);
    return prepared;
  } catch (error) {
    if (error instanceof TodayFriendRowError) {
      throw new TodayFriendRepositoryError(502, error.code);
    }
    throw error;
  }
};

const loadSubmissionRows = async (
  configuration: TodayFriendRepositoryConfiguration,
  filter: string,
): Promise<readonly TodayFriendSubmission[]> => {
  try {
    const value = await request(
      configuration,
      `today_friend_submissions?${filter}&select=id,submission_date,student_number,partner_number,genre,payload,status,revision,teacher_feedback,submitted_at,reviewed_at,reward_status&order=student_number.asc`,
    );
    return parseTodayFriendRows(value).map(parseTodayFriendSubmissionRow);
  } catch (error) {
    if (error instanceof TodayFriendRowError) {
      throw new TodayFriendRepositoryError(502, error.code);
    }
    throw error;
  }
};

export const loadTodayFriendState = async (
  configuration: TodayFriendRepositoryConfiguration,
  dateKey: string,
): Promise<TodayFriendState> => {
  const planning = await loadTodayFriendPlanningState(configuration, dateKey);
  const submissions = await loadSubmissionRows(configuration, `submission_date=eq.${encodeURIComponent(dateKey)}`);
  return { ...planning, submissions };
};

export const loadTodayFriendMission = async (
  configuration: TodayFriendRepositoryConfiguration,
  dateKey: string,
  studentNumber: number,
): Promise<TodayFriendStudentMission> => (
  getTodayFriendStudentMission(await loadTodayFriendState(configuration, dateKey), dateKey, studentNumber)
);

const persistSubmission = async (
  configuration: TodayFriendRepositoryConfiguration,
  submission: TodayFriendSubmission,
): Promise<TodayFriendSubmission> => {
  const value = await request(configuration, 'today_friend_submissions?on_conflict=submission_date,student_number&select=id,submission_date,student_number,partner_number,genre,payload,status,revision,teacher_feedback,submitted_at,reviewed_at,reward_status', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(serializeTodayFriendSubmission(submission)),
  });
  const row = parseTodayFriendRows(value)[0];
  if (!row) throw new TodayFriendRepositoryError(502, 'TODAY_FRIEND_DATABASE_INVALID_RESPONSE');
  return parseTodayFriendSubmissionRow(row);
};

export const saveTodayFriendDraft = async (
  configuration: TodayFriendRepositoryConfiguration,
  mission: TodayFriendStudentMission,
  payload: TodayFriendPayload,
): Promise<TodayFriendSubmission> => {
  const state = saveTodayFriendSubmission(
    { ...(await loadTodayFriendState(configuration, mission.dateKey)), submissions: mission.submission ? [mission.submission] : [] },
    { mission, payload },
  );
  const submission = state.submissions.find((entry) => entry.studentNumber === mission.studentNumber);
  if (!submission) throw new TodayFriendRepositoryError(500, 'SUBMISSION_SAVE_FAILED');
  return persistSubmission(configuration, submission);
};

export const submitTodayFriendDraft = async (
  configuration: TodayFriendRepositoryConfiguration,
  dateKey: string,
  studentNumber: number,
): Promise<TodayFriendSubmission> => {
  const submissions = await loadSubmissionRows(
    configuration,
    `submission_date=eq.${encodeURIComponent(dateKey)}&student_number=eq.${studentNumber}`,
  );
  const current = submissions[0];
  if (!current) throw new TodayFriendRepositoryError(404, 'SUBMISSION_NOT_FOUND');
  return persistSubmission(configuration, submitTodayFriendSubmission(current, new Date().toISOString()));
};

export const loadTodayFriendSubmission = async (
  configuration: TodayFriendRepositoryConfiguration,
  submissionId: string,
): Promise<TodayFriendSubmission> => {
  const submissions = await loadSubmissionRows(configuration, `id=eq.${encodeURIComponent(submissionId)}`);
  const submission = submissions[0];
  if (!submission) throw new TodayFriendRepositoryError(404, 'SUBMISSION_NOT_FOUND');
  return submission;
};

export const requestTodayFriendSubmissionRevision = async (
  configuration: TodayFriendRepositoryConfiguration,
  submission: TodayFriendSubmission,
  feedback: string,
): Promise<TodayFriendSubmission> => (
  persistSubmission(configuration, requestTodayFriendRevision(submission, feedback, new Date().toISOString()))
);

export const approveTodayFriendSubmissionReward = async (
  configuration: TodayFriendRepositoryConfiguration,
  submissionId: string,
): Promise<void> => {
  await request(configuration, 'rpc/approve_today_friend_submission', {
    method: 'POST',
    body: JSON.stringify({ p_submission_id: submissionId }),
  });
};

export const storeTodayFriendPlanningState = savePlanningState;
