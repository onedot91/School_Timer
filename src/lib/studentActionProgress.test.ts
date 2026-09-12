import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import StudentActionProgress from '../components/student/StudentActionProgress.tsx';

test('학생 비동기 작업 중에는 처리 상태와 중앙 로딩 모달을 함께 표시한다', (context) => {
  context.mock.method(Math, 'random', () => 0);
  const inactiveMarkup = renderToStaticMarkup(createElement(StudentActionProgress, { isActive: false }));
  const activeMarkup = renderToStaticMarkup(createElement(StudentActionProgress, { isActive: true }));

  assert.equal(inactiveMarkup, '');
  assert.match(activeMarkup, /role="status"/);
  assert.match(activeMarkup, /class="student-action-progress-card"/);
  assert.match(activeMarkup, /class="goma-loading" aria-hidden="true"/);
  assert.match(activeMarkup, /class="goma-flight goma-artwork"/);
  assert.match(activeMarkup, /focusable="false"/);
  assert.match(activeMarkup, /href="\/images\/loading\/goma-pencil.png"/);
  assert.match(activeMarkup, />처리 중</);
  assert.match(activeMarkup, /aria-label="요청 처리 중"/);
  assert.doesNotMatch(activeMarkup, /role="progressbar"/);
});

test('처리 중 모달의 움직임 그림은 SVG 대신 작은 이미지를 바로 그린다', (context) => {
  context.mock.method(Math, 'random', () => 0.15);
  const activeMarkup = renderToStaticMarkup(createElement(StudentActionProgress, { isActive: true }));

  assert.match(activeMarkup, /class="goma-kinetic-actor"/);
  assert.match(activeMarkup, /src="\/images\/loading\/goma-jumping.webp"/);
  assert.doesNotMatch(activeMarkup, /<image /);
});

test('학생 버튼은 pointer-down 동안 즉시 눌림 피드백을 준다', async () => {
  const css = await readFile(new URL('../index.css', import.meta.url), 'utf8');
  const activeRuleStart = css.indexOf('.student-mode-page button:not(:disabled):active');
  const activeRuleEnd = css.indexOf('\n}', activeRuleStart);
  const activeRule = css.slice(activeRuleStart, activeRuleEnd);

  assert.ok(activeRuleStart >= 0);
  assert.match(activeRule, /scale:\s*\.98/);
  assert.match(activeRule, /opacity:\s*\.88/);
});

test('동작 줄이기에서는 고마와 배경의 움직임을 모두 멈춘다', async () => {
  const css = await readFile(new URL('../index.css', import.meta.url), 'utf8');
  const sceneStart = css.indexOf('.goma-loading {');
  const reducedMotionStart = css.indexOf('@media (prefers-reduced-motion: reduce)', sceneStart);
  const reducedMotionRule = css.slice(reducedMotionStart);

  assert.ok(sceneStart >= 0);
  assert.ok(reducedMotionStart >= 0);
  assert.match(reducedMotionRule, /\.goma-loading \*/);
  assert.match(reducedMotionRule, /animation: none/);
  assert.match(reducedMotionRule, /\.goma-spark, \.goma-wind \{ opacity: 0/);
});

test('학생 화면은 주요 비동기 저장 상태를 연결하고 랜덤 프로필 가챠에서만 중복 로딩 모달을 숨긴다', async () => {
  const source = await readFile(new URL('../pages/AuctionPage.tsx', import.meta.url), 'utf8');
  const pendingStart = source.indexOf('const isStudentActionPending');
  const pendingEnd = source.indexOf('\n\n  return (', pendingStart);
  const pendingSource = source.slice(pendingStart, pendingEnd);

  assert.ok(pendingStart >= 0);
  assert.match(pendingSource, /isLoading/);
  assert.match(pendingSource, /isSavePending/);
  assert.match(pendingSource, /isStudentLifeSaving/);
  assert.match(pendingSource, /isPetSaving/);
  assert.match(pendingSource, /isEconomySaving/);
  assert.match(pendingSource, /isEmotionSaving/);
  assert.match(pendingSource, /isSubmittingItemId !== null/);
  assert.match(pendingSource, /isDonating/);
  assert.match(source, /aria-busy=\{isStudentActionPending\}/);
  assert.match(source, /profilePurchaseType === 'random'/);
  assert.match(source, /<StudentActionProgress isActive=\{isStudentActionPending && !isProfileGachaSaving\} \/>/);
});
