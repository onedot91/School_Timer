import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import TeacherTodayFriendReview from '../components/teacher/TeacherTodayFriendReview';
import type { TodayFriendSubmission } from './todayFriend';
import {
  createTodayFriendReviewQueue,
  getTodayFriendReviewQueueStatus,
} from './teacherTodayFriendReviewPresentation';

const submission = (overrides: Partial<TodayFriendSubmission> & Pick<TodayFriendSubmission, 'studentNumber' | 'partnerNumber' | 'genre' | 'payload'>): TodayFriendSubmission => ({
  id: `today-friend-2026-09-12-${overrides.studentNumber}`,
  dateKey: '2026-09-12',
  status: 'submitted',
  revision: 1,
  teacherFeedback: null,
  submittedAt: '2026-09-12T01:10:00.000Z',
  reviewedAt: null,
  rewardStatus: 'pending',
  ...overrides,
});

test('제출 칸 상태는 초안을 미제출로, 제출·완료를 구분한다', () => {
  assert.equal(getTodayFriendReviewQueueStatus(null), 'missing');
  assert.equal(getTodayFriendReviewQueueStatus(submission({
    studentNumber: 2,
    partnerNumber: 3,
    genre: 'interview',
    payload: { kind: 'interview', answer: '초안' },
    status: 'draft',
  })), 'missing');
  assert.equal(getTodayFriendReviewQueueStatus(submission({
    studentNumber: 3,
    partnerNumber: 22,
    genre: 'commonality',
    payload: { kind: 'commonality', commonality: '대화로 알게 된 공통점' },
  })), 'submitted');
  assert.equal(getTodayFriendReviewQueueStatus(submission({
    studentNumber: 11,
    partnerNumber: 14,
    genre: 'interview',
    payload: { kind: 'interview', answer: '완료' },
    status: 'approved',
  })), 'approved');
});

test('제출 목록은 1번부터 23번까지 번호 칸을 두고 상태로 색을 구분한다', () => {
  const queue = createTodayFriendReviewQueue([
    submission({
      studentNumber: 3,
      partnerNumber: 22,
      genre: 'commonality',
      payload: { kind: 'commonality', commonality: '1. 둘 다 떡볶이를 좋아한다\n2. 주말에 자전거를 탄다\n3. 강아지를 키운다' },
    }),
    submission({
      studentNumber: 11,
      partnerNumber: 14,
      genre: 'interview',
      payload: { kind: 'interview', answer: '새로 배운 리코더 곡을 연습 중이라고 했어요.' },
      status: 'approved',
    }),
  ]);
  const markup = renderToStaticMarkup(createElement(TeacherTodayFriendReview, {
    submissions: queue.flatMap((entry) => entry.submission ? [entry.submission] : []),
    isSaving: false,
    onReview: async () => {},
  }));

  assert.deepEqual(queue.map((entry) => entry.studentNumber), Array.from({ length: 23 }, (_, index) => index + 1));
  assert.match(markup, /aria-label="1번 미제출"/);
  assert.match(markup, /aria-label="3번 승인 대기"/);
  assert.match(markup, /aria-label="11번 완료"/);
  assert.match(markup, /aria-label="23번 미제출"/);
  assert.equal(markup.match(/teacher-today-friend-queue-list">[\s\S]*?<\/div>/)?.[0].match(/<button /g)?.length, 23);
  assert.match(markup, /data-status="missing"/);
  assert.match(markup, /data-status="submitted"/);
  assert.match(markup, /data-status="approved"/);
  assert.match(markup, /<h3>3번 제출<\/h3>/);
  assert.match(markup, /공통점 찾기 · 친구 22번/);
  assert.doesNotMatch(markup, /수정 요청/);
  assert.doesNotMatch(markup, /3번 → 22번/);
});
