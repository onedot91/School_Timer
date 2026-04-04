import { DictionaryLookupError } from '../errors';
import type {
  DictionaryEntry,
  DictionaryLexicalOrigin,
  DictionarySense,
  SyllableResult,
} from '../models';
import type { DictionaryProvider } from '../provider';
import { LOANWORD_NOTE, NATIVE_KOREAN_NOTE, buildFallbackSyllables, buildSenseId, sanitizeWord, toCompactText, toWordKey } from '../text';
import { LOCAL_DICTIONARY_ENTRIES, type LocalDictionarySeedEntry } from './localDictionaryData';

const LOOKUP_SUFFIXES = [
  '에게서는',
  '한테서는',
  '이었어요',
  '이었어',
  '이라고',
  '이라는',
  '이라도',
  '이랑은',
  '이랑도',
  '으로는',
  '으로도',
  '에게서',
  '한테서',
  '에서는',
  '에게는',
  '한테는',
  '이에요',
  '예요',
  '에게',
  '한테',
  '에서',
  '까지',
  '부터',
  '처럼',
  '보다',
  '으로',
  '이랑',
  '랑은',
  '랑도',
  '께서',
  '에는',
  '에도',
  '와는',
  '과는',
  '와도',
  '과도',
  '와',
  '과',
  '은',
  '는',
  '이',
  '가',
  '을',
  '를',
  '도',
  '만',
  '에',
  '의',
  '로',
  '야',
  '아',
  '나',
];

const PREDICATE_SUFFIX_RULES = [
  { suffix: '했었어요', append: '하다' },
  { suffix: '했어요', append: '하다' },
  { suffix: '했어', append: '하다' },
  { suffix: '했다', append: '하다' },
  { suffix: '해요', append: '하다' },
  { suffix: '해야', append: '하다' },
  { suffix: '해서', append: '하다' },
  { suffix: '해도', append: '하다' },
  { suffix: '하면', append: '하다' },
  { suffix: '하는', append: '하다' },
  { suffix: '하며', append: '하다' },
  { suffix: '하고', append: '하다' },
  { suffix: '한다', append: '하다' },
  { suffix: '했네', append: '하다' },
  { suffix: '해', append: '하다' },
  { suffix: '었어요', append: '다' },
  { suffix: '았어요', append: '다' },
  { suffix: '었어', append: '다' },
  { suffix: '았어', append: '다' },
  { suffix: '었다', append: '다' },
  { suffix: '았다', append: '다' },
  { suffix: '어요', append: '다' },
  { suffix: '아요', append: '다' },
  { suffix: '어도', append: '다' },
  { suffix: '아도', append: '다' },
  { suffix: '어서', append: '다' },
  { suffix: '아서', append: '다' },
  { suffix: '으면', append: '다' },
  { suffix: '면', append: '다' },
  { suffix: '는다', append: '다' },
  { suffix: '는', append: '다' },
  { suffix: '고', append: '다' },
  { suffix: '어', append: '다' },
  { suffix: '아', append: '다' },
  { suffix: '요', append: '다' },
];

const stripTrailingPunctuation = (value: string) => value.replace(/[!?.,]+$/g, '');

const buildDictionarySenses = (
  lemma: string,
  seed: LocalDictionarySeedEntry,
): DictionarySense[] =>
  seed.senses.map((sense, index) => ({
    id: buildSenseId(lemma, index + 1),
    order: index + 1,
    definition: sense.definition,
    example: sense.example,
    simplifiedDefinition: sense.simplifiedDefinition || sense.definition,
    simplifiedExample: sense.simplifiedExample || sense.example,
    partOfSpeech: sense.partOfSpeech || seed.partOfSpeech,
    sourceType: 'curated_dictionary',
  }));

const createEntryFromSeed = (seed: LocalDictionarySeedEntry): DictionaryEntry => ({
  lemma: seed.lemma,
  normalizedLemma: toWordKey(seed.lemma),
  sourceType: 'curated_dictionary',
  partOfSpeech: seed.partOfSpeech,
  lexicalOrigin: seed.lexicalOrigin,
  homographNumber: seed.homographNumber ?? null,
  senses: buildDictionarySenses(seed.lemma, seed),
  syllables: seed.syllables ?? null,
  syllableNote: seed.syllableNote ?? null,
  caseOptions: seed.caseOptions ?? null,
});

const buildSyllableNote = (lexicalOrigin: DictionaryLexicalOrigin, explicitNote?: string | null) => {
  if (explicitNote) return explicitNote;
  if (lexicalOrigin === 'native_korean') return NATIVE_KOREAN_NOTE;
  if (lexicalOrigin === 'loanword') return LOANWORD_NOTE;
  return null;
};

const seedByKey = new Map<string, LocalDictionarySeedEntry>();
const compactSeedBuckets = new Map<string, LocalDictionarySeedEntry[]>();

const registerSeed = (lookupWord: string, seed: LocalDictionarySeedEntry) => {
  const wordKey = toWordKey(lookupWord);
  if (wordKey && !seedByKey.has(wordKey)) {
    seedByKey.set(wordKey, seed);
  }

  const compactKey = toCompactText(lookupWord);
  if (compactKey) {
    const bucket = compactSeedBuckets.get(compactKey) || [];
    bucket.push(seed);
    compactSeedBuckets.set(compactKey, bucket);
  }
};

LOCAL_DICTIONARY_ENTRIES.forEach((seed) => {
  registerSeed(seed.lemma, seed);
  (seed.aliases || []).forEach((alias) => registerSeed(alias, seed));
});

const getUniqueSeedByCompactKey = (lookupWord: string) => {
  const compactKey = toCompactText(lookupWord);
  if (!compactKey) return null;

  const bucket = compactSeedBuckets.get(compactKey) || [];
  return bucket.length === 1 ? bucket[0] : null;
};

const createParticleStrippedCandidates = (word: string) =>
  LOOKUP_SUFFIXES.flatMap((suffix) => {
    if (!word.endsWith(suffix) || word.length <= suffix.length) return [];
    return [word.slice(0, -suffix.length)];
  });

const createPredicateCandidates = (word: string) =>
  PREDICATE_SUFFIX_RULES.flatMap((rule) => {
    if (!word.endsWith(rule.suffix) || word.length <= rule.suffix.length) return [];

    const stem = word.slice(0, -rule.suffix.length);
    if (!stem) return [];

    return [stem + rule.append];
  });

const generateLookupCandidates = (rawWord: string) => {
  const sanitizedWord = stripTrailingPunctuation(sanitizeWord(rawWord));
  if (!sanitizedWord) return [];

  const seen = new Set<string>();
  const queue = [sanitizedWord];
  const results: string[] = [];

  while (queue.length > 0 && results.length < 40) {
    const currentWord = queue.shift();
    if (!currentWord || seen.has(currentWord)) continue;

    seen.add(currentWord);
    results.push(currentWord);

    for (const candidate of [
      ...createParticleStrippedCandidates(currentWord),
      ...createPredicateCandidates(currentWord),
    ]) {
      if (!seen.has(candidate)) {
        queue.push(candidate);
      }
    }
  }

  return results;
};

const findSeedByCandidate = (candidate: string) =>
  seedByKey.get(toWordKey(candidate)) || getUniqueSeedByCompactKey(candidate);

const resolveSeedEntry = (rawWord: string) => {
  for (const candidate of generateLookupCandidates(rawWord)) {
    const matchedSeed = findSeedByCandidate(candidate);
    if (matchedSeed) return matchedSeed;
  }

  return null;
};

export class LocalDictionaryProvider implements DictionaryProvider {
  async lookupEntry(word: string): Promise<DictionaryEntry> {
    const matchedSeed = resolveSeedEntry(word);
    if (!matchedSeed) {
      throw new DictionaryLookupError('not_found');
    }

    return createEntryFromSeed(matchedSeed);
  }

  async lookupSyllables(word: string): Promise<SyllableResult> {
    const matchedSeed = resolveSeedEntry(word);
    if (!matchedSeed) {
      throw new DictionaryLookupError('not_found');
    }

    const syllables =
      matchedSeed.syllables && matchedSeed.syllables.length > 0
        ? matchedSeed.syllables
        : buildFallbackSyllables(matchedSeed.lemma);
    const syllableNote = buildSyllableNote(matchedSeed.lexicalOrigin, matchedSeed.syllableNote);

    return {
      word: matchedSeed.lemma,
      syllables,
      status: matchedSeed.caseOptions?.length ? 'ambiguous' : 'resolved',
      syllableNote,
      caseOptions: matchedSeed.caseOptions ?? null,
      lexicalOrigin: matchedSeed.lexicalOrigin,
    };
  }
}
