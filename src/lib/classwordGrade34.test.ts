import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { getDailyClasswordQuizDefinition } from './classwordQuiz';
import { getClasswordInitialFromWord } from './classword';
import { CLASSWORD_VOCABULARY_V1 } from './classwordVocabulary';
import { CLASSWORD_VOCABULARY_V2 } from './classwordVocabularyGrade34';
import { VOCABULARY_GRADE34_REVISIONS } from './classwordCatalog/vocabularyGrade34';

test('the grade 3–4 v2 date-to-ID order remains frozen for future catalog maintenance', () => {
  const ids = CLASSWORD_VOCABULARY_V2.map(question => question.id);
  assert.equal(createHash('sha256').update(JSON.stringify(ids)).digest('hex'),
    '5b32d845e7c01002a0c0f008834683eca6e2796ff677170dedce7b9dd042651d');
});

test('the annual student deck uses only grade 3–4 vocabulary from its first school day', () => {
  const date = new Date('2026-09-07T00:00:00Z');
  const questions = [];
  while (questions.length < 400) {
    if (![0, 6].includes(date.getUTCDay())) {
      questions.push(getDailyClasswordQuizDefinition(date.toISOString().slice(0, 10)));
    }
    date.setUTCDate(date.getUTCDate() + 1);
  }
  assert.equal(new Set(questions.map(question => question.answer)).size, 400);
  const advanced = questions.filter(question => !('grade' in question) || ![3, 4].includes(Number(question.grade)));
  assert.deepEqual(advanced.map(question => question.answer), []);
});

test('grade 3–4 revisions have valid source targets and two complete answer slots', () => {
  const originalAnswers = new Set(CLASSWORD_VOCABULARY_V1.map(question => question.answer));
  for (const [originalAnswer, [answer, meaning, written, spoken, family]] of Object.entries(VOCABULARY_GRADE34_REVISIONS)) {
    assert.ok(originalAnswers.has(originalAnswer), originalAnswer);
    assert.ok(meaning && family, answer);
    assert.equal(written.split(answer).length, 2, answer);
    assert.equal(spoken.split(answer).length, 2, answer);
  }
});

test('the revised deck preserves quiz format and short examples without duplicate answers or IDs', () => {
  assert.equal(CLASSWORD_VOCABULARY_V2.length, 400);
  assert.equal(new Set(CLASSWORD_VOCABULARY_V2.map(question => question.id)).size, 400);
  assert.equal(new Set(CLASSWORD_VOCABULARY_V2.map(question => question.answer.replace(/\s/g, ''))).size, 400);
  for (const question of CLASSWORD_VOCABULARY_V2) {
    assert.match(question.id, /^annual-v2-[a-f0-9]{8}$/);
    assert.ok(question.meaning.length <= 50, question.answer);
    assert.ok(question.source && question.family, question.answer);
    assert.equal(question.initialHint, [...question.answer.replace(/\s/g, '')].map(getClasswordInitialFromWord).join(''));
    assert.ok(question.initialHint.length <= 8, question.answer);
    assert.deepEqual(question.examples.map(example => example.register), ['written', 'spoken']);
    for (const example of question.examples) {
      const sentence = example.prefix + question.answer + example.suffix;
      assert.equal(sentence.split(question.answer).length, 2, question.answer);
      assert.ok(sentence.length <= 50, question.answer);
      assert.equal(sentence.normalize('NFC'), sentence);
    }
  }
});

test('the revised deck keeps semantic families apart at every adjacent pair and the cycle seam', () => {
  CLASSWORD_VOCABULARY_V2.forEach((question, index) => {
    assert.notEqual(question.family, CLASSWORD_VOCABULARY_V2[(index + 1) % 400]?.family);
  });
});

test('the grade revision retains all sixty PDF starting words and leaves pre-launch assignments untouched', () => {
  const revisedAnswers = new Set(CLASSWORD_VOCABULARY_V2.map(question => question.answer));
  const pdfQuestions = CLASSWORD_VOCABULARY_V1.filter(question => question.source.startsWith('어휘싹3:'));
  assert.equal(pdfQuestions.length, 60);
  for (const question of pdfQuestions) assert.ok(revisedAnswers.has(question.answer), question.answer);
  assert.doesNotMatch(getDailyClasswordQuizDefinition('2026-09-06').id, /^annual-/);
  assert.match(getDailyClasswordQuizDefinition('2026-09-07').id, /^annual-v2-/);
});
