import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getStudentFailureExhibitionHint,
  STUDENT_FAILURE_EXHIBITION_HIDDEN_LABEL,
  STUDENT_FAILURE_EXHIBITION_HINTS,
  STUDENT_CUSTOM_HOUSE_RELEASED,
  STUDENT_FEATURE_RELEASES,
  getStudentFeatureFallbackView,
  getUnavailableStudentFeature,
} from './studentFeatureRelease';

test('학생 기능은 기능별 공개 플래그가 켜질 때까지 잠긴다', () => {
  assert.deepEqual(STUDENT_FEATURE_RELEASES, {
    bank: true,
    securities: false,
    bookstore: true,
    failureExhibition: false,
    emotionOrbs: true,
    petEgg: false,
  });
  assert.equal(STUDENT_CUSTOM_HOUSE_RELEASED, false);
});

test('잠긴 학생 화면의 직접 경로도 공개된 허브로 돌아간다', () => {
  assert.equal(getUnavailableStudentFeature('emotions'), null);
  assert.equal(getUnavailableStudentFeature('library'), null);
  assert.equal(getUnavailableStudentFeature('library-bookstore'), null);
  assert.equal(getUnavailableStudentFeature('library-bookshelf'), null);
  assert.equal(getUnavailableStudentFeature('library-failure-board'), 'failureExhibition');
  assert.equal(getUnavailableStudentFeature('store-bank'), null);
  assert.equal(getUnavailableStudentFeature('store-securities'), 'securities');
  assert.equal(getUnavailableStudentFeature('store-securities-trade'), 'securities');
  assert.equal(getUnavailableStudentFeature('store-shop'), null);
  assert.equal(getStudentFeatureFallbackView('bank'), 'store');
  assert.equal(getStudentFeatureFallbackView('securities'), 'store');
  assert.equal(getStudentFeatureFallbackView('bookstore'), 'overview');
  assert.equal(getStudentFeatureFallbackView('failureExhibition'), 'library');
  assert.equal(getStudentFeatureFallbackView('emotionOrbs'), 'overview');
});

test('잠긴 실패 전시 공간은 이름을 숨기고 무작위 힌트만 제공한다', () => {
  assert.equal(STUDENT_FAILURE_EXHIBITION_HIDDEN_LABEL, '?? ???');
  assert.equal(STUDENT_FAILURE_EXHIBITION_HINTS.length >= 4, true);
  assert.equal(getStudentFailureExhibitionHint(() => 0), STUDENT_FAILURE_EXHIBITION_HINTS[0]);
  assert.equal(getStudentFailureExhibitionHint(() => 0.999), STUDENT_FAILURE_EXHIBITION_HINTS.at(-1));
  assert.equal(STUDENT_FAILURE_EXHIBITION_HINTS.every(hint => hint.length > 0 && !hint.includes('실패 자랑소')), true);
});
