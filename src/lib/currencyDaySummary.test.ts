import assert from 'node:assert/strict';
import test from 'node:test';
import type { CurrencyHistoryEntry } from './currency.js';
import { mergeTeacherAdjustments, summarizeCurrencyDay } from './currencyDaySummary.js';

const dayStart = Date.parse('2026-10-20T00:00:00+09:00');
const dayEnd = dayStart + 24 * 60 * 60 * 1000;
const entry = (studentNumber: number, before: number, after: number, reason: CurrencyHistoryEntry['reason'], createdAt: string): CurrencyHistoryEntry => ({
  id: `${studentNumber}-${createdAt}-${reason}`, studentNumber, delta: after - before, before, after, reason, createdAt,
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
  assert.deepEqual(merged.map(({ reason, delta, before, after, createdAt }) => ({ reason, delta, before, after, createdAt })), [
    { reason: 'teacher_adjust', delta: 5, before: 100, after: 105, createdAt: '2026-10-20T09:03:00+09:00' },
    { reason: 'allowance', delta: 10, before: 90, after: 100, createdAt: '2026-10-20T09:00:00+09:00' },
    { reason: 'teacher_adjust', delta: -5, before: 95, after: 90, createdAt: '2026-10-20T08:59:00+09:00' },
    { reason: 'teacher_adjust', delta: 5, before: 90, after: 95, createdAt: '2026-10-20T08:00:00+09:00' },
  ]);
});

test('+5와 −5가 상쇄된 교사 조정은 표시하지 않는다', () => {
  assert.deepEqual(mergeTeacherAdjustments([
    entry(2, 105, 100, 'teacher_deduction', '2026-10-20T09:01:00+09:00'),
    entry(2, 100, 105, 'manual', '2026-10-20T09:00:00+09:00'),
  ]), []);
});

test('오늘 기록만 학생별 순증감·사유별로 합치고 테스트 학생은 제외한다', () => {
  const summary = summarizeCurrencyDay({
    '1': [
      entry(1, 130, 118, 'shop_purchase', '2026-10-20T09:00:00+09:00'),
      entry(1, 100, 130, 'allowance', '2026-10-20T08:00:00+09:00'),
      entry(1, 1, 100, 'allowance', '2026-10-19T23:59:00+09:00'),
    ],
    '2': [entry(2, 105, 100, 'teacher_deduction', '2026-10-20T10:01:00+09:00'), entry(2, 100, 105, 'manual', '2026-10-20T10:00:00+09:00')],
    '3': [entry(3, 120, 110, 'teacher_deduction', '2026-10-20T10:01:00+09:00'), entry(3, 115, 120, 'manual', '2026-10-20T10:00:00+09:00')],
    '24': [entry(24, 0, 500, 'manual', '2026-10-20T10:00:00+09:00')],
  }, { '1': 250, '2': 40, '24': 9999 }, dayStart, dayEnd);

  assert.equal(summary.students.length, 23);
  assert.deepEqual(summary.students.slice(0, 3).map(({ studentNumber, balance, net, entries }) => ({ studentNumber, balance, net, rows: entries.length })), [
    { studentNumber: 1, balance: 250, net: 18, rows: 2 },
    { studentNumber: 2, balance: 40, net: 0, rows: 0 },
    { studentNumber: 3, balance: 100, net: -5, rows: 1 },
  ]);
  assert.equal(summary.incoming, 30);
  assert.equal(summary.outgoing, 17);
  assert.equal(summary.totalBalance, 250 + 40 + 21 * 100);
  assert.equal(summary.maxBalance, 250);
  assert.equal(summary.maxStudentNet, 18);
  assert.deepEqual(summary.incomingReasons, [{ reason: 'allowance', amount: 30 }]);
  assert.deepEqual(summary.outgoingReasons, [{ reason: 'shop_purchase', amount: 12 }, { reason: 'teacher_adjust', amount: 5 }]);
});
