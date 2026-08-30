import {
  TodayFriendDomainError,
  getTodayFriendDateKey,
} from '../src/lib/todayFriend.js';
import {
  assignTodayFriendPair,
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
  submitTodayFriendDraft,
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
  const state = await loadTodayFriendPlanningState(configuration, action.dateKey);
  switch (action.type) {
    case 'reassign_week':
      await storeTodayFriendPlanningState(configuration, reassignTodayFriendWeek(state, getKoreanIsoWeekKey(new Date(`${action.dateKey}T12:00:00+09:00`))));
      return;
    case 'reassign_partners':
      await storeTodayFriendPlanningState(configuration, reassignTodayFriendPartners(state, action.dateKey));
      return;
    case 'assign_pair':
      await storeTodayFriendPlanningState(configuration, assignTodayFriendPair(state, action));
      return;
    case 'select_question':
      await storeTodayFriendPlanningState(configuration, selectTodayFriendQuestion(state, action.dateKey, action.questionId));
      return;
    case 'replace_questions':
      await storeTodayFriendPlanningState(configuration, { ...state, questions: action.questions });
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
  if (action.type === 'save_draft') {
    if (session.role !== 'student') throw new TodayFriendApiError(403, 'STUDENT_REQUIRED');
    const mission = await loadTodayFriendMission(configuration, action.dateKey, session.studentNumber);
    response.status(200).json(await saveTodayFriendDraft(configuration, mission, action.payload));
    return;
  }
  if (action.type === 'submit') {
    if (session.role !== 'student') throw new TodayFriendApiError(403, 'STUDENT_REQUIRED');
    response.status(200).json(await submitTodayFriendDraft(configuration, action.dateKey, session.studentNumber));
    return;
  }
  requireTeacher(session);
  if (action.type === 'review') {
    const submission = await loadTodayFriendSubmission(configuration, action.submissionId);
    if (action.decision === 'revision_requested') {
      await requestTodayFriendSubmissionRevision(configuration, submission, action.feedback);
    } else {
      await approveTodayFriendSubmissionReward(configuration, submission.id);
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
