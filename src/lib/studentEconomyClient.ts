import { canonicalStorageJson } from './storageV2Codec.js';
import { withSaveFailureReporting } from './saveFailureClient.js';
import { publishStorageAvailability } from './storageAvailability.js';
import { parseStorageProjectionPatch } from './storageProjectionPatch.js';
import { acceptStorageProjection, captureStorageResponseContext, isStorageResponseContextCurrent, StorageResponseActorChangedError, type StorageResponseContext } from './storageResponseOrder.js';
import { normalizeCurrencyBalances, normalizeCurrencyHistory, type CurrencyBalances, type CurrencyHistory } from './currency.js';
import { normalizeStudentEconomyState, type StudentEconomyAction, type StudentEconomyState } from './studentEconomy.js';
import { normalizeStudentLifeState, type StudentLifeState } from './studentLife.js';
import type { StudentProfileEconomyAction, StudentProfilePurchaseReason } from './studentProfilePurchase.js';

export type StudentEconomyApiAction = StudentEconomyAction | StudentProfileEconomyAction;

interface StudentEconomyResultMetadata {
  readonly message: string;
  readonly applied: boolean;
  readonly profileImage?: string | null;
  readonly profilePrice?: number;
  readonly profileReason?: StudentProfilePurchaseReason;
  readonly updatedAt: string;
}

export type StudentEconomyUpdateResult = StudentEconomyResultMetadata & ({
  readonly refreshPending?: false;
  readonly balance: number;
  readonly currencyBalanceEntries: CurrencyBalances;
  readonly currencyHistoryEntries: CurrencyHistory;
  readonly studentEconomy: StudentEconomyState;
  readonly studentLife: StudentLifeState;
} | {
  readonly refreshPending: true;
  readonly balance: null;
  readonly currencyBalanceEntries: null;
  readonly currencyHistoryEntries: null;
  readonly studentEconomy: null;
  readonly studentLife: null;
});

export class StudentEconomyRequestError extends Error {
  readonly name = 'StudentEconomyRequestError';

  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
  }
}

export const loadStudentEconomyReceipt = async (
  studentNumber: number,
  requestId: string,
  expectedAction: unknown,
  context: StorageResponseContext = captureStorageResponseContext(),
): Promise<StudentEconomyUpdateResult | null> => {
  const query = new URLSearchParams({ protocolVersion: '2', studentNumber: String(studentNumber), requestId, receiptOnly: '1' });
  const response = await fetch(`/api/student-economy?${query}`, {
    credentials: 'same-origin', cache: 'no-store', headers: { 'X-Storage-Projection': '1' }, signal: AbortSignal.timeout(8000),
  });
  if (!isStorageResponseContextCurrent(context)) throw new StorageResponseActorChangedError();
  if (!response.ok) throw new StudentEconomyRequestError('STUDENT_ECONOMY_STATUS_UNAVAILABLE', response.status);
  const body: unknown = await response.json();
  if (!isStorageResponseContextCurrent(context)) throw new StorageResponseActorChangedError();
  if (isRecord(body) && body.status === 'unknown') return null;
  if (!isRecord(body) || body.status !== 'committed' || typeof body.committedAt !== 'string'
    || !Number.isFinite(Date.parse(body.committedAt)) || !isRecord(body.result)
    || typeof body.result.message !== 'string' || typeof body.result.applied !== 'boolean') {
    throw new StudentEconomyRequestError('STUDENT_ECONOMY_INVALID_RESPONSE', 502);
  }
  const bytes = new TextEncoder().encode(canonicalStorageJson({ action: 'student-economy', payload: { studentNumber, action: expectedAction } }));
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
  if (!isStorageResponseContextCurrent(context)) throw new StorageResponseActorChangedError();
  if (body.action !== 'student-economy' || body.payloadHash !== hash) throw new StudentEconomyRequestError('STORAGE_REQUEST_REUSED', 409);
  // The immutable receipt proves this request committed; only the second read supplies current display values.
  query.delete('receiptOnly');
  try {
    const refreshed = await fetch(`/api/student-economy?${query}`, {
      credentials: 'same-origin', cache: 'no-store', headers: { 'X-Storage-Projection': '1' }, signal: AbortSignal.timeout(8000),
    });
    if (!isStorageResponseContextCurrent(context)) throw new StorageResponseActorChangedError();
    if (!refreshed.ok) throw new StudentEconomyRequestError('STUDENT_ECONOMY_REFRESH_UNAVAILABLE', refreshed.status);
    const snapshot: unknown = await refreshed.json();
    if (!isStorageResponseContextCurrent(context)) throw new StorageResponseActorChangedError();
    if (!isRecord(snapshot) || snapshot.status !== 'committed') throw new Error('STUDENT_ECONOMY_INVALID_RESPONSE');
    return parseUpdateResult(snapshot.result, studentNumber, context);
  } catch (error) {
    if (!isStorageResponseContextCurrent(context) || error instanceof StorageResponseActorChangedError) throw new StorageResponseActorChangedError();
    return { refreshPending: true, balance: null, currencyBalanceEntries: null, currencyHistoryEntries: null,
      studentEconomy: null, studentLife: null, message: body.result.message, applied: body.result.applied,
      updatedAt: body.committedAt };
  }
};

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

const parseUpdateResult = (body: unknown, studentNumber: number, context: StorageResponseContext): StudentEconomyUpdateResult => {
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
  const parsed: StudentEconomyUpdateResult = {
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
  if (body.storagePatch === undefined) return parsed;
  const projection = acceptStorageProjection(context, {
    value: { currencyBalances: balanceEntries, currencyHistory: historyEntries, studentEconomy: { [studentNumber]: economy }, studentLife: life },
    updatedAt: body.updatedAt, scope: 'student', storagePatch: parseStorageProjectionPatch(body.storagePatch),
  });
  const merged = projection.value;
  const mergedBalances = normalizeCurrencyBalances(merged.currencyBalances), mergedHistory = normalizeCurrencyHistory(merged.currencyHistory);
  const mergedEconomy = isRecord(merged.studentEconomy) ? merged.studentEconomy[String(studentNumber)] : undefined;
  return { ...parsed, balance: mergedBalances[String(studentNumber)], currencyBalanceEntries: { [studentNumber]: mergedBalances[String(studentNumber)] },
    currencyHistoryEntries: { [studentNumber]: mergedHistory[String(studentNumber)] ?? [] },
    studentEconomy: normalizeStudentEconomyState(mergedEconomy), studentLife: normalizeStudentLifeState(merged.studentLife), updatedAt: projection.updatedAt };
};

export const mergeStudentEconomyLife = (current: StudentLifeState, incoming: StudentLifeState): StudentLifeState => {
  const letters = new Map(current.letters.map(letter => [letter.id, letter]));
  for (const letter of incoming.letters) letters.set(letter.id, { ...letter, readAt: letters.get(letter.id)?.readAt ?? letter.readAt });
  return { ...current, letters: [...letters.values()], failureProfileAssignments: { ...current.failureProfileAssignments, ...incoming.failureProfileAssignments } };
};

export const retryStudentEconomyRequest = async ({
  studentNumber,
  action,
  requestId,
}: {
  readonly studentNumber: number;
  readonly action: unknown;
  readonly requestId: string;
}): Promise<StudentEconomyUpdateResult> => {
  const context = captureStorageResponseContext();
  const outcome = await withSaveFailureReporting('economy', async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), 45_000);
    try {
      const response = await fetch('/api/student-economy', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'X-Storage-Projection': '1' },
        body: JSON.stringify({ protocolVersion: 2, studentNumber, action, requestId }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const error = new StudentEconomyRequestError(getErrorCode(body) || `STUDENT_ECONOMY_HTTP_${response.status}`, response.status);
        if (!isStorageResponseContextCurrent(context)) return { error: new StorageResponseActorChangedError() };
        if (publishStorageAvailability(error, context)) return { error };
        if ((response.status < 500 && isRecord(body) && body.businessRejected === true) || [401, 403, 429].includes(response.status)
          || (response.status === 409 && error.code === 'STORAGE_REQUEST_REUSED')) return { error };
        throw error;
      }
      const result = parseUpdateResult(await response.json(), studentNumber, context);
      if (!isStorageResponseContextCurrent(context)) return { error: new StorageResponseActorChangedError() };
      return { result };
    } catch (error) {
      if (!isStorageResponseContextCurrent(context)) return { error: new StorageResponseActorChangedError() };
      const uncertain = error instanceof StudentEconomyRequestError
        ? error.status === 408 || error.status >= 500
        : error instanceof Error && (['TypeError', 'TimeoutError', 'AbortError', 'SyntaxError'].includes(error.name) || error.message === 'STUDENT_ECONOMY_INVALID_RESPONSE');
      if (!uncertain) throw error;
      try {
        const committed = await loadStudentEconomyReceipt(studentNumber, requestId, action, context);
        if (committed) return { result: committed };
      } catch (confirmationError) {
        if (confirmationError instanceof StorageResponseActorChangedError
          || (confirmationError instanceof StudentEconomyRequestError && confirmationError.code === 'STORAGE_REQUEST_REUSED')) return { error: confirmationError };
        if (!(confirmationError instanceof Error)) throw confirmationError;
      }
      if (!isStorageResponseContextCurrent(context)) return { error: new StorageResponseActorChangedError() };
      throw new StudentEconomyRequestError('STUDENT_ECONOMY_CONFIRMATION_REQUIRED', 504);
    } finally { clearTimeout(timeout); }
  }, studentNumber);
  if ('error' in outcome) throw outcome.error;
  return outcome.result;
};

export const updateStudentEconomy = (input: {
  readonly studentNumber: number;
  readonly action: StudentEconomyApiAction;
  readonly requestId: string;
}): Promise<StudentEconomyUpdateResult> => retryStudentEconomyRequest(input);
