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

  assert.equal(letters[0]?.id, 'bank-00000000-0000-0000-0000-000000000001-deposit');
  assert.equal(letters[0]?.recipient, 3);
  assert.equal(letters[0]?.senderLabel, '은행원 돝돝');
  assert.equal(letters[0]?.title, '예금 접수');
  assert.equal(letters[0]?.senderStudentNumber, null);
  assert.equal(letters[0]?.createdAt, '2026-08-20T01:00:00.000Z');
  assert.ok((letters[0]?.content.length ?? 0) > 0);
});

test('은행원 편지 제목은 거래 용건만 짧게 알린다', () => {
  const actions = [
    { type: 'open_deposit', amount: 20, dateKey: '2026-08-20' },
    { type: 'close_deposit', depositId: 'deposit-1' },
    { type: 'claim_deposit', depositId: 'deposit-1', dateKey: '2026-08-20' },
    { type: 'borrow', amount: 20, dateKey: '2026-08-20' },
    { type: 'repay', amount: 20, dateKey: '2026-08-20' },
  ] as const;

  const titles = actions.map((action, index) => createBankMailboxLetters({
    action,
    studentNumber: 3,
    requestId: `student-economy-3-00000000-0000-0000-0000-00000000000${index + 1}`,
    createdAt: '2026-08-20T01:00:00.000Z',
  })[0]?.title);

  assert.deepEqual(titles, ['예금 접수', '예금 해지', '예금 만기', '대출', '대출 상환']);
});

test('은행원은 편지에서 자신을 이름 대신 저라고 부른다', () => {
  const actions = [
    { type: 'open_deposit', amount: 20, dateKey: '2026-08-20' },
    { type: 'repay', amount: 20, dateKey: '2026-08-20' },
    { type: 'transfer', amount: 20, recipientNumber: 8, dateKey: '2026-08-20' },
  ] as const;

  const contents = actions.flatMap((action, index) => createBankMailboxLetters({
    action,
    studentNumber: 3,
    requestId: `student-economy-3-00000000-0000-0000-0000-00000000000${index + 1}`,
    createdAt: '2026-08-20T01:00:00.000Z',
  }).map((letter) => letter.content));

  assert.equal(contents.some((content) => content.includes('돝돝이가')), false);
});

test('같은 은행 거래는 같은 편지를 만들고 다른 거래에는 세 가지 멘트를 고르게 사용한다', () => {
  const requestIds = [
    'student-economy-3-00000000-0000-0000-0000-000000000001',
    'student-economy-3-00000000-0000-0000-0000-000000000002',
    'student-economy-3-00000000-0000-0000-0000-000000000003',
  ] as const;
  const createLetter = (requestId: string) => createBankMailboxLetters({
    action: { type: 'open_deposit', amount: 20, dateKey: '2026-08-20' },
    studentNumber: 3,
    requestId,
    createdAt: '2026-08-20T01:00:00.000Z',
  })[0];

  const contents = requestIds.map((requestId) => createLetter(requestId)?.content);

  assert.equal(new Set(contents).size, 3);
  assert.equal(createLetter(requestIds[0])?.content, contents[0]);
});

test('이체는 보낸 학생과 받은 학생 모두에게 영수증을 보낸다', () => {
  const letters = createBankMailboxLetters({
    action: { type: 'transfer', amount: 20, recipientNumber: 8, dateKey: '2026-08-20' },
    studentNumber: 3,
    requestId: 'student-economy-3-00000000-0000-0000-0000-000000000002',
    createdAt: '2026-08-20T01:00:00.000Z',
  });

  assert.equal(letters.length, 2);
  assert.equal(letters[0]?.title, '송금 완료');
  assert.equal(letters[0]?.recipient, 3);
  assert.equal(letters[1]?.title, '송금 도착');
  assert.equal(letters[1]?.recipient, 8);
  assert.equal(letters[1]?.senderLabel, '은행원 돝돝');
});
