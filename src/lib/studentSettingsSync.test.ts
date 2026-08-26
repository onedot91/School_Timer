import assert from 'node:assert/strict';
import test from 'node:test';
import {
  shouldLoadFullStudentSettings,
  STUDENT_FOREGROUND_SYNC_COOLDOWN_MS,
  STUDENT_SETTINGS_SYNC_INTERVAL_MS,
} from './studentSettingsSync';

test('student settings only reload fully when the shared timestamp changes', () => {
  assert.equal(shouldLoadFullStudentSettings(null, '2026-08-10T00:00:00.000Z'), true);
  assert.equal(shouldLoadFullStudentSettings('2026-08-10T00:00:00.000Z', '2026-08-10T00:00:00.000Z'), false);
  assert.equal(shouldLoadFullStudentSettings('2026-08-10T00:00:00.000Z', '2026-08-10T00:01:00.000Z'), true);
});

test('학생 상점은 2초 안에, 개요는 10초 안에 공유 변경을 다시 확인한다', () => {
  assert.equal(STUDENT_SETTINGS_SYNC_INTERVAL_MS.overview, 10_000);
  assert.equal(STUDENT_SETTINGS_SYNC_INTERVAL_MS.store, 2_000);
  assert.equal(STUDENT_SETTINGS_SYNC_INTERVAL_MS.emotions, undefined);
  assert.equal(STUDENT_SETTINGS_SYNC_INTERVAL_MS.missions, undefined);
  assert.equal(STUDENT_FOREGROUND_SYNC_COOLDOWN_MS, 2_000);
});
