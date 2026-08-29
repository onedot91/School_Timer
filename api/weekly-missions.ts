import { getKoreanDateKey } from '../src/lib/classword.js';
import {
  CLASSWORD_WORD_ENTRY_WEEKLY_MISSION_TYPE,
  findPersonalQuestionForWeek,
  getWeeklyMissionRewardAmount,
  getKoreanIsoWeekKey,
  parseQuestionStudentResponse,
  parseWeeklyMissionResult,
  PERSONAL_QUESTION_WEEKLY_MISSION_TYPE,
  type WeeklyMissionResult,
  type WeeklyMissionType,
} from '../src/lib/weeklyMission.js';
import { getDeviceSession, type RequestHeaders } from '../src/server/deviceSession.js';
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

interface MissionClaimInput {
  readonly missionType: WeeklyMissionType;
  readonly sourceEventId: string | null;
  readonly rewardKey: string;
}

interface SupabaseConfiguration {
  readonly url: string;
  readonly serviceRoleKey: string;
}

const QUESTION_STUDENT_ENDPOINT = 'https://question-news.vercel.app/api/student';
const getStudentNumber = (body: unknown) => {
  const parsedBody = typeof body === 'string' ? JSON.parse(body) : body;
  if (!parsedBody || typeof parsedBody !== 'object' || !('studentNumber' in parsedBody)) return null;
  const studentNumber = Reflect.get(parsedBody, 'studentNumber');
  return typeof studentNumber === 'number' && Number.isInteger(studentNumber) && studentNumber >= 1 && studentNumber <= 23
    ? studentNumber
    : null;
};

const fetchJson = async (url: URL) => {
  const externalResponse = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!externalResponse.ok) {
    throw new Error(`WEEKLY_MISSION_SOURCE_HTTP_${externalResponse.status}`);
  }
  return externalResponse.json();
};

const loadClasswordEntryId = async (
  configuration: SupabaseConfiguration,
  studentNumber: number,
  dateKey: string,
) => {
  const url = new URL(`${configuration.url.replace(/\/$/, '')}/rest/v1/classword_entries`);
  url.searchParams.set('student_number', `eq.${studentNumber}`);
  url.searchParams.set('round_date', `eq.${dateKey}`);
  url.searchParams.set('select', 'id,round_date');
  url.searchParams.set('order', 'created_at.asc');
  url.searchParams.set('limit', '1');
  const classwordResponse = await fetch(url, {
    headers: {
      Accept: 'application/json',
      apikey: configuration.serviceRoleKey,
      Authorization: `Bearer ${configuration.serviceRoleKey}`,
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!classwordResponse.ok) {
    throw new Error(`CLASSWORD_ENTRY_HTTP_${classwordResponse.status}`);
  }
  const rows = await classwordResponse.json();
  if (!Array.isArray(rows)) throw new Error('CLASSWORD_ENTRY_INVALID_RESPONSE');
  const first = rows[0];
  return first && typeof first === 'object' && typeof Reflect.get(first, 'id') === 'string'
    ? String(Reflect.get(first, 'id'))
    : null;
};

const claimMission = async (
  configuration: SupabaseConfiguration,
  studentNumber: number,
  input: MissionClaimInput,
): Promise<WeeklyMissionResult> => {
  const rpcResponse = await fetch(`${configuration.url.replace(/\/$/, '')}/rest/v1/rpc/claim_weekly_mission_reward`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      apikey: configuration.serviceRoleKey,
      Authorization: `Bearer ${configuration.serviceRoleKey}`,
    },
    body: JSON.stringify({
      p_student_number: studentNumber,
      p_week_key: input.rewardKey,
      p_mission_type: input.missionType,
      p_source_event_id: input.sourceEventId,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!rpcResponse.ok) {
    throw new Error(`WEEKLY_MISSION_RPC_HTTP_${rpcResponse.status}`);
  }
  return parseWeeklyMissionResult(await rpcResponse.json());
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

  const rateLimit = consumeRequestRateLimit('weekly-missions', request.headers, studentNumber);
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
    const dateKey = getKoreanDateKey();
    const configuration = { url: supabaseUrl, serviceRoleKey } satisfies SupabaseConfiguration;
    const questionUrl = new URL(QUESTION_STUDENT_ENDPOINT);
    questionUrl.searchParams.set('studentNumber', String(studentNumber));
    questionUrl.searchParams.set('weekKey', weekKey);
    const [questionResult, classwordResult] = await Promise.allSettled([
      fetchJson(questionUrl).then((value) => findPersonalQuestionForWeek(
        parseQuestionStudentResponse(value),
        studentNumber,
        weekKey,
      )),
      loadClasswordEntryId(
        configuration,
        studentNumber,
        dateKey,
      ),
    ]);
    if (questionResult.status === 'rejected') {
      console.warn('Failed to load personal-question mission evidence.', questionResult.reason);
    }
    if (classwordResult.status === 'rejected') {
      console.warn('Failed to load classword mission evidence.', classwordResult.reason);
    }
    const personalQuestion = questionResult.status === 'fulfilled'
      ? questionResult.value
      : null;
    const classwordEntryId = classwordResult.status === 'fulfilled' ? classwordResult.value : null;
    const claims: readonly MissionClaimInput[] = [
      {
        missionType: PERSONAL_QUESTION_WEEKLY_MISSION_TYPE,
        sourceEventId: personalQuestion?.id ?? null,
        rewardKey: weekKey,
      },
      {
        missionType: CLASSWORD_WORD_ENTRY_WEEKLY_MISSION_TYPE,
        sourceEventId: classwordEntryId,
        rewardKey: dateKey,
      },
    ];
    const claimResults = await Promise.allSettled(claims.map((claim) => (
      claimMission(configuration, studentNumber, claim)
    )));
    const successfulClaims = claimResults.flatMap((result) => (
      result.status === 'fulfilled' ? [result.value] : []
    ));
    if (successfulClaims.length === 0) {
      throw new Error('WEEKLY_MISSION_RPC_ALL_FAILED');
    }
    const fallbackBalance = Math.max(...successfulClaims.map((mission) => mission.balance));
    const missions = claimResults.map((result, index): WeeklyMissionResult => {
      if (result.status === 'fulfilled') return result.value;
      console.warn('Failed to claim one weekly mission reward.', result.reason);
      return {
        missionType: claims[index].missionType,
        weekKey: claims[index].rewardKey,
        completed: false,
        awarded: false,
        rewardAmount: getWeeklyMissionRewardAmount(claims[index].missionType),
        balance: fallbackBalance,
      };
    });

    response.status(200).json({ missions });
  } catch (error) {
    console.error('Failed to sync weekly missions.', error);
    response.status(502).json({ error: 'WEEKLY_MISSIONS_SYNC_FAILED' });
  }
}
