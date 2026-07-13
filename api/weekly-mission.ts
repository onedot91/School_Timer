import {
  findPersonalQuestionForWeek,
  getKoreanIsoWeekKey,
  parseQuestionStudentResponse,
  parseWeeklyMissionResult,
} from '../src/lib/weeklyMission';

interface ApiRequest {
  method?: string;
  body?: unknown;
}

interface ApiResponse {
  setHeader: (name: string, value: string) => void;
  status: (statusCode: number) => ApiResponse;
  json: (body: unknown) => void;
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
    const questionUrl = new URL(QUESTION_STUDENT_ENDPOINT);
    questionUrl.searchParams.set('studentNumber', String(studentNumber));
    questionUrl.searchParams.set('weekKey', weekKey);

    const questionResponse = await fetch(questionUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!questionResponse.ok) {
      throw new Error(`QUESTION_STUDENT_HTTP_${questionResponse.status}`);
    }

    const questionData = parseQuestionStudentResponse(await questionResponse.json());
    const personalQuestion = findPersonalQuestionForWeek(questionData, studentNumber, weekKey);
    const rpcResponse = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/claim_personal_question_weekly_reward`, {
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
