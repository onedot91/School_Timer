import {
  CURRENCY_STUDENT_NUMBERS,
  DEFAULT_CURRENCY_BALANCE,
  type CurrencyBalances,
  type CurrencyHistory,
  type CurrencyHistoryEntry,
  type CurrencyHistoryReason,
} from './currency.js';
import { getStudentInvestmentBalance, type StudentEconomyStates } from './studentEconomy.js';

// 교사가 ±버튼·직접 입력·차감으로 바꾼 기록은 한 묶음으로 보여 준다.
export const TEACHER_ADJUST_REASON = 'teacher_adjust';
// 예금·대출·주식 원금 이동은 보유 고마 변화가 아니다. 이자·손익과 학생 사이 송금만 입출금으로 본다.
export const BANK_INTEREST_REASON = 'bank_interest';
export const INVESTMENT_RETURN_REASON = 'investment_return';
export const STUDENT_TRANSFER_REASON = 'student_transfer';
export type CurrencyDayReason =
  | Exclude<CurrencyHistoryReason, 'manual' | 'bulk_adjust' | 'teacher_deduction' | 'bank_transfer'>
  | typeof TEACHER_ADJUST_REASON
  | typeof BANK_INTEREST_REASON
  | typeof INVESTMENT_RETURN_REASON
  | typeof STUDENT_TRANSFER_REASON;

const TEACHER_ADJUST_SOURCES: readonly CurrencyHistoryReason[] = ['manual', 'bulk_adjust', 'teacher_deduction'];
const TEACHER_ADJUST_MERGE_GAP_MS = 10 * 60 * 1000;

// 송금은 보낸 학생과 받은 학생 기록이 같은 요청 id(`currency-economy-<요청>-<학생>`)를 나눠 갖는다.
const ECONOMY_ENTRY_ID = /^currency-economy-(.+)-\d+$/;
const getEconomyRequestId = (entry: CurrencyHistoryEntry) => ECONOMY_ENTRY_ID.exec(entry.id)?.[1] ?? null;

export const findStudentTransferRequestIds = (history: CurrencyHistory): ReadonlySet<string> => {
  const owners = new Map<string, Set<string>>();
  for (const [key, entries] of Object.entries(history)) {
    for (const entry of entries) {
      if (entry.reason !== 'bank_transfer' || entry.ownAccountAmount !== undefined) continue;
      const requestId = getEconomyRequestId(entry);
      if (requestId) owners.set(requestId, (owners.get(requestId) ?? new Set()).add(key));
    }
  }
  return new Set([...owners].filter(([, keys]) => keys.size > 1).map(([requestId]) => requestId));
};

const isStudentTransfer = (entry: CurrencyHistoryEntry, transferRequestIds: ReadonlySet<string>) => {
  const requestId = entry.reason === 'bank_transfer' && entry.ownAccountAmount === undefined ? getEconomyRequestId(entry) : null;
  return requestId !== null && transferRequestIds.has(requestId);
};

// 원금 이동액을 남기기 전의 은행·주식 기록은 원금과 이자·손익을 나눌 수 없어 모두 원금 이동으로 본다.
const isLegacyOwnAccountMove = (entry: CurrencyHistoryEntry, transferRequestIds: ReadonlySet<string>) =>
  entry.ownAccountAmount === undefined
  && (entry.reason === 'stock_trade' || (entry.reason === 'bank_transfer' && !isStudentTransfer(entry, transferRequestIds)));

const toDayReason = (entry: CurrencyHistoryEntry): CurrencyDayReason => {
  const { reason } = entry;
  if (reason === 'manual' || reason === 'bulk_adjust' || reason === 'teacher_deduction') return TEACHER_ADJUST_REASON;
  if (reason === 'bank_transfer') return entry.ownAccountAmount === undefined ? STUDENT_TRANSFER_REASON : BANK_INTEREST_REASON;
  if (reason === 'stock_trade') return INVESTMENT_RETURN_REASON;
  return reason;
};

/** 보유 고마(지갑+예금+투자−대출 원금)의 실제 증감. */
export const getHoldingDelta = (entry: CurrencyHistoryEntry) => entry.delta - (entry.ownAccountAmount ?? 0);

export interface CurrencyDayEntry {
  readonly id: string;
  readonly reason: CurrencyDayReason;
  readonly delta: number;
  readonly createdAt: string;
}

export interface CurrencyDayStudent {
  readonly studentNumber: number;
  /** 지갑+예금+적금+투자 평가액−대출 원금 */
  readonly balance: number;
  readonly wallet: number;
  readonly savedAmount: number;
  readonly loanPrincipal: number;
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

// 최신순 기록에서 원금 이동만 있는 기록은 빼고, 10분 이내로 이어진 교사 조정은 한 줄로 합친다.
export const mergeTeacherAdjustments = (
  entries: readonly CurrencyHistoryEntry[],
  transferRequestIds: ReadonlySet<string> = new Set(),
): CurrencyDayEntry[] => {
  const merged: CurrencyDayEntry[] = [];
  let oldestInRun = Number.NaN;
  for (const entry of entries) {
    if (isLegacyOwnAccountMove(entry, transferRequestIds)) continue;
    const delta = getHoldingDelta(entry);
    if (delta === 0 && entry.ownAccountAmount !== undefined && !TEACHER_ADJUST_SOURCES.includes(entry.reason)) continue;
    const createdAt = Date.parse(entry.createdAt);
    const previous = merged[merged.length - 1];
    if (
      previous?.reason === TEACHER_ADJUST_REASON
      && TEACHER_ADJUST_SOURCES.includes(entry.reason)
      && oldestInRun - createdAt <= TEACHER_ADJUST_MERGE_GAP_MS
    ) {
      merged[merged.length - 1] = { ...previous, delta: previous.delta + delta };
      oldestInRun = createdAt;
      continue;
    }
    merged.push({ id: entry.id, reason: toDayReason(entry), delta, createdAt: entry.createdAt });
    oldestInRun = createdAt;
  }
  return merged.filter((entry) => entry.delta !== 0 || entry.reason !== TEACHER_ADJUST_REASON);
};

const sortReasonTotals = (totals: Map<CurrencyDayReason, number>) =>
  [...totals.entries()]
    .map(([reason, amount]) => ({ reason, amount }))
    .sort((left, right) => right.amount - left.amount);

// [dayStart, dayEnd) 구간의 학생별·사유별 입출금과 현재 보유 고마(지갑+예금+투자−대출 원금)를 묶는다. 테스트 학생은 제외한다.
export const summarizeCurrencyDay = (
  history: CurrencyHistory,
  balances: CurrencyBalances,
  economyStates: StudentEconomyStates,
  dayStart: number,
  dayEnd: number,
): CurrencyDaySummary => {
  const incomingTotals = new Map<CurrencyDayReason, number>();
  const outgoingTotals = new Map<CurrencyDayReason, number>();
  let incoming = 0;
  let outgoing = 0;
  const transferRequestIds = findStudentTransferRequestIds(history);
  const students = CURRENCY_STUDENT_NUMBERS.map((studentNumber): CurrencyDayStudent => {
    const key = String(studentNumber);
    const entries = mergeTeacherAdjustments((history[key] ?? []).filter((entry) => {
      const createdAt = Date.parse(entry.createdAt);
      return Number.isFinite(createdAt) && createdAt >= dayStart && createdAt < dayEnd;
    }), transferRequestIds);
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
    const wallet = balances[key] ?? DEFAULT_CURRENCY_BALANCE;
    const economy = economyStates[key];
    const savedAmount = (economy?.deposit ?? 0) + (economy?.savings ?? 0) + getStudentInvestmentBalance(economy);
    const loanPrincipal = economy?.loanPrincipal ?? 0;
    return { studentNumber, balance: wallet + savedAmount - loanPrincipal, wallet, savedAmount, loanPrincipal, entries, net };
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
