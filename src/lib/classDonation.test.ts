import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getClassDonationMaximum,
  getClassDonationPublicState,
  mergeClassDonationActivity,
  normalizeClassDonationSettings,
  parseClassDonationResult,
} from './classDonation';

test('student donation state never exposes the private item or history', () => {
  const publicState = getClassDonationPublicState({
    enabled: true,
    itemName: '비밀 보드게임',
    targetAmount: 500,
    totalAmount: 320,
    history: [{ id: 'one', studentNumber: 8, amount: 20, createdAt: '2026-07-14T00:00:00.000Z' }],
  });
  assert.deepEqual(publicState, { enabled: true, targetAmount: 500, totalAmount: 320 });
  assert.equal('itemName' in publicState, false);
  assert.equal('history' in publicState, false);
});

test('teacher settings saves preserve concurrent donation activity', () => {
  const merged = mergeClassDonationActivity({
    enabled: true,
    itemName: '기존 물품',
    targetAmount: 500,
    totalAmount: 20,
    history: [{ id: 'donation-1', studentNumber: 8, amount: 20, createdAt: '2026-07-14T00:00:00.000Z' }],
  }, {
    enabled: true,
    itemName: '새 물품명',
    targetAmount: 600,
    totalAmount: 0,
    history: [],
  });

  assert.equal(merged.itemName, '새 물품명');
  assert.equal(merged.targetAmount, 600);
  assert.equal(merged.totalAmount, 20);
  assert.equal(merged.history.length, 1);
});

test('teacher autosave cannot shrink the target below donated currency', () => {
  const merged = mergeClassDonationActivity({
    enabled: true,
    targetAmount: 500,
    totalAmount: 320,
    history: [],
  }, {
    enabled: true,
    targetAmount: 100,
    totalAmount: 100,
    history: [],
  });
  assert.equal(merged.targetAmount, 320);
  assert.equal(merged.totalAmount, 320);
});

test('donation maximum respects available balance and remaining target', () => {
  assert.equal(getClassDonationMaximum({ enabled: true, targetAmount: 500, totalAmount: 493 }, 130), 7);
  assert.equal(getClassDonationMaximum({ enabled: true, targetAmount: 500, totalAmount: 320 }, 12), 12);
});

test('donation settings normalize invalid persisted values', () => {
  assert.deepEqual(normalizeClassDonationSettings({ targetAmount: 0, totalAmount: 999 }), {
    enabled: false,
    itemName: '',
    targetAmount: 500,
    totalAmount: 500,
    history: [],
  });
  assert.equal(parseClassDonationResult({
    donatedAmount: 7,
    balance: 123,
    totalAmount: 500,
    targetAmount: 500,
    completed: true,
  }).completed, true);
});
