export const PERSONAL_QUESTION_WEEKLY_MISSION_TYPE = 'personal_question';
export const CLASSWORD_WORD_ENTRY_WEEKLY_MISSION_TYPE = 'classword_word_entry';
export const CLASSWORD_QUIZ_WEEKLY_MISSION_TYPE = 'classword_quiz_correct';
export const PERSONAL_QUESTION_WEEKLY_REWARD = 5;

export const WEEKLY_MISSION_TYPES = [
  PERSONAL_QUESTION_WEEKLY_MISSION_TYPE,
  CLASSWORD_WORD_ENTRY_WEEKLY_MISSION_TYPE,
  CLASSWORD_QUIZ_WEEKLY_MISSION_TYPE,
] as const;

export type WeeklyMissionType = typeof WEEKLY_MISSION_TYPES[number];

const isWeeklyMissionType = (value: unknown): value is WeeklyMissionType => (
  typeof value === 'string' && WEEKLY_MISSION_TYPES.some((missionType) => missionType === value)
);

export const WEEKLY_MISSION_DEFINITIONS = [
  { type: PERSONAL_QUESTION_WEEKLY_MISSION_TYPE, label: '신문에 개인 질문하기', rewardAmount: 5 },
  { type: CLASSWORD_WORD_ENTRY_WEEKLY_MISSION_TYPE, label: 'ㄱㄴㄷ 게임 낱말 넣기', rewardAmount: 5 },
  { type: CLASSWORD_QUIZ_WEEKLY_MISSION_TYPE, label: 'ㄱㄴㄷ 게임 낱말 퀴즈', rewardAmount: 5 },
] as const satisfies readonly {
  readonly type: WeeklyMissionType;
  readonly label: string;
  readonly rewardAmount: number;
}[];

export type WeeklyMissionStatus = 'loading' | 'incomplete' | 'completed' | 'unavailable';
export type WeeklyMissionStatuses = Record<WeeklyMissionType, WeeklyMissionStatus>;

export const createWeeklyMissionStatuses = (status: WeeklyMissionStatus): WeeklyMissionStatuses => ({
  personal_question: status,
  classword_word_entry: status,
  classword_quiz_correct: status,
});

export interface WeeklyMissionResult {
  missionType: WeeklyMissionType;
  weekKey: string;
  completed: boolean;
  awarded: boolean;
  rewardAmount: number;
  balance: number;
}

export interface WeeklyMissionClaim {
  value: Record<string, unknown>;
  awarded: boolean;
  balance: number;
}

export interface WeeklyMissionsResult {
  missions: WeeklyMissionResult[];
}

interface QuestionHistoryRecord {
  id: string;
  student_number: number;
  question_type: 'personal' | 'topic';
  week_key: string;
}

export interface QuestionStudentResponse {
  history: QuestionHistoryRecord[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

export const getKoreanIsoWeekKey = (date = new Date()) => {
  const koreanDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const utcDate = new Date(Date.UTC(
    koreanDate.getUTCFullYear(),
    koreanDate.getUTCMonth(),
    koreanDate.getUTCDate(),
  ));
  const weekday = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utcDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utcDate.getUTCFullYear()}-${String(week).padStart(2, '0')}`;
};

export const parseQuestionStudentResponse = (value: unknown): QuestionStudentResponse => {
  if (!isRecord(value) || !Array.isArray(value.history)) {
    throw new Error('QUESTION_STUDENT_INVALID_RESPONSE');
  }

  const history = value.history.map((entry): QuestionHistoryRecord => {
    if (
      !isRecord(entry) ||
      typeof entry.id !== 'string' ||
      typeof entry.student_number !== 'number' ||
      !Number.isInteger(entry.student_number) ||
      (entry.question_type !== 'personal' && entry.question_type !== 'topic') ||
      typeof entry.week_key !== 'string'
    ) {
      throw new Error('QUESTION_STUDENT_INVALID_HISTORY');
    }

    return {
      id: entry.id,
      student_number: entry.student_number,
      question_type: entry.question_type,
      week_key: entry.week_key,
    };
  });

  return { history };
};

export const findPersonalQuestionForWeek = (
  response: QuestionStudentResponse,
  studentNumber: number,
  weekKey: string,
) => response.history.find((entry) => (
  entry.student_number === studentNumber &&
  entry.question_type === 'personal' &&
  entry.week_key === weekKey
)) ?? null;

export const hasWeeklyMissionReward = (
  currencyHistory: unknown,
  studentNumber: number,
  weekKey: string,
  missionType: WeeklyMissionType,
) => (
  normalizeCurrencyHistory(currencyHistory)[String(studentNumber)] ?? []
).some((entry) => entry.id === getWeeklyMissionRewardId(studentNumber, weekKey, missionType));

const getWeeklyMissionRewardId = (
  studentNumber: number,
  weekKey: string,
  missionType: WeeklyMissionType,
) => missionType === PERSONAL_QUESTION_WEEKLY_MISSION_TYPE
  ? `weekly-mission-${studentNumber}-${weekKey}`
  : `weekly-mission-${missionType}-${studentNumber}-${weekKey}`;

export const claimWeeklyMissionRewardInSettings = (
  value: unknown,
  studentNumber: number,
  weekKey: string,
  missionType: WeeklyMissionType,
  createdAt = new Date().toISOString(),
): WeeklyMissionClaim => {
  const currentValue = value && typeof value === 'object'
    ? { ...(value as Record<string, unknown>) }
    : {};
  const balances = normalizeCurrencyBalances(currentValue.currencyBalances);
  const history = normalizeCurrencyHistory(currentValue.currencyHistory);
  const studentKey = String(studentNumber);
  const rewardId = getWeeklyMissionRewardId(studentNumber, weekKey, missionType);
  const existingEntries = history[studentKey] ?? [];

  if (existingEntries.some((entry) => entry.id === rewardId)) {
    return { value: currentValue, awarded: false, balance: balances[studentKey] };
  }

  const before = balances[studentKey];
  const after = Math.min(CURRENCY_BALANCE_MAX, before + PERSONAL_QUESTION_WEEKLY_REWARD);
  const nextHistory = {
    ...history,
    [studentKey]: [
      {
        id: rewardId,
        studentNumber,
        delta: after - before,
        before,
        after,
        reason: 'weekly_mission' as const,
        createdAt,
      },
      ...existingEntries,
    ].slice(0, CURRENCY_HISTORY_LIMIT_PER_STUDENT),
  };

  return {
    value: {
      ...currentValue,
      currencyBalances: { ...balances, [studentKey]: after },
      currencyHistory: nextHistory,
    },
    awarded: true,
    balance: after,
  };
};

export const parseWeeklyMissionResult = (value: unknown): WeeklyMissionResult => {
  if (
    !isRecord(value) ||
    !isWeeklyMissionType(value.missionType) ||
    typeof value.weekKey !== 'string' ||
    typeof value.completed !== 'boolean' ||
    typeof value.awarded !== 'boolean' ||
    typeof value.rewardAmount !== 'number' ||
    typeof value.balance !== 'number'
  ) {
    throw new Error('WEEKLY_MISSION_INVALID_RESPONSE');
  }

  return {
    missionType: value.missionType,
    weekKey: value.weekKey,
    completed: value.completed,
    awarded: value.awarded,
    rewardAmount: value.rewardAmount,
    balance: value.balance,
  };
};

export const parseWeeklyMissionsResult = (value: unknown): WeeklyMissionsResult => {
  if (!isRecord(value) || !Array.isArray(value.missions)) {
    throw new Error('WEEKLY_MISSIONS_INVALID_RESPONSE');
  }

  const missions = value.missions.map(parseWeeklyMissionResult);
  if (
    missions.length !== WEEKLY_MISSION_TYPES.length ||
    !WEEKLY_MISSION_TYPES.every((missionType) => (
      missions.filter((mission) => mission.missionType === missionType).length === 1
    ))
  ) {
    throw new Error('WEEKLY_MISSIONS_INVALID_RESPONSE');
  }

  return { missions };
};

export const syncPersonalQuestionWeeklyMission = async (studentNumber: number) => {
  const response = await fetch('/api/weekly-mission', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ studentNumber }),
  });

  if (!response.ok) {
    throw new Error(`WEEKLY_MISSION_HTTP_${response.status}`);
  }

  return parseWeeklyMissionResult(await response.json());
};

export const syncWeeklyMissions = async (studentNumber: number) => {
  const response = await fetch('/api/weekly-missions', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ studentNumber }),
  });

  if (!response.ok) {
    throw new Error(`WEEKLY_MISSIONS_HTTP_${response.status}`);
  }

  return parseWeeklyMissionsResult(await response.json());
};
import {
  CURRENCY_BALANCE_MAX,
  CURRENCY_HISTORY_LIMIT_PER_STUDENT,
  normalizeCurrencyBalances,
  normalizeCurrencyHistory,
} from './currency.js';
