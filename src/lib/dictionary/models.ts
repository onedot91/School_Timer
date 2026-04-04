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

export type DictionaryPartOfSpeech =
  | 'noun'
  | 'verb'
  | 'adjective'
  | 'adverb'
  | 'expression'
  | 'unknown';

export type DictionaryLexicalOrigin =
  | 'native_korean'
  | 'sino_korean'
  | 'loanword'
  | 'mixed'
  | 'unknown';

export type DictionarySourceType = 'generated_ai' | 'curated_dictionary' | 'unknown';

export interface DictionarySense {
  id: string;
  order: number;
  definition: string;
  example: string;
  simplifiedDefinition: string;
  simplifiedExample: string;
  partOfSpeech: DictionaryPartOfSpeech;
  sourceType: DictionarySourceType;
}

export interface DictionaryCaseOption {
  label: string;
  description: string;
  syllables: Syllable[];
  meanings: Meaning[];
  senses?: DictionarySense[];
}

export interface DictionaryEntry {
  lemma: string;
  normalizedLemma: string;
  sourceType: DictionarySourceType;
  partOfSpeech: DictionaryPartOfSpeech;
  lexicalOrigin: DictionaryLexicalOrigin;
  homographNumber: number | null;
  senses: DictionarySense[];
  syllables: Syllable[] | null;
  syllableNote: string | null;
  caseOptions: DictionaryCaseOption[] | null;
}

export type DictionarySuggestionMatchType =
  | 'normalized'
  | 'alias'
  | 'prefix'
  | 'contains'
  | 'similar';

export interface DictionarySuggestion {
  lemma: string;
  partOfSpeech: DictionaryPartOfSpeech;
  lexicalOrigin: DictionaryLexicalOrigin;
  matchType: DictionarySuggestionMatchType;
}

export interface MeaningResult {
  word: string;
  meanings: Meaning[];
  entry: DictionaryEntry;
}

export type DictionarySyllableStatus = 'resolved' | 'ambiguous';

export interface SyllableResult {
  word: string;
  syllables: Syllable[];
  status: DictionarySyllableStatus;
  syllableNote: string | null;
  caseOptions: DictionaryCaseOption[] | null;
  lexicalOrigin: DictionaryLexicalOrigin;
}

export interface DictionaryResult {
  word: string;
  meanings: Meaning[] | null;
  syllables: Syllable[] | null;
  syllableNote: string | null;
  caseOptions: DictionaryCaseOption[] | null;
  entry?: DictionaryEntry | null;
}
