import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveTeacherSaveIndicator, type TeacherSaveIndicatorInput } from './teacherSaveIndicator.js';
import { getSaveActivitySnapshot, setSaveActivityPending, subscribeSaveActivity, trackSaveActivity } from './saveActivity.js';

const idle: TeacherSaveIndicatorInput = {
  unsafe: false, saveError: false, noticeKind: null, pendingRecovery: 0, activeIssues: 0, reviewedIssues: 0,
  recovering: false, inFlightSaves: 0, refreshPending: false, loading: false, sharedBackend: true,
};
const stateOf = (patch: Partial<TeacherSaveIndicatorInput>) => deriveTeacherSaveIndicator({ ...idle, ...patch }).state;

test('saved only shows when the shared backend has nothing pending', () => {
  assert.deepEqual(deriveTeacherSaveIndicator(idle), { state: 'saved', label: '저장됨', tone: 'success', count: 0 });
  assert.equal(stateOf({ sharedBackend: false }), 'local');
  assert.equal(stateOf({ inFlightSaves: 1 }), 'saving');
  assert.equal(stateOf({ recovering: true }), 'saving');
  assert.equal(stateOf({ loading: true }), 'loading');
  assert.equal(stateOf({ refreshPending: true }), 'refresh');
});

test('problems outrank a save that is still running', () => {
  const busy = { inFlightSaves: 2, recovering: true, refreshPending: true, loading: true };
  assert.equal(stateOf({ ...busy, unsafe: true, saveError: true, activeIssues: 1 }), 'unsafe');
  assert.equal(stateOf({ ...busy, saveError: true, activeIssues: 1 }), 'failed');
  assert.equal(stateOf({ ...busy, activeIssues: 1, noticeKind: 'maintenance' }), 'unconfirmed');
  assert.equal(stateOf({ ...busy, noticeKind: 'maintenance' }), 'maintenance');
  assert.equal(stateOf({ ...busy, noticeKind: 'update' }), 'update');
});

test('an unknown server result stays unconfirmed, never failed or saved', () => {
  const unconfirmed = deriveTeacherSaveIndicator({ ...idle, pendingRecovery: 3, activeIssues: 2, reviewedIssues: 1 });
  assert.equal(unconfirmed.state, 'unconfirmed');
  assert.equal(unconfirmed.tone, 'warning');
  assert.equal(unconfirmed.count, 2);
  assert.equal(stateOf({ pendingRecovery: 1 }), 'unconfirmed');
  assert.equal(deriveTeacherSaveIndicator({ ...idle, pendingRecovery: 1 }).count, 1);
});

test('teacher-reviewed alerts alone read as saved until a new unconfirmed alert appears', () => {
  const reviewed = deriveTeacherSaveIndicator({ ...idle, pendingRecovery: 2, reviewedIssues: 2 });
  assert.equal(reviewed.state, 'saved');
  assert.equal(reviewed.count, 0);
  assert.equal(stateOf({ pendingRecovery: 2, reviewedIssues: 2, sharedBackend: false }), 'local');
  assert.equal(stateOf({ pendingRecovery: 2, reviewedIssues: 2, inFlightSaves: 1 }), 'saving');
  const withNew = deriveTeacherSaveIndicator({ ...idle, pendingRecovery: 3, activeIssues: 1, reviewedIssues: 2 });
  assert.equal(withNew.state, 'unconfirmed');
  assert.equal(withNew.count, 1);
});

test('save activity counts running and scheduled saves until they settle', async () => {
  let notified = 0;
  const unsubscribe = subscribeSaveActivity(() => { notified += 1; });
  let finish: (() => void) | undefined;
  const running = trackSaveActivity(() => new Promise<void>(resolve => { finish = resolve; }));
  const failing = trackSaveActivity(() => Promise.reject(new Error('offline')));
  const throwing = trackSaveActivity(() => { throw new Error('sync'); });
  setSaveActivityPending('debounce', true);
  setSaveActivityPending('debounce', true);
  assert.equal(getSaveActivitySnapshot(), 4);
  await assert.rejects(failing);
  await assert.rejects(throwing);
  assert.equal(getSaveActivitySnapshot(), 2);
  finish?.();
  await running;
  setSaveActivityPending('debounce', false);
  assert.equal(getSaveActivitySnapshot(), 0);
  assert.ok(notified > 0);
  unsubscribe();
});
