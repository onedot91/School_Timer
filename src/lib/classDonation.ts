import { CURRENCY_BALANCE_MAX, clampCurrencyBalance } from './currency.js';

export const CLASS_DONATION_DEFAULT_TARGET = 500;
export const CLASS_DONATION_HISTORY_LIMIT = 500;

export type ClassDonationEntry = {
  readonly id: string;
  readonly studentNumber: number;
  readonly amount: number;
  readonly createdAt: string;
};

export type ClassDonationSettings = {
  readonly enabled: boolean;
  readonly itemName: string;
  readonly targetAmount: number;
  readonly totalAmount: number;
  readonly history: readonly ClassDonationEntry[];
};

export type ClassDonationPublicState = Omit<ClassDonationSettings, 'itemName' | 'history'>;

export type ClassDonationResult = {
  readonly donatedAmount: number;
  readonly balance: number;
  readonly totalAmount: number;
  readonly targetAmount: number;
  readonly completed: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const clampDonationAmount = (value: unknown, fallback: number) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(CURRENCY_BALANCE_MAX, Math.floor(parsed)));
};

export const normalizeClassDonationSettings = (value: unknown): ClassDonationSettings => {
  const parsed = isRecord(value) ? value : {};
  const parsedTargetAmount = clampDonationAmount(parsed.targetAmount, CLASS_DONATION_DEFAULT_TARGET);
  const targetAmount = parsedTargetAmount > 0 ? parsedTargetAmount : CLASS_DONATION_DEFAULT_TARGET;
  const totalAmount = Math.min(targetAmount, clampDonationAmount(parsed.totalAmount, 0));
  const history = Array.isArray(parsed.history)
    ? parsed.history.flatMap((candidate): ClassDonationEntry[] => {
      if (!isRecord(candidate)) return [];
      const studentNumber = Number(candidate.studentNumber);
      const amount = Number(candidate.amount);
      if (
        typeof candidate.id !== 'string' || candidate.id.trim().length === 0 ||
        !Number.isInteger(studentNumber) || studentNumber < 1 || studentNumber > 23 ||
        !Number.isInteger(amount) || amount < 1 ||
        typeof candidate.createdAt !== 'string' || candidate.createdAt.trim().length === 0
      ) return [];
      return [{
        id: candidate.id.trim(),
        studentNumber,
        amount,
        createdAt: candidate.createdAt,
      }];
    }).slice(0, CLASS_DONATION_HISTORY_LIMIT)
    : [];

  return {
    enabled: parsed.enabled === true,
    itemName: typeof parsed.itemName === 'string' ? parsed.itemName.slice(0, 60) : '',
    targetAmount,
    totalAmount,
    history,
  };
};

export const getClassDonationPublicState = (value: unknown): ClassDonationPublicState => {
  const settings = normalizeClassDonationSettings(value);
  return {
    enabled: settings.enabled,
    targetAmount: settings.targetAmount,
    totalAmount: settings.totalAmount,
  };
};

export const mergeClassDonationActivity = (remoteValue: unknown, nextValue: unknown): ClassDonationSettings => {
  const remote = normalizeClassDonationSettings(remoteValue);
  const next = normalizeClassDonationSettings(nextValue);
  return {
    ...next,
    targetAmount: Math.max(next.targetAmount, remote.totalAmount),
    totalAmount: remote.totalAmount,
    history: remote.history,
  };
};

export const getClassDonationMaximum = (
  state: ClassDonationPublicState,
  availableBalance: number,
) => Math.max(0, Math.min(
  clampCurrencyBalance(availableBalance),
  state.targetAmount - state.totalAmount,
));

export const parseClassDonationResult = (value: unknown): ClassDonationResult => {
  if (!isRecord(value)) throw new Error('CLASS_DONATION_INVALID_RESPONSE');
  const donatedAmount = Number(value.donatedAmount);
  const balance = Number(value.balance);
  const totalAmount = Number(value.totalAmount);
  const targetAmount = Number(value.targetAmount);
  if (
    !Number.isInteger(donatedAmount) || donatedAmount < 1 ||
    !Number.isInteger(balance) || balance < 0 ||
    !Number.isInteger(totalAmount) || totalAmount < 0 ||
    !Number.isInteger(targetAmount) || targetAmount < 1 ||
    typeof value.completed !== 'boolean'
  ) throw new Error('CLASS_DONATION_INVALID_RESPONSE');
  return { donatedAmount, balance, totalAmount, targetAmount, completed: value.completed };
};
