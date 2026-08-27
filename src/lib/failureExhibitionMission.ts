import {
  normalizeCurrencyBalances,
  normalizeCurrencyHistory,
  type CurrencyBalances,
  type CurrencyHistory,
} from './currency.js';
import { createFailureStory } from './failureExhibition.js';
import { normalizeStudentLifeState, type StudentLifeState } from './studentLife.js';
import {
  claimWeeklyMissionRewardInSettings,
  FAILURE_EXHIBITION_WEEKLY_MISSION_TYPE,
  getKoreanIsoWeekKey,
} from './weeklyMission.js';

interface FailureExhibitionMissionInput {
  readonly id: string;
  readonly studentNumber: number;
  readonly failure: string;
  readonly lesson: string;
  readonly createdAt: string;
}

export interface FailureExhibitionMissionEntry {
  readonly value: Record<string, unknown>;
  readonly studentLife: StudentLifeState;
  readonly balances: CurrencyBalances;
  readonly history: CurrencyHistory;
  readonly applied: boolean;
  readonly awarded: boolean;
  readonly balance: number;
}

const toRecord = (value: unknown): Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? { ...value as Record<string, unknown> }
    : {}
);

export const createFailureExhibitionMissionEntry = (
  value: unknown,
  input: FailureExhibitionMissionInput,
): FailureExhibitionMissionEntry => {
  const current = toRecord(value);
  const currentStudentLife = normalizeStudentLifeState(current.studentLife);
  const failureStories = createFailureStory(currentStudentLife.failureStories, {
    id: input.id,
    studentNumber: input.studentNumber,
    failure: input.failure,
    lesson: input.lesson,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  });
  const balances = normalizeCurrencyBalances(current.currencyBalances);
  const history = normalizeCurrencyHistory(current.currencyHistory);
  const applied = failureStories.length > currentStudentLife.failureStories.length;

  if (!applied) {
    return {
      value: current,
      studentLife: currentStudentLife,
      balances,
      history,
      applied: false,
      awarded: false,
      balance: balances[String(input.studentNumber)],
    };
  }

  const studentLife = { ...currentStudentLife, failureStories };
  const reward = claimWeeklyMissionRewardInSettings(
    { ...current, studentLife },
    input.studentNumber,
    getKoreanIsoWeekKey(new Date(input.createdAt)),
    FAILURE_EXHIBITION_WEEKLY_MISSION_TYPE,
    input.createdAt,
  );

  return {
    value: reward.value,
    studentLife,
    balances: normalizeCurrencyBalances(reward.value.currencyBalances),
    history: normalizeCurrencyHistory(reward.value.currencyHistory),
    applied: true,
    awarded: reward.awarded,
    balance: reward.balance,
  };
};
