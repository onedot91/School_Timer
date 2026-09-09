import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canReloadWithDrafts, getDraftReloadSafetySnapshot, getUnsafeDraftRecoveryText,
  removeDraftReloadCheck, setDraftReloadCheck, subscribeDraftReloadSafety,
} from './draftReloadSafety.js';

test('unsafe memory copy and reload protection are isolated by actor and react to durability changes', () => {
  const snapshots: number[] = [];
  const stop = subscribeDraftReloadSafety(() => snapshots.push(getDraftReloadSafetySnapshot()));
  setDraftReloadCheck('draft-safety-a', 22, () => false, () => '내 최신 글');
  setDraftReloadCheck('draft-safety-b', 23, () => false, () => '다른 학생 글');
  setDraftReloadCheck('draft-safety-c', 22, () => true, () => '이미 보관된 글');
  assert.equal(canReloadWithDrafts(22), false);
  assert.equal(getUnsafeDraftRecoveryText(22), '내 최신 글');
  setDraftReloadCheck('draft-safety-a', 22, () => true, () => '내 최신 글');
  assert.equal(canReloadWithDrafts(22), true);
  assert.equal(getUnsafeDraftRecoveryText(22), '');
  assert.equal(snapshots.length, 4);
  assert.ok(snapshots.every((value, index) => index === 0 || value > snapshots[index - 1]));
  for (const key of ['draft-safety-a', 'draft-safety-b', 'draft-safety-c']) removeDraftReloadCheck(key);
  stop();
});

test('storage verification failure blocks unload even if recovery text itself is unavailable', () => {
  setDraftReloadCheck('draft-safety-error', 22, () => { throw new Error('storage unavailable'); }, () => { throw new Error('unavailable'); });
  assert.equal(canReloadWithDrafts(22), false);
  assert.equal(getUnsafeDraftRecoveryText(22), '');
  removeDraftReloadCheck('draft-safety-error');
  assert.equal(canReloadWithDrafts(22), true);
});
