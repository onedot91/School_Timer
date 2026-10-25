import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import StudentBalanceSummary from '../components/student/StudentBalanceSummary.tsx';
import { interpolateStudentBalance } from './useStudentBalanceChange.js';

test('잔액 숫자는 처음과 끝을 정확히 지나며 앞쪽에서 빨리 움직인다', () => {
  assert.equal(interpolateStudentBalance(60, 65, 0), 60);
  assert.equal(interpolateStudentBalance(60, 65, 1), 65);
  assert.equal(interpolateStudentBalance(60, 65, 1.4), 65);
  assert.equal(interpolateStudentBalance(64, 54, -0.2), 64);
  assert.ok(interpolateStudentBalance(0, 100, 0.5) > 50);
  for (let step = 0; step <= 10; step += 1) {
    const value = interpolateStudentBalance(64, 54, step / 10);
    assert.ok(value <= 64 && value >= 54, String(value));
  }
});

test('처음 그린 잔액에는 변화 배지를 띄우지 않는다', () => {
  const markup = renderToStaticMarkup(createElement(StudentBalanceSummary, {
    balance: 64,
    availableBalance: 64,
    reservedAmount: 0,
  }));

  assert.doesNotMatch(markup, /student-balance-change/);
  assert.match(markup, /<strong>64 고마<\/strong>|<strong>64 고마<\/strong>/);
});

test('잔액 변화 배지는 이름 줄 위에 흐름 밖으로 겹쳐 칸 크기를 바꾸지 않고 transform만 움직인다', async () => {
  const css = await readFile(new URL('../index.css', import.meta.url), 'utf8');
  const start = css.indexOf('.student-balance-primary .student-balance-change {');
  const rule = css.slice(start, css.indexOf('\n}', start));
  assert.match(rule, /position: absolute/);
  assert.match(css, /\.student-balance-primary\[data-changing="true"\] \.student-balance-primary-heading > :not\(\.student-balance-change\) \{\n  opacity: 0;/);
  assert.match(rule, /pointer-events: none/);
  const keyframesStart = css.indexOf('@keyframes student-balance-change-in');
  assert.doesNotMatch(css.slice(keyframesStart, css.indexOf('\n}', keyframesStart)), /opacity/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\n  \.student-balance-change \{ animation: none; \}/);
});

test('학생 핵심 카드 호버는 한 규칙에서 테두리와 그림자만 바꾸고 터치에서는 적용하지 않는다', async () => {
  const css = await readFile(new URL('../index.css', import.meta.url), 'utf8');
  const start = css.indexOf('/* STUDENT_CARD_HOVER');
  assert.ok(start > 0);
  const block = css.slice(start);
  assert.match(block, /@media \(hover: hover\) and \(pointer: fine\) \{\n  :is\(\n    \.auction-item-card,\n    \.student-mission-card\.is-interactive,/);
  assert.doesNotMatch(block, /:hover \{[^}]*(transform|translate)/);
  for (const removed of [
    '.auction-item-card:not(:disabled):hover {\n  transform: translateY(-2px);',
    '.student-mission-card.is-interactive:hover {\n  transform: translateY(-2px);',
    '.student-featured-writing-card:hover { transform: translateY(-.2rem);',
    '.student-bookshelf-entry:hover { transform: translateY(-.15rem);',
  ]) {
    assert.equal(css.includes(removed), false, removed);
  }
  assert.match(block, /border-color: var\(--student-card-hover-border, color-mix\(in srgb, var\(--apple-accent\) 45%, var\(--apple-separator\)\)\);/);
  const auctionCard = await readFile(new URL('../components/AuctionItemCard.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(auctionCard, /hover:-?translate/);
});
