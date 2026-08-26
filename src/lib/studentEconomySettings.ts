import type { CurrencyBalances, CurrencyHistory } from './currency.js';
import type { StudentEconomyStates } from './studentEconomy.js';
import type { StudentLifeState } from './studentLife.js';

interface StudentEconomySettingsPatch {
  readonly currentValue: unknown;
  readonly currencyBalanceEntries: CurrencyBalances;
  readonly currencyHistoryEntries: CurrencyHistory;
  readonly studentEconomyEntries: StudentEconomyStates;
  readonly studentLife: StudentLifeState;
}

const toRecord = (value: unknown): Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : {}
);

const patchEntries = (currentValue: unknown, entries: Readonly<Record<string, unknown>>) => ({
  ...toRecord(currentValue),
  ...entries,
});

export const patchStudentEconomySettings = ({
  currentValue,
  currencyBalanceEntries,
  currencyHistoryEntries,
  studentEconomyEntries,
  studentLife,
}: StudentEconomySettingsPatch) => {
  const current = toRecord(currentValue);
  return {
    ...current,
    currencyBalances: patchEntries(current.currencyBalances, currencyBalanceEntries),
    currencyHistory: patchEntries(current.currencyHistory, currencyHistoryEntries),
    studentEconomy: patchEntries(current.studentEconomy, studentEconomyEntries),
    studentLife,
  };
};
