import { DictionaryLookupError } from './errors';
import type {
  DictionaryEntry,
  DictionaryLexicalOrigin,
  DictionaryResult,
  Meaning,
  MeaningResult,
  SyllableResult,
} from './models';
import type { DictionaryProvider } from './provider';
import { sanitizeWord, toWordKey } from './text';

const mergeLexicalOrigin = (
  entryOrigin: DictionaryLexicalOrigin,
  syllableOrigin: DictionaryLexicalOrigin,
): DictionaryLexicalOrigin => {
  if (entryOrigin !== 'unknown') return entryOrigin;
  return syllableOrigin;
};

const toLegacyMeanings = (entry: DictionaryEntry): Meaning[] =>
  entry.senses.map((sense) => ({
    meaning: sense.simplifiedDefinition || sense.definition,
    example: sense.simplifiedExample || sense.example,
  }));

export class DictionaryService {
  private readonly entryCache = new Map<string, DictionaryEntry>();
  private readonly entryPromiseCache = new Map<string, Promise<DictionaryEntry>>();
  private readonly syllableCache = new Map<string, SyllableResult>();
  private readonly syllablePromiseCache = new Map<string, Promise<SyllableResult>>();

  constructor(private readonly provider: DictionaryProvider) {}

  async getEntry(rawWord: string): Promise<DictionaryEntry> {
    const word = sanitizeWord(rawWord);
    const key = toWordKey(word);

    if (!word || !key) {
      throw new DictionaryLookupError('empty_word');
    }

    const cachedResult = this.entryCache.get(key);
    if (cachedResult) return cachedResult;

    const inflightPromise = this.entryPromiseCache.get(key);
    if (inflightPromise) return inflightPromise;

    const nextPromise = this.provider
      .lookupEntry(word)
      .then((result) => {
        this.entryCache.set(key, result);
        return result;
      })
      .finally(() => {
        this.entryPromiseCache.delete(key);
      });

    this.entryPromiseCache.set(key, nextPromise);
    return nextPromise;
  }

  async getSyllables(rawWord: string): Promise<SyllableResult> {
    const word = sanitizeWord(rawWord);
    const key = toWordKey(word);

    if (!word || !key) {
      throw new DictionaryLookupError('empty_word');
    }

    const cachedResult = this.syllableCache.get(key);
    if (cachedResult) return cachedResult;

    const inflightPromise = this.syllablePromiseCache.get(key);
    if (inflightPromise) return inflightPromise;

    const nextPromise = this.provider
      .lookupSyllables(word)
      .then((result) => {
        this.syllableCache.set(key, result);
        return result;
      })
      .finally(() => {
        this.syllablePromiseCache.delete(key);
      });

    this.syllablePromiseCache.set(key, nextPromise);
    return nextPromise;
  }

  async getMeaningResult(rawWord: string): Promise<MeaningResult> {
    const entry = await this.getEntry(rawWord);

    return {
      word: entry.lemma,
      meanings: toLegacyMeanings(entry),
      entry,
    };
  }

  async getDictionaryEntry(rawWord: string): Promise<DictionaryEntry> {
    const [entry, syllableResult] = await Promise.all([
      this.getEntry(rawWord),
      this.getSyllables(rawWord),
    ]);

    return {
      ...entry,
      syllables: syllableResult.syllables,
      syllableNote: syllableResult.syllableNote,
      caseOptions: syllableResult.caseOptions,
      lexicalOrigin: mergeLexicalOrigin(entry.lexicalOrigin, syllableResult.lexicalOrigin),
    };
  }

  createDictionaryResult(word: string): DictionaryResult {
    return {
      word: sanitizeWord(word),
      meanings: null,
      syllables: null,
      syllableNote: null,
      caseOptions: null,
      entry: null,
    };
  }
}
