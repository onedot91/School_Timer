import assert from 'node:assert/strict';
import test from 'node:test';
import { getSaveRecoveryStatus, getSaveRefreshVersion, isSaveRefreshVersionCurrent, markSaveRefreshComplete, markSaveRefreshPending } from './saveRecovery.js';
import { compareStorageTimestamps } from './storageResponseOrder.js';

test('a read started before receipt confirmation cannot clear the pending refresh', () => {
  const beforeConfirmation = getSaveRefreshVersion(17);
  markSaveRefreshPending(17);
  assert.equal(isSaveRefreshVersionCurrent(17, beforeConfirmation), false);
  markSaveRefreshComplete(17, beforeConfirmation);
  assert.equal(getSaveRecoveryStatus(17).refreshPending, true);

  const afterConfirmation = getSaveRefreshVersion(17);
  // PostgreSQL records resource timestamps before the transaction's receipt timestamp.
  const snapshotUpdatedAt = '2026-09-09T01:00:00.000100Z';
  const receiptCommittedAt = '2026-09-09T01:00:00.000900Z';
  assert.equal(compareStorageTimestamps(snapshotUpdatedAt, receiptCommittedAt), -1);
  assert.equal(isSaveRefreshVersionCurrent(17, afterConfirmation), true);
  markSaveRefreshComplete(17, afterConfirmation);
  assert.equal(getSaveRecoveryStatus(17).refreshPending, false);
});

test('another confirmed save invalidates an in-flight refresh without affecting another student', () => {
  markSaveRefreshPending(4);
  markSaveRefreshPending(5);
  const first = getSaveRefreshVersion(4);
  const other = getSaveRefreshVersion(5);
  markSaveRefreshPending(4);
  markSaveRefreshComplete(4, first);
  assert.equal(getSaveRecoveryStatus(4).refreshPending, true);
  markSaveRefreshComplete(5, other);
  assert.equal(getSaveRecoveryStatus(5).refreshPending, false);
  markSaveRefreshComplete(4, getSaveRefreshVersion(4));
  assert.equal(getSaveRecoveryStatus(4).refreshPending, false);
});
