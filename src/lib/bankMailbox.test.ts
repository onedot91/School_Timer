import assert from 'node:assert/strict';
import test from 'node:test';

import { createBankMailboxLetters } from './bankMailbox.ts';

const createdAt = '2026-08-20T01:00:00.000Z';

test('학생이 즉시 확인한 은행 거래에는 편지를 만들지 않는다', () => {
  // Given
  const actions = [
    { type: 'open_deposit', amount: 20, dateKey: '2026-08-20' },
    { type: 'close_deposit', depositId: 'deposit-1' },
    { type: 'repay', amount: 20, dateKey: '2026-08-20' },
  ] as const;

  // When
  const letters = actions.flatMap((action, index) => createBankMailboxLetters({
    action,
    studentNumber: 3,
    requestId: `student-economy-3-00000000-0000-0000-0000-00000000000${index + 1}`,
    createdAt,
  }));

  // Then
  assert.equal(letters.length, 0);
});

test('예금 만기와 대출 기한에는 중요 알림을 한 장씩 만든다', () => {
  // Given
  const actions = [
    { type: 'claim_deposit', depositId: 'deposit-1', dateKey: '2026-08-20' },
    { type: 'borrow', amount: 20, dateKey: '2026-08-20' },
  ] as const;

  // When
  const lettersByAction = actions.map((action, index) => createBankMailboxLetters({
    action,
    studentNumber: 3,
    requestId: `student-economy-3-00000000-0000-0000-0000-00000000001${index + 1}`,
    createdAt,
  }));

  // Then
  assert.deepEqual(lettersByAction.map((letters) => letters.length), [1, 1]);
  assert.equal(lettersByAction.every(([letter]) => letter?.recipient === 3), true);
});

test('송금은 받은 학생에게만 도착 알림을 만든다', () => {
  // Given
  const action = { type: 'transfer', amount: 20, recipientNumber: 8, dateKey: '2026-08-20' } as const;

  // When
  const letters = createBankMailboxLetters({
    action,
    studentNumber: 3,
    requestId: 'student-economy-3-00000000-0000-0000-0000-000000000021',
    createdAt,
  });

  // Then
  assert.equal(letters.length, 1);
  assert.equal(letters[0]?.recipient, 8);
});
