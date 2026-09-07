import { withSaveFailureReporting } from './saveFailureClient.js';
import { normalizeCurrencyBalances, normalizeCurrencyHistory, type CurrencyBalances, type CurrencyHistory } from './currency.js';
import { normalizeStudentEconomyState, type StudentEconomyAction, type StudentEconomyState } from './studentEconomy.js';
import { normalizeStudentLifeState, type StudentLifeState } from './studentLife.js';
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

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

const matchesNormalized = (raw: unknown, normalized: unknown): boolean => {
  if (raw === normalized) return true;
  if (Array.isArray(normalized)) return Array.isArray(raw) && raw.length === normalized.length
    && normalized.every((value, index) => matchesNormalized(raw[index], value));
  return isRecord(raw) && isRecord(normalized)
    && Object.entries(normalized).every(([key, value]) => Object.hasOwn(raw, key) && matchesNormalized(raw[key], value));
};

const parseUpdateResult = (body: unknown, studentNumber: number): StudentEconomyUpdateResult => {
  if (!isRecord(body) || typeof body.balance !== 'number' || !Number.isFinite(body.balance)
    || !isRecord(body.currencyBalanceEntries) || !isRecord(body.currencyHistoryEntries)
    || !isRecord(body.studentEconomy) || !isRecord(body.studentLife)
    || typeof body.message !== 'string' || typeof body.applied !== 'boolean'
    || typeof body.updatedAt !== 'string' || body.updatedAt.length === 0) {
    throw new Error('STUDENT_ECONOMY_INVALID_RESPONSE');
  }
  const profileReason = body.profileReason;
  let parsedReason: StudentProfilePurchaseReason | undefined;
  switch (profileReason) {
    case 'purchased': case 'already_selected': case 'profile_in_use': case 'invalid_profile':
    case 'first_profile_must_be_random': case 'no_profile_available': case 'insufficient_currency':
      parsedReason = profileReason; break;
    case undefined: break;
    default: throw new Error('STUDENT_ECONOMY_INVALID_RESPONSE');
  }
  if ((body.profileImage !== undefined && body.profileImage !== null && typeof body.profileImage !== 'string')
    || (body.profilePrice !== undefined && (typeof body.profilePrice !== 'number' || !Number.isFinite(body.profilePrice)))) {
    throw new Error('STUDENT_ECONOMY_INVALID_RESPONSE');
  }
  const balanceEntries = Object.fromEntries(Object.entries(normalizeCurrencyBalances(body.currencyBalanceEntries))
    .filter(([key]) => Object.hasOwn(Object(body.currencyBalanceEntries), key)));
  const historyEntries = Object.fromEntries(Object.entries(normalizeCurrencyHistory(body.currencyHistoryEntries))
    .filter(([key]) => Object.hasOwn(Object(body.currencyHistoryEntries), key)));
  const economy = normalizeStudentEconomyState(body.studentEconomy);
  const life = normalizeStudentLifeState(body.studentLife);
  const economyToValidate = Array.isArray(body.studentEconomy.deposits) && body.studentEconomy.deposits.length === 0
    && typeof body.studentEconomy.deposit === 'number' && body.studentEconomy.deposit > 0
    ? { ...body.studentEconomy, deposits: economy.deposits }
    : body.studentEconomy;
  if (!matchesNormalized(body.currencyBalanceEntries, balanceEntries)
    || !matchesNormalized(body.currencyHistoryEntries, historyEntries)
    || balanceEntries[String(studentNumber)] !== body.balance || !Object.hasOwn(historyEntries, String(studentNumber))
    || !matchesNormalized(economyToValidate, economy) || !matchesNormalized(body.studentLife, life)) {
    throw new Error('STUDENT_ECONOMY_INVALID_RESPONSE');
  }
  return {
    balance: body.balance,
    currencyBalanceEntries: balanceEntries,
    currencyHistoryEntries: historyEntries,
    studentEconomy: economy,
    studentLife: life,
    message: body.message, applied: body.applied, updatedAt: body.updatedAt,
    ...(body.profileImage === undefined ? {} : { profileImage: typeof body.profileImage === 'string' ? body.profileImage : null }),
    ...(typeof body.profilePrice === 'number' ? { profilePrice: body.profilePrice } : {}),
    ...(parsedReason === undefined ? {} : { profileReason: parsedReason }),
  };
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
  return withSaveFailureReporting('economy', async () => {
    const requestBody = JSON.stringify({ studentNumber, action, requestId });
    for (let attempt = 0; attempt < REQUEST_ATTEMPT_LIMIT; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), 45_000);
      let retryDelay = 250 + Math.floor(Math.random() * 250);
      try {
        const response = await fetch('/api/student-economy', {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: requestBody,
          signal: controller.signal,
        });
        if (!response.ok) {
          const body: unknown = await response.json().catch(() => null);
          const retryAfter = response.headers.get('Retry-After');
          const seconds = retryAfter === null ? NaN : Number(retryAfter);
          const waitMs = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter ?? '') - Date.now();
          if (Number.isFinite(waitMs)) retryDelay = Math.max(retryDelay, waitMs);
          throw new StudentEconomyRequestError(getErrorCode(body) || `STUDENT_ECONOMY_HTTP_${response.status}`, response.status);
        }
        return parseUpdateResult(await response.json(), studentNumber);
      } catch (error) {
        const retryable = error instanceof StudentEconomyRequestError
          ? RETRYABLE_STATUS_CODES.has(error.status)
          : error instanceof Error && ['TypeError', 'TimeoutError', 'AbortError'].includes(error.name);
        if (!retryable || attempt + 1 >= REQUEST_ATTEMPT_LIMIT || retryDelay > 5000) throw error;
      } finally { clearTimeout(timeout); }
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
    throw new StudentEconomyRequestError('STUDENT_ECONOMY_UPDATE_FAILED', 502);
  }, studentNumber);
};
