import { parseTodayFriendState } from '../lib/todayFriendCodec.js';
import { getStorageReceipt, storagePayloadHash, StorageRepositoryError } from './storageV2Repository.js';
import {
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
  if (!response.ok) {
    const failure: unknown = await response.json().catch(() => null);
    const code: unknown = failure && typeof failure === 'object' ? Reflect.get(failure, 'message') : null;
    if (code === 'STORAGE_MAINTENANCE' || code === 'STORAGE_NOT_ACTIVE') throw new TodayFriendRepositoryError(503, code);
    if (code === 'TODAY_FRIEND_SUBMISSION_CONFLICT' || code === 'TODAY_FRIEND_PLANNING_CONFLICT' || code === 'STORAGE_REQUEST_PAYLOAD_MISMATCH' || code === 'LEGACY_CLIENT_UPDATE_REQUIRED') throw new TodayFriendRepositoryError(409, code);
    if (code === 'SUBMISSION_NOT_EDITABLE' || code === 'SUBMISSION_NOT_REVIEWABLE') throw new TodayFriendRepositoryError(400, code);
    throw new TodayFriendRepositoryError(502, `TODAY_FRIEND_DATABASE_HTTP_${response.status}`);
  }
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
  expectedState: TodayFriendState,
): Promise<void> => {
  await request(configuration, 'rpc/save_today_friend_planning_v2', {
    method: 'POST',
    body: JSON.stringify({ p_state: toTodayFriendPlanningState(state), p_expected: toTodayFriendPlanningState(expectedState), p_protocol_version: 2 }),
  });
};

export const loadTodayFriendPlanningState = async (
  configuration: TodayFriendRepositoryConfiguration,
  _dateKey: string,
): Promise<TodayFriendState> => {
  const value = await request(configuration, 'rpc/load_today_friend_planning_v2', { method: 'POST', body: '{}' });
  return value === null ? TODAY_FRIEND_INITIAL_STATE : parseTodayFriendState(value);
};

const loadSubmissionRows = async (
  configuration: TodayFriendRepositoryConfiguration,
  filter: string,
): Promise<readonly TodayFriendSubmission[]> => {
  try {
    const value = await request(
      configuration,
      `today_friend_submissions?${filter}&select=id,submission_date,student_number,partner_number,genre,payload,status,revision,teacher_feedback,submitted_at,reviewed_at,reward_status,storage_revision&order=student_number.asc`,
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
  const planning = ensureTodayFriendDay(await loadTodayFriendPlanningState(configuration, dateKey), getWeekKey(dateKey), dateKey);
  const submissions = await loadSubmissionRows(configuration, `submission_date=eq.${encodeURIComponent(dateKey)}`);
  return { ...planning, submissions };
};

export const loadTodayFriendMission = async (
  configuration: TodayFriendRepositoryConfiguration,
  dateKey: string,
  studentNumber: number,
): Promise<TodayFriendStudentMission> => {
  const context = await request(configuration, 'rpc/load_today_friend_context_v2', { method: 'POST', body: JSON.stringify({ p_date_key: dateKey, p_week_key: getWeekKey(dateKey) }) });
  if (!context || typeof context !== 'object') throw new TodayFriendRepositoryError(502, 'TODAY_FRIEND_DATABASE_INVALID_RESPONSE');
  const state: unknown = Reflect.get(context, 'state');
  const revision: unknown = Reflect.get(context, 'revision');
  if (typeof revision !== 'string') throw new TodayFriendRepositoryError(502, 'TODAY_FRIEND_DATABASE_INVALID_RESPONSE');
  const planning = ensureTodayFriendDay(state === null ? TODAY_FRIEND_INITIAL_STATE : parseTodayFriendState(state), getWeekKey(dateKey), dateKey);
  const submissions = await loadSubmissionRows(configuration, `submission_date=eq.${encodeURIComponent(dateKey)}&student_number=eq.${studentNumber}`);
  return { ...getTodayFriendStudentMission({ ...planning, submissions }, dateKey, studentNumber), planningRevision: revision };
};

export interface TodayFriendSaveOptions {
  readonly expectedRevision: number;
  readonly requestId: string;
  readonly actorKey: string;
  readonly requestPayload: unknown;
  readonly planningRevision?: string;
}

export const loadTodayFriendSaveReceipt = async (
  configuration: TodayFriendRepositoryConfiguration, actorKey: string, requestId: string, requestPayload?: unknown,
): Promise<TodayFriendSubmission | null> => {
  const receipt = await loadTodayFriendRequestReceipt(configuration, actorKey, requestId, requestPayload);
  return receipt?.result ?? null;
};

export const loadTodayFriendRequestReceipt = async (
  configuration: TodayFriendRepositoryConfiguration, actorKey: string, requestId: string, requestPayload?: unknown,
) => {
  try {
    const receipt = await getStorageReceipt(configuration, actorKey, requestId,
      requestPayload === undefined ? undefined : { action: 'today_friend_submission', payload: requestPayload });
    if (!receipt.found) return null;
    if (receipt.action !== 'today_friend_submission') throw new TodayFriendRepositoryError(409, 'STORAGE_REQUEST_PAYLOAD_MISMATCH');
    const row = parseTodayFriendRows(receipt.result)[0];
    if (!row) throw new TodayFriendRepositoryError(502, 'TODAY_FRIEND_DATABASE_INVALID_RESPONSE');
    return { status: 'committed' as const, action: receipt.action, payloadHash: receipt.payloadHash,
      committedAt: receipt.committedAt, result: parseTodayFriendSubmissionRow(row) };
  } catch (error) {
    if (error instanceof StorageRepositoryError) throw new TodayFriendRepositoryError(error.status, error.code);
    throw error;
  }
};

const persistSubmission = async (
  configuration: TodayFriendRepositoryConfiguration,
  submission: TodayFriendSubmission,
  options: TodayFriendSaveOptions,
): Promise<TodayFriendSubmission> => {
  const value = await request(configuration, 'rpc/persist_today_friend_submission_v2', {
    method: 'POST',
    body: JSON.stringify({ p_submission: serializeTodayFriendSubmission(submission), p_expected_revision: options.expectedRevision,
      p_request_id: options.requestId, p_actor_key: options.actorKey, p_payload_hash: storagePayloadHash('today_friend_submission', options.requestPayload), p_protocol_version: 2, p_expected_plan_revision: options.planningRevision ?? null, p_week_key: getWeekKey(submission.dateKey) }),
  });
  const row = parseTodayFriendRows(value)[0];
  if (!row) throw new TodayFriendRepositoryError(502, 'TODAY_FRIEND_DATABASE_INVALID_RESPONSE');
  return parseTodayFriendSubmissionRow(row);
};

export const saveTodayFriendDraft = async (
  configuration: TodayFriendRepositoryConfiguration,
  mission: TodayFriendStudentMission,
  payload: TodayFriendPayload,
  options: TodayFriendSaveOptions,
  submit = false,
): Promise<TodayFriendSubmission> => {
  if ((mission.submission?.storageRevision ?? 0) !== options.expectedRevision) throw new TodayFriendRepositoryError(409, 'TODAY_FRIEND_SUBMISSION_CONFLICT');
  const state = saveTodayFriendSubmission(
    { ...TODAY_FRIEND_INITIAL_STATE, submissions: mission.submission ? [mission.submission] : [] }, { mission, payload },
  );
  const draft = state.submissions.find((entry) => entry.studentNumber === mission.studentNumber);
  if (!draft) throw new TodayFriendRepositoryError(500, 'SUBMISSION_SAVE_FAILED');
  return persistSubmission(configuration, submit ? submitTodayFriendSubmission(draft, new Date().toISOString()) : draft, { ...options, planningRevision: mission.planningRevision });
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

export const approveTodayFriendSubmissionReward = async (
  configuration: TodayFriendRepositoryConfiguration,
  submissionId: string,
  expectedRevision: number,
): Promise<void> => {
  await request(configuration, 'rpc/approve_today_friend_submission_v2', {
    method: 'POST',
    body: JSON.stringify({ p_submission_id: submissionId, p_protocol_version: 2, p_expected_revision: expectedRevision }),
  });
};

export const storeTodayFriendPlanningState = savePlanningState;
