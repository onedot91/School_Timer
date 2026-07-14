import {
  getClasswordMissionEvidence,
  getKoreanWeekDateRange,
  parseClasswordMissionStatus,
} from '../src/lib/classwordWeeklyMission.js';
import {
  CLASSWORD_QUIZ_WEEKLY_MISSION_TYPE,
  CLASSWORD_WORD_ENTRY_WEEKLY_MISSION_TYPE,
  findPersonalQuestionForWeek,
  getKoreanIsoWeekKey,
  parseQuestionStudentResponse,
  parseWeeklyMissionResult,
  PERSONAL_QUESTION_WEEKLY_MISSION_TYPE,
  type WeeklyMissionResult,
  type WeeklyMissionType,
} from '../src/lib/weeklyMission.js';

interface ApiRequest {
  method?: string;
  body?: unknown;
}

interface ApiResponse {
  setHeader: (name: string, value: string) => void;
  status: (statusCode: number) => ApiResponse;
  json: (body: unknown) => void;
}

interface MissionClaimInput {
  readonly missionType: WeeklyMissionType;
  readonly sourceEventId: string | null;
}

const QUESTION_STUDENT_ENDPOINT = 'https://question-news.vercel.app/api/student';
const CLASSWORD_MISSION_ENDPOINT = 'https://classword.vercel.app/api/mission-status';

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
  supabaseUrl: string,
  serviceRoleKey: string,
  studentNumber: number,
  weekKey: string,
  input: MissionClaimInput,
): Promise<WeeklyMissionResult> => {
  const rpcResponse = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/claim_weekly_mission_reward`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({
      p_student_number: studentNumber,
      p_week_key: weekKey,
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

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    response.status(503).json({ error: 'WEEKLY_MISSION_NOT_CONFIGURED' });
    return;
  }

  try {
    const weekKey = getKoreanIsoWeekKey();
    const range = getKoreanWeekDateRange();
    const questionUrl = new URL(QUESTION_STUDENT_ENDPOINT);
    questionUrl.searchParams.set('studentNumber', String(studentNumber));
    questionUrl.searchParams.set('weekKey', weekKey);
    const classwordUrl = new URL(CLASSWORD_MISSION_ENDPOINT);
    classwordUrl.searchParams.set('studentNumber', String(studentNumber));
    classwordUrl.searchParams.set('startDate', range.startDate);
    classwordUrl.searchParams.set('endDate', range.endDate);

    const [questionResult, classwordResult] = await Promise.allSettled([
      fetchJson(questionUrl).then((value) => findPersonalQuestionForWeek(
        parseQuestionStudentResponse(value),
        studentNumber,
        weekKey,
      )),
      fetchJson(classwordUrl).then((value) => getClasswordMissionEvidence(
        parseClasswordMissionStatus(value, studentNumber, range.startDate, range.endDate),
        range.today,
      )),
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
    const evidence = classwordResult.status === 'fulfilled'
      ? classwordResult.value
      : { wordEntryEventDate: null, quizCorrectEventDate: null };
    const claims: readonly MissionClaimInput[] = [
      { missionType: PERSONAL_QUESTION_WEEKLY_MISSION_TYPE, sourceEventId: personalQuestion?.id ?? null },
      {
        missionType: CLASSWORD_WORD_ENTRY_WEEKLY_MISSION_TYPE,
        sourceEventId: evidence.wordEntryEventDate === null ? null : `${evidence.wordEntryEventDate}:word_entry`,
      },
      {
        missionType: CLASSWORD_QUIZ_WEEKLY_MISSION_TYPE,
        sourceEventId: evidence.quizCorrectEventDate === null ? null : `${evidence.quizCorrectEventDate}:quiz_correct`,
      },
    ];
    const claimResults = await Promise.allSettled(claims.map((claim) => (
      claimMission(supabaseUrl, serviceRoleKey, studentNumber, weekKey, claim)
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
        weekKey,
        completed: false,
        awarded: false,
        rewardAmount: 5,
        balance: fallbackBalance,
      };
    });

    response.status(200).json({ missions });
  } catch (error) {
    console.error('Failed to sync weekly missions.', error);
    response.status(502).json({ error: 'WEEKLY_MISSIONS_SYNC_FAILED' });
  }
}
