import type { CurrencyBalances, CurrencyHistory } from './currency.js';
import type { StudentEconomyAction, StudentEconomyState } from './studentEconomy.js';
import type { StudentLifeState } from './studentLife.js';

export interface StudentEconomyUpdateResult {
  readonly balance: number;
  readonly currencyBalanceEntries: CurrencyBalances;
  readonly currencyHistoryEntries: CurrencyHistory;
  readonly studentEconomy: StudentEconomyState;
  readonly studentLife: StudentLifeState;
  readonly message: string;
  readonly applied: boolean;
  readonly updatedAt: string;
}

const getErrorCode = (value: unknown) => {
  if (!value || typeof value !== 'object') return '';
  const error = Reflect.get(value, 'error');
  return typeof error === 'string' ? error : '';
};

export const updateStudentEconomy = async ({
  studentNumber,
  action,
  requestId,
}: {
  readonly studentNumber: number;
  readonly action: StudentEconomyAction;
  readonly requestId: string;
}): Promise<StudentEconomyUpdateResult> => {
  const response = await fetch('/api/student-economy', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentNumber, action, requestId }),
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(getErrorCode(body) || `STUDENT_ECONOMY_HTTP_${response.status}`);
    Reflect.set(error, 'status', response.status);
    throw error;
  }
  return body as StudentEconomyUpdateResult;
};
