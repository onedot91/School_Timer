import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import StudentActionProgress from '../components/student/StudentActionProgress.tsx';

test('학생 비동기 작업 중에는 처리 상태와 중앙 로딩 모달을 함께 표시한다', () => {
  const inactiveMarkup = renderToStaticMarkup(createElement(StudentActionProgress, { isActive: false }));
  const activeMarkup = renderToStaticMarkup(createElement(StudentActionProgress, { isActive: true }));

  assert.equal(inactiveMarkup, '');
  assert.match(activeMarkup, /role="status"/);
  assert.match(activeMarkup, /class="student-action-progress-card"/);
  assert.match(activeMarkup, /class="student-action-progress-spinner"/);
  assert.match(activeMarkup, />처리 중</);
  assert.match(activeMarkup, /aria-label="요청 처리 중"/);
  assert.doesNotMatch(activeMarkup, /role="progressbar"/);
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

test('동작 줄이기에서는 로딩 회전을 잔잔한 밝기 변화로 바꾼다', async () => {
  const css = await readFile(new URL('../index.css', import.meta.url), 'utf8');
  const progressStart = css.indexOf('.student-action-progress {');
  const reducedMotionStart = css.indexOf('@media (prefers-reduced-motion: reduce)', progressStart);
  const reducedMotionEnd = css.indexOf('@media (prefers-reduced-transparency: reduce)', reducedMotionStart);
  const reducedMotionRule = css.slice(reducedMotionStart, reducedMotionEnd);

  assert.ok(progressStart >= 0);
  assert.ok(reducedMotionStart >= 0);
  assert.match(reducedMotionRule, /student-action-progress-spinner/);
  assert.match(reducedMotionRule, /studentActionLoadingPulse/);
});

test('학생 화면은 주요 비동기 저장 상태를 하나의 로딩 모달에 연결한다', async () => {
  const source = await readFile(new URL('../pages/AuctionPage.tsx', import.meta.url), 'utf8');
  const pendingStart = source.indexOf('const isStudentActionPending');
  const pendingEnd = source.indexOf('\n\n  return (', pendingStart);
  const pendingSource = source.slice(pendingStart, pendingEnd);

  assert.ok(pendingStart >= 0);
  assert.match(pendingSource, /isLoading/);
  assert.match(pendingSource, /isStudentLifeSaving/);
  assert.match(pendingSource, /isPetSaving/);
  assert.match(pendingSource, /isEconomySaving/);
  assert.match(pendingSource, /isEmotionSaving/);
  assert.match(pendingSource, /isSubmittingItemId !== null/);
  assert.match(pendingSource, /isDonating/);
  assert.match(source, /aria-busy=\{isStudentActionPending\}/);
  assert.match(source, /<StudentActionProgress isActive=\{isStudentActionPending\} \/>/);
});
