import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createClassDonationThankYouLetter,
  getClassDonationMaximum,
  isClassDonationCompleted,
  getClassDonationPublicState,
  mergeClassDonationActivity,
  normalizeClassDonationSettings,
  parseClassDonationResult,
} from './classDonation';
import { getStudentLetters, normalizeStudentLifeState } from './studentLife';

test('기부 요청마다 아기고마 감사 편지를 정확히 한 장 만든다', () => {
  // Given
  const initial = normalizeStudentLifeState(null);
  const input = {
    studentNumber: 7,
    donatedAmount: 20,
    requestId: 'class-donation-7-request-1',
    createdAt: '2026-08-23T01:00:00.000Z',
  };

  // When
  const first = createClassDonationThankYouLetter(initial, input);
  const second = createClassDonationThankYouLetter(first, input);

  // Then
  const letters = getStudentLetters(second, 7);
  assert.equal(letters.length, 1);
  assert.equal(letters[0]?.id, input.requestId);
  assert.equal(letters[0]?.senderLabel, '아기고마');
  assert.equal(letters[0]?.senderStudentNumber, null);
});

test('서로 다른 기부 요청에는 여러 감사 멘트가 안정적으로 배정된다', () => {
  // Given
  const initial = normalizeStudentLifeState(null);
  const requestIds = Array.from({ length: 24 }, (_, index) => `class-donation-7-request-${index + 1}`);

  // When
  const messages = requestIds.map((requestId) => {
    const state = createClassDonationThankYouLetter(initial, {
      studentNumber: 7,
      donatedAmount: 20,
      requestId,
      createdAt: '2026-08-23T01:00:00.000Z',
    });
    return state.letters[0]?.content;
  });
  const retried = createClassDonationThankYouLetter(initial, {
    studentNumber: 7,
    donatedAmount: 20,
    requestId: requestIds[0] ?? '',
    createdAt: '2026-08-23T01:00:00.000Z',
  });

  // Then
  assert.ok(new Set(messages).size >= 4);
  assert.equal(retried.letters[0]?.content, messages[0]);
});

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

test('completed donation goals remain identifiable after collection closes', () => {
  assert.equal(isClassDonationCompleted({ enabled: false, targetAmount: 150, totalAmount: 149 }), false);
  assert.equal(isClassDonationCompleted({ enabled: false, targetAmount: 150, totalAmount: 150 }), true);
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
