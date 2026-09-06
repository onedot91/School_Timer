import { getClasswordInitialFromWord } from './classword.js';
import type { ClasswordQuizDefinition } from './classwordQuiz.js';
import { arrangeClasswordCatalog } from './classwordSchedule.js';
import { VOCABULARY_LEARNING } from './classwordCatalog/vocabularyLearning.js';
import { VOCABULARY_NATURE } from './classwordCatalog/vocabularyNature.js';
import { VOCABULARY_SOCIETY } from './classwordCatalog/vocabularySociety.js';
import { VOCABULARY_LIFE } from './classwordCatalog/vocabularyLife.js';
import type { ClasswordVocabularySeed } from './classwordCatalog/types.js';

export type ClasswordCatalogQuestion = ClasswordQuizDefinition & Pick<ClasswordVocabularySeed, 'grade' | 'family' | 'source'>;

const seeds: readonly ClasswordVocabularySeed[] = [
  ...VOCABULARY_LEARNING, ...VOCABULARY_NATURE, ...VOCABULARY_SOCIETY, ...VOCABULARY_LIFE,
];

export const CLASSWORD_VOCABULARY_V1: readonly ClasswordCatalogQuestion[] = arrangeClasswordCatalog(seeds, 20260907)
  .map((seed) => {
    const answerHash = [...seed.answer.normalize('NFC').replace(/\s/g, '')]
      .reduce((hash, letter) => Math.imul(hash ^ letter.charCodeAt(0), 16777619) >>> 0, 2166136261);
    const writtenIndex = seed.written.indexOf(seed.answer);
    const spokenIndex = seed.spoken.indexOf(seed.answer);
    return {
      id: `annual-v1-${answerHash.toString(16).padStart(8, '0')}`,
      answer: seed.answer,
      initialHint: [...seed.answer.replace(/\s/g, '')].map((letter) => getClasswordInitialFromWord(letter)).join(''),
      meaning: seed.meaning,
      examples: [
        { register: 'written', prefix: seed.written.slice(0, writtenIndex), suffix: seed.written.slice(writtenIndex + seed.answer.length) },
        { register: 'spoken', prefix: seed.spoken.slice(0, spokenIndex), suffix: seed.spoken.slice(spokenIndex + seed.answer.length) },
      ],
      grade: seed.grade,
      family: seed.family,
      source: seed.source,
    };
  });
