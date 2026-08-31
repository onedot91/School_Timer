import {
  CURRENCY_BALANCE_MAX,
  normalizeCurrencyBalances,
  normalizeCurrencyHistory,
} from './currency';

export const CLASSWORD_QUIZ_REWARD_MIN = 1;
export const CLASSWORD_QUIZ_REWARD_MAX = 10;

export type ClasswordQuizRewardClaim = {
  readonly value: Record<string, unknown>;
  readonly awarded: boolean;
  readonly balance: number;
};

export const getRandomClasswordQuizRewardAmount = (
  randomSource: () => number = Math.random,
): number => {
  const randomValue = randomSource();
  const normalized = Number.isFinite(randomValue)
    ? Math.min(1 - Number.EPSILON, Math.max(0, randomValue))
    : 0;
  return Math.floor(normalized * CLASSWORD_QUIZ_REWARD_MAX) + CLASSWORD_QUIZ_REWARD_MIN;
};

export const claimClasswordQuizRewardInSettings = (
  value: unknown,
  studentNumber: number,
  dateKey: string,
  rewardAmount: number,
  createdAt = new Date().toISOString(),
): ClasswordQuizRewardClaim => {
  if (
    !Number.isInteger(rewardAmount)
    || rewardAmount < CLASSWORD_QUIZ_REWARD_MIN
    || rewardAmount > CLASSWORD_QUIZ_REWARD_MAX
  ) throw new Error('CLASSWORD_QUIZ_INVALID_REWARD');

  const currentValue = value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
  const balances = normalizeCurrencyBalances(currentValue.currencyBalances);
  const history = normalizeCurrencyHistory(currentValue.currencyHistory);
  const studentKey = String(studentNumber);
  const rewardId = `weekly-mission-classword_quiz_correct-${studentNumber}-${dateKey}`;
  const existingEntries = history[studentKey] ?? [];
  const before = balances[studentKey];

  if (existingEntries.some((entry) => entry.id === rewardId)) {
    return { value: currentValue, awarded: false, balance: before };
  }
  if (before > CURRENCY_BALANCE_MAX - rewardAmount) {
    return { value: currentValue, awarded: false, balance: before };
  }

  const after = before + rewardAmount;
  return {
    value: {
      ...currentValue,
      currencyBalances: { ...balances, [studentKey]: after },
      currencyHistory: {
        ...history,
        [studentKey]: [{
          id: rewardId,
          studentNumber,
          delta: rewardAmount,
          before,
          after,
          reason: 'weekly_mission' as const,
          createdAt,
        }, ...existingEntries],
      },
    },
    awarded: true,
    balance: after,
  };
};
