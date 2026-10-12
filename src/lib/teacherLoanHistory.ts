import { normalizeStudentEconomyStates, type StudentEconomyStates } from './studentEconomy.js';
import { isStorageRecord } from './storageV2Codec.js';

export interface TeacherLoanStatus {
  readonly studentNumber: number;
  readonly principal: number;
  readonly repaymentAmount: number;
  readonly dueDate: string | null;
}

export interface TeacherLoanEntry {
  readonly id: string;
  readonly studentNumber: number;
  readonly type: 'borrow' | 'repay';
  readonly amount: number;
  readonly principalAfter: number;
  readonly repaymentAfter: number;
  readonly dueDate: string | null;
  readonly createdAt: string;
}

export interface TeacherLoanReport {
  readonly checkedAt: string;
  readonly source: 'server' | 'local';
  readonly students: readonly TeacherLoanStatus[];
  readonly entries: readonly TeacherLoanEntry[];
}

export class TeacherLoanHistoryError extends Error {
  constructor(readonly code = 'LOAN_HISTORY_UNAVAILABLE') { super(code); }
}

const invalid = (): never => { throw new TeacherLoanHistoryError('LOAN_HISTORY_INVALID_RESPONSE'); };
const amount = (value: unknown): number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 999_999 ? value : invalid();
const student = (value: unknown): number => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 23 ? value : invalid();
const date = (value: unknown): string | null => {
  if (value === null) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value))) return invalid();
  return new Date(value).toISOString().slice(0, 10) === value ? value : invalid();
};
const timestamp = (value: unknown): string => typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value)) ? value : invalid();

export const parseTeacherLoanReport = (value: unknown): TeacherLoanReport => {
  if (!isStorageRecord(value) || !Array.isArray(value.students) || !Array.isArray(value.entries)
    || !['server', 'local'].includes(String(value.source))) return invalid();
  const students = value.students.map((row: unknown): TeacherLoanStatus => {
    if (!isStorageRecord(row)) return invalid();
    const status = { studentNumber: student(row.studentNumber), principal: amount(row.principal), repaymentAmount: amount(row.repaymentAmount), dueDate: date(row.dueDate) };
    if (status.principal > status.repaymentAmount) return invalid();
    return status;
  });
  if (students.length !== 23 || new Set(students.map(row => row.studentNumber)).size !== 23) return invalid();
  const entries = value.entries.map((row: unknown): TeacherLoanEntry => {
    if (!isStorageRecord(row) || typeof row.id !== 'string' || !row.id || row.id.length > 240
      || (row.type !== 'borrow' && row.type !== 'repay')) return invalid();
    const entry: TeacherLoanEntry = { id: row.id, studentNumber: student(row.studentNumber), type: row.type, amount: amount(row.amount),
      principalAfter: amount(row.principalAfter), repaymentAfter: amount(row.repaymentAfter), dueDate: date(row.dueDate), createdAt: timestamp(row.createdAt) };
    if (entry.amount === 0 || entry.principalAfter > entry.repaymentAfter) return invalid();
    return entry;
  });
  if (new Set(entries.map(row => row.id)).size !== entries.length) return invalid();
  return { checkedAt: timestamp(value.checkedAt), source: value.source === 'server' ? 'server' : 'local', students,
    entries: entries.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id)) };
};

export const createLocalTeacherLoanReport = (states: StudentEconomyStates): TeacherLoanReport => {
  const normalized = normalizeStudentEconomyStates(states);
  return { checkedAt: new Date().toISOString(), source: 'local', entries: [],
    students: Array.from({ length: 23 }, (_, index) => {
      const studentNumber = index + 1, state = normalized[String(studentNumber)];
      return { studentNumber, principal: state?.loanPrincipal ?? 0, repaymentAmount: state?.loan ?? 0, dueDate: state?.loanDueDate ?? null };
    }) };
};

export const getTeacherLoanStatusLabel = (status: TeacherLoanStatus, today: string): string => status.repaymentAmount === 0
  ? '대출 없음' : status.dueDate && status.dueDate < today ? '연체' : '상환 중';
