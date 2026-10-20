import {
  CURRENCY_STUDENT_NUMBERS,
  DEFAULT_CURRENCY_BALANCE,
  type CurrencyBalances,
  type CurrencyHistory,
  type CurrencyHistoryEntry,
  type CurrencyHistoryReason,
} from './currency.js';

// 교사가 ±버튼·직접 입력·차감으로 바꾼 기록은 한 묶음으로 보여 준다.
export const TEACHER_ADJUST_REASON = 'teacher_adjust';
export type CurrencyDayReason = Exclude<CurrencyHistoryReason, 'manual' | 'bulk_adjust' | 'teacher_deduction'> | typeof TEACHER_ADJUST_REASON;

const TEACHER_ADJUST_SOURCES: readonly CurrencyHistoryReason[] = ['manual', 'bulk_adjust', 'teacher_deduction'];
const TEACHER_ADJUST_MERGE_GAP_MS = 10 * 60 * 1000;

const toDayReason = (reason: CurrencyHistoryReason): CurrencyDayReason => (
  reason === 'manual' || reason === 'bulk_adjust' || reason === 'teacher_deduction' ? TEACHER_ADJUST_REASON : reason
);

export interface CurrencyDayEntry {
  readonly id: string;
  readonly reason: CurrencyDayReason;
  readonly delta: number;
  readonly before: number;
  readonly after: number;
  readonly createdAt: string;
}

export interface CurrencyDayStudent {
  readonly studentNumber: number;
  readonly balance: number;
  readonly entries: readonly CurrencyDayEntry[];
  readonly net: number;
}

export interface CurrencyDayReasonTotal {
  readonly reason: CurrencyDayReason;
  readonly amount: number;
}

export interface CurrencyDaySummary {
  readonly students: readonly CurrencyDayStudent[];
  readonly entryCount: number;
  readonly incoming: number;
  readonly outgoing: number;
  readonly totalBalance: number;
  readonly maxBalance: number;
  readonly maxStudentNet: number;
  readonly incomingReasons: readonly CurrencyDayReasonTotal[];
  readonly outgoingReasons: readonly CurrencyDayReasonTotal[];
}

// 최신순 기록에서 시간 간격이 10분 이내로 이어진 교사 조정을 한 줄로 합친다.
export const mergeTeacherAdjustments = (entries: readonly CurrencyHistoryEntry[]): CurrencyDayEntry[] => {
  const merged: CurrencyDayEntry[] = [];
  let oldestInRun = Number.NaN;
  for (const entry of entries) {
    const createdAt = Date.parse(entry.createdAt);
    const previous = merged[merged.length - 1];
    if (
      previous?.reason === TEACHER_ADJUST_REASON
      && TEACHER_ADJUST_SOURCES.includes(entry.reason)
      && oldestInRun - createdAt <= TEACHER_ADJUST_MERGE_GAP_MS
    ) {
      merged[merged.length - 1] = { ...previous, delta: previous.delta + entry.delta, before: entry.before };
      oldestInRun = createdAt;
      continue;
    }
    merged.push({ id: entry.id, reason: toDayReason(entry.reason), delta: entry.delta, before: entry.before, after: entry.after, createdAt: entry.createdAt });
    oldestInRun = createdAt;
  }
  return merged.filter((entry) => entry.delta !== 0 || entry.reason !== TEACHER_ADJUST_REASON);
};

const sortReasonTotals = (totals: Map<CurrencyDayReason, number>) =>
  [...totals.entries()]
    .map(([reason, amount]) => ({ reason, amount }))
    .sort((left, right) => right.amount - left.amount);

// [dayStart, dayEnd) 구간의 학생별·사유별 입출금과 현재 지갑 보유 고마를 묶는다. 테스트 학생은 제외한다.
export const summarizeCurrencyDay = (
  history: CurrencyHistory,
  balances: CurrencyBalances,
  dayStart: number,
  dayEnd: number,
): CurrencyDaySummary => {
  const incomingTotals = new Map<CurrencyDayReason, number>();
  const outgoingTotals = new Map<CurrencyDayReason, number>();
  let incoming = 0;
  let outgoing = 0;
  const students = CURRENCY_STUDENT_NUMBERS.map((studentNumber): CurrencyDayStudent => {
    const key = String(studentNumber);
    const entries = mergeTeacherAdjustments((history[key] ?? []).filter((entry) => {
      const createdAt = Date.parse(entry.createdAt);
      return Number.isFinite(createdAt) && createdAt >= dayStart && createdAt < dayEnd;
    }));
    for (const entry of entries) {
      if (entry.delta > 0) {
        incoming += entry.delta;
        incomingTotals.set(entry.reason, (incomingTotals.get(entry.reason) ?? 0) + entry.delta);
      } else if (entry.delta < 0) {
        outgoing -= entry.delta;
        outgoingTotals.set(entry.reason, (outgoingTotals.get(entry.reason) ?? 0) - entry.delta);
      }
    }
    const net = entries.reduce((total, entry) => total + entry.delta, 0);
    return { studentNumber, balance: balances[key] ?? DEFAULT_CURRENCY_BALANCE, entries, net };
  });
  return {
    students,
    entryCount: students.reduce((total, student) => total + student.entries.length, 0),
    incoming,
    outgoing,
    totalBalance: students.reduce((total, student) => total + student.balance, 0),
    maxBalance: students.reduce((max, student) => Math.max(max, student.balance), 0),
    maxStudentNet: students.reduce((max, student) => Math.max(max, Math.abs(student.net)), 0),
    incomingReasons: sortReasonTotals(incomingTotals),
    outgoingReasons: sortReasonTotals(outgoingTotals),
  };
};
