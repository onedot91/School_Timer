import { GoogleGenAI } from '@google/genai';

import { classifyLookupError, DictionaryLookupError } from '../errors';
import type {
  DictionaryCaseOption,
  DictionaryEntry,
  DictionarySuggestion,
  Meaning,
  Syllable,
  SyllableResult,
} from '../models';
import type { DictionaryProvider } from '../provider';
import {
  buildFallbackSyllables,
  buildSensesFromMeanings,
  dedupeStrings,
  doesResponseWordMatch,
  getWordCharacters,
  guessLexicalOriginFromSyllables,
  isPlainObject,
  normalizeSyllableNote,
  sanitizeInlineText,
  sanitizeWord,
  toCompactText,
  toWordKey,
} from '../text';

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

let dictionaryAiClient: GoogleGenAI | null = null;

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

const buildGeneratedEntry = (word: string, meanings: Meaning[]): DictionaryEntry => ({
  lemma: word,
  normalizedLemma: toWordKey(word),
  sourceType: 'generated_ai',
  partOfSpeech: 'unknown',
  lexicalOrigin: 'unknown',
  homographNumber: null,
  senses: buildSensesFromMeanings(word, meanings),
  syllables: null,
  syllableNote: null,
  caseOptions: null,
});

const createResolvedFallbackSyllableResult = (word: string): SyllableResult => ({
  word,
  syllables: buildFallbackSyllables(word),
  status: 'resolved',
  syllableNote: null,
  caseOptions: null,
  lexicalOrigin: 'unknown',
});

const sanitizeMeanings = (value: unknown) => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!isPlainObject(item)) return null;

      const meaning = sanitizeInlineText(item.meaning, 120);
      const example = sanitizeInlineText(item.example, 160);

      if (!meaning || !example) return null;

      return { meaning, example } satisfies Meaning;
    })
    .filter((item): item is Meaning => item !== null)
    .slice(0, MAX_MEANINGS);
};

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
      const label = sanitizeInlineText(item.label, 36) || `${index + 1}번 뜻`;
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
        senses: buildSensesFromMeanings(`${requestedWord}-${index + 1}`, meanings),
      } satisfies DictionaryCaseOption;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
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

const sanitizeMeaningEntry = (raw: unknown, requestedWord: string): DictionaryEntry => {
  if (!isPlainObject(raw) || typeof raw.exists !== 'boolean' || !Array.isArray(raw.meanings)) {
    throw new DictionaryLookupError('invalid_response', '뜻 응답 형식이 올바르지 않습니다.');
  }

  if (!doesResponseWordMatch(raw.word, requestedWord)) {
    throw new DictionaryLookupError(
      'invalid_response',
      '뜻 응답 낱말이 요청한 낱말과 다릅니다.',
    );
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

  return buildGeneratedEntry(requestedWord, meanings);
};

const sanitizeSyllableResult = (raw: unknown, requestedWord: string): SyllableResult => {
  if (!isPlainObject(raw) || typeof raw.status !== 'string' || !Array.isArray(raw.syllables)) {
    return createResolvedFallbackSyllableResult(requestedWord);
  }

  if (!doesResponseWordMatch(raw.word, requestedWord)) {
    throw new DictionaryLookupError(
      'invalid_response',
      '글자 분석 응답 낱말이 요청한 낱말과 다릅니다.',
    );
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
        lexicalOrigin: guessLexicalOriginFromSyllables(resolvedSyllables, null, null),
      };
    }

    const syllableNote = normalizeSyllableNote(raw.note);

    return {
      word: requestedWord,
      syllables: buildFallbackSyllables(requestedWord),
      status: 'ambiguous',
      syllableNote,
      caseOptions: caseOptions.length > 0 ? caseOptions : null,
      lexicalOrigin: guessLexicalOriginFromSyllables(
        buildFallbackSyllables(requestedWord),
        syllableNote,
        caseOptions.length > 0 ? caseOptions : null,
      ),
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
    lexicalOrigin: guessLexicalOriginFromSyllables(sanitizedSyllables, null, null),
  };
};

export class GeminiDictionaryProvider implements DictionaryProvider {
  async lookupEntry(word: string): Promise<DictionaryEntry> {
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

      return sanitizeMeaningEntry(parseJsonResponse(responseText), word);
    } catch (error) {
      throw classifyLookupError(error);
    }
  }

  async lookupSyllables(word: string): Promise<SyllableResult> {
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
  }

  async suggestEntries(_word: string): Promise<DictionarySuggestion[]> {
    return [];
  }
}
