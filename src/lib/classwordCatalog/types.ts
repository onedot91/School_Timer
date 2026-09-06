export type ClasswordVocabularySeed = {
  readonly answer: string;
  readonly meaning: string;
  readonly written: string;
  readonly spoken: string;
  readonly grade: 3 | 4 | 5 | 6;
  readonly family: string;
  readonly source: string;
};

export type ClasswordTopicSeed = {
  readonly id: string;
  readonly title: string;
  readonly family: string;
  readonly examples: readonly [string, string, string, string, string, string, string,
    string, string, string, string, string, string, string];
};
