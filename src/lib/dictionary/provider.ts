import type { DictionaryEntry, DictionarySuggestion, SyllableResult } from './models';

export interface DictionaryProvider {
  lookupEntry(word: string): Promise<DictionaryEntry>;
  lookupSyllables(word: string): Promise<SyllableResult>;
  suggestEntries(word: string): Promise<DictionarySuggestion[]>;
}
