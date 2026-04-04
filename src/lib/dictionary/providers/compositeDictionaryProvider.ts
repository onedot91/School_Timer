import { classifyLookupError, DictionaryLookupError } from '../errors';
import type { DictionaryEntry, DictionarySuggestion, SyllableResult } from '../models';
import type { DictionaryProvider } from '../provider';

const shouldTryNextProvider = (error: unknown) => {
  const lookupError = classifyLookupError(error);
  return lookupError.code === 'not_found';
};

const mergeProviderErrors = (errors: unknown[]) => {
  const normalizedErrors = errors.map((error) => classifyLookupError(error));
  const blockingError = normalizedErrors.find((error) => error.code !== 'not_found');

  if (blockingError) {
    return blockingError;
  }

  return normalizedErrors[normalizedErrors.length - 1] || new DictionaryLookupError('not_found');
};

export class CompositeDictionaryProvider implements DictionaryProvider {
  constructor(private readonly providers: DictionaryProvider[]) {}

  async lookupEntry(word: string): Promise<DictionaryEntry> {
    const errors: unknown[] = [];

    for (const provider of this.providers) {
      try {
        return await provider.lookupEntry(word);
      } catch (error) {
        errors.push(error);
        if (!shouldTryNextProvider(error)) {
          throw classifyLookupError(error);
        }
      }
    }

    throw mergeProviderErrors(errors);
  }

  async lookupSyllables(word: string): Promise<SyllableResult> {
    const errors: unknown[] = [];

    for (const provider of this.providers) {
      try {
        return await provider.lookupSyllables(word);
      } catch (error) {
        errors.push(error);
        if (!shouldTryNextProvider(error)) {
          throw classifyLookupError(error);
        }
      }
    }

    throw mergeProviderErrors(errors);
  }

  async suggestEntries(word: string): Promise<DictionarySuggestion[]> {
    const collectedSuggestions = await Promise.all(
      this.providers.map(async (provider) => {
        try {
          return await provider.suggestEntries(word);
        } catch {
          return [];
        }
      }),
    );

    const uniqueSuggestions: DictionarySuggestion[] = [];
    const seenLemmas = new Set<string>();

    for (const suggestionList of collectedSuggestions) {
      for (const suggestion of suggestionList) {
        if (seenLemmas.has(suggestion.lemma)) continue;

        seenLemmas.add(suggestion.lemma);
        uniqueSuggestions.push(suggestion);
      }
    }

    return uniqueSuggestions;
  }
}
