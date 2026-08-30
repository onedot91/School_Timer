import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import StudentShopPage, { getVisibleStudentShopTabs } from '../components/student/StudentShopPage';
import { createStudentEconomyState } from './studentEconomy';
import { FAILURE_PROFILE_IMAGES, normalizeFailureProfileAssignments } from './failureExhibition';

test('프로필이 없는 학생 상점은 무료 랜덤 프로필만 표시한다', () => {
  assert.deepEqual(getVisibleStudentShopTabs(false), ['items']);

  const markup = renderToStaticMarkup(createElement(StudentShopPage, {
    studentNumber: 1,
    profileAssignments: normalizeFailureProfileAssignments(undefined),
    state: createStudentEconomyState(),
    availableBalance: 100,
    isSaving: false,
    onAction: async () => true,
    onSelectProfile: async () => true,
  }));

  assert.match(markup, /<button[^>]*>[^<]*<svg[\s\S]*?프로필<\/button>/);
  assert.match(markup, /class="student-profile-shop-grid"/);
  assert.match(markup, />첫 1회 무료</);
  assert.doesNotMatch(markup, />내 프로필</);
  assert.doesNotMatch(markup, />곰</);
  assert.doesNotMatch(markup, /고마 스킨 뽑기|>집<\/button>/);
  assert.doesNotMatch(markup, /student-profile-shop-groups/);
  assert.doesNotMatch(markup, />물품</);
  assert.doesNotMatch(markup, /연필|간식 쿠폰|자리 선택권/);
});

test('프로필을 받은 학생 상점은 랜덤 30고마와 직접 교체 50고마를 표시한다', () => {
  assert.deepEqual(getVisibleStudentShopTabs(true), ['items', 'characters', 'houses']);

  const markup = renderToStaticMarkup(createElement(StudentShopPage, {
    studentNumber: 1,
    profileAssignments: normalizeFailureProfileAssignments({ 1: FAILURE_PROFILE_IMAGES[0] }),
    state: createStudentEconomyState(),
    availableBalance: 100,
    isSaving: false,
    onAction: async () => true,
    onSelectProfile: async () => true,
  }));

  assert.match(markup, />랜덤 교체</);
  assert.match(markup, />30 고마</);
  assert.match(markup, />50 고마</);
  assert.match(markup, />내 프로필</);
});
