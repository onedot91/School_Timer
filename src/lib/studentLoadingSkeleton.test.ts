import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import StudentBalanceSummary from '../components/student/StudentBalanceSummary.tsx';
import StudentLoadingSkeleton, { getStudentLoadingSkeletonVariant, StudentLoadingPage } from '../components/student/StudentLoadingSkeleton.tsx';

test('학생 화면 스켈레톤은 실제 화면 틀(.student-view, .student-header)에 자리를 잡고 상태를 알린다', () => {
  const markup = renderToStaticMarkup(createElement(StudentLoadingSkeleton, { label: '학생 기록 불러오는 중', variant: 'cards' }));

  assert.match(markup, /class="student-view student-loading-skeleton" data-variant="cards" role="status" aria-busy="true"/);
  assert.match(markup, /class="student-header" aria-hidden="true"/);
  assert.match(markup, /<span class="sr-only">학생 기록 불러오는 중<\/span>/);
  assert.equal(markup.match(/class="student-loading-skeleton-card"/g)?.length, 3);
});

test('첫 화면 스켈레톤은 학생 화면과 같은 페이지 틀을 쓴다', () => {
  const markup = renderToStaticMarkup(createElement(StudentLoadingPage, { label: '학생 기록 불러오는 중', variant: 'panel' }));

  assert.match(markup, /class="auction-page student-mode-page h-\[100dvh\] w-full overflow-hidden/);
  assert.match(markup, /<main class="mx-auto w-full max-w-7xl"><div class="student-view student-loading-skeleton" data-variant="panel"/);
});

test('홈 스켈레톤은 헤더 없이 실제 홈의 그림 칸과 아래 칸 세 개 자리를 쓴다', () => {
  const markup = renderToStaticMarkup(createElement(StudentLoadingSkeleton, { variant: 'overview' }));

  assert.match(markup, /class="student-view student-overview-view student-loading-skeleton" data-variant="overview"/);
  assert.doesNotMatch(markup, /student-header/);
  assert.match(markup, /<section class="student-overview-hero" aria-hidden="true"><span class="student-skeleton-block student-skeleton-overview-scene"><\/span><\/section>/);
  assert.equal(markup.match(/student-skeleton-overview-card/g)?.length, 3);
});

test('화면마다 닮은 스켈레톤을 고른다', () => {
  assert.equal(getStudentLoadingSkeletonVariant('overview'), 'overview');
  assert.equal(getStudentLoadingSkeletonVariant('store-bank'), 'cards');
  assert.equal(getStudentLoadingSkeletonVariant('store'), 'panel');
  assert.equal(getStudentLoadingSkeletonVariant('missions'), 'panel');
});

test('잔액을 확인하는 동안 글자 대신 고정 폭 블록을 보여 주고 읽기 프로그램에는 확인 중이라고 알린다', () => {
  const markup = renderToStaticMarkup(createElement(StudentBalanceSummary, {
    balance: 0,
    availableBalance: 0,
    reservedAmount: 0,
    isLoading: true,
  }));

  assert.match(markup, /student-balance-skeleton--primary" aria-hidden="true"/);
  assert.match(markup, /student-balance-skeleton--detail" aria-hidden="true"/);
  assert.equal(markup.match(/<span class="sr-only">확인 중<\/span>/g)?.length, 2);
  assert.doesNotMatch(markup, /<strong>확인 중<\/strong>/);
});

test('스켈레톤 반짝임은 transform만 쓰고 움직임 줄이기에서는 멈춘다', async () => {
  const css = await readFile(new URL('../index.css', import.meta.url), 'utf8');
  const keyframesStart = css.indexOf('@keyframes student-skeleton-sweep');
  assert.match(css.slice(keyframesStart, css.indexOf('\n}', keyframesStart)), /transform: translateX\(100%\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\n  \.student-skeleton-block::after \{ display: none; \}/);
});

test('학생 화면 전환은 다시 마운트하지 않고 투명도만 바꾸며 멈춘 애니메이션도 끝낸다', async () => {
  const source = await readFile(new URL('../pages/AuctionPage.tsx', import.meta.url), 'utf8');

  assert.match(source, /const STUDENT_VIEW_ENTER_KEYFRAMES: Keyframe\[\] = \[\{ opacity: 0\.3 \}, \{ opacity: 1 \}\];/);
  assert.match(source, /if \(!\(view instanceof HTMLElement\) \|\| shouldReduceMotion \|\| typeof view\.animate !== 'function'\) return undefined;/);
  assert.match(source, /window\.setTimeout\(\(\) => animation\.finish\(\), STUDENT_VIEW_ENTER_TIMING\.duration \+ 200\)/);
  assert.match(source, /<main ref=\{studentViewMainRef\} className="mx-auto w-full max-w-7xl">/);
});
