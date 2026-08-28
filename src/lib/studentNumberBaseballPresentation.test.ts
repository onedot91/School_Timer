import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import StudentNumberBaseballPage from '../components/student/StudentNumberBaseballPage';
import { StudentNumberBaseballHistory } from '../components/student/StudentNumberBaseballHistory';
import { createNumberBaseballAnswer } from './numberBaseball';

test('숫자 야구 제목은 색상을 나누면서 하나의 제목으로 읽힌다', () => {
  const markup = renderToStaticMarkup(createElement(StudentNumberBaseballPage, {
    studentNumber: 1,
    weekKey: '2026-W35',
    entry: {
      gameId: 'number-baseball-v1-1-2026-W35',
      attempts: [],
      completedAt: null,
    },
    hasReward: false,
    onSave: async () => true,
    onComplete: async () => true,
    onBack: () => undefined,
  }));

  assert.match(markup, /<h1><span class="student-baseball-title"><span class="is-coral">숫자<\/span><span class="is-mint">야구<\/span><\/span><\/h1>/);
  assert.match(markup, /class="student-baseball-actions"/);
  assert.match(markup, /한 칸 지우기/);
  assert.match(markup, /확인하기/);
  assert.doesNotMatch(markup, /숫자 3개를 차례로 골라 주세요/);
  assert.doesNotMatch(markup, /student-baseball-guide/);
});

test('숫자 야구 기록은 보상 범례와 9칸 단일 보드로 표시된다', () => {
  const markup = renderToStaticMarkup(createElement(StudentNumberBaseballHistory, {
    answer: [1, 2, 3],
    attempts: [],
  }));

  assert.equal((markup.match(/student-baseball-reward-guide-item/g) ?? []).length, 3);
  assert.match(markup, /1~5회<\/b><strong>\+20고마<\/strong>/);
  assert.match(markup, /6~7회<\/b><strong>\+10고마<\/strong>/);
  assert.match(markup, /8~9회<\/b><strong>\+5고마<\/strong>/);
  assert.equal((markup.match(/<li/g) ?? []).length, 9);
  assert.match(markup, /student-baseball-history-list/);
  assert.doesNotMatch(markup, /student-baseball-history-tier/);
  assert.doesNotMatch(markup, />입력 전</);
});

test('숫자 야구 완료 화면은 결과 카드 하나만 상태로 알린다', () => {
  const answer = createNumberBaseballAnswer(1, '2026-W35');
  const markup = renderToStaticMarkup(createElement(StudentNumberBaseballPage, {
    studentNumber: 1,
    weekKey: '2026-W35',
    entry: {
      gameId: 'number-baseball-v1-1-2026-W35',
      attempts: [{ guess: answer, createdAt: '2026-08-28T00:00:00.000Z' }],
      completedAt: '2026-08-28T00:00:00.000Z',
    },
    hasReward: true,
    onSave: async () => true,
    onComplete: async () => true,
    onBack: () => undefined,
  }));

  assert.equal((markup.match(/role="status"/g) ?? []).length, 1);
  assert.match(markup, /student-baseball-finish is-completed/);
  assert.doesNotMatch(markup, /student-baseball-guide/);
  assert.doesNotMatch(markup, /student-baseball-feedback/);
  assert.match(markup, new RegExp(`<span class="student-baseball-finish-details"><b>${answer.join('')}</b><em>\\+20 고마</em></span>`));
  assert.equal((markup.match(/\+20 고마/g) ?? []).length, 1);
  assert.doesNotMatch(markup, /정답이에요!/);
});

test('숫자 야구 완료 카드는 시도 횟수별 보상을 카드 안에 표시한다', () => {
  const answer = createNumberBaseballAnswer(1, '2026-W35');
  const wrongGuess = [answer[1], answer[2], answer[0]] as const;

  for (const { attemptCount, reward } of [
    { attemptCount: 1, reward: 20 },
    { attemptCount: 6, reward: 10 },
    { attemptCount: 8, reward: 5 },
  ] as const) {
    const markup = renderToStaticMarkup(createElement(StudentNumberBaseballPage, {
      studentNumber: 1,
      weekKey: '2026-W35',
      entry: {
        gameId: 'number-baseball-v1-1-2026-W35',
        attempts: [
          ...Array.from({ length: attemptCount - 1 }, (_, index) => ({
            guess: wrongGuess,
            createdAt: `2026-08-28T00:00:${String(index).padStart(2, '0')}.000Z`,
          })),
          { guess: answer, createdAt: '2026-08-28T00:01:00.000Z' },
        ],
        completedAt: '2026-08-28T00:01:00.000Z',
      },
      hasReward: true,
      onSave: async () => true,
      onComplete: async () => true,
      onBack: () => undefined,
    }));

    assert.match(markup, new RegExp(`<span class="student-baseball-finish-details"><b>${answer.join('')}</b><em>\\+${reward} 고마</em></span>`));
    assert.equal((markup.match(/role="status"/g) ?? []).length, 1);
  }
});
