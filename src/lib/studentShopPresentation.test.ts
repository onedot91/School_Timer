import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import StudentShopPage from '../components/student/StudentShopPage';
import { createStudentEconomyState } from './studentEconomy';
import { normalizeFailureProfileAssignments } from './failureExhibition';

test('학생 상점은 물품 없이 하나의 프로필 목록을 표시한다', () => {
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
  assert.match(markup, />내 프로필</);
  assert.doesNotMatch(markup, /student-profile-shop-groups/);
  assert.doesNotMatch(markup, />물품</);
  assert.doesNotMatch(markup, /연필|간식 쿠폰|자리 선택권/);
});
