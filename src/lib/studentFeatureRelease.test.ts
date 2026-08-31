import assert from 'node:assert/strict';
import test from 'node:test';
import {
  STUDENT_CUSTOM_HOUSE_RELEASED,
  STUDENT_FEATURE_RELEASES,
  getStudentFeatureFallbackView,
  getUnavailableStudentFeature,
} from './studentFeatureRelease';

test('학생 기능은 기능별 공개 플래그가 켜질 때까지 잠긴다', () => {
  assert.deepEqual(STUDENT_FEATURE_RELEASES, {
    bank: false,
    securities: false,
    bookstore: false,
    emotionOrbs: false,
    petEgg: false,
  });
  assert.equal(STUDENT_CUSTOM_HOUSE_RELEASED, false);
});

test('잠긴 학생 화면의 직접 경로도 공개된 허브로 돌아간다', () => {
  assert.equal(getUnavailableStudentFeature('emotions'), 'emotionOrbs');
  assert.equal(getUnavailableStudentFeature('library'), 'bookstore');
  assert.equal(getUnavailableStudentFeature('library-bookstore'), 'bookstore');
  assert.equal(getUnavailableStudentFeature('library-bookshelf'), 'bookstore');
  assert.equal(getUnavailableStudentFeature('store-bank'), 'bank');
  assert.equal(getUnavailableStudentFeature('store-securities'), 'securities');
  assert.equal(getUnavailableStudentFeature('store-securities-trade'), 'securities');
  assert.equal(getUnavailableStudentFeature('store-shop'), null);
  assert.equal(getStudentFeatureFallbackView('bank'), 'store');
  assert.equal(getStudentFeatureFallbackView('securities'), 'store');
  assert.equal(getStudentFeatureFallbackView('bookstore'), 'overview');
  assert.equal(getStudentFeatureFallbackView('emotionOrbs'), 'overview');
});
