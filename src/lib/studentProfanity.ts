import { studentProfanityWordsSource } from '../data/studentProfanityWords';

const WORD_TOKEN_PATTERN = /[\p{L}\p{N}]+/gu;
const KOREAN_WORD_PATTERN = /^[가-힣]+$/u;
const STUDENT_FREE_TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel']);

const normalizeStudentText = (value: string) => (
  value
    .normalize('NFKC')
    .toLocaleLowerCase('ko-KR')
    .match(WORD_TOKEN_PATTERN) ?? []
);

const profanityWords = studentProfanityWordsSource
  .split(/\r?\n/)
  .map((word) => word.trim())
  .filter((word) => word.length > 0 && !word.startsWith('#'));

const tokenOnlyWords = new Set(
  profanityWords.filter((word) => [...word].length === 2 || !KOREAN_WORD_PATTERN.test(word)),
);
const tokenOnlyWordsWhileTyping = new Set(
  [...tokenOnlyWords].filter((word) => [...word].length >= 3),
);
const inlineKoreanWords = profanityWords
  .filter((word) => [...word].length >= 3 && KOREAN_WORD_PATTERN.test(word))
  .sort((left, right) => right.length - left.length);
const inlineKoreanPattern = new RegExp(inlineKoreanWords.join('|'), 'u');

const findInlineKoreanTerm = (compact: string): string | null => (
  inlineKoreanPattern.exec(compact)?.[0] ?? null
);

export const isStudentFreeTextInputType = (inputType: string): boolean => (
  STUDENT_FREE_TEXT_INPUT_TYPES.has(inputType)
);

export const findStudentForbiddenTerm = (value: string): string | null => {
  const tokens = normalizeStudentText(value);
  const compact = tokens.join('');
  const inlineTerm = findInlineKoreanTerm(compact);
  if (inlineTerm !== null) return inlineTerm;

  for (const token of tokens) {
    if (tokenOnlyWords.has(token)) return token;
  }

  return tokenOnlyWords.has(compact) ? compact : null;
};

export const shouldBlockStudentTextWhileTyping = (value: string): boolean => {
  const tokens = normalizeStudentText(value);
  const compact = tokens.join('');
  if (findInlineKoreanTerm(compact) !== null) return true;

  return tokens.some((token) => tokenOnlyWordsWhileTyping.has(token))
    || tokenOnlyWordsWhileTyping.has(compact);
};
