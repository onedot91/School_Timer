import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getDailyClasswordQuiz,
  isClasswordQuizAnswerCorrect,
  parseClasswordQuizStudentState,
  parseClasswordQuizTeacherSummary,
} from './classwordQuiz';

test('날짜별 퀴즈는 같은 날짜에 같은 문제를 선택하고 정답은 공개하지 않는다', () => {
  const first = getDailyClasswordQuiz('2026-08-30');
  const second = getDailyClasswordQuiz('2026-08-30');

  assert.deepEqual(first, second);
  assert.equal(Object.hasOwn(first, 'answer'), false);
  assert.match(first.initialHint, /^[ㄱ-ㅎ]{2,}$/);
  assert.deepEqual(first.examples.map((example) => example.register), ['written', 'spoken']);
  assert.equal(first.examples.length, 2);
  assert.equal(first.examples.some((example) => `${example.prefix}${example.suffix}`.includes('□')), false);
});

test('퀴즈 정답은 주변 공백을 정리하고 오답과 구분한다', () => {
  const prompt = getDailyClasswordQuiz('2026-08-30');
  const answerByQuestionId: Readonly<Record<string, string>> = {
    'saving-resources': '절약',
    'caring-for-others': '배려',
    'finishing-your-duty': '책임',
    'working-together': '협동',
    'looking-carefully': '관찰',
    'putting-into-action': '실천',
    'showing-respect': '존중',
  };
  const answer = answerByQuestionId[prompt.id];
  assert.ok(answer);

  assert.equal(isClasswordQuizAnswerCorrect('2026-08-30', ` ${answer} `), true);
  assert.equal(isClasswordQuizAnswerCorrect('2026-08-30', '오답'), false);
});

test('학생 완료와 교사 정답자 응답은 유효한 번호만 허용한다', () => {
  const question = getDailyClasswordQuiz('2026-08-30');
  assert.equal(parseClasswordQuizStudentState({
    dateKey: '2026-08-30', question, completed: true, completedAt: '2026-08-30T01:00:00.000Z', rewardAmount: 7,
  }).rewardAmount, 7);
  assert.equal(parseClasswordQuizStudentState({
    dateKey: '2026-08-30', question, completed: false, completedAt: null, rewardAmount: null,
  }).rewardAmount, null);
  assert.deepEqual(parseClasswordQuizTeacherSummary({
    dateKey: '2026-08-30', question, correctStudentNumbers: [4, 2, 4],
  }).correctStudentNumbers, [2, 4]);
  assert.throws(() => parseClasswordQuizTeacherSummary({
    dateKey: '2026-08-30', question, correctStudentNumbers: [24],
  }), /CLASSWORD_QUIZ_INVALID_RESPONSE/);
});
