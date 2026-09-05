import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isStudentSettingsSnapshotFresh,
  loadStudentSettingsSnapshot,
  parseStudentSettingsSnapshot,
  shouldLoadFullStudentSettings,
  STUDENT_FOREGROUND_SYNC_COOLDOWN_MS,
  STUDENT_SETTINGS_SYNC_INTERVAL_MS,
  STUDENT_SETTINGS_DEFAULT_SYNC_INTERVAL_MS,
  STUDENT_SETTINGS_CACHE_KEY,
  storeStudentProfileSnapshot,
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
  assert.equal(STUDENT_SETTINGS_DEFAULT_SYNC_INTERVAL_MS, 10_000);
});

test('프로필 저장보다 늦게 도착한 과거 조회는 거부하고 같은 버전과 이후 변경은 반영한다', () => {
  const savedAt = '2026-09-05T10:00:01.001Z';
  assert.equal(isStudentSettingsSnapshotFresh('2026-09-05T10:00:01.000Z', savedAt), false);
  assert.equal(isStudentSettingsSnapshotFresh(savedAt, savedAt), true);
  assert.equal(isStudentSettingsSnapshotFresh('2026-09-05T10:00:01.002Z', savedAt), true);
  assert.equal(isStudentSettingsSnapshotFresh(undefined, savedAt), false);
  assert.equal(isStudentSettingsSnapshotFresh('invalid', savedAt), false);
  assert.equal(isStudentSettingsSnapshotFresh(savedAt, null), true);
});

test('프로필 저장은 재입장 캐시도 갱신하되 전체 동기화 시각과 다른 영역은 유지한다', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const stored = new Map<string, string>([[STUDENT_SETTINGS_CACHE_KEY, JSON.stringify({
    studentNumber: 1, updatedAt: '2026-09-05T10:00:00.000Z',
    value: { auctionBids: { first: { bidder: 1, amount: 20 } }, studentLife: { failureProfileAssignments: { 1: 'old' } } },
  })]]);
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    localStorage: { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value) },
  } });
  try {
    const life = { failureProfileAssignments: { 1: 'new', 2: 'unchanged' } };
    assert.equal(storeStudentProfileSnapshot(2, life), false);
    assert.equal(storeStudentProfileSnapshot(1, life), true);
    const cached = loadStudentSettingsSnapshot(1);
    assert.deepEqual(cached?.value.studentLife, life);
    assert.deepEqual(cached?.value.auctionBids, { first: { bidder: 1, amount: 20 } });
    assert.equal(cached?.updatedAt, '2026-09-05T10:00:00.000Z');
    assert.equal(shouldLoadFullStudentSettings(cached?.updatedAt ?? null, '2026-09-05T10:00:01.000Z'), true);
    stored.set(STUDENT_SETTINGS_CACHE_KEY, 'broken json');
    assert.equal(storeStudentProfileSnapshot(1, life), false);
  } finally {
    if (original) Object.defineProperty(globalThis, 'window', original);
    else Reflect.deleteProperty(globalThis, 'window');
  }
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
