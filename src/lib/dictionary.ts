import { getDictionaryErrorMessage, DictionaryLookupError } from './dictionary/errors';
import type {
  DictionaryCaseOption,
  DictionaryEntry,
  DictionaryLexicalOrigin,
  DictionaryPartOfSpeech,
  DictionaryResult,
  DictionarySense,
  Meaning,
  MeaningResult,
  Syllable,
  SyllableResult,
} from './dictionary/models';
import { CompositeDictionaryProvider } from './dictionary/providers/compositeDictionaryProvider';
import { GeminiDictionaryProvider } from './dictionary/providers/geminiDictionaryProvider';
import { LocalDictionaryProvider } from './dictionary/providers/localDictionaryProvider';
import { DictionaryService } from './dictionary/service';
import { toWordKey } from './dictionary/text';

const dictionaryService = new DictionaryService(
  new CompositeDictionaryProvider([
    new LocalDictionaryProvider(),
    new GeminiDictionaryProvider(),
  ]),
);

export type {
  DictionaryCaseOption,
  DictionaryEntry,
  DictionaryLexicalOrigin,
  DictionaryPartOfSpeech,
  DictionaryResult,
  DictionarySense,
  Meaning,
  MeaningResult,
  Syllable,
  SyllableResult,
};

export { DictionaryLookupError, getDictionaryErrorMessage };

export const normalizeDictionaryWordKey = (value: string) => toWordKey(value);

export const getWordMeanings = async (rawWord: string): Promise<MeaningResult> =>
  dictionaryService.getMeaningResult(rawWord);

export const getWordSyllables = async (rawWord: string): Promise<SyllableResult> =>
  dictionaryService.getSyllables(rawWord);

export const getDictionaryEntry = async (rawWord: string): Promise<DictionaryEntry> =>
  dictionaryService.getDictionaryEntry(rawWord);

export const createDictionaryResult = (word: string): DictionaryResult =>
  dictionaryService.createDictionaryResult(word);
