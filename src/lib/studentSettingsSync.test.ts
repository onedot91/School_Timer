import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseStudentSettingsSnapshot,
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

test('학생 설정 스냅샷은 같은 학생 번호에서만 재사용한다', () => {
  const stored = JSON.stringify({
    studentNumber: 7,
    updatedAt: '2026-08-10T00:00:00.000Z',
    value: { currencyBalances: { 7: 145 } },
  });

  assert.equal(parseStudentSettingsSnapshot(stored, 8), null);
  assert.deepEqual(parseStudentSettingsSnapshot(stored, 7), {
    studentNumber: 7,
    updatedAt: '2026-08-10T00:00:00.000Z',
    value: { currencyBalances: { 7: 145 } },
  });
});
