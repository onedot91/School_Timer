import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import StudentToast from '../components/student/StudentToast.tsx';
import { getStudentToastDurationMs, STUDENT_TOAST_MAX_MS, STUDENT_TOAST_MIN_MS } from './studentToast.js';

test('짧은 결과는 최소 시간, 긴 결과는 더 오래 보이되 최대 시간을 넘지 않는다', () => {
  assert.equal(getStudentToastDurationMs('입찰했어요.'), STUDENT_TOAST_MIN_MS);
  const loanMessage = '30 고마를 빌렸습니다. 다음 주 월요일까지 33 고마를 갚아야 합니다.';
  assert.ok(getStudentToastDurationMs(loanMessage) > STUDENT_TOAST_MIN_MS);
  assert.equal(getStudentToastDurationMs('가'.repeat(500)), STUDENT_TOAST_MAX_MS);
});

test('알림 영역은 내용이 없어도 live region으로 먼저 자리 잡는다', () => {
  const markup = renderToStaticMarkup(createElement(StudentToast, { toast: null, onDone: () => undefined }));

  assert.match(markup, /class="student-toast-region"/);
  assert.match(markup, /role="status"/);
  assert.match(markup, /aria-live="polite"/);
  assert.doesNotMatch(markup, /aria-modal/);
});

test('토스트는 클릭을 막지 않고 움직임 줄이기 설정을 따른다', async () => {
  const css = await readFile(new URL('../index.css', import.meta.url), 'utf8');
  const regionStart = css.indexOf('.student-toast-region {');
  const region = css.slice(regionStart, css.indexOf('\n}', regionStart));

  assert.match(region, /pointer-events: none/);
  const toastStart = css.indexOf('.student-toast {');
  const toast = css.slice(toastStart, css.indexOf('\n}', toastStart));
  assert.match(toast, /font-size: var\(--type-title\)/);
  assert.match(toast, /width: max-content/);
  assert.doesNotMatch(toast, /white-space: nowrap/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\n  \.student-toast \{ animation: none; \}/);
  const keyframesStart = css.indexOf('@keyframes student-toast-in');
  assert.doesNotMatch(css.slice(keyframesStart, css.indexOf('\n}', keyframesStart)), /opacity/);
});

test('학생 성공 결과는 토스트로, 미확인 결과는 기존 알림창으로 보낸다', async () => {
  const source = await readFile(new URL('../pages/AuctionPage.tsx', import.meta.url), 'utf8');

  assert.match(source, /showSuccessToast\('입찰했어요\.'\)/);
  assert.match(source, /showSuccessToast\(`\$\{formatCurrency\(result\.donatedAmount\)\}를 기부했어요\.`\)/);
  assert.match(source, /action\.type !== 'buy_house'\) showSuccessToast\(resultMessage\)/);
  assert.match(source, /showStatusMessage\(`\$\{formatCurrency\(amount\)\} 입찰 결과가 미확인 상태입니다/);
  assert.match(source, /showStatusMessage\('처리 결과를 확인하지 못했습니다\./);
});
