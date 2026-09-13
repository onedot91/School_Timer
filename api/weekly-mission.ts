import {
  getKoreanIsoWeekKey,
  parseWeeklyMissionResult,
} from '../src/lib/weeklyMission.js';
import { getDeviceSession, type RequestHeaders } from '../src/server/deviceSession.js';
import { loadPersonalQuestionEvidence } from '../src/server/newspaperRepository.js';
import { consumeRequestRateLimit, isCrossSiteRequest } from '../src/server/requestRateLimit.js';

interface ApiRequest {
  method?: string;
  body?: unknown;
  headers?: RequestHeaders;
}

interface ApiResponse {
  setHeader: (name: string, value: string) => void;
  status: (statusCode: number) => ApiResponse;
  json: (body: unknown) => void;
}


const getStudentNumber = (body: unknown) => {
  const parsedBody = typeof body === 'string' ? JSON.parse(body) : body;
  if (!parsedBody || typeof parsedBody !== 'object' || !('studentNumber' in parsedBody)) return null;
  const studentNumber = Reflect.get(parsedBody, 'studentNumber');
  return typeof studentNumber === 'number' && Number.isInteger(studentNumber) && studentNumber >= 1 && studentNumber <= 23
    ? studentNumber
    : null;
};

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method !== 'POST') {
    response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  if (isCrossSiteRequest(request.headers)) {
    response.status(403).json({ error: 'CROSS_SITE_REQUEST_BLOCKED' });
    return;
  }

  const sessionSecret = process.env.DEVICE_SESSION_SECRET;
  if (!sessionSecret || sessionSecret.length < 32) {
    response.status(503).json({ error: 'DEVICE_SECURITY_NOT_CONFIGURED' });
    return;
  }
  const deviceSession = getDeviceSession(request.headers, sessionSecret);
  if (!deviceSession) {
    response.status(401).json({ error: 'DEVICE_REGISTRATION_REQUIRED' });
    return;
  }

  let studentNumber: number | null = null;
  try {
    studentNumber = getStudentNumber(request.body);
  } catch {
    response.status(400).json({ error: 'INVALID_BODY' });
    return;
  }

  if (studentNumber === null) {
    response.status(400).json({ error: 'INVALID_STUDENT_NUMBER' });
    return;
  }
  if (deviceSession.role === 'student' && deviceSession.studentNumber !== studentNumber) {
    response.status(403).json({ error: 'STUDENT_NUMBER_MISMATCH' });
    return;
  }

  const parsedBody: unknown = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
  if (!parsedBody || typeof parsedBody !== 'object' || Reflect.get(parsedBody, 'protocolVersion') !== 2) {
    response.status(409).json({ error: 'LEGACY_CLIENT_UPDATE_REQUIRED' });
    return;
  }

  const rateLimit = consumeRequestRateLimit('weekly-mission', request.headers, studentNumber);
  if (!rateLimit.allowed) {
    response.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
    response.status(429).json({ error: 'TOO_MANY_REQUESTS' });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    response.status(503).json({ error: 'WEEKLY_MISSION_NOT_CONFIGURED' });
    return;
  }

  try {
    const weekKey = getKoreanIsoWeekKey();
    const personalQuestion = await loadPersonalQuestionEvidence({ url: supabaseUrl, key: serviceRoleKey }, studentNumber, weekKey);
    const rpcResponse = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/claim_personal_question_weekly_reward_v2`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        p_protocol_version: 2,
        p_student_number: studentNumber,
        p_week_key: weekKey,
        p_source_question_id: personalQuestion?.id ?? null,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!rpcResponse.ok) {
      throw new Error(`WEEKLY_MISSION_RPC_HTTP_${rpcResponse.status}`);
    }

    response.status(200).json(parseWeeklyMissionResult(await rpcResponse.json()));
  } catch (error) {
    console.error('Failed to sync personal-question weekly mission.', error);
    response.status(502).json({ error: 'WEEKLY_MISSION_SYNC_FAILED' });
  }
}
