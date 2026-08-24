import {
  CURRENCY_BALANCE_MAX,
  CURRENCY_STUDENT_NUMBERS,
  DEFAULT_CURRENCY_BALANCE,
  normalizeCurrencyBalances,
  normalizeCurrencyHistory,
  type CurrencyBalances,
  type CurrencyHistory,
  type CurrencyHistoryEntry,
} from './currency';
import { getKoreanLocalDateKey } from './studentEmotion';
import { createStudentLetter, type StudentLetter, type StudentLifeState } from './studentLife';

export const DAILY_WRITING_REWARD = 25;
export const DAILY_WRITING_SENDER_LABEL = '밥집 아주머니 가히';
export const DAILY_WRITING_STAMP_IMAGE_SOURCE = '/daily-writing-letter-gahi.png';
export const DAILY_WRITING_COOK_IMAGE_SOURCE = '/daily-writing-cook-gahi.png';

export type DailyWritingAssignment = {
  readonly dateKey: string;
  readonly topic: string;
  readonly requiredWord: string;
  readonly requiredWordMeaning: string;
  readonly rewardAmount: typeof DAILY_WRITING_REWARD;
  readonly publishedAt: string;
};

export type DailyWritingState = {
  readonly assignment: DailyWritingAssignment | null;
  readonly completedStudentNumbers: readonly number[];
};

type DailyWritingDraft = Omit<DailyWritingAssignment, 'rewardAmount'>;

export type DailyWritingPublishResult = {
  readonly state: DailyWritingState;
  readonly studentLife: StudentLifeState;
};

type DailyWritingRewardSettingsValue = {
  readonly currencyBalances?: unknown;
  readonly currencyHistory?: unknown;
};

export type DailyWritingRewardResult<T extends DailyWritingRewardSettingsValue> = {
  readonly value: T & { readonly currencyBalances: CurrencyBalances; readonly currencyHistory: CurrencyHistory };
  readonly balances: CurrencyBalances;
  readonly history: CurrencyHistory;
  readonly awarded: boolean;
};

export type DailyWritingRewardCancellationResult<T extends DailyWritingRewardSettingsValue> = {
  readonly value: T & { readonly currencyBalances: CurrencyBalances; readonly currencyHistory: CurrencyHistory };
  readonly balances: CurrencyBalances;
  readonly history: CurrencyHistory;
  readonly cancelled: boolean;
};

const DAILY_WRITING_STORAGE_KEY = 'school-timer-daily-writing-v1';
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAILY_WRITING_LETTER_ID_PATTERN = /^daily-writing-letter-(\d{4}-\d{2}-\d{2})-\d+$/;

const parseAssignment = (value: unknown): DailyWritingAssignment | null => {
  if (!value || typeof value !== 'object') return null;
  const assignment = value as Partial<DailyWritingAssignment>;
  const dateKey = typeof assignment.dateKey === 'string' ? assignment.dateKey.trim() : '';
  const topic = typeof assignment.topic === 'string' ? assignment.topic.trim().slice(0, 100) : '';
  const requiredWord = typeof assignment.requiredWord === 'string'
    ? assignment.requiredWord.trim().slice(0, 20)
    : '';
  const requiredWordMeaning = typeof assignment.requiredWordMeaning === 'string'
    ? assignment.requiredWordMeaning.trim().slice(0, 120)
    : '';
  const publishedAt = typeof assignment.publishedAt === 'string' ? assignment.publishedAt.trim() : '';
  if (!DATE_KEY_PATTERN.test(dateKey) || !topic || !requiredWord || !publishedAt) return null;
  return { dateKey, topic, requiredWord, requiredWordMeaning, rewardAmount: DAILY_WRITING_REWARD, publishedAt };
};

export const normalizeDailyWritingState = (value: unknown): DailyWritingState => {
  if (!value || typeof value !== 'object') return { assignment: null, completedStudentNumbers: [] };
  const state = value as { assignment?: unknown; completedStudentNumbers?: unknown };
  const rawCompletedStudentNumbers = Array.isArray(state.completedStudentNumbers)
    ? state.completedStudentNumbers
    : [];
  const completedStudentNumbers = CURRENCY_STUDENT_NUMBERS.filter((studentNumber) => (
    rawCompletedStudentNumbers.some((candidate) => candidate === studentNumber)
  ));
  return { assignment: parseAssignment(state.assignment), completedStudentNumbers };
};

export const markDailyWritingStudentRewarded = (
  state: DailyWritingState,
  studentNumber: number,
  dateKey: string,
): DailyWritingState => {
  if (
    state.assignment?.dateKey !== dateKey
    || !CURRENCY_STUDENT_NUMBERS.includes(studentNumber)
    || state.completedStudentNumbers.includes(studentNumber)
  ) return state;
  return { ...state, completedStudentNumbers: [...state.completedStudentNumbers, studentNumber].sort((a, b) => a - b) };
};

export const unmarkDailyWritingStudentRewarded = (
  state: DailyWritingState,
  studentNumber: number,
  dateKey: string,
): DailyWritingState => {
  if (state.assignment?.dateKey !== dateKey || !state.completedStudentNumbers.includes(studentNumber)) return state;
  return {
    ...state,
    completedStudentNumbers: state.completedStudentNumbers.filter((candidate) => candidate !== studentNumber),
  };
};

export const isDailyWritingWeekday = (dateKey: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return false;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (getKoreanLocalDateKey(date) !== dateKey) return false;
  const weekday = date.getDay();
  return weekday >= 1 && weekday <= 5;
};

export const getNextDailyWritingDateKey = (today = new Date()): string => {
  const nextDate = new Date(today);
  do {
    nextDate.setDate(nextDate.getDate() + 1);
  } while (!isDailyWritingWeekday(getKoreanLocalDateKey(nextDate)));
  return getKoreanLocalDateKey(nextDate);
};

const getDailyWritingLetterId = (dateKey: string, studentNumber: number): string => (
  `daily-writing-letter-${dateKey}-${studentNumber}`
);

export const isDailyWritingLetter = (letter: Pick<StudentLetter, 'id'>): boolean => (
  letter.id.startsWith('daily-writing-letter-')
);

export const hasDailyWritingLetterForDate = (
  letters: readonly Pick<StudentLetter, 'id'>[],
  dateKey: string,
): boolean => letters.some(
  (letter) => DAILY_WRITING_LETTER_ID_PATTERN.exec(letter.id)?.[1] === dateKey,
);

export const getDailyWritingAssignedDateKeys = (
  letters: readonly Pick<StudentLetter, 'id'>[],
): readonly string[] => (
  [...new Set(letters.flatMap((letter) => {
    const dateKey = DAILY_WRITING_LETTER_ID_PATTERN.exec(letter.id)?.[1];
    return dateKey ? [dateKey] : [];
  }))].sort()
);

const createDailyWritingLetterContent = (
  topic: string,
  requiredWord: string,
  requiredWordMeaning: string,
  rewardAmount: number,
): string => [
  '• 글밥 주제',
  `  “${topic}”`,
  '',
  '• 꼭 쓸 낱말',
  `  “${requiredWord}”`,
  `  뜻: ${requiredWordMeaning}`,
  '',
  '꼭 쓸 낱말을 글에 한 번 써 보는 거다멍.',
  `선생님께 제출하면 ${rewardAmount}고마를 받을 수 있다멍!`,
].join('\n');

const normalizeDailyWritingGahiTone = (value: string): string => {
  const normalized = value
    .replace(/^내일의 글밥/, '오늘의 글밥')
    .replace(/^\d{1,2}월 \d{1,2}일 글밥 주제는/, '오늘 글밥 주제는')
    .replace(/^글밥 주제는/, '오늘 글밥 주제는')
    .replace(/써 보꿀/g, '써 보는 거다멍')
    .replace(/수 있꿀/g, '수 있다멍')
    .replaceAll('꿀', '멍')
    .replace(/도착했멍/g, '도착했다멍')
    .replace(/써 보라멍/g, '써 보는 거다멍')
    .replaceAll('• 꼭 넣을 낱말', '• 꼭 쓸 낱말')
    .replaceAll('필수 낱말을 한 번 넣어 글을 써 보는 거다멍.', '꼭 쓸 낱말을 글에 한 번 써 보는 거다멍.')
    .replace(/”이야\./g, '”이다멍.')
    .replace(/”이멍\./g, '”이다멍.')
    .replace(/수 있멍/g, '수 있다멍');
  const detailedContent = /^오늘 글밥 주제는 “([^”]+)”이다멍\. 꼭 넣을 낱말은 “([^”]+)”이고, 뜻은 “([^”]+)”이다멍\. 글에 한 번 넣어 선생님께 제출하면 (\d+)고마를 받을 수 있다멍!$/.exec(normalized);
  if (detailedContent) {
    return createDailyWritingLetterContent(
      detailedContent[1],
      detailedContent[2],
      detailedContent[3],
      Number(detailedContent[4]),
    );
  }
  const legacyContent = /^오늘 글밥 주제는 “([^”]+)”이다멍\.\s*(.+)$/.exec(normalized);
  if (!legacyContent) return normalized;
  return [
    '• 글밥 주제',
    `  “${legacyContent[1]}”`,
    '',
    '• 꼭 쓸 낱말',
    '  예전 편지에는 낱말 정보가 남아 있지 않다멍.',
    '  뜻: 확인할 수 없다멍.',
    '',
    legacyContent[2],
  ].join('\n');
};

export const normalizeDailyWritingLetterForDisplay = (letter: StudentLetter): StudentLetter => (
  isDailyWritingLetter(letter)
    ? {
      ...letter,
      senderLabel: DAILY_WRITING_SENDER_LABEL,
      title: normalizeDailyWritingGahiTone(letter.title),
      content: normalizeDailyWritingGahiTone(letter.content),
    }
    : letter
);

export const publishDailyWritingAssignment = (
  currentState: DailyWritingState,
  currentStudentLife: StudentLifeState,
  draft: DailyWritingDraft,
): DailyWritingPublishResult => {
  if (!isDailyWritingWeekday(draft.dateKey) || !draft.requiredWordMeaning.trim()) {
    return { state: currentState, studentLife: currentStudentLife };
  }
  const assignment = parseAssignment({ ...draft, rewardAmount: DAILY_WRITING_REWARD });
  if (!assignment) {
    return { state: currentState, studentLife: currentStudentLife };
  }

  const letterIds = new Set(CURRENCY_STUDENT_NUMBERS.map((studentNumber) => (
    getDailyWritingLetterId(assignment.dateKey, studentNumber)
  )));
  const studentLifeWithoutPreviousEdition = {
    ...currentStudentLife,
    letters: currentStudentLife.letters.filter((letter) => !letterIds.has(letter.id)),
  };
  const content = createDailyWritingLetterContent(
    assignment.topic,
    assignment.requiredWord,
    assignment.requiredWordMeaning,
    DAILY_WRITING_REWARD,
  );
  const studentLife = CURRENCY_STUDENT_NUMBERS.reduce<StudentLifeState>((state, studentNumber) => (
    createStudentLetter(state, {
      id: getDailyWritingLetterId(assignment.dateKey, studentNumber),
      recipient: studentNumber,
      senderLabel: DAILY_WRITING_SENDER_LABEL,
      title: '오늘의 글밥이 도착했다멍',
      content,
      createdAt: assignment.publishedAt,
    })
  ), studentLifeWithoutPreviousEdition);

  return {
    state: {
      assignment,
      completedStudentNumbers: currentState.assignment?.dateKey === assignment.dateKey
        ? currentState.completedStudentNumbers
        : [],
    },
    studentLife,
  };
};

const getDailyWritingRewardId = (studentNumber: number, dateKey: string): string => (
  `daily-writing-reward-${dateKey}-${studentNumber}`
);

export const hasDailyWritingReward = (
  currencyHistory: unknown,
  studentNumber: number,
  dateKey: string,
): boolean => (
  normalizeCurrencyHistory(currencyHistory)[String(studentNumber)]?.some(
    (entry) => entry.id === getDailyWritingRewardId(studentNumber, dateKey),
  ) ?? false
);

export const claimDailyWritingRewardInSettings = <T extends DailyWritingRewardSettingsValue>(
  currentValue: T,
  studentNumber: number,
  dateKey: string,
): DailyWritingRewardResult<T> => {
  const balances = normalizeCurrencyBalances(currentValue.currencyBalances);
  const history = normalizeCurrencyHistory(currentValue.currencyHistory);
  const key = String(studentNumber);
  const before = balances[key] ?? DEFAULT_CURRENCY_BALANCE;
  const rewardId = getDailyWritingRewardId(studentNumber, dateKey);
  const isValidStudent = CURRENCY_STUDENT_NUMBERS.includes(studentNumber);
  const alreadyAwarded = history[key]?.some((entry) => entry.id === rewardId) ?? false;
  if (!isValidStudent || !DATE_KEY_PATTERN.test(dateKey) || alreadyAwarded || before > CURRENCY_BALANCE_MAX - DAILY_WRITING_REWARD) {
    return { value: { ...currentValue, currencyBalances: balances, currencyHistory: history }, balances, history, awarded: false };
  }

  const after = before + DAILY_WRITING_REWARD;
  const entry: CurrencyHistoryEntry = {
    id: rewardId,
    studentNumber,
    delta: DAILY_WRITING_REWARD,
    before,
    after,
    reason: 'daily_writing',
    createdAt: new Date().toISOString(),
  };
  const nextBalances = { ...balances, [key]: after };
  const nextHistory = { ...history, [key]: [entry, ...(history[key] ?? [])] };
  return {
    value: { ...currentValue, currencyBalances: nextBalances, currencyHistory: nextHistory },
    balances: nextBalances,
    history: nextHistory,
    awarded: true,
  };
};

export const cancelDailyWritingRewardInSettings = <T extends DailyWritingRewardSettingsValue>(
  currentValue: T,
  studentNumber: number,
  dateKey: string,
): DailyWritingRewardCancellationResult<T> => {
  const balances = normalizeCurrencyBalances(currentValue.currencyBalances);
  const history = normalizeCurrencyHistory(currentValue.currencyHistory);
  const key = String(studentNumber);
  const studentHistory = history[key] ?? [];
  const rewardIndex = studentHistory.findIndex(
    (entry) => entry.id === getDailyWritingRewardId(studentNumber, dateKey),
  );
  const currentBalance = balances[key] ?? DEFAULT_CURRENCY_BALANCE;
  const newerEntries = rewardIndex > 0 ? studentHistory.slice(0, rewardIndex) : [];
  const canRebaseNewerEntries = newerEntries.every(
    (entry) => entry.before >= DAILY_WRITING_REWARD && entry.after >= DAILY_WRITING_REWARD,
  );
  if (
    !CURRENCY_STUDENT_NUMBERS.includes(studentNumber)
    || !DATE_KEY_PATTERN.test(dateKey)
    || rewardIndex < 0
    || currentBalance < DAILY_WRITING_REWARD
    || !canRebaseNewerEntries
  ) {
    return {
      value: { ...currentValue, currencyBalances: balances, currencyHistory: history },
      balances,
      history,
      cancelled: false,
    };
  }

  const nextStudentHistory = studentHistory.flatMap((entry, index) => {
    if (index === rewardIndex) return [];
    if (index > rewardIndex) return [entry];
    return [{
      ...entry,
      before: entry.before - DAILY_WRITING_REWARD,
      after: entry.after - DAILY_WRITING_REWARD,
    }];
  });
  const nextBalances = { ...balances, [key]: currentBalance - DAILY_WRITING_REWARD };
  const nextHistory = { ...history, [key]: nextStudentHistory };
  return {
    value: { ...currentValue, currencyBalances: nextBalances, currencyHistory: nextHistory },
    balances: nextBalances,
    history: nextHistory,
    cancelled: true,
  };
};

export const loadStoredDailyWritingState = (): DailyWritingState => {
  try {
    const stored = window.localStorage.getItem(DAILY_WRITING_STORAGE_KEY);
    return normalizeDailyWritingState(stored ? JSON.parse(stored) : null);
  } catch (error) {
    if (error instanceof Error) return normalizeDailyWritingState(null);
    throw error;
  }
};

export const storeDailyWritingState = (state: DailyWritingState): void => {
  window.localStorage.setItem(DAILY_WRITING_STORAGE_KEY, JSON.stringify(normalizeDailyWritingState(state)));
};
