import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import StudentNumberBaseballPage from '../components/student/StudentNumberBaseballPage';
import { StudentNumberBaseballHistory } from '../components/student/StudentNumberBaseballHistory';

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
