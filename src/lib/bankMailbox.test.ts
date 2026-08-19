import assert from 'node:assert/strict';
import test from 'node:test';

import { createBankMailboxLetters } from './bankMailbox.ts';

test('은행원은 예금 접수와 실제 만기 금액을 우편함에 알린다', () => {
  const letters = createBankMailboxLetters({
    action: { type: 'open_deposit', amount: 20, dateKey: '2026-08-20' },
    studentNumber: 3,
    requestId: 'student-economy-3-00000000-0000-0000-0000-000000000001',
    createdAt: '2026-08-20T01:00:00.000Z',
  });

  assert.deepEqual(letters, [{
    id: 'bank-00000000-0000-0000-0000-000000000001-deposit',
    recipient: 3,
    senderLabel: '은행원',
    senderStudentNumber: null,
    title: '◆ 예금 접수',
    content: '20 고마를 맡겼어요. 다음주 월요일에 22 고마를 받을 수 있어요.',
    createdAt: '2026-08-20T01:00:00.000Z',
  }]);
});

test('이체는 보낸 학생과 받은 학생 모두에게 기호가 있는 영수증을 보낸다', () => {
  const letters = createBankMailboxLetters({
    action: { type: 'transfer', amount: 20, recipientNumber: 8, dateKey: '2026-08-20' },
    studentNumber: 3,
    requestId: 'student-economy-3-00000000-0000-0000-0000-000000000002',
    createdAt: '2026-08-20T01:00:00.000Z',
  });

  assert.equal(letters.length, 2);
  assert.equal(letters[0]?.title, '↗ 이체 완료');
  assert.equal(letters[0]?.recipient, 3);
  assert.equal(letters[1]?.title, '↙ 이체 도착');
  assert.equal(letters[1]?.recipient, 8);
  assert.equal(letters[1]?.senderLabel, '은행원');
});
