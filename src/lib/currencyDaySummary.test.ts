import assert from 'node:assert/strict';
import test from 'node:test';
import type { CurrencyHistoryEntry } from './currency.js';
import { mergeTeacherAdjustments, summarizeCurrencyDay } from './currencyDaySummary.js';
import { normalizeStudentEconomyStates } from './studentEconomy.js';

const dayStart = Date.parse('2026-10-20T00:00:00+09:00');
const dayEnd = dayStart + 24 * 60 * 60 * 1000;
const entry = (
  studentNumber: number,
  before: number,
  after: number,
  reason: CurrencyHistoryEntry['reason'],
  createdAt: string,
  ownAccountAmount?: number,
): CurrencyHistoryEntry => ({
  id: `${studentNumber}-${createdAt}-${reason}`, studentNumber, delta: after - before, before, after, reason, createdAt,
  ...(ownAccountAmount === undefined ? {} : { ownAccountAmount }),
});

test('이어진 교사 ±조정은 순증감 한 줄로 합치고 다른 사유가 끼면 끊는다', () => {
  const merged = mergeTeacherAdjustments([
    entry(1, 110, 105, 'teacher_deduction', '2026-10-20T09:03:00+09:00'),
    entry(1, 105, 110, 'manual', '2026-10-20T09:02:00+09:00'),
    entry(1, 100, 105, 'bulk_adjust', '2026-10-20T09:01:00+09:00'),
    entry(1, 90, 100, 'allowance', '2026-10-20T09:00:00+09:00'),
    entry(1, 95, 90, 'manual', '2026-10-20T08:59:00+09:00'),
    entry(1, 90, 95, 'manual', '2026-10-20T08:00:00+09:00'),
  ]);
  assert.deepEqual(merged.map(({ reason, delta, createdAt }) => ({ reason, delta, createdAt })), [
    { reason: 'teacher_adjust', delta: 5, createdAt: '2026-10-20T09:03:00+09:00' },
    { reason: 'allowance', delta: 10, createdAt: '2026-10-20T09:00:00+09:00' },
    { reason: 'teacher_adjust', delta: -5, createdAt: '2026-10-20T08:59:00+09:00' },
    { reason: 'teacher_adjust', delta: 5, createdAt: '2026-10-20T08:00:00+09:00' },
  ]);
});

test('+5와 −5가 상쇄된 교사 조정은 표시하지 않는다', () => {
  assert.deepEqual(mergeTeacherAdjustments([
    entry(2, 105, 100, 'teacher_deduction', '2026-10-20T09:01:00+09:00'),
    entry(2, 100, 105, 'manual', '2026-10-20T09:00:00+09:00'),
  ]), []);
});

test('예금·주식 원금 이동은 빼고 회수할 때의 이자·손익만 입출금으로 본다', () => {
  const merged = mergeTeacherAdjustments([
    entry(3, 70, 95, 'stock_trade', '2026-10-20T10:04:00+09:00', 30),
    entry(3, 100, 70, 'stock_trade', '2026-10-20T10:03:00+09:00', -30),
    entry(3, 45, 100, 'bank_transfer', '2026-10-20T10:02:00+09:00', 50),
    entry(3, 95, 45, 'bank_transfer', '2026-10-20T10:01:00+09:00', -50),
    entry(3, 100, 95, 'bank_transfer', '2026-10-20T10:00:00+09:00'),
    entry(3, 100, 100, 'stock_trade', '2026-10-20T09:59:00+09:00', 20),
  ]);
  assert.deepEqual(merged.map(({ reason, delta }) => ({ reason, delta })), [
    { reason: 'investment_return', delta: -5 },
    { reason: 'deposit_interest', delta: 5 },
    { reason: 'bank_transfer', delta: -5 },
    { reason: 'investment_return', delta: -20 },
  ]);
});

test('예금·투자에서 함께 빠진 교사 차감은 전체 차감액으로 본다', () => {
  const [merged] = mergeTeacherAdjustments([entry(4, 10, 0, 'teacher_deduction', '2026-10-20T09:00:00+09:00', 25)]);
  assert.equal(merged?.reason, 'teacher_adjust');
  assert.equal(merged?.delta, -35);
});

test('오늘 기록만 학생별 순증감·사유별로 합치고 보유 고마는 예금·투자를 포함한다', () => {
  const summary = summarizeCurrencyDay({
    '1': [
      entry(1, 130, 118, 'shop_purchase', '2026-10-20T09:00:00+09:00'),
      entry(1, 100, 130, 'allowance', '2026-10-20T08:00:00+09:00'),
      entry(1, 1, 100, 'allowance', '2026-10-19T23:59:00+09:00'),
    ],
    '2': [entry(2, 105, 100, 'teacher_deduction', '2026-10-20T10:01:00+09:00'), entry(2, 100, 105, 'manual', '2026-10-20T10:00:00+09:00')],
    '3': [entry(3, 120, 110, 'teacher_deduction', '2026-10-20T10:01:00+09:00'), entry(3, 115, 120, 'manual', '2026-10-20T10:00:00+09:00')],
    '24': [entry(24, 0, 500, 'manual', '2026-10-20T10:00:00+09:00')],
  }, { '1': 250, '2': 40, '24': 9999 }, normalizeStudentEconomyStates({
    '2': {
      deposit: 30,
      deposits: [{ id: 'd1', principal: 30, openedOn: '2026-10-19', maturityDate: '2026-10-26', interest: 3 }],
      investments: { sunny: { investedAmount: 20, currentAmount: 25, lastSettledDateKey: '2026-10-20', lastChangeAmount: 5, lastStage: 'up' } },
    },
  }), dayStart, dayEnd);

  assert.equal(summary.students.length, 23);
  assert.deepEqual(summary.students.slice(0, 3).map(({ studentNumber, balance, wallet, net, entries }) => ({ studentNumber, balance, wallet, net, rows: entries.length })), [
    { studentNumber: 1, balance: 250, wallet: 250, net: 18, rows: 2 },
    { studentNumber: 2, balance: 95, wallet: 40, net: 0, rows: 0 },
    { studentNumber: 3, balance: 100, wallet: 100, net: -5, rows: 1 },
  ]);
  assert.equal(summary.incoming, 30);
  assert.equal(summary.outgoing, 17);
  assert.equal(summary.totalBalance, 250 + 95 + 21 * 100);
  assert.equal(summary.maxBalance, 250);
  assert.equal(summary.maxStudentNet, 18);
  assert.deepEqual(summary.incomingReasons, [{ reason: 'allowance', amount: 30 }]);
  assert.deepEqual(summary.outgoingReasons, [{ reason: 'shop_purchase', amount: 12 }, { reason: 'teacher_adjust', amount: 5 }]);
});
