import { GoogleGenAI } from '@google/genai';

export interface Meaning {
  meaning: string;
  example: string;
}

export interface Syllable {
  char: string;
  isHanja: boolean;
  hanjaChar?: string;
  hanjaMeaning?: string;
  relatedWords?: string[];
}

export interface MeaningResult {
  word: string;
  meanings: Meaning[];
}

export interface DictionaryCaseOption {
  label: string;
  description: string;
  syllables: Syllable[];
  meanings: Meaning[];
}

export interface DictionaryResult {
  word: string;
  meanings: Meaning[] | null;
  syllables: Syllable[] | null;
  syllableNote: string | null;
  caseOptions: DictionaryCaseOption[] | null;
}

export type DictionaryErrorCode =
  | 'empty_word'
  | 'not_found'
  | 'missing_api_key'
  | 'invalid_api_key'
  | 'network'
  | 'invalid_response'
  | 'unknown';

export class DictionaryLookupError extends Error {
  code: DictionaryErrorCode;

  constructor(code: DictionaryErrorCode, message?: string) {
    super(message || code);
    this.name = 'DictionaryLookupError';
    this.code = code;
  }
}

const DICTIONARY_MODEL = 'gemini-2.5-flash';
const MAX_MEANINGS = 2;
const MAX_RELATED_WORDS = 3;
const SIMPLE_NOUN_MEANING_ALLOWLIST = new Set([
  '불',
  '물',
  '힘',
  '손',
  '발',
  '눈',
  '귀',
  '입',
  '집',
  '길',
  '빛',
  '별',
  '산',
  '강',
  '꽃',
  '풀',
  '돌',
  '씨',
  '말',
  '글',
  '마음',
  '사람',
  '하늘',
  '땅',
]);

const meaningCache = new Map<string, MeaningResult>();
const meaningPromiseCache = new Map<string, Promise<MeaningResult>>();
const syllableCache = new Map<string, SyllableResult>();
const syllablePromiseCache = new Map<string, Promise<SyllableResult>>();

let dictionaryAiClient: GoogleGenAI | null = null;

interface SyllableResult {
  word: string;
  syllables: Syllable[];
  status: 'resolved' | 'ambiguous';
  syllableNote: string | null;
  caseOptions: DictionaryCaseOption[] | null;
}

const getRuntimeGeminiApiKey = () => {
  const processValue = (
    globalThis as typeof globalThis & {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process;

  return processValue?.env?.GEMINI_API_KEY?.trim() || '';
};

const getGeminiApiKey = () => {
  const buildTimeApiKey =
    typeof __GEMINI_API_KEY__ === 'string' ? __GEMINI_API_KEY__.trim() : '';

  return buildTimeApiKey || getRuntimeGeminiApiKey();
};

const getDictionaryClient = () => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new DictionaryLookupError(
      'missing_api_key',
      '낱말 사전을 쓰려면 Gemini API 키가 필요합니다.',
    );
  }

  if (!dictionaryAiClient) {
    dictionaryAiClient = new GoogleGenAI({ apiKey });
  }

  return dictionaryAiClient;
};

const sanitizeInlineText = (value: unknown, maxLength: number) => {
  if (typeof value !== 'string') return '';

  return value
    .replace(/\s+/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, maxLength);
};

const sanitizeWord = (value: string) => sanitizeInlineText(value, 40);
const sanitizeLookupNote = (value: unknown, maxLength = 120) => sanitizeInlineText(value, maxLength);
const hasHangul = (value: string) => /[가-힣]/.test(value);
const DEFAULT_AMBIGUOUS_NOTE = '동형이의어일 수 있어서 문맥이 있어야 정확한 한자를 정할 수 있어요.';
const NATIVE_KOREAN_NOTE = '이 낱말은 고유어라서 한자로 풀이하지 않아요.';

const normalizeSyllableNote = (value: unknown) => {
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

const toWordKey = (value: string) => sanitizeWord(value).toLocaleLowerCase('ko-KR');
const toCompactText = (value: string) => sanitizeInlineText(value, 80).replace(/\s+/g, '');

const getWordCharacters = (word: string) => Array.from(word);

const buildFallbackSyllables = (word: string): Syllable[] =>
  getWordCharacters(word).map((char) => ({
    char,
    isHanja: false,
  }));

const createResolvedFallbackSyllableResult = (word: string): SyllableResult => ({
  word,
  syllables: buildFallbackSyllables(word),
  status: 'resolved',
  syllableNote: null,
  caseOptions: null,
});

const dedupeStrings = (values: string[]) => Array.from(new Set(values));

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const sanitizeRelatedWords = (value: unknown, requestedWord: string, currentChar: string) => {
  if (!Array.isArray(value)) return [];

  const requestedWordCompact = toCompactText(requestedWord);

  return dedupeStrings(
    value
      .map((relatedWord) => sanitizeInlineText(relatedWord, 20))
      .filter(Boolean),
  )
    .filter((relatedWord) => {
      const compactRelatedWord = toCompactText(relatedWord);

      if (!compactRelatedWord) return false;
      if (compactRelatedWord.length < 2 || compactRelatedWord.length > 6) return false;
      if (!compactRelatedWord.includes(currentChar)) return false;
      if (compactRelatedWord === requestedWordCompact) return false;
      if (requestedWordCompact && compactRelatedWord.includes(requestedWordCompact)) return false;

      return true;
    })
    .slice(0, MAX_RELATED_WORDS);
};

const isSuspiciousHanjaMeaning = (
  hanjaMeaning: string,
  requestedWord: string,
  currentChar: string,
  relatedWords: string[],
) => {
  const compactMeaning = toCompactText(hanjaMeaning);

  if (!compactMeaning) return true;
  if (compactMeaning === toCompactText(requestedWord)) return true;
  if (compactMeaning === toCompactText(currentChar)) return true;

  if (
    /^[가-힣]{1,2}$/.test(compactMeaning) &&
    !compactMeaning.endsWith('다') &&
    !SIMPLE_NOUN_MEANING_ALLOWLIST.has(compactMeaning) &&
    relatedWords.length === 0
  ) {
    return true;
  }

  return false;
};

const classifyLookupError = (error: unknown) => {
  if (error instanceof DictionaryLookupError) return error;

  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'unknown';
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes('api key') ||
    normalizedMessage.includes('api_key') ||
    normalizedMessage.includes('permission') ||
    normalizedMessage.includes('unauth') ||
    normalizedMessage.includes('403') ||
    normalizedMessage.includes('401')
  ) {
    return new DictionaryLookupError('invalid_api_key', message);
  }

  if (
    normalizedMessage.includes('fetch') ||
    normalizedMessage.includes('network') ||
    normalizedMessage.includes('failed to fetch')
  ) {
    return new DictionaryLookupError('network', message);
  }

  if (
    normalizedMessage.includes('json') ||
    normalizedMessage.includes('schema') ||
    normalizedMessage.includes('candidate')
  ) {
    return new DictionaryLookupError('invalid_response', message);
  }

  return new DictionaryLookupError('unknown', message);
};

const parseJsonResponse = (text: string) => {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new DictionaryLookupError(
      'invalid_response',
      error instanceof Error ? error.message : 'JSON parse failed',
    );
  }
};

const sanitizeMeanings = (value: unknown) => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!isPlainObject(item)) return null;

      const meaning = sanitizeInlineText(item.meaning, 120);
      const example = sanitizeInlineText(item.example, 160);

      if (!meaning || !example) return null;

      return { meaning, example };
    })
    .filter((item): item is Meaning => item !== null)
    .slice(0, MAX_MEANINGS);
};

const sanitizeSyllables = (value: unknown, requestedWord: string) => {
  if (!Array.isArray(value)) return null;

  const characters = getWordCharacters(requestedWord);
  if (value.length !== characters.length) {
    return null;
  }

  const sanitizedSyllables = value.map((item, index) => {
    const currentChar = characters[index] || '';

    if (!isPlainObject(item)) {
      return null;
    }

    const responseChar = sanitizeInlineText(item.char, 4);
    if (responseChar !== currentChar) {
      return null;
    }

    const isHanja = item.isHanja === true;
    if (!isHanja) {
      return {
        char: currentChar,
        isHanja: false,
      } satisfies Syllable;
    }

    const hanjaChar = sanitizeInlineText(item.hanjaChar, 4);
    const hanjaMeaning = sanitizeInlineText(item.hanjaMeaning, 24);
    const relatedWords = sanitizeRelatedWords(item.relatedWords, requestedWord, currentChar);

    if (
      !hanjaChar ||
      !hanjaMeaning ||
      isSuspiciousHanjaMeaning(hanjaMeaning, requestedWord, currentChar, relatedWords)
    ) {
      return {
        char: currentChar,
        isHanja: false,
      } satisfies Syllable;
    }

    return {
      char: currentChar,
      isHanja: true,
      hanjaChar,
      hanjaMeaning,
      relatedWords,
    } satisfies Syllable;
  });

  if (sanitizedSyllables.some((item) => item === null)) {
    return null;
  }

  return sanitizedSyllables as Syllable[];
};

const sanitizeCaseOptions = (value: unknown, requestedWord: string) => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      if (!isPlainObject(item)) return null;

      const meanings = sanitizeMeanings(item.meanings);
      const syllables = sanitizeSyllables(item.syllables, requestedWord);
      const label = sanitizeInlineText(item.label, 36) || `${index + 1}\uBC88 \uB73B`;
      const description =
        sanitizeInlineText(item.description, 80) || meanings[0]?.meaning || '';

      if (!syllables || meanings.length === 0 || !description) {
        return null;
      }

      return {
        label,
        description,
        syllables,
        meanings,
      } satisfies DictionaryCaseOption;
    })
    .filter((item): item is DictionaryCaseOption => item !== null)
    .slice(0, 4);
};

const getSyllableSignature = (syllables: Syllable[]) =>
  syllables
    .map((syllable) =>
      syllable.isHanja
        ? `${syllable.char}:1:${syllable.hanjaChar || ''}`
        : `${syllable.char}:0:`,
    )
    .join('|');

const resolveEquivalentCaseOptions = (caseOptions: DictionaryCaseOption[]) => {
  if (caseOptions.length === 0) return null;

  const firstSignature = getSyllableSignature(caseOptions[0].syllables);
  const isSameSyllableSet = caseOptions.every(
    (caseOption) => getSyllableSignature(caseOption.syllables) === firstSignature,
  );

  if (!isSameSyllableSet) return null;
  return caseOptions[0].syllables;
};

const sanitizeMeaningResult = (raw: unknown, requestedWord: string): MeaningResult => {
  if (!isPlainObject(raw) || typeof raw.exists !== 'boolean' || !Array.isArray(raw.meanings)) {
    throw new DictionaryLookupError('invalid_response', '뜻 응답 형식이 올바르지 않습니다.');
  }

  if (!raw.exists) {
    throw new DictionaryLookupError('not_found');
  }

  const meanings = sanitizeMeanings(raw.meanings);

  if (meanings.length === 0) {
    throw new DictionaryLookupError(
      'invalid_response',
      '뜻 항목이 비어 있어 결과를 보여줄 수 없습니다.',
    );
  }

  return {
    word: requestedWord,
    meanings,
  };
};

const sanitizeSyllableResult = (raw: unknown, requestedWord: string): SyllableResult => {
  if (!isPlainObject(raw) || typeof raw.status !== 'string' || !Array.isArray(raw.syllables)) {
    return createResolvedFallbackSyllableResult(requestedWord);
  }

  if (raw.status === 'not_found') {
    throw new DictionaryLookupError('not_found');
  }

  if (raw.status === 'ambiguous') {
    const caseOptions = sanitizeCaseOptions(raw.cases, requestedWord);
    const resolvedSyllables = resolveEquivalentCaseOptions(caseOptions);

    if (resolvedSyllables) {
      return {
        word: requestedWord,
        syllables: resolvedSyllables,
        status: 'resolved',
        syllableNote: null,
        caseOptions: null,
      };
    }

    return {
      word: requestedWord,
      syllables: buildFallbackSyllables(requestedWord),
      status: 'ambiguous',
      syllableNote: normalizeSyllableNote(raw.note),
      caseOptions: caseOptions.length > 0 ? caseOptions : null,
    };
  }

  const sanitizedSyllables = sanitizeSyllables(raw.syllables, requestedWord);
  if (!sanitizedSyllables) {
    return createResolvedFallbackSyllableResult(requestedWord);
  }

  return {
    word: requestedWord,
    syllables: sanitizedSyllables,
    status: 'resolved',
    syllableNote: null,
    caseOptions: null,
  };
};

const requestWordMeanings = async (word: string): Promise<MeaningResult> => {
  try {
    const ai = getDictionaryClient();
    const response = await ai.models.generateContent({
      model: DICTIONARY_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: [
                'Return only JSON.',
                'Use exists=false and meanings=[] when the input is not a real Korean dictionary word.',
                'Do not invent meanings for typos, fragments, slang, or nonsense strings.',
                'If the word exists, return easy Korean meanings and examples for elementary students.',
                `검색 낱말: ${word}`,
                '초등학교 3학년도 이해할 수 있게 아주 쉽게 설명하는 한국어 낱말 뜻풀이 JSON만 출력해 주세요.',
                '규칙:',
                '- word는 입력 낱말을 그대로 넣습니다.',
                '- meanings는 최대 2개입니다.',
                '- meaning은 사전식 문체 대신 아주 쉬운 한 문장으로 짧게 씁니다.',
                '- example은 학교, 집, 친구, 놀이 같은 익숙한 상황으로 짧게 씁니다.',
                '- example 안에는 검색 낱말을 자연스럽게 넣습니다.',
                '- 빈 문자열은 절대 넣지 않습니다.',
                '- 설명, 마크다운, 코드블록 없이 JSON만 출력합니다.',
              ].join('\n'),
            },
          ],
        },
      ],
      config: {
        temperature: 0.3,
        responseMimeType: 'application/json',
        responseJsonSchema: {
          type: 'object',
          required: ['word', 'exists', 'meanings'],
          properties: {
            word: { type: 'string' },
            exists: { type: 'boolean' },
            meanings: {
              type: 'array',
              minItems: 0,
              maxItems: MAX_MEANINGS,
              items: {
                type: 'object',
                required: ['meaning', 'example'],
                properties: {
                  meaning: { type: 'string' },
                  example: { type: 'string' },
                },
              },
            },
          },
        },
      },
    });

    const responseText = response.text?.trim();
    if (!responseText) {
      throw new DictionaryLookupError('invalid_response', '뜻 응답이 비어 있습니다.');
    }

    return sanitizeMeaningResult(parseJsonResponse(responseText), word);
  } catch (error) {
    throw classifyLookupError(error);
  }
};

const requestWordSyllables = async (word: string): Promise<SyllableResult> => {
  try {
    const ai = getDictionaryClient();
    const characters = getWordCharacters(word);
    const response = await ai.models.generateContent({
      model: DICTIONARY_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: [
                'Return only JSON.',
                'status must be one of resolved, ambiguous, not_found.',
                'Use not_found when the input is not a real Korean dictionary word.',
                'Use ambiguous when multiple common homonym spellings or hanja readings are possible without context.',
                'Use resolved only when you can confidently determine the exact hanja without sentence context.',
                'If multiple meanings share the same exact hanja spelling for every syllable, treat them as one resolved hanja word, not ambiguous.',
                'When status is ambiguous or not_found, set every syllable to isHanja=false.',
                'When status is ambiguous, include 2 to 4 likely cases in cases.',
                'Each case must include a short Korean label, a short Korean description, case-specific syllables, and easy Korean meanings/examples.',
                'If status is resolved or not_found, set cases to an empty array.',
                'If you include note, write the note in Korean only.',
                `검색 낱말: ${word}`,
                '한국어 낱말을 글자별로 분석해 JSON만 출력해 주세요.',
                '규칙:',
                '- 각 글자를 순서대로 syllables 배열에 넣습니다.',
                '- char는 입력 낱말의 해당 글자와 정확히 같아야 합니다.',
                '- 한자어 기반 글자만 isHanja=true로 둡니다.',
                '- 고유어, 외래어, 불확실한 글자는 억지로 한자로 맞추지 말고 isHanja=false로 둡니다.',
                '- isHanja=true이면 hanjaChar와 hanjaMeaning을 꼭 채웁니다.',
                '- hanjaMeaning은 초등학생이 바로 이해할 말로 씁니다.',
                '- hanjaMeaning은 "칠"처럼 어간만 쓰지 말고 "치다", "때리다"처럼 기본형이나 쉬운 짧은 말로 씁니다.',
                '- relatedWords는 초등학생도 자주 볼 수 있는 쉬운 낱말 2~3개만 넣습니다.',
                '- relatedWords에는 검색 낱말 자체나 검색 낱말에 하다, 적, 성, 수 같은 말만 붙인 변형을 절대 넣지 않습니다.',
                '- 예: 검색 낱말이 "공격"일 때 "공격하다", "공격적", "공격수"는 relatedWords로 넣지 않습니다.',
                '- 같은 글자가 들어간 쉬운 낱말이 자신 없으면 relatedWords는 빈 배열로 둡니다.',
                '- isHanja=false이면 hanjaChar, hanjaMeaning, relatedWords를 비워도 됩니다.',
                '- 설명, 마크다운, 코드블록 없이 JSON만 출력합니다.',
              ].join('\n'),
            },
          ],
        },
      ],
      config: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseJsonSchema: {
          type: 'object',
          required: ['word', 'status', 'syllables', 'cases'],
          properties: {
            word: { type: 'string' },
            status: {
              type: 'string',
              enum: ['resolved', 'ambiguous', 'not_found'],
            },
            note: { type: 'string' },
            cases: {
              type: 'array',
              minItems: 0,
              maxItems: 4,
              items: {
                type: 'object',
                required: ['label', 'description', 'syllables', 'meanings'],
                properties: {
                  label: { type: 'string' },
                  description: { type: 'string' },
                  meanings: {
                    type: 'array',
                    minItems: 1,
                    maxItems: MAX_MEANINGS,
                    items: {
                      type: 'object',
                      required: ['meaning', 'example'],
                      properties: {
                        meaning: { type: 'string' },
                        example: { type: 'string' },
                      },
                    },
                  },
                  syllables: {
                    type: 'array',
                    minItems: characters.length,
                    maxItems: characters.length,
                    items: {
                      type: 'object',
                      required: ['char', 'isHanja'],
                      properties: {
                        char: { type: 'string' },
                        isHanja: { type: 'boolean' },
                        hanjaChar: { type: 'string' },
                        hanjaMeaning: { type: 'string' },
                        relatedWords: {
                          type: 'array',
                          maxItems: MAX_RELATED_WORDS,
                          items: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
            syllables: {
              type: 'array',
              minItems: characters.length,
              maxItems: characters.length,
              items: {
                type: 'object',
                required: ['char', 'isHanja'],
                properties: {
                  char: { type: 'string' },
                  isHanja: { type: 'boolean' },
                  hanjaChar: { type: 'string' },
                  hanjaMeaning: { type: 'string' },
                  relatedWords: {
                    type: 'array',
                    maxItems: MAX_RELATED_WORDS,
                    items: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    });

    const responseText = response.text?.trim();
    if (!responseText) {
      return createResolvedFallbackSyllableResult(word);
    }

    return sanitizeSyllableResult(parseJsonResponse(responseText), word);
  } catch (error) {
    const lookupError = classifyLookupError(error);
    if (lookupError.code === 'invalid_response') {
      return createResolvedFallbackSyllableResult(word);
    }

    throw lookupError;
  }
};

export const normalizeDictionaryWordKey = (value: string) => toWordKey(value);

export const getDictionaryErrorMessage = (error: unknown) => {
  const lookupError = classifyLookupError(error);

  if (lookupError.code === 'empty_word') {
    return '찾고 싶은 낱말을 먼저 입력해 주세요.';
  }

  if (lookupError.code === 'not_found') {
    return '사전에 없는 단어예요. 철자나 띄어쓰기를 다시 확인해 주세요.';
  }

  if (lookupError.code === 'missing_api_key') {
    return import.meta.env.PROD
      ? '사전 기능을 쓰려면 배포 환경 변수에 `VITE_GEMINI_API_KEY` 또는 `GEMINI_API_KEY`를 넣고 다시 배포해 주세요.'
      : '사전 기능을 쓰려면 `.env.local`에 `VITE_GEMINI_API_KEY` 또는 `GEMINI_API_KEY`를 넣어 주세요.';
  }

  if (lookupError.code === 'invalid_api_key') {
    return 'Gemini API 키를 확인해 주세요. 키가 없거나 권한이 맞지 않을 수 있어요.';
  }

  if (lookupError.code === 'network') {
    return '인터넷 연결이 잠시 불안정해서 낱말을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.';
  }

  if (lookupError.code === 'invalid_response') {
    return '낱말 설명을 정리하는 중에 결과가 어긋났어요. 다시 한 번 검색해 주세요.';
  }

  return '낱말 사전을 여는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.';
};

export const getWordMeanings = async (rawWord: string): Promise<MeaningResult> => {
  const word = sanitizeWord(rawWord);
  const key = toWordKey(word);

  if (!word || !key) {
    throw new DictionaryLookupError('empty_word');
  }

  const cachedResult = meaningCache.get(key);
  if (cachedResult) return cachedResult;

  const inflightPromise = meaningPromiseCache.get(key);
  if (inflightPromise) return inflightPromise;

  const nextPromise = requestWordMeanings(word)
    .then((result) => {
      meaningCache.set(key, result);
      return result;
    })
    .finally(() => {
      meaningPromiseCache.delete(key);
    });

  meaningPromiseCache.set(key, nextPromise);
  return nextPromise;
};

export const getWordSyllables = async (rawWord: string): Promise<SyllableResult> => {
  const word = sanitizeWord(rawWord);
  const key = toWordKey(word);

  if (!word || !key) {
    throw new DictionaryLookupError('empty_word');
  }

  const cachedResult = syllableCache.get(key);
  if (cachedResult) return cachedResult;

  const inflightPromise = syllablePromiseCache.get(key);
  if (inflightPromise) return inflightPromise;

  const nextPromise = requestWordSyllables(word)
    .then((result) => {
      syllableCache.set(key, result);
      return result;
    })
    .finally(() => {
      syllablePromiseCache.delete(key);
    });

  syllablePromiseCache.set(key, nextPromise);
  return nextPromise;
};

export const createDictionaryResult = (word: string): DictionaryResult => ({
  word: sanitizeWord(word),
  meanings: null,
  syllables: null,
  syllableNote: null,
  caseOptions: null,
});

