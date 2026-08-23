import { CURRENCY_BALANCE_MAX, clampCurrencyBalance } from './currency.js';
import { createStudentLetter, type StudentLifeState } from './studentLife.js';

export const CLASS_DONATION_DEFAULT_TARGET = 500;
export const CLASS_DONATION_HISTORY_LIMIT = 500;
export const CLASS_DONATION_MAIL_SENDER_LABEL = '아기고마';
export const CLASS_DONATION_MAIL_IMAGE_SOURCE = '/mail-donation-baby-goma.png';

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

type ClassDonationThankYouLetterInput = {
  readonly studentNumber: number;
  readonly donatedAmount: number;
  readonly requestId: string;
  readonly createdAt: string;
};

type ClassDonationThankYouMessage = {
  readonly title: string;
  readonly content: (donatedAmount: number) => string;
};

const CLASS_DONATION_THANK_YOU_MESSAGES: readonly ClassDonationThankYouMessage[] = [
  {
    title: '따뜻한 마음을 받아서 기쁘고마!',
    content: (amount) => `소중한 ${amount}고마를 나눠 줘서 정말 고맙고마! 네 마음 덕분에 우리 반의 꿈이 한 걸음 가까워졌고마!`,
  },
  {
    title: '나눔이 반짝반짝 빛나고마!',
    content: (amount) => `${amount}고마에 담긴 따뜻한 마음을 잘 받았고마! 함께해 줘서 내 마음도 몽글몽글해졌고마!`,
  },
  {
    title: '우리 반에 큰 힘이 되었고마!',
    content: (amount) => `기부해 준 ${amount}고마가 우리 반에 큰 힘이 되었고마! 멋진 나눔을 실천한 너를 힘껏 응원하겠고마!`,
  },
  {
    title: '목표에 더 가까워졌고마!',
    content: (amount) => `네가 보내 준 ${amount}고마 덕분에 목표에 더 가까워졌고마! 소중한 마음을 오래오래 기억하겠고마!`,
  },
  {
    title: '커다란 기적을 만들고마!',
    content: (amount) => `작은 나눔도 함께 모이면 커다란 기적이 되고마! ${amount}고마를 보태 준 네 마음이 정말 예쁘고마!`,
  },
  {
    title: '오늘이 더 환해졌고마!',
    content: (amount) => `우리 반을 생각하며 ${amount}고마를 나눠 줘서 고맙고마! 네 따뜻한 선택 덕분에 오늘이 더 환해졌고마!`,
  },
  {
    title: '소중한 응원을 잘 받았고마!',
    content: (amount) => `${amount}고마와 함께 네 응원도 잘 받았고마! 나도 힘내서 우리 반의 꿈을 응원하겠고마!`,
  },
  {
    title: '함께해 줘서 든든하고마!',
    content: (amount) => `기꺼이 나눠 준 ${amount}고마가 든든한 힘이 되었고마! 다정한 마음을 보여 준 네가 참 멋지고마!`,
  },
];

const getClassDonationThankYouMessage = (requestId: string) => {
  const messageIndex = Array.from(requestId).reduce(
    (sum, character) => sum + character.charCodeAt(0),
    0,
  ) % CLASS_DONATION_THANK_YOU_MESSAGES.length;
  return CLASS_DONATION_THANK_YOU_MESSAGES[messageIndex] ?? CLASS_DONATION_THANK_YOU_MESSAGES[0];
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const clampDonationAmount = (value: unknown, fallback: number) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(CURRENCY_BALANCE_MAX, Math.floor(parsed)));
};

export const createClassDonationThankYouLetter = (
  state: StudentLifeState,
  input: ClassDonationThankYouLetterInput,
): StudentLifeState => {
  const message = getClassDonationThankYouMessage(input.requestId);
  return createStudentLetter(state, {
    id: input.requestId,
    recipient: input.studentNumber,
    senderLabel: CLASS_DONATION_MAIL_SENDER_LABEL,
    title: message.title,
    content: message.content(input.donatedAmount),
    createdAt: input.createdAt,
  });
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

export const isClassDonationCompleted = (state: ClassDonationPublicState) => (
  state.totalAmount >= state.targetAmount
);

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
