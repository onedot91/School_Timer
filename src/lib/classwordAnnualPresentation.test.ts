import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import ClasswordQuiz from '../components/student/ClasswordQuiz';
import type { ClasswordQuizStudentState } from './classwordQuiz';

const questionState: ClasswordQuizStudentState = {
  dateKey: '2026-09-11',
  question: {
    id: 'teacher-custom', initialHint: 'ㅅㅍ', meaning: '함께 나누는 마음',
    examples: [
      { register: 'written', prefix: '서로 ', suffix: '을 나누었다.' },
      { register: 'spoken', prefix: '오늘도 ', suffix: '을 나누자.' },
    ],
  },
  completed: false, completedAt: null, rewardAmount: null,
};

test('주말 읽기 전용 퀴즈는 입력과 제출을 막고 보상 안내를 숨긴다', () => {
  // Given: Friday's unanswered question is viewed in weekend read-only mode.
  const props = {
    studentNumber: 1, state: questionState, loading: false, saving: false,
    readOnly: true, loadError: '', onSubmit: async () => true,
  };
  // When: the quiz is rendered.
  const markup = renderToStaticMarkup(createElement(ClasswordQuiz, props));
  // Then: neither participation nor an immediate-reward invitation is available.
  assert.match(markup, /<input[^>]*disabled=""/);
  assert.match(markup, /<button type="submit"[^>]*disabled=""/);
  assert.doesNotMatch(markup, /class="classword-quiz-reward-copy"/);
});

test('완료한 교사 퀴즈는 저장된 정답 없이 자동 문제의 정답을 노출하지 않는다', () => {
  // Given: a completed teacher question has no browser answer available at render.
  const props = {
    studentNumber: 1, state: { ...questionState, completed: true }, loading: false,
    saving: false, loadError: '', onSubmit: async () => true,
  };
  // When: the quiz is rendered.
  const markup = renderToStaticMarkup(createElement(ClasswordQuiz, props));
  // Then: the disabled answer field stays empty while completion remains visible.
  assert.match(markup, /<input[^>]*disabled=""[^>]*value=""/);
  assert.match(markup, /<button[^>]*class="is-correct"/);
});
