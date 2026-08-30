import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import StudentTodayFriendPage from '../components/student/StudentTodayFriendPage';
import {
  getTodayFriendDateKey,
  getTodayFriendNumber,
  TODAY_FRIEND_STUDENT_COUNT,
} from './todayFriend';

test('오늘의 친구는 같은 날짜와 학생에게 같은 번호를 배정한다', () => {
  const first = getTodayFriendNumber(7, '2026-08-30');
  const second = getTodayFriendNumber(7, '2026-08-30');

  assert.equal(first, second);
  assert.notEqual(first, 7);
});

test('오늘의 친구는 본인을 제외하고 반 전체에 한 명씩 겹치지 않게 배정한다', () => {
  ['2026-08-30', '2026-08-31', '2027-01-01'].forEach((dateKey) => {
    const assignments = Array.from({ length: TODAY_FRIEND_STUDENT_COUNT }, (_, index) => {
      const studentNumber = index + 1;
      const friendNumber = getTodayFriendNumber(studentNumber, dateKey);
      assert.notEqual(friendNumber, studentNumber);
      return friendNumber;
    });

    assert.equal(new Set(assignments).size, TODAY_FRIEND_STUDENT_COUNT);
  });
});

test('오늘의 친구 페이지는 배정된 친구와 세 가지 실천 방법을 보여 준다', () => {
  const friendNumber = getTodayFriendNumber(1, getTodayFriendDateKey());
  const markup = renderToStaticMarkup(createElement(StudentTodayFriendPage, {
    studentNumber: 1,
    profileAssignments: {},
    onBack: () => undefined,
  }));

  assert.match(markup, /<h1>오늘의 친구<\/h1>/);
  assert.match(markup, new RegExp(`${friendNumber}번 친구의 동물 프로필`));
  assert.match(markup, /먼저 웃으며 인사하기/);
  assert.match(markup, /이야기 끝까지 들어 주기/);
  assert.match(markup, /좋은 점 한 가지 말해 주기/);
  assert.equal(markup.match(/<li>/g)?.length, 3);
  assert.equal(markup.match(/<figure/g)?.length, 1);
  assert.doesNotMatch(markup, /<span>나<\/span>/);
  assert.doesNotMatch(markup, /선생님 확인 · 10고마/);
});
