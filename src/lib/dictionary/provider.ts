import type { DictionaryEntry, SyllableResult } from './models';

export interface DictionaryProvider {
  lookupEntry(word: string): Promise<DictionaryEntry>;
  lookupSyllables(word: string): Promise<SyllableResult>;
}
