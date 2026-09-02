import {
  getKoreanDateKey,
  getClasswordEntryRetentionCutoff,
  isClasswordDateKey,
  isClasswordInitial,
  isClasswordMonthKey,
  validateClasswordWord,
} from '../src/lib/classword.js';
import {
  getDailyClasswordQuiz,
  isClasswordQuizAnswerCorrect,
} from '../src/lib/classwordQuiz.js';
import {
  claimClasswordReward,
  claimClasswordQuizReward,
  ClasswordRepositoryError,
  deleteClasswordDateEntries,
  deleteClasswordEntry,
  loadClasswordBoard,
  loadClasswordRounds,
  loadClasswordTopic,
  loadClasswordQuizCompletions,
  loadClasswordQuizRewardAmount,
  loadClasswordUsedTopics,
  pruneClasswordEntries,
  saveClasswordEntry,
  saveClasswordQuizCompletion,
  saveClasswordTopic,
  type ClasswordRepositoryConfiguration,
} from '../src/server/classwordRepository.js';
import { getDeviceSession, type DeviceSession, type RequestHeaders } from '../src/server/deviceSession.js';
import { consumeRequestRateLimit, isCrossSiteRequest } from '../src/server/requestRateLimit.js';

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

type ClasswordAction =
  | {
      readonly type: 'save_entry';
      readonly entryId?: string;
      readonly dateKey: string;
      readonly initial: import('../src/lib/classword.js').ClasswordInitial;
      readonly word: string;
    }
  | { readonly type: 'delete_entry'; readonly entryId: string }
  | { readonly type: 'answer_quiz'; readonly dateKey: string; readonly answer: string }
  | { readonly type: 'save_topic'; readonly dateKey: string; readonly topic: string }
  | { readonly type: 'delete_date_entries'; readonly dateKey: string; readonly confirmation: 'DELETE' };

class ClasswordApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code);
    this.name = 'ClasswordApiError';
    this.status = status;
    this.code = code;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const getQueryString = (value: QueryValue): string | null => (
  typeof value === 'string' ? value : null
);

const parseBody = (body: unknown): Record<string, unknown> => {
  let value: unknown;
  try {
    value = typeof body === 'string' ? JSON.parse(body) : body;
  } catch (error) {
    if (error instanceof SyntaxError) throw new ClasswordApiError(400, 'INVALID_BODY');
    throw error;
  }
  if (!isRecord(value) || Buffer.byteLength(JSON.stringify(value), 'utf8') > 4096) {
    throw new ClasswordApiError(400, 'INVALID_BODY');
  }
  return value;
};

const parseAction = (body: unknown): ClasswordAction => {
  const value = parseBody(body);
  const action = value.action;
  if (action === 'save_entry') {
    if (
      !isClasswordDateKey(value.dateKey)
      || !isClasswordInitial(value.initial)
      || typeof value.word !== 'string'
      || value.word.length > 32
      || (value.entryId !== undefined && (typeof value.entryId !== 'string' || value.entryId.length > 160))
    ) throw new ClasswordApiError(400, 'INVALID_ENTRY');
    return {
      type: action,
      ...(typeof value.entryId === 'string' ? { entryId: value.entryId } : {}),
      dateKey: value.dateKey,
      initial: value.initial,
      word: value.word,
    };
  }
  if (action === 'delete_entry') {
    if (typeof value.entryId !== 'string' || value.entryId.length > 160) {
      throw new ClasswordApiError(400, 'INVALID_ENTRY');
    }
    return { type: action, entryId: value.entryId };
  }
  if (action === 'answer_quiz') {
    if (
      !isClasswordDateKey(value.dateKey)
      || typeof value.answer !== 'string'
      || [...value.answer].length > 20
    ) throw new ClasswordApiError(400, 'INVALID_QUIZ_ANSWER');
    return { type: action, dateKey: value.dateKey, answer: value.answer };
  }
  if (action === 'save_topic') {
    if (!isClasswordDateKey(value.dateKey) || typeof value.topic !== 'string' || [...value.topic.trim()].length > 40) {
      throw new ClasswordApiError(400, 'INVALID_TOPIC');
    }
    return { type: action, dateKey: value.dateKey, topic: value.topic.trim() };
  }
  if (action === 'delete_date_entries') {
    if (!isClasswordDateKey(value.dateKey) || value.confirmation !== 'DELETE') {
      throw new ClasswordApiError(400, 'INVALID_DELETE_CONFIRMATION');
    }
    return { type: action, dateKey: value.dateKey, confirmation: value.confirmation };
  }
  throw new ClasswordApiError(400, 'INVALID_ACTION');
};

const getConfiguration = (): (ClasswordRepositoryConfiguration & { readonly sessionSecret: string }) | null => {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sessionSecret = process.env.DEVICE_SESSION_SECRET;
  return url && key && sessionSecret && sessionSecret.length >= 32
    ? { url: url.replace(/\/$/, ''), key, sessionSecret }
    : null;
};

const requireTeacher = (session: DeviceSession): void => {
  if (session.role !== 'teacher') throw new ClasswordApiError(403, 'TEACHER_REQUIRED');
};

const pruneExpiredEntries = (configuration: ClasswordRepositoryConfiguration): Promise<void> =>
  pruneClasswordEntries(configuration, getClasswordEntryRetentionCutoff());

const handleGet = async (
  request: ApiRequest,
  response: ApiResponse,
  configuration: ClasswordRepositoryConfiguration,
  session: DeviceSession,
): Promise<void> => {
  if (getQueryString(request.query?.quiz) === '1') {
    const dateKey = getQueryString(request.query?.dateKey) ?? getKoreanDateKey();
    if (!isClasswordDateKey(dateKey)) throw new ClasswordApiError(400, 'INVALID_DATE');
    const question = getDailyClasswordQuiz(dateKey);
    const completions = await loadClasswordQuizCompletions(configuration, dateKey, question.id);
    if (session.role === 'teacher') {
      response.status(200).json({
        dateKey,
        question,
        correctStudentNumbers: completions.map((completion) => completion.studentNumber),
      });
      return;
    }
    const completion = completions.find((candidate) => candidate.studentNumber === session.studentNumber);
    const rewardAmount = completion
      ? await loadClasswordQuizRewardAmount(configuration, dateKey, session.studentNumber)
      : null;
    response.status(200).json({
      dateKey,
      question,
      completed: completion !== undefined,
      completedAt: completion?.completedAt ?? null,
      rewardAmount,
    });
    return;
  }
  if (getQueryString(request.query?.usedTopics) === '1') {
    requireTeacher(session);
    await pruneExpiredEntries(configuration);
    response.status(200).json(await loadClasswordUsedTopics(configuration));
    return;
  }
  const monthKey = getQueryString(request.query?.monthKey);
  if (monthKey !== null) {
    requireTeacher(session);
    if (!isClasswordMonthKey(monthKey)) throw new ClasswordApiError(400, 'INVALID_MONTH');
    await pruneExpiredEntries(configuration);
    response.status(200).json(await loadClasswordRounds(configuration, monthKey));
    return;
  }
  const dateKey = getQueryString(request.query?.dateKey) ?? getKoreanDateKey();
  if (!isClasswordDateKey(dateKey)) throw new ClasswordApiError(400, 'INVALID_DATE');
  await pruneExpiredEntries(configuration);
  response.status(200).json(await loadClasswordBoard(configuration, dateKey));
};

const handlePost = async (
  request: ApiRequest,
  response: ApiResponse,
  configuration: ClasswordRepositoryConfiguration,
  session: DeviceSession,
): Promise<void> => {
  const action = parseAction(request.body);
  switch (action.type) {
    case 'save_entry': {
      if (session.role !== 'student') throw new ClasswordApiError(403, 'STUDENT_REQUIRED');
      if (action.dateKey !== getKoreanDateKey()) throw new ClasswordApiError(403, 'TODAY_ONLY');
      await pruneExpiredEntries(configuration);
      const topic = await loadClasswordTopic(configuration, action.dateKey);
      if (!topic.trim()) throw new ClasswordApiError(400, 'CLASSWORD_TOPIC_REQUIRED');
      const validation = validateClasswordWord(action.word, action.initial, topic);
      if (validation.ok === false) throw new ClasswordApiError(400, validation.code);
      const entry = await saveClasswordEntry(configuration, {
        ...(action.entryId ? { entryId: action.entryId } : {}),
        dateKey: action.dateKey,
        initial: action.initial,
        word: validation.word,
        studentNumber: session.studentNumber,
      });
      const reward = await claimClasswordReward(configuration, {
        studentNumber: session.studentNumber,
        entryId: entry.id,
        dateKey: action.dateKey,
      });
      response.status(200).json({ entry, ...reward });
      return;
    }
    case 'delete_entry':
      await pruneExpiredEntries(configuration);
      await deleteClasswordEntry(
        configuration,
        action.entryId,
        session.role === 'student' ? session.studentNumber : null,
        session.role === 'student' ? getKoreanDateKey() : null,
      );
      response.status(200).json({ deleted: true });
      return;
    case 'answer_quiz': {
      if (session.role !== 'student') throw new ClasswordApiError(403, 'STUDENT_REQUIRED');
      if (action.dateKey !== getKoreanDateKey()) throw new ClasswordApiError(403, 'TODAY_ONLY');
      const question = getDailyClasswordQuiz(action.dateKey);
      const existingCompletions = await loadClasswordQuizCompletions(
        configuration,
        action.dateKey,
        question.id,
      );
      const existingCompletion = existingCompletions.find(
        (completion) => completion.studentNumber === session.studentNumber,
      );
      if (existingCompletion) {
        const reward = await claimClasswordQuizReward(configuration, {
          studentNumber: session.studentNumber,
          entryId: question.id,
          dateKey: action.dateKey,
        });
        response.status(200).json({
          correct: true,
          ...reward,
          state: {
            dateKey: action.dateKey,
            question,
            completed: true,
            completedAt: existingCompletion.completedAt,
            rewardAmount: reward.rewardAmount,
          },
        });
        return;
      }
      if (!isClasswordQuizAnswerCorrect(action.dateKey, action.answer)) {
        response.status(200).json({
          correct: false,
          state: {
            dateKey: action.dateKey,
            question,
            completed: false,
            completedAt: null,
            rewardAmount: null,
          },
        });
        return;
      }
      const completion = await saveClasswordQuizCompletion(
        configuration,
        action.dateKey,
        question.id,
        session.studentNumber,
      );
      const reward = await claimClasswordQuizReward(configuration, {
        studentNumber: session.studentNumber,
        entryId: question.id,
        dateKey: action.dateKey,
      });
      response.status(200).json({
        correct: true,
        ...reward,
        state: {
          dateKey: action.dateKey,
          question,
          completed: true,
          completedAt: completion.completedAt,
          rewardAmount: reward.rewardAmount,
        },
      });
      return;
    }
    case 'save_topic':
      requireTeacher(session);
      await pruneExpiredEntries(configuration);
      await saveClasswordTopic(configuration, action.dateKey, action.topic);
      response.status(200).json({ saved: true });
      return;
    case 'delete_date_entries':
      requireTeacher(session);
      await pruneExpiredEntries(configuration);
      await deleteClasswordDateEntries(configuration, action.dateKey);
      response.status(200).json({ deleted: true });
      return;
  }
};

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 'no-store');
  const configuration = getConfiguration();
  if (!configuration) {
    response.status(503).json({ error: 'CLASSWORD_NOT_CONFIGURED' });
    return;
  }
  const session = getDeviceSession(request.headers, configuration.sessionSecret);
  if (!session) {
    response.status(401).json({ error: 'DEVICE_REGISTRATION_REQUIRED' });
    return;
  }
  if (request.method !== 'GET' && isCrossSiteRequest(request.headers)) {
    response.status(403).json({ error: 'CROSS_SITE_REQUEST_BLOCKED' });
    return;
  }
  if (request.method !== 'GET') {
    const rateLimit = consumeRequestRateLimit('classword-write', request.headers, session.role === 'student' ? session.studentNumber : 0);
    if (!rateLimit.allowed) {
      response.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
      response.status(429).json({ error: 'TOO_MANY_REQUESTS' });
      return;
    }
  }
  try {
    if (request.method === 'GET') {
      await handleGet(request, response, configuration, session);
      return;
    }
    if (request.method === 'POST') {
      await handlePost(request, response, configuration, session);
      return;
    }
    response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    if (error instanceof ClasswordApiError || error instanceof ClasswordRepositoryError) {
      response.status(error.status).json({ error: error.code });
      return;
    }
    console.error('Failed to handle classword request.', error);
    response.status(500).json({ error: 'CLASSWORD_REQUEST_FAILED' });
  }
}
