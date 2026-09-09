import { requiresStudentEditRevisions } from '../src/server/storageClientContract.js';
import {
  TodayFriendDomainError,
  getTodayFriendDateKey,
} from '../src/lib/todayFriend.js';
import {
  assignTodayFriendPair,
  ensureTodayFriendDay,
  reassignTodayFriendPartners,
  reassignTodayFriendWeek,
  selectTodayFriendQuestion,
} from '../src/lib/todayFriendState.js';
import { getKoreanIsoWeekKey } from '../src/lib/weeklyMission.js';
import { getDeviceSession, type DeviceSession, type RequestHeaders } from '../src/server/deviceSession.js';
import { consumeRequestRateLimit, isCrossSiteRequest } from '../src/server/requestRateLimit.js';
import {
  isTodayFriendDateKey,
  parseTodayFriendAction,
  TodayFriendApiError,
  type TodayFriendPlanningAction,
} from '../src/server/todayFriendRequest.js';
import {
  approveTodayFriendSubmissionReward,
  loadTodayFriendMission,
  loadTodayFriendPlanningState,
  loadTodayFriendState,
  loadTodayFriendSubmission,
  requestTodayFriendSubmissionRevision,
  saveTodayFriendDraft,
  storeTodayFriendPlanningState,
  loadTodayFriendSaveReceipt,
  loadTodayFriendRequestReceipt,
  TodayFriendRepositoryError,
  type TodayFriendRepositoryConfiguration,
} from '../src/server/todayFriendRepository.js';

type QueryValue = string | readonly string[] | undefined;

interface ApiRequest {
  readonly method?: string;
  readonly body?: unknown;
  readonly headers?: RequestHeaders;
  readonly query?: Readonly<Record<string, QueryValue>>;
}

interface ApiResponse {
  setHeader: (name: string, value: string) => void;
  status: (statusCode: number) => ApiResponse;
  json: (body: unknown) => void;
}

const getConfiguration = (): (TodayFriendRepositoryConfiguration & { readonly sessionSecret: string }) | null => {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sessionSecret = process.env.DEVICE_SESSION_SECRET;
  return url && key && sessionSecret && sessionSecret.length >= 32
    ? { url: url.replace(/\/$/, ''), key, sessionSecret }
    : null;
};

const requireTeacher = (session: DeviceSession): void => {
  if (session.role !== 'teacher') throw new TodayFriendApiError(403, 'TEACHER_REQUIRED');
};

const handleGet = async (
  request: ApiRequest,
  response: ApiResponse,
  configuration: TodayFriendRepositoryConfiguration,
  session: DeviceSession,
): Promise<void> => {
  const expectedStudent = request.query?.expectedStudentNumber;
  if (expectedStudent !== undefined && (session.role !== 'student' || expectedStudent !== String(session.studentNumber))) throw new TodayFriendApiError(403, 'STUDENT_FORBIDDEN');
  if (typeof request.query?.requestId === 'string') {
    if (session.role !== 'student') throw new TodayFriendApiError(403, 'STUDENT_REQUIRED');
    if (!request.query.requestId.trim() || request.query.requestId.length > 200) throw new TodayFriendApiError(400, 'INVALID_REQUEST_ID');
    if (request.query.receiptOnly === '1') {
      response.status(200).json(await loadTodayFriendRequestReceipt(configuration, `student:${session.studentNumber}`, request.query.requestId) ?? { status: 'unknown' });
      return;
    }
    const submission = await loadTodayFriendSaveReceipt(configuration, `student:${session.studentNumber}`, request.query.requestId);
    response.status(200).json({ found: submission !== null, submission });
    return;
  }
  const dateKey = typeof request.query?.dateKey === 'string' ? request.query.dateKey : getTodayFriendDateKey();
  if (!isTodayFriendDateKey(dateKey)) throw new TodayFriendApiError(400, 'INVALID_DATE');
  if (request.query?.teacher === '1') {
    requireTeacher(session);
    response.status(200).json(await loadTodayFriendState(configuration, dateKey));
    return;
  }
  if (session.role !== 'student') throw new TodayFriendApiError(403, 'STUDENT_REQUIRED');
  response.status(200).json(await loadTodayFriendMission(configuration, dateKey, session.studentNumber));
};

const updatePlan = async (
  configuration: TodayFriendRepositoryConfiguration,
  action: TodayFriendPlanningAction,
): Promise<void> => {
  const expectedState = await loadTodayFriendPlanningState(configuration, action.dateKey);
  const state = ensureTodayFriendDay(expectedState, getKoreanIsoWeekKey(new Date(`${action.dateKey}T12:00:00+09:00`)), action.dateKey);
  switch (action.type) {
    case 'reassign_week':
      await storeTodayFriendPlanningState(configuration, reassignTodayFriendWeek(state, getKoreanIsoWeekKey(new Date(`${action.dateKey}T12:00:00+09:00`))), expectedState);
      return;
    case 'reassign_partners':
      await storeTodayFriendPlanningState(configuration, reassignTodayFriendPartners(state, action.dateKey), expectedState);
      return;
    case 'assign_pair':
      await storeTodayFriendPlanningState(configuration, assignTodayFriendPair(state, action), expectedState);
      return;
    case 'select_question':
      await storeTodayFriendPlanningState(configuration, selectTodayFriendQuestion(state, action.dateKey, action.questionId), expectedState);
      return;
    case 'replace_questions':
      await storeTodayFriendPlanningState(configuration, { ...state, questions: action.questions }, expectedState);
      return;
  }
};

const handlePost = async (
  request: ApiRequest,
  response: ApiResponse,
  configuration: TodayFriendRepositoryConfiguration,
  session: DeviceSession,
): Promise<void> => {
  const action = parseTodayFriendAction(request.body);
  if (action.type === 'save_draft' || action.type === 'submit') {
    if (session.role !== 'student') throw new TodayFriendApiError(403, 'STUDENT_REQUIRED');
    const raw: unknown = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    const expectedStudent = raw && typeof raw === 'object' ? Reflect.get(raw, 'expectedStudentNumber') : undefined;
    if (expectedStudent === undefined && requiresStudentEditRevisions()) throw new TodayFriendApiError(426, 'STORAGE_PROTOCOL_UPGRADE_REQUIRED');
    if (expectedStudent !== undefined && expectedStudent !== session.studentNumber) throw new TodayFriendApiError(403, 'STUDENT_FORBIDDEN');
    const requestPayload = { action: action.type, dateKey: action.dateKey, payload: action.payload, expectedRevision: action.expectedRevision, ...(action.expectedMission ? { expectedMission: { partnerNumber: action.expectedMission.partnerNumber, genre: action.expectedMission.genre, question: action.expectedMission.question } } : {}) };
    const actorKey = `student:${session.studentNumber}`;
    const prior = await loadTodayFriendSaveReceipt(configuration, actorKey, action.requestId, requestPayload);
    if (prior) { response.status(200).json(prior); return; }
    try {
      const mission = await loadTodayFriendMission(configuration, action.dateKey, session.studentNumber);
      if (action.expectedMission && (action.expectedMission.partnerNumber !== mission.partnerNumber || action.expectedMission.genre !== mission.genre || action.expectedMission.question !== mission.question || (action.expectedMission.planningRevision !== undefined && action.expectedMission.planningRevision !== mission.planningRevision))) throw new TodayFriendApiError(409, 'TODAY_FRIEND_SUBMISSION_CONFLICT');
      response.status(200).json(await saveTodayFriendDraft(configuration, mission, action.payload, {
        expectedRevision: action.expectedRevision, requestId: action.requestId, actorKey, requestPayload,
      }, action.type === 'submit'));
    } catch (error) {
      if (error instanceof TodayFriendDomainError || (error instanceof TodayFriendApiError || error instanceof TodayFriendRepositoryError)
        && [400, 409, 422].includes(error.status) && !['STORAGE_REQUEST_REUSED', 'STORAGE_REQUEST_PAYLOAD_MISMATCH'].includes(error.code)) {
        let confirmed;
        try { confirmed = await loadTodayFriendSaveReceipt(configuration, actorKey, action.requestId, requestPayload); }
        catch { throw new TodayFriendRepositoryError(502, 'TODAY_FRIEND_CONFIRMATION_UNAVAILABLE'); }
        if (confirmed) { response.status(200).json(confirmed); return; }
      }
      throw error;
    }
    return;
  }
  requireTeacher(session);
  if (action.type === 'review') {
    const reviewPayload = { submissionId: action.submissionId, decision: action.decision, feedback: action.feedback, expectedRevision: action.expectedRevision };
    const prior = await loadTodayFriendSaveReceipt(configuration, 'teacher:0', action.requestId, reviewPayload);
    if (prior) { response.status(200).json(await loadTodayFriendState(configuration, prior.dateKey)); return; }
    const submission = await loadTodayFriendSubmission(configuration, action.submissionId);
    if ((submission.storageRevision ?? 0) !== action.expectedRevision && submission.status !== 'approved') throw new TodayFriendApiError(409, 'TODAY_FRIEND_SUBMISSION_CONFLICT');
    if (action.decision === 'revision_requested') {
      await requestTodayFriendSubmissionRevision(configuration, submission, action.feedback, { expectedRevision: action.expectedRevision, requestId: action.requestId, actorKey: 'teacher:0', requestPayload: reviewPayload });
    } else {
      await approveTodayFriendSubmissionReward(configuration, submission.id, action.expectedRevision);
    }
    response.status(200).json(await loadTodayFriendState(configuration, submission.dateKey));
    return;
  }
  await updatePlan(configuration, action);
  response.status(200).json(await loadTodayFriendState(configuration, action.dateKey));
};

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  response.setHeader('Cache-Control', 'no-store');
  const configuration = getConfiguration();
  if (!configuration) return void response.status(503).json({ error: 'TODAY_FRIEND_NOT_CONFIGURED' });
  const session = getDeviceSession(request.headers, configuration.sessionSecret);
  if (!session) return void response.status(401).json({ error: 'DEVICE_REGISTRATION_REQUIRED' });
  if (request.method !== 'GET' && isCrossSiteRequest(request.headers)) {
    return void response.status(403).json({ error: 'CROSS_SITE_REQUEST_BLOCKED' });
  }
  if (request.method !== 'GET') {
    const rateLimit = consumeRequestRateLimit('today-friend-write', request.headers, session.role === 'student' ? session.studentNumber : 0);
    if (!rateLimit.allowed) {
      response.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
      return void response.status(429).json({ error: 'TOO_MANY_REQUESTS' });
    }
  }
  try {
    if (request.method === 'GET') return void await handleGet(request, response, configuration, session);
    if (request.method === 'POST') return void await handlePost(request, response, configuration, session);
    response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    if (error instanceof TodayFriendApiError || error instanceof TodayFriendRepositoryError) {
      response.status(error.status).json({ error: error.code });
      return;
    }
    if (error instanceof TodayFriendDomainError) {
      response.status(400).json({ error: error.code });
      return;
    }
    console.error('Today friend request failed.', error);
    response.status(500).json({ error: 'TODAY_FRIEND_REQUEST_FAILED' });
  }
}
