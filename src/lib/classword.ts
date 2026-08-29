export const CLASSWORD_INITIALS = [
  'ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const;

export const CLASSWORD_ENTRY_RETENTION_DAYS = 14;

export type ClasswordInitial = typeof CLASSWORD_INITIALS[number];

export type ClasswordEntry = {
  readonly id: string;
  readonly dateKey: string;
  readonly initial: ClasswordInitial;
  readonly word: string;
  readonly studentNumber: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type ClasswordBoard = {
  readonly dateKey: string;
  readonly topic: string;
  readonly entries: readonly ClasswordEntry[];
};

export type ClasswordRoundSummary = {
  readonly dateKey: string;
  readonly topic: string;
};

export type ClasswordWordErrorCode =
  | 'empty'
  | 'same_topic'
  | 'number_only'
  | 'special_character'
  | 'too_long'
  | 'jamo_only'
  | 'repeated_character'
  | 'blocked_word'
  | 'non_korean_start'
  | 'wrong_initial';

export type ClasswordWordValidation =
  | { readonly ok: true; readonly word: string }
  | { readonly ok: false; readonly code: ClasswordWordErrorCode; readonly message: string };

const CHOSEONG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ',
  'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const;

const INITIAL_ALIASES: Partial<Record<ClasswordInitial, string>> = {
  ㄱ: 'ㄲ',
  ㄷ: 'ㄸ',
  ㅂ: 'ㅃ',
  ㅅ: 'ㅆ',
  ㅈ: 'ㅉ',
};

const BLOCKED_WORDS = ['씨발', '시발', '병신', '바보', '멍청이', '꺼져', '죽어', '똥개', '좆', 'ㅅㅂ'] as const;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/;
const JAMO_ONLY_PATTERN = /^[ㄱ-ㅎㅏ-ㅣ]+$/;
const NUMBER_ONLY_PATTERN = /^\d+$/;
const SPECIAL_CHARACTER_PATTERN = /[^\p{L}\p{N}]/u;

export class ClasswordParseError extends Error {
  constructor() {
    super('CLASSWORD_BOARD_INVALID_RESPONSE');
    this.name = 'ClasswordParseError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

export const isClasswordInitial = (value: unknown): value is ClasswordInitial => (
  typeof value === 'string' && CLASSWORD_INITIALS.some((initial) => initial === value)
);

export const isClasswordDateKey = (value: unknown): value is string => (
  typeof value === 'string' && DATE_KEY_PATTERN.test(value)
);

export const isClasswordMonthKey = (value: unknown): value is string => (
  typeof value === 'string' && MONTH_KEY_PATTERN.test(value)
);

export const getKoreanDateKey = (date = new Date()): string => (
  new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
);

export const getClasswordEntryRetentionCutoff = (
  dateKey = getKoreanDateKey(),
): string => {
  const [year = 2000, month = 1, day = 1] = dateKey.split('-').map(Number);
  const cutoff = new Date(Date.UTC(year, month - 1, day));
  cutoff.setUTCDate(cutoff.getUTCDate() - (CLASSWORD_ENTRY_RETENTION_DAYS - 1));
  return cutoff.toISOString().slice(0, 10);
};

export const getClasswordInitialFromWord = (word: string): string | null => {
  const firstCharacter = [...word.trim()][0];
  if (!firstCharacter) return null;
  const syllableIndex = firstCharacter.charCodeAt(0) - 0xac00;
  if (syllableIndex < 0 || syllableIndex > 11171) return null;
  return CHOSEONG[Math.floor(syllableIndex / (21 * 28))] ?? null;
};

export const acceptsClasswordInitial = (
  selectedInitial: ClasswordInitial,
  actualInitial: string,
): boolean => selectedInitial === actualInitial || INITIAL_ALIASES[selectedInitial] === actualInitial;

export const getClasswordInitialLabel = (initial: ClasswordInitial): string => {
  const alias = INITIAL_ALIASES[initial];
  return alias ? `${initial}(${alias})` : initial;
};

export const sanitizeClasswordInput = (input: string): string => (
  [...input.replace(/[^\p{L}\p{N}]/gu, '')].slice(0, 8).join('')
);

const invalidWord = (code: ClasswordWordErrorCode, message: string): ClasswordWordValidation => ({
  ok: false,
  code,
  message,
});

export const validateClasswordWord = (
  input: string,
  selectedInitial: ClasswordInitial,
  topic = '',
): ClasswordWordValidation => {
  const word = input.trim();
  const normalizedTopic = topic.trim().replace(/\s+/g, '');
  if (!word) return invalidWord('empty', '낱말을 입력해 주세요.');
  if (normalizedTopic && word.replace(/\s+/g, '') === normalizedTopic) {
    return invalidWord('same_topic', '주제 낱말 말고 다른 낱말을 찾아 주세요.');
  }
  if (NUMBER_ONLY_PATTERN.test(word)) return invalidWord('number_only', '숫자만 쓸 수 없어요.');
  if (SPECIAL_CHARACTER_PATTERN.test(word)) return invalidWord('special_character', '특수 문자는 쓸 수 없어요.');
  if ([...word].length > 8) return invalidWord('too_long', '8글자까지 쓸 수 있어요.');
  if (JAMO_ONLY_PATTERN.test(word)) return invalidWord('jamo_only', '완성된 낱말을 써 주세요.');
  if (/(.)\1{2,}/u.test(word)) return invalidWord('repeated_character', '다른 낱말을 써 주세요.');
  if (BLOCKED_WORDS.some((blockedWord) => word.includes(blockedWord))) {
    return invalidWord('blocked_word', '다른 낱말을 써 주세요.');
  }
  const actualInitial = getClasswordInitialFromWord(word);
  if (!actualInitial) return invalidWord('non_korean_start', '한글 낱말로 시작해 주세요.');
  if (!acceptsClasswordInitial(selectedInitial, actualInitial)) {
    const alias = INITIAL_ALIASES[selectedInitial];
    return invalidWord(
      'wrong_initial',
      `${alias ? `${selectedInitial} 또는 ${alias}` : selectedInitial}으로 시작하는 낱말을 써 주세요.`,
    );
  }
  return { ok: true, word };
};

const parseEntry = (value: unknown): ClasswordEntry => {
  if (!isRecord(value)) throw new ClasswordParseError();
  const entry = {
    id: value.id,
    dateKey: value.dateKey,
    initial: value.initial,
    word: value.word,
    studentNumber: value.studentNumber,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
  if (
    typeof entry.id !== 'string'
    || !isClasswordDateKey(entry.dateKey)
    || !isClasswordInitial(entry.initial)
    || typeof entry.word !== 'string'
    || [...entry.word].length < 1
    || [...entry.word].length > 8
    || !Number.isInteger(entry.studentNumber)
    || Number(entry.studentNumber) < 1
    || Number(entry.studentNumber) > 23
    || typeof entry.createdAt !== 'string'
    || typeof entry.updatedAt !== 'string'
  ) throw new ClasswordParseError();
  return {
    id: entry.id,
    dateKey: entry.dateKey,
    initial: entry.initial,
    word: entry.word,
    studentNumber: Number(entry.studentNumber),
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
};

export const parseClasswordBoard = (value: unknown): ClasswordBoard => {
  if (!isRecord(value) || !isClasswordDateKey(value.dateKey) || typeof value.topic !== 'string' || !Array.isArray(value.entries)) {
    throw new ClasswordParseError();
  }
  return {
    dateKey: value.dateKey,
    topic: value.topic,
    entries: value.entries.map(parseEntry),
  };
};

export const parseClasswordRounds = (value: unknown): readonly ClasswordRoundSummary[] => {
  if (!Array.isArray(value)) throw new ClasswordParseError();
  return value.map((round) => {
    if (!isRecord(round) || !isClasswordDateKey(round.dateKey) || typeof round.topic !== 'string') {
      throw new ClasswordParseError();
    }
    return { dateKey: round.dateKey, topic: round.topic };
  });
};
