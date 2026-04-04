import type {
  DictionaryCaseOption,
  DictionaryLexicalOrigin,
  DictionarySense,
  Meaning,
  Syllable,
} from './models';

export const DEFAULT_AMBIGUOUS_NOTE =
  '동형이의어일 수 있어서 문맥이 있어야 정확한 한자를 정할 수 있어요.';
export const NATIVE_KOREAN_NOTE = '이 낱말은 고유어라서 한자로 풀이하지 않아요.';
export const LOANWORD_NOTE = '이 낱말은 외래어라서 한자로 풀이하지 않아요.';

export const sanitizeInlineText = (value: unknown, maxLength: number) => {
  if (typeof value !== 'string') return '';

  return value
    .replace(/\s+/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, maxLength);
};

export const sanitizeWord = (value: string) => sanitizeInlineText(value, 40);
export const sanitizeLookupNote = (value: unknown, maxLength = 120) =>
  sanitizeInlineText(value, maxLength);
export const hasHangul = (value: string) => /[가-힣]/.test(value);
export const toWordKey = (value: string) => sanitizeWord(value).toLocaleLowerCase('ko-KR');
export const toCompactText = (value: string) =>
  sanitizeInlineText(value, 80).replace(/\s+/g, '');

export const normalizeSyllableNote = (value: unknown) => {
  const note = sanitizeLookupNote(value);
  if (!note) return DEFAULT_AMBIGUOUS_NOTE;

  const lowerNote = note.toLowerCase();
  if (
    lowerNote.includes('native korean') ||
    lowerNote.includes('pure korean') ||
    lowerNote.includes('not a hanja') ||
    lowerNote.includes('not hanja') ||
    note.includes('고유어') ||
    note.includes('한자어가 아니')
  ) {
    return NATIVE_KOREAN_NOTE;
  }

  if (
    lowerNote.includes('homonym') ||
    lowerNote.includes('ambiguous') ||
    lowerNote.includes('context') ||
    lowerNote.includes('multiple hanja') ||
    note.includes('동형이의어') ||
    note.includes('문맥')
  ) {
    return DEFAULT_AMBIGUOUS_NOTE;
  }

  if (hasHangul(note)) return note;
  return DEFAULT_AMBIGUOUS_NOTE;
};

export const doesResponseWordMatch = (value: unknown, requestedWord: string) => {
  if (typeof value !== 'string') return false;

  const responseWord = sanitizeWord(value);
  if (!responseWord) return false;

  return (
    toWordKey(responseWord) === toWordKey(requestedWord) ||
    toCompactText(responseWord) === toCompactText(requestedWord)
  );
};

export const getWordCharacters = (word: string) => Array.from(word);

export const buildFallbackSyllables = (word: string): Syllable[] =>
  getWordCharacters(word).map((char) => ({
    char,
    isHanja: false,
  }));

export const dedupeStrings = (values: string[]) => Array.from(new Set(values));

export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const buildSenseId = (word: string, order: number) =>
  `${toWordKey(word) || sanitizeWord(word)}-sense-${order}`;

export const buildSensesFromMeanings = (
  word: string,
  meanings: Meaning[],
): DictionarySense[] =>
  meanings.map((meaning, index) => ({
    id: buildSenseId(word, index + 1),
    order: index + 1,
    definition: meaning.meaning,
    example: meaning.example,
    simplifiedDefinition: meaning.meaning,
    simplifiedExample: meaning.example,
    partOfSpeech: 'unknown',
    sourceType: 'generated_ai',
  }));

export const guessLexicalOriginFromSyllables = (
  syllables: Syllable[],
  syllableNote: string | null,
  caseOptions: DictionaryCaseOption[] | null,
): DictionaryLexicalOrigin => {
  if (syllableNote === NATIVE_KOREAN_NOTE) {
    return 'native_korean';
  }

  const hasResolvedHanja = syllables.some((syllable) => syllable.isHanja);
  const hasResolvedNonHanja = syllables.some((syllable) => !syllable.isHanja);

  if (hasResolvedHanja && hasResolvedNonHanja) {
    return 'mixed';
  }

  if (hasResolvedHanja) {
    return 'sino_korean';
  }

  const caseOptionHasHanja = (caseOptions || []).some((caseOption) =>
    caseOption.syllables.some((syllable) => syllable.isHanja),
  );

  if (caseOptionHasHanja) {
    return 'sino_korean';
  }

  return 'unknown';
};
