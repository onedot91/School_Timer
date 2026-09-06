import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { getDailyClasswordQuiz } from './classwordQuiz';
import { getKoreanDateKey, CLASSWORD_INITIALS, validateClasswordWord, getClasswordInitialFromWord, parseClasswordBoard } from './classword';
import { CLASSWORD_VOCABULARY_V1 } from './classwordVocabulary';
import { CLASSWORD_TOPICS_V1, CLASSWORD_TOPICS_V2, resolveClasswordMonth, resolveClasswordTopic, getElapsedClasswordTopics } from './classwordTopics';
import { assertClasswordParticipation, getClasswordDisplayDate, getClasswordWeekdayIndex } from './classwordSchedule';

test('published v1 date-to-ID ordering stays frozen across catalog maintenance', () => {
  const ids = [CLASSWORD_VOCABULARY_V1.map((question) => question.id), CLASSWORD_TOPICS_V1.map((topic) => topic.id)];
  assert.equal(createHash('sha256').update(JSON.stringify(ids)).digest('hex'),
    '36d82316f0575db85073900172102d110d2cc3f871c41ebbbaaed11c68c8448b');
});

test('automatic quizzes remain distinct across 262 weekdays', () => {
  const days: string[] = [];
  const date = new Date('2026-09-07T00:00:00Z');
  while (days.length < 262) {
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) days.push(date.toISOString().slice(0, 10));
    date.setUTCDate(date.getUTCDate() + 1);
  }
  const ids = days.map((day) => getDailyClasswordQuiz(day).id);
  assert.equal(new Set(ids).size, 262);
});

test('catalogs contain 400 independent answers and 300 distinct topics with valid examples', () => {
  assert.equal(CLASSWORD_VOCABULARY_V1.length, 400);
  assert.equal(new Set(CLASSWORD_VOCABULARY_V1.map((question) => question.id)).size, 400);
  assert.equal(new Set(CLASSWORD_VOCABULARY_V1.map((question) => question.answer.replace(/\s/g, ''))).size, 400);
  assert.equal(CLASSWORD_TOPICS_V1.length, 300);
  assert.equal(new Set(CLASSWORD_TOPICS_V1.map((topic) => topic.id)).size, 300);
  assert.equal(new Set(CLASSWORD_TOPICS_V1.map((topic) => topic.title)).size, 300);
  assert.equal(new Set(CLASSWORD_TOPICS_V1.map((topic) => topic.examples.join('|'))).size, 300);
  for (const topic of CLASSWORD_TOPICS_V1) {
    assert.ok([...topic.title].length <= 40, topic.id);
    assert.equal(topic.examples.length, 14);
    assert.equal(new Set(topic.examples).size, 14, topic.id);
    CLASSWORD_INITIALS.forEach((initial, index) => {
      assert.equal(validateClasswordWord(topic.examples[index] ?? '', initial, topic.title).ok, true, `${topic.id}/${initial}`);
    });
  }
});

test('every quiz reconstructs two short grammatical-review sentences without leaking its answer in the ID', () => {
  for (const question of CLASSWORD_VOCABULARY_V1) {
    assert.ok(question.id.length <= 64);
    assert.equal(question.id.includes(question.answer), false);
    assert.ok(question.meaning.length <= 90);
    assert.ok(question.answer.length <= 20);
    assert.ok(question.family && question.source);
    assert.ok([3, 4, 5, 6].includes(question.grade));
    assert.equal(question.initialHint, [...question.answer.replace(/\s/g, '')].map(getClasswordInitialFromWord).join(''));
    assert.ok(question.initialHint.length <= 8);
    for (const example of question.examples) {
      const sentence = example.prefix + question.answer + example.suffix;
      assert.equal(sentence.split(question.answer).length, 2, question.answer);
      assert.ok(sentence.length <= 100, question.answer);
      assert.ok(example.prefix.length + example.suffix.length > 5, question.answer);
      assert.equal(sentence.normalize('NFC'), sentence);
    }
  }
});

test('semantic families never touch in the fixed deck, including cycle boundaries', () => {
  for (const catalog of [CLASSWORD_VOCABULARY_V1, CLASSWORD_TOPICS_V1]) {
    catalog.forEach((item, index) => assert.notEqual(item.family, catalog[(index + 1) % catalog.length]?.family));
  }
});

test('quizzes stay unique for 262 weekdays and topics repeat only after the full selected deck', () => {
  const dates: string[] = [];
  const day = new Date('2026-09-07T00:00:00Z');
  while (dates.length < 1500) {
    if (![0, 6].includes(day.getUTCDay())) dates.push(day.toISOString().slice(0, 10));
    day.setUTCDate(day.getUTCDate() + 1);
  }
  const topics = dates.map((date) => resolveClasswordTopic(date, '').topic);
  const questions = dates.map((date) => getDailyClasswordQuiz(date).id);
  for (let start = 0; start <= dates.length - 262; start += 1) {
    assert.equal(new Set(questions.slice(start, start + 262)).size, 262, dates[start]);
  }
  const topicCount = CLASSWORD_TOPICS_V2.length;
  for (let start = 0; start <= dates.length - topicCount; start += 1) {
    assert.equal(new Set(topics.slice(start, start + topicCount)).size, topicCount, dates[start]);
    if (start + topicCount < dates.length) {
      assert.equal(topics[start + topicCount], topics[start], dates[start]);
    }
  }
});

test('KST midnight, leap day and Friday-to-Monday transitions advance only on weekdays', () => {
  assert.equal(getKoreanDateKey(new Date('2026-09-06T14:59:59Z')), '2026-09-06');
  assert.equal(getKoreanDateKey(new Date('2026-09-06T15:00:00Z')), '2026-09-07');
  assert.equal(getClasswordWeekdayIndex('2026-09-07'), 0);
  assert.equal(getClasswordWeekdayIndex('2026-09-11'), 4);
  assert.equal(getClasswordWeekdayIndex('2026-09-12'), 4);
  assert.equal(getClasswordWeekdayIndex('2026-09-13'), 4);
  assert.equal(getClasswordWeekdayIndex('2026-09-14'), 5);
  assert.equal(getClasswordWeekdayIndex('2028-02-29') - getClasswordWeekdayIndex('2028-02-28'), 1);
  assert.equal(getClasswordDisplayDate('2026-09-06'), '2026-09-04');
  assert.equal(getClasswordDisplayDate('2026-09-13'), '2026-09-11');
  assert.throws(() => getClasswordDisplayDate('2026-02-30'), /CLASSWORD_INVALID_DATE/);
});

test('weekend participation cannot use a Friday or forged Monday date', () => {
  for (const today of ['2026-09-12', '2026-09-13']) {
    for (const requested of ['2026-09-11', today, '2026-09-14']) {
      assert.throws(() => assertClasswordParticipation(requested, today), /CLASSWORD_WEEKEND_CLOSED/);
    }
  }
  assert.doesNotThrow(() => assertClasswordParticipation('2026-09-14', '2026-09-14'));
  assert.throws(() => assertClasswordParticipation('2026-09-11', '2026-09-14'), /TODAY_ONLY/);
});

test('manual topics override automatic topics without rewriting earlier dates or future usage', () => {
  const automatic = resolveClasswordTopic('2026-09-07', '');
  assert.equal(automatic.source, 'automatic');
  assert.ok(automatic.topic);
  assert.deepEqual(resolveClasswordTopic('2026-09-07', '선생님만의 주제'), { topic: '선생님만의 주제', source: 'teacher' });
  assert.deepEqual(resolveClasswordTopic('2026-09-04', ''), { topic: '', source: 'automatic' });
  assert.deepEqual(getElapsedClasswordTopics('2026-09-06'), []);
  assert.equal(getElapsedClasswordTopics('2026-09-07').length, 1);
  assert.equal(getElapsedClasswordTopics('2026-09-13').length, 5);
  assert.equal(getElapsedClasswordTopics('2040-01-01').length, CLASSWORD_TOPICS_V2.length);
});

test('monthly calendar merges all weekday defaults and stored overrides and parses their source', () => {
  const rounds = resolveClasswordMonth('2026-09', [{ dateKey: '2026-09-08', topic: '고유한 직접 주제' }]);
  assert.equal(rounds.length, 18);
  assert.equal(rounds.find((round) => round.dateKey === '2026-09-08')?.source, 'teacher');
  assert.equal(rounds.some((round) => round.dateKey === '2026-09-12'), false);
  const board = parseClasswordBoard({ dateKey: '2026-09-07', ...resolveClasswordTopic('2026-09-07', ''), entries: [] });
  assert.equal(board.source, 'automatic');
  assert.throws(() => parseClasswordBoard({ ...board, source: 'invalid' }));
});
