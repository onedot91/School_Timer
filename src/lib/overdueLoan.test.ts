import assert from 'node:assert/strict';
import test from 'node:test';
import { applyStudentEconomyAction } from './studentEconomy.js';
import { createBankMailboxLetters } from './bankMailbox.js';
import { settlePendingTeacherDeductionsInSettings } from './currency.js';
import { normalizeStudentEconomyStates } from './studentEconomy.js';

const settle = (state: unknown, requestId = 'overdue-test-request', todayDateKey = '2026-11-06') => applyStudentEconomyAction({
  state, action: { type: 'settle_overdue_loan' }, wallet: 2, availableWallet: 0, requestId, todayDateKey,
});

test('기한 당일·대출 없음·기한 없는 기존 대출은 차감하지 않는다', () => {
  for (const state of [{ loan: 55, loanDueDate: '2026-11-06' }, { loan: 55 }, {}]) {
    assert.equal(settle(state).applied, false);
  }
});

test('기존 연체는 남은 상환액의 10%를 반올림하고 대출을 대기로 한 번만 옮긴다', () => {
  const result = settle({ loan: 55, loanPrincipal: 50, loanDueDate: '2026-10-01' });
  assert.equal(result.state.loan, 0);
  assert.equal(result.state.loanPrincipal, 0);
  assert.equal(result.state.loanDueDate, null);
  assert.equal(result.state.pendingDeductions[0].amount, 61);
  assert.deepEqual(result.overdueLoan, { repayment: 55, penalty: 6 });
  assert.equal(settle(result.state).applied, false);
  assert.equal(settle(result.state, 'another-login-request').applied, false);
  const letters = createBankMailboxLetters({ action: { type: 'settle_overdue_loan' }, studentNumber: 1,
    requestId: 'overdue-test-request', createdAt: '2026-11-06T00:00:00Z', overdueLoan: result.overdueLoan });
  assert.equal(letters.length, 1);
  assert.equal(letters[0].senderLabel, '은행원 돝돝');
  assert.match(letters[0].content, /55고마와 연체 벌금 6고마/);
});

test('가능한 자산부터 차감하고 부족액을 기존 차감 대기에 남긴다', () => {
  const result = settle({ loan: 55, loanPrincipal: 50, loanDueDate: '2026-10-01', deposit: 3 });
  const value = settlePendingTeacherDeductionsInSettings({ currencyBalances: { '1': 2, '2': 90 },
    studentEconomy: { '1': result.state, '2': { futureField: null } }, studentLife: { letters: [] } },
  '2026-11-06T00:00:00Z', [1]);
  const state = normalizeStudentEconomyStates(value.studentEconomy)['1'];
  assert.equal(state.deposit, 0);
  assert.equal(state.pendingDeductions[0].amount, 56);
  assert.deepEqual(Reflect.get(value.studentEconomy as object, '2'), { futureField: null });
  const again = settlePendingTeacherDeductionsInSettings(value, '2026-11-06T00:00:00Z', [1]);
  assert.deepEqual(again, value);
});
