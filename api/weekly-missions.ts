import { getKoreanDateKey } from '../src/lib/classword.js';
import { getPreviousKoreanDateKey } from '../src/lib/classwordWeeklyMission.js';
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
import {
  loadClasswordEntries,
  loadFinalizedClasswordEntries,
  loadFinalizedClasswordRewardKeys,
  type ClasswordMissionConfiguration,
} from '../src/server/classwordMissionSettlement.js';

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
  readonly studentNumber: number;
  readonly missionType: WeeklyMissionType;
  readonly sourceEventId: string | null;
  readonly rewardKey: string;
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

const claimMission = async (
  configuration: ClasswordMissionConfiguration,
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
      p_student_number: input.studentNumber,
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
    const now = new Date();
    const weekKey = getKoreanIsoWeekKey(now);
    const dateKey = getKoreanDateKey(now);
    const previousDateKey = getPreviousKoreanDateKey(now);
    const configuration = { url: supabaseUrl, serviceRoleKey } satisfies ClasswordMissionConfiguration;
    const questionUrl = new URL(QUESTION_STUDENT_ENDPOINT);
    questionUrl.searchParams.set('studentNumber', String(studentNumber));
    questionUrl.searchParams.set('weekKey', weekKey);
    const [questionResult, todayEntriesResult, finalizedEntriesResult, finalizedRewardKeysResult] = await Promise.allSettled([
      fetchJson(questionUrl).then((value) => findPersonalQuestionForWeek(
        parseQuestionStudentResponse(value),
        studentNumber,
        weekKey,
      )),
      loadClasswordEntries(configuration, dateKey),
      loadFinalizedClasswordEntries(configuration, dateKey),
      loadFinalizedClasswordRewardKeys(configuration, dateKey),
    ]);
    if (questionResult.status === 'rejected') {
      console.warn('Failed to load personal-question mission evidence.', questionResult.reason);
    }
    if (todayEntriesResult.status === 'rejected') {
      console.warn('Failed to load today classword mission evidence.', todayEntriesResult.reason);
    }
    if (finalizedEntriesResult.status === 'rejected') {
      console.warn('Failed to load finalized classword mission evidence.', finalizedEntriesResult.reason);
    }
    if (finalizedRewardKeysResult.status === 'rejected') {
      console.warn('Failed to load finalized classword reward ledger.', finalizedRewardKeysResult.reason);
    }
    const personalQuestion = questionResult.status === 'fulfilled'
      ? questionResult.value
      : null;
    const todayEntries = todayEntriesResult.status === 'fulfilled' ? todayEntriesResult.value : [];
    const finalizedEntries = finalizedEntriesResult.status === 'fulfilled' ? finalizedEntriesResult.value : [];
    const finalizedRewardKeys = finalizedRewardKeysResult.status === 'fulfilled'
      ? finalizedRewardKeysResult.value
      : new Set<string>();
    const seenStudentDates = new Set<string>();
    const classwordClaims: MissionClaimInput[] = finalizedEntries.flatMap((entry) => {
      const key = `${entry.dateKey}:${entry.studentNumber}`;
      if (seenStudentDates.has(key) || finalizedRewardKeys.has(key)) return [];
      seenStudentDates.add(key);
      return [{
        studentNumber: entry.studentNumber,
        missionType: CLASSWORD_WORD_ENTRY_WEEKLY_MISSION_TYPE,
        sourceEventId: entry.id,
        rewardKey: entry.dateKey,
      }];
    });
    let currentStudentClasswordClaim: MissionClaimInput | undefined;
    classwordClaims.forEach((claim) => {
      if (claim.studentNumber === studentNumber) currentStudentClasswordClaim = claim;
    });
    if (!currentStudentClasswordClaim) {
      currentStudentClasswordClaim = {
        studentNumber,
        missionType: CLASSWORD_WORD_ENTRY_WEEKLY_MISSION_TYPE,
        sourceEventId: null,
        rewardKey: previousDateKey,
      };
      classwordClaims.push(currentStudentClasswordClaim);
    }
    const personalClaim: MissionClaimInput = {
      studentNumber,
      missionType: PERSONAL_QUESTION_WEEKLY_MISSION_TYPE,
      sourceEventId: personalQuestion?.id ?? null,
      rewardKey: weekKey,
    };
    const [personalClaimResult] = await Promise.allSettled([claimMission(configuration, personalClaim)]);
    const classwordClaimResults: PromiseSettledResult<WeeklyMissionResult>[] = [];
    const finalizedDateKeys = [...new Set(classwordClaims.map((claim) => claim.rewardKey))];
    for (const finalizedDateKey of finalizedDateKeys) {
      const dateClaims = classwordClaims.filter((claim) => claim.rewardKey === finalizedDateKey);
      classwordClaimResults.push(...await Promise.allSettled(
        dateClaims.map((claim) => claimMission(configuration, claim)),
      ));
    }
    const classwordClaimIndex = classwordClaims.lastIndexOf(currentStudentClasswordClaim);
    const classwordClaimResult = classwordClaimResults[classwordClaimIndex];
    const requesterClaimResults = [personalClaimResult, classwordClaimResult];
    const successfulRequesterClaims = requesterClaimResults.flatMap((result) => (
      result?.status === 'fulfilled' ? [result.value] : []
    ));
    if (successfulRequesterClaims.length === 0) {
      throw new Error('WEEKLY_MISSION_RPC_ALL_FAILED');
    }
    const claims = [personalClaim, ...classwordClaims];
    const claimResults = [personalClaimResult, ...classwordClaimResults];
    claimResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.warn('Failed to claim one weekly mission reward.', claims[index], result.reason);
      }
    });
    const fallbackBalance = Math.max(...successfulRequesterClaims.map((mission) => mission.balance));
    const createMissionResult = (
      claim: MissionClaimInput,
      result: PromiseSettledResult<WeeklyMissionResult> | undefined,
      pending: boolean,
    ): WeeklyMissionResult => {
      if (result?.status === 'fulfilled') return { ...result.value, pending };
      return {
        missionType: claim.missionType,
        weekKey: claim.rewardKey,
        completed: false,
        awarded: false,
        rewardAmount: getWeeklyMissionRewardAmount(claim.missionType),
        balance: fallbackBalance,
        pending,
      };
    };
    const missions = [
      createMissionResult(personalClaim, personalClaimResult, false),
      createMissionResult(
        currentStudentClasswordClaim,
        classwordClaimResult,
        todayEntries.some((entry) => entry.studentNumber === studentNumber),
      ),
    ];

    response.status(200).json({ missions });
  } catch (error) {
    console.error('Failed to sync weekly missions.', error);
    response.status(502).json({ error: 'WEEKLY_MISSIONS_SYNC_FAILED' });
  }
}
