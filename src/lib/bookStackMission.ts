import {
  normalizeCurrencyBalances,
  normalizeCurrencyHistory,
  type CurrencyBalances,
  type CurrencyHistory,
} from './currency.js';
import { addStudentBook, normalizeStudentLifeState, type StudentLifeState } from './studentLife.js';
import {
  BOOK_STACK_WEEKLY_MISSION_TYPE,
  claimWeeklyMissionRewardInSettings,
  getKoreanIsoWeekKey,
} from './weeklyMission.js';

interface BookStackMissionInput {
  readonly id: string;
  readonly studentNumber: number;
  readonly title: string;
  readonly author: string;
  readonly pageCount: number;
  readonly createdAt: string;
}

export interface BookStackMissionEntry {
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

export const createBookStackMissionEntry = (
  value: unknown,
  input: BookStackMissionInput,
): BookStackMissionEntry => {
  const current = toRecord(value);
  const currentStudentLife = normalizeStudentLifeState(current.studentLife);
  const studentLife = addStudentBook(currentStudentLife, input);
  const balances = normalizeCurrencyBalances(current.currencyBalances);
  const history = normalizeCurrencyHistory(current.currencyHistory);
  const applied = studentLife.books.length > currentStudentLife.books.length;

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

  const reward = claimWeeklyMissionRewardInSettings(
    { ...current, studentLife },
    input.studentNumber,
    getKoreanIsoWeekKey(new Date(input.createdAt)),
    BOOK_STACK_WEEKLY_MISSION_TYPE,
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
