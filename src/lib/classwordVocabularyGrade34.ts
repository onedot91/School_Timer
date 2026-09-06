import { getClasswordInitialFromWord } from './classword.js';
import { arrangeClasswordCatalog } from './classwordSchedule.js';
import { CLASSWORD_VOCABULARY_V1, type ClasswordCatalogQuestion } from './classwordVocabulary.js';
import { VOCABULARY_GRADE34_REVISIONS } from './classwordCatalog/vocabularyGrade34.js';

export const CLASSWORD_GRADE34_START = '2026-09-07';
export type ClasswordGrade34Question = ClasswordCatalogQuestion & { readonly grade: 3 | 4 };

const revisedQuestions = CLASSWORD_VOCABULARY_V1.map((question): ClasswordGrade34Question => {
  const revision = VOCABULARY_GRADE34_REVISIONS[question.answer];
  if (!revision) {
    if (question.grade !== 3 && question.grade !== 4) {
      throw new RangeError(`CLASSWORD_GRADE34_REVISION_MISSING:${question.id}`);
    }
    return { ...question, id: question.id.replace('annual-v1-', 'annual-v2-'), grade: question.grade };
  }
  const [answer, meaning, written, spoken, family] = revision;
  const hash = [...answer.normalize('NFC').replace(/\s/g, '')]
    .reduce((value, letter) => Math.imul(value ^ letter.charCodeAt(0), 16777619) >>> 0, 2166136261);
  const writtenIndex = written.indexOf(answer);
  const spokenIndex = spoken.indexOf(answer);
  return {
    id: `annual-v2-${hash.toString(16).padStart(8, '0')}`,
    answer, meaning, family, grade: 4,
    source: answer === question.answer ? `${question.source};초3~4개정` : '자체집필:초3~4개정',
    initialHint: [...answer.replace(/\s/g, '')].map(getClasswordInitialFromWord).join(''),
    examples: [
      { register: 'written', prefix: written.slice(0, writtenIndex), suffix: written.slice(writtenIndex + answer.length) },
      { register: 'spoken', prefix: spoken.slice(0, spokenIndex), suffix: spoken.slice(spokenIndex + answer.length) },
    ],
  };
});

export const CLASSWORD_VOCABULARY_V2: readonly ClasswordGrade34Question[] = arrangeClasswordCatalog(revisedQuestions, 20260907);
