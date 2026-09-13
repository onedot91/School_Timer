import { getDeviceSession, type RequestHeaders } from '../src/server/deviceSession.js';
import { consumeRequestRateLimit, isCrossSiteRequest } from '../src/server/requestRateLimit.js';
import { loadNewspaperData, newspaperRpc } from '../src/server/newspaperRepository.js';
import { NEWSPAPER_CONFIG, NewspaperError, isQuestionRecord, isQuestionStudent, isQuestionType, isQuestionMode, isQuestionUuid, normalizeQuestionText, questionValidationCode, weekMonday } from '../src/lib/newspaperQuestion.js';
import { getKoreanIsoWeekKey } from '../src/lib/weeklyMission.js';

interface Request { method?: string; body?: unknown; query?: Record<string, unknown>; headers?: RequestHeaders }
interface Response { setHeader(name: string, value: string): void; status(code: number): Response; json(body: unknown): void }
const listFromEnv = (key: string) => (process.env[key] ?? '').split(',').map(word => word.trim()).filter(Boolean);
export default async function handler(request: Request, response: Response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Allow', 'GET, POST');
  if (request.method !== 'GET' && request.method !== 'POST') { response.status(405).json({ error: 'METHOD_NOT_ALLOWED' }); return; }
  const secret = process.env.DEVICE_SESSION_SECRET;
  if (!secret || secret.length < 32) { response.status(503).json({ error: 'DEVICE_SECURITY_NOT_CONFIGURED' }); return; }
  const session = getDeviceSession(request.headers, secret);
  if (!session) { response.status(401).json({ error: 'DEVICE_REGISTRATION_REQUIRED' }); return; }
  const actor = session.role === 'teacher' ? NEWSPAPER_CONFIG.teacherNumber : session.studentNumber;
  if (request.method === 'POST' && isCrossSiteRequest(request.headers)) { response.status(403).json({ error: 'CROSS_SITE_REQUEST_BLOCKED' }); return; }
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { response.status(503).json({ error: 'QUESTION_NOT_CONFIGURED' }); return; }
  try {
    if (request.method === 'GET') {
      const week = request.query?.weekKey ?? getKoreanIsoWeekKey();
      if (typeof week !== 'string') throw new NewspaperError('QUESTION_INVALID_WEEK');
      weekMonday(week);
      if (session.role === 'student' && week !== getKoreanIsoWeekKey()) throw new NewspaperError('QUESTION_WEEK_CHANGED', 409);
      const data = await loadNewspaperData({ url, key }, actor, week);
      response.status(200).json({ ...data,
        weeks: session.role === 'teacher' ? data.weeks : [week],
        questions: data.questions.filter(row => row.week_key === week).map(row => session.role === 'teacher' ? row : { ...row, downloaded_at: null }),
        history: data.history.filter(row => row.student_number === actor).map(row => ({ ...row, downloaded_at: null })),
        topics: data.topics.filter(row => session.role === 'teacher' || row.week_key === week),
      });
      return;
    }
    const limit = consumeRequestRateLimit('newspaper', request.headers, actor);
    if (!limit.allowed) { response.setHeader('Retry-After', String(limit.retryAfterSeconds)); response.status(429).json({ error: 'TOO_MANY_REQUESTS' }); return; }
    const serialized = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
    if (!serialized || Buffer.byteLength(serialized, 'utf8') > 8192) throw new NewspaperError('QUESTION_INVALID_BODY');
    let body: unknown;
    try { body = JSON.parse(serialized); } catch { throw new NewspaperError('QUESTION_INVALID_BODY'); }
    if (!isQuestionRecord(body) || !isQuestionUuid(body.requestId) || !isQuestionRecord(body.command)) throw new NewspaperError('QUESTION_INVALID_BODY');
    const command = body.command;
    if (typeof command.action !== 'string' || !['submit', 'update', 'delete', 'topic', 'download', 'reset'].includes(command.action)) throw new NewspaperError('QUESTION_INVALID_ACTION');
    if (session.role !== 'teacher' && command.action !== 'submit') throw new NewspaperError('QUESTION_FORBIDDEN', 403);
    if (command.action === 'submit' && (session.role !== 'student' || !isQuestionStudent(command.studentNumber) || command.studentNumber !== actor)) throw new NewspaperError('STUDENT_NUMBER_MISMATCH', 403);
    if (['submit', 'topic', 'download'].includes(command.action)) {
      if (typeof command.weekKey !== 'string') throw new NewspaperError('QUESTION_INVALID_WEEK');
      weekMonday(command.weekKey);
      if (command.action === 'submit' && command.weekKey !== getKoreanIsoWeekKey()) throw new NewspaperError('QUESTION_WEEK_CHANGED', 409);
    }
    if (['submit', 'update'].includes(command.action)) {
      if (typeof command.questionText !== 'string') throw new NewspaperError('QUESTION_EMPTY');
      const code = questionValidationCode(command.questionText, { privateWords: listFromEnv('NEWSPAPER_PRIVATE_WORDS'), blockedWords: [...NEWSPAPER_CONFIG.blockedWords, ...listFromEnv('NEWSPAPER_BLOCKED_WORDS')] });
      if (code) throw new NewspaperError(code);
      command.questionText = normalizeQuestionText(command.questionText);
    }
    if (command.action === 'submit' && !isQuestionType(command.questionType)) throw new NewspaperError('QUESTION_INVALID_TYPE');
    if (command.action === 'submit' && command.questionType === 'topic' && (typeof command.topicRevision !== 'string' || !Number.isFinite(Date.parse(command.topicRevision)))) throw new NewspaperError('QUESTION_TOPIC_REQUIRED');
    if (['submit', 'update', 'delete', 'topic'].includes(command.action) && command.expectedUpdatedAt !== null
      && (typeof command.expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(command.expectedUpdatedAt)))) throw new NewspaperError('QUESTION_INVALID_REVISION');
    if (['update', 'delete'].includes(command.action) && !isQuestionUuid(command.id)) throw new NewspaperError('QUESTION_INVALID_ID');
    if (command.action === 'topic') {
      if (typeof command.topicText !== 'string' || !command.topicText.trim() || [...command.topicText.trim()].length > NEWSPAPER_CONFIG.topicMaxLength) throw new NewspaperError('QUESTION_TOPIC_INVALID');
      command.topicText = command.topicText.trim();
    }
    if (command.action === 'download' && (!isQuestionMode(command.mode) || typeof command.cumulative !== 'boolean')) throw new NewspaperError('QUESTION_INVALID_ACTION');
    if (command.action === 'reset' && command.confirmation !== '모든 기록 초기화') throw new NewspaperError('QUESTION_FORBIDDEN', 403);
    response.status(200).json(await newspaperRpc({ url, key }, 'newspaper_command', { p_actor: actor, p_request_id: body.requestId, p_command: command }));
  } catch (error) {
    const known = error instanceof NewspaperError;
    response.status(known ? error.status : 502).json({ error: known ? error.code : 'QUESTION_DATABASE_FAILED' });
  }
}
