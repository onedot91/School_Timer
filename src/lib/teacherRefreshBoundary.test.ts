import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { applyAcknowledgedTeacherChanges, createTeacherSettingsChanges, isStorageRecord } from './teacherStorageCommand.js';
import { getSaveRecoveryStatus, getSaveRefreshVersion, isSaveRefreshVersionCurrent, markSaveRefreshComplete, markSaveRefreshPending } from './saveRecovery.js';

const source = readFileSync(new URL('../pages/TimerPage.tsx', import.meta.url), 'utf8');
const callbackStart = source.indexOf('  const refreshTeacherSavedState = ');
const callbackEnd = source.indexOf('  const teacherRecoveryRefreshRef = ', callbackStart);
assert.ok(callbackStart >= 0 && callbackEnd > callbackStart);
const callbackSource = source.slice(callbackStart, callbackEnd) + '\nrefreshTeacherSavedState;';

const fixture = () => {
  let resolveRead: ((value: { value: Record<string, unknown>; updated_at: string }) => void) | undefined;
  const read = new Promise<{ value: Record<string, unknown>; updated_at: string }>(resolve => { resolveRead = resolve; });
  const applied: unknown[] = [];
  const lastUpdatedAt = { current: '2026-09-09T00:00:00.000Z' };
  const pending = { current: true };
  const callback: unknown = runInNewContext(callbackSource, {
    getSaveRefreshVersion, isSaveRefreshVersionCurrent, markSaveRefreshComplete,
    loadSharedSettingsRow: () => read,
    normalizeSharedSchoolTimerSettings: (value: unknown) => isStorageRecord(value) ? value : null,
    createTeacherSettingsChanges, applyAcknowledgedTeacherChanges,
    teacherSettingsBaseRef: { current: { scheduleNotice: 'before' } },
    latestTeacherSnapshotRef: { current: { scheduleNotice: 'before' } },
    applySharedSettingsSnapshot: (value: unknown) => { applied.push(value); },
    teacherRefreshPendingRef: pending,
    lastSharedSettingsUpdatedAtRef: lastUpdatedAt,
    setTeacherRefreshPending: (value: boolean) => { pending.current = value; },
  });
  assert.equal(typeof callback, 'function');
  return { applied, pending, lastUpdatedAt,
    start: async () => { if (typeof callback !== 'function') throw new Error('Missing teacher callback'); await callback(); },
    finishRead: (updated_at: string) => resolveRead?.({ value: { scheduleNotice: 'saved' }, updated_at }),
  };
};

test('교사 실제 갱신 callback은 이전 조회 응답으로 나중에 확인된 저장 경고를 지우지 않는다', async () => {
  markSaveRefreshPending(0);
  const screen = fixture();
  const pendingRead = screen.start();
  markSaveRefreshPending(0);
  screen.finishRead('2026-09-09T00:00:01.000Z');
  await pendingRead;
  assert.deepEqual(screen.applied, []);
  assert.equal(screen.pending.current, true);
  assert.equal(screen.lastUpdatedAt.current, '2026-09-09T00:00:00.000Z');
  assert.equal(getSaveRecoveryStatus(0).refreshPending, true);
});

test('확인 이후 시작한 교사 조회는 영수증 시각보다 이른 resource updated_at도 최신 화면으로 수신한다', async () => {
  markSaveRefreshPending(0);
  const screen = fixture();
  const pendingRead = screen.start();
  // The resource snapshot timestamp can precede the receipt's transaction timestamp.
  screen.finishRead('2026-09-09T00:00:01.000Z');
  await pendingRead;
  assert.deepEqual(screen.applied, [{ scheduleNotice: 'saved' }]);
  assert.equal(screen.lastUpdatedAt.current, '2026-09-09T00:00:01.000Z');
  assert.equal(screen.pending.current, false);
  assert.equal(getSaveRecoveryStatus(0).refreshPending, false);
});

test('교사 polling은 두 비동기 조회 사이에도 저장 확인 세대를 검사한다', () => {
  const polling = source.slice(source.indexOf('    const syncSharedSettingsFromRemote ='), source.indexOf('    const intervalId = window.setInterval(syncSharedSettingsFromRemote'));
  assert.match(polling, /const refreshVersion = getSaveRefreshVersion\(0\);[\s\S]*await loadSharedSettingsUpdatedAt\(\)/);
  assert.match(polling, /await loadSharedSettingsUpdatedAt\(\);[\s\S]*!isSaveRefreshVersionCurrent\(0, refreshVersion\)[\s\S]*await loadSharedSettingsRow\(\)/);
  assert.match(polling, /await loadSharedSettingsRow\(\);[\s\S]*!isSaveRefreshVersionCurrent\(0, refreshVersion\)[\s\S]*applySharedSettingsSnapshot/);
  assert.match(polling, /markSaveRefreshComplete\(0, refreshVersion\)/);
  assert.doesNotMatch(source, /(?<!if \(saved.value\) )lastSharedSettingsUpdatedAtRef.current = saved.updatedAt;/);
});
