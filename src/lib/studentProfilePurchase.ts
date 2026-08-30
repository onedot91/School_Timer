import {
  appendCurrencyHistoryEntry,
  DEFAULT_CURRENCY_BALANCE,
  normalizeCurrencyBalances,
  normalizeCurrencyHistory,
  type CurrencyBalances,
  type CurrencyHistory,
} from './currency.js';
import {
  getAssignedFailureProfileImage,
  getRandomAvailableFailureProfile,
  selectFailureProfile,
} from './failureExhibition.js';
import { normalizeStudentLifeState, type StudentLifeState } from './studentLife.js';

export const RANDOM_PROFILE_CHANGE_PRICE = 30;
export const SELECTED_PROFILE_CHANGE_PRICE = 50;

export type StudentProfilePurchase =
  | { readonly type: 'random' }
  | { readonly type: 'selected'; readonly profileImage: string };

export type StudentProfilePurchaseReason =
  | 'purchased'
  | 'already_selected'
  | 'profile_in_use'
  | 'invalid_profile'
  | 'first_profile_must_be_random'
  | 'no_profile_available'
  | 'insufficient_currency';

export interface StudentProfilePurchaseResult {
  readonly value: Record<string, unknown>;
  readonly studentLife: StudentLifeState;
  readonly balances: CurrencyBalances;
  readonly history: CurrencyHistory;
  readonly applied: boolean;
  readonly reason: StudentProfilePurchaseReason;
  readonly profileImage: string | null;
  readonly price: number;
}

const toRecord = (value: unknown): Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? { ...value as Record<string, unknown> }
    : {}
);

export const getStudentProfilePurchasePrice = (
  assignments: unknown,
  studentNumber: number,
  purchaseType: StudentProfilePurchase['type'],
): number | null => {
  const studentLife = normalizeStudentLifeState({ failureProfileAssignments: assignments });
  const hasProfile = getAssignedFailureProfileImage(studentNumber, studentLife.failureProfileAssignments) !== null;
  if (!hasProfile) return purchaseType === 'random' ? 0 : null;
  return purchaseType === 'random' ? RANDOM_PROFILE_CHANGE_PRICE : SELECTED_PROFILE_CHANGE_PRICE;
};

export const purchaseStudentProfile = (
  value: unknown,
  studentNumber: number,
  purchase: StudentProfilePurchase,
  availableBalance: number,
  random: () => number = Math.random,
  createdAt = new Date().toISOString(),
): StudentProfilePurchaseResult => {
  const current = toRecord(value);
  const studentLife = normalizeStudentLifeState(current.studentLife);
  const balances = normalizeCurrencyBalances(current.currencyBalances);
  const history = normalizeCurrencyHistory(current.currencyHistory);
  const price = getStudentProfilePurchasePrice(
    studentLife.failureProfileAssignments,
    studentNumber,
    purchase.type,
  );
  const baseResult = {
    value: current,
    studentLife,
    balances,
    history,
    applied: false,
    profileImage: null,
    price: price ?? 0,
  } as const;

  if (price === null) {
    return { ...baseResult, reason: 'first_profile_must_be_random' };
  }

  const profileImage = purchase.type === 'random'
    ? getRandomAvailableFailureProfile(studentLife.failureProfileAssignments, studentNumber, random)
    : purchase.profileImage;
  if (profileImage === null) {
    return { ...baseResult, reason: 'no_profile_available' };
  }

  const selection = selectFailureProfile(
    studentLife.failureProfileAssignments,
    studentNumber,
    profileImage,
  );
  if (!selection.applied) {
    const reason = selection.reason === 'selected' ? 'invalid_profile' : selection.reason;
    return { ...baseResult, reason, profileImage };
  }

  const studentKey = String(studentNumber);
  const before = balances[studentKey] ?? DEFAULT_CURRENCY_BALANCE;
  if (availableBalance < price || before < price) {
    return { ...baseResult, reason: 'insufficient_currency', profileImage };
  }

  const after = before - price;
  const nextBalances = { ...balances, [studentKey]: after };
  const nextHistory = appendCurrencyHistoryEntry(history, {
    studentNumber,
    before,
    after,
    reason: 'shop_purchase',
    createdAt,
  });
  const nextStudentLife = {
    ...studentLife,
    failureProfileAssignments: selection.assignments,
  };
  const nextValue = {
    ...current,
    currencyBalances: nextBalances,
    currencyHistory: nextHistory,
    studentLife: nextStudentLife,
  };

  return {
    value: nextValue,
    studentLife: nextStudentLife,
    balances: nextBalances,
    history: nextHistory,
    applied: true,
    reason: 'purchased',
    profileImage,
    price,
  };
};
