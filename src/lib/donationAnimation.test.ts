import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import StudentDonationPage from '../components/student/StudentDonationPage.tsx';

const renderDonationPage = (isCompleted: boolean) => renderToStaticMarkup(createElement(StudentDonationPage, {
  totalAmount: isCompleted ? 600 : 439,
  targetAmount: 600,
  canDonate: !isCompleted,
  isCompleted,
  triggerRef: createRef<HTMLButtonElement>(),
  onDonate: () => {},
}));

test('기부 미완료 상태에서는 감사 GIF를 불러오지 않는다', () => {
  const incompleteDonationMarkup = renderDonationPage(false);

  assert.doesNotMatch(incompleteDonationMarkup, /donation-thanks-075x\.gif/);
  assert.match(incompleteDonationMarkup, /donation-character-[1-4]\.png/);
  assert.doesNotMatch(incompleteDonationMarkup, /student-donation-animation is-completed/);
});

test('기부 완료 상태에서만 감사 GIF와 모션 감소 포스터를 제공한다', () => {
  const completedDonationMarkup = renderDonationPage(true);

  assert.match(completedDonationMarkup, /donation-thanks-075x\.gif/);
  assert.match(completedDonationMarkup, /donation-thanks-poster\.png/);
  assert.match(completedDonationMarkup, /student-donation-animation is-completed/);
});
