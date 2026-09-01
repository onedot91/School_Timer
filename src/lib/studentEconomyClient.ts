import type { CurrencyBalances, CurrencyHistory } from './currency.js';
import type { StudentEconomyAction, StudentEconomyState } from './studentEconomy.js';
import type { StudentLifeState } from './studentLife.js';
import type { StudentProfileEconomyAction, StudentProfilePurchaseReason } from './studentProfilePurchase.js';

export type StudentEconomyApiAction = StudentEconomyAction | StudentProfileEconomyAction;

export interface StudentEconomyUpdateResult {
  readonly balance: number;
  readonly currencyBalanceEntries: CurrencyBalances;
  readonly currencyHistoryEntries: CurrencyHistory;
  readonly studentEconomy: StudentEconomyState;
  readonly studentLife: StudentLifeState;
  readonly message: string;
  readonly applied: boolean;
  readonly profileImage?: string | null;
  readonly profilePrice?: number;
  readonly profileReason?: StudentProfilePurchaseReason;
  readonly updatedAt: string;
}

export class StudentEconomyRequestError extends Error {
  readonly name = 'StudentEconomyRequestError';

  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
  }
}

const REQUEST_ATTEMPT_LIMIT = 2;
const RETRYABLE_STATUS_CODES = new Set([408, 409, 425, 429, 502, 503, 504]);

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
  readonly action: StudentEconomyApiAction;
  readonly requestId: string;
}): Promise<StudentEconomyUpdateResult> => {
  const requestBody = JSON.stringify({ studentNumber, action, requestId });
  let lastNetworkError: TypeError | null = null;

  for (let attempt = 0; attempt < REQUEST_ATTEMPT_LIMIT; attempt += 1) {
    let response: Response;
    try {
      response = await fetch('/api/student-economy', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
      });
    } catch (error) {
      if (error instanceof TypeError && attempt + 1 < REQUEST_ATTEMPT_LIMIT) {
        lastNetworkError = error;
        continue;
      }
      throw error;
    }

    const body: unknown = await response.json().catch(() => null);
    if (response.ok) return body as StudentEconomyUpdateResult;

    const requestError = new StudentEconomyRequestError(
      getErrorCode(body) || `STUDENT_ECONOMY_HTTP_${response.status}`,
      response.status,
    );
    if (attempt + 1 < REQUEST_ATTEMPT_LIMIT && RETRYABLE_STATUS_CODES.has(response.status)) continue;
    throw requestError;
  }

  if (lastNetworkError) throw lastNetworkError;
  throw new StudentEconomyRequestError('STUDENT_ECONOMY_UPDATE_FAILED', 502);
};
