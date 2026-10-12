import { normalizeStudentEconomyState } from '../lib/studentEconomy.js';
import { parseTeacherLoanReport, TeacherLoanHistoryError, type TeacherLoanEntry, type TeacherLoanReport, type TeacherLoanStatus } from '../lib/teacherLoanHistory.js';
import { isStorageRecord } from '../lib/storageV2Codec.js';
import type { StorageConfiguration } from './storageV2Repository.js';

const invalid = (): never => { throw new TeacherLoanHistoryError('LOAN_HISTORY_INVALID_RESPONSE'); };
const parseRows = (value: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(value) || !value.every(isStorageRecord)) return invalid();
  return value;
};

export const parseLoanReceipt = (row: Record<string, unknown>): TeacherLoanEntry => {
  const actor = typeof row.actor_key === 'string' ? /^(?:student:(\d+)|teacher:0):economy:(\d+)$/.exec(row.actor_key) : null;
  if (row.applied !== true || !actor || (actor[1] !== undefined && actor[1] !== actor[2]) || typeof row.request_id !== 'string'
    || !/^[a-zA-Z0-9-]{8,160}$/.test(row.request_id)) return invalid();
  const studentNumber = Number(actor[2]);
  const loan = row.loan, principal = row.principal;
  if (typeof loan !== 'number' || typeof principal !== 'number') return invalid();
  const explicit = row.loan_transaction;
  let type: 'borrow' | 'repay', amount: number;
  if (isStorageRecord(explicit)) {
    if ((explicit.type !== 'borrow' && explicit.type !== 'repay') || typeof explicit.amount !== 'number') return invalid();
    type = explicit.type; amount = explicit.amount;
  } else {
    const message = typeof row.message === 'string' ? /^(\d+)\s+고마를 (빌렸습니다|갚았습니다)\./.exec(row.message) : null;
    if (!message) return invalid();
    type = message[2] === '빌렸습니다' ? 'borrow' : 'repay'; amount = Number(message[1]);
  }
  if (type === 'borrow' && (principal !== amount || loan < amount)) return invalid();
  return { id: `${row.actor_key}:${row.request_id}`, studentNumber, type, amount,
    principalAfter: principal, repaymentAfter: loan, dueDate: row.due_date === null ? null : typeof row.due_date === 'string' ? row.due_date : invalid(),
    createdAt: typeof row.committed_at === 'string' ? row.committed_at : invalid() };
};

export const loadTeacherLoanReport = async (configuration: StorageConfiguration): Promise<TeacherLoanReport> => {
  const checkedAt = new Date().toISOString(), signal = AbortSignal.timeout(8000);
  const read = async (table: string, parameters: Record<string, string>) => {
    const response = await fetch(`${configuration.url.replace(/\/$/, '')}/rest/v1/${table}?${new URLSearchParams(parameters)}`, {
      method: 'GET', headers: { apikey: configuration.key, Authorization: `Bearer ${configuration.key}` }, signal,
    });
    if (!response.ok) throw new TeacherLoanHistoryError();
    return parseRows(await response.json());
  };
  const loadReceipts = async () => {
    const entries: TeacherLoanEntry[] = [], pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      const rows = await read('storage_receipts', {
        action: 'eq.student-economy', 'result->>applied': 'eq.true', committed_at: `lte.${checkedAt}`,
        or: '(result->loanTransaction.not.is.null,result->>message.like.*고마를 빌렸습니다.*,result->>message.like.*고마를 갚았습니다.*)',
        select: 'actor_key,request_id,committed_at,applied:result->applied,message:result->>message,loan_transaction:result->loanTransaction,loan:result->studentEconomy->loan,principal:result->studentEconomy->loanPrincipal,due_date:result->studentEconomy->>loanDueDate',
        order: 'committed_at.desc,actor_key.asc,request_id.asc', limit: String(pageSize), offset: String(offset),
      });
      for (const row of rows) {
        if (typeof row.actor_key === 'string' && row.actor_key.endsWith(':economy:24')) continue;
        entries.push(parseLoanReceipt(row));
      }
      if (rows.length < pageSize) return entries;
    }
  };
  const [rows, entries] = await Promise.all([
    read('storage_resources', { category: 'eq.studentEconomy', owner_number: 'gte.1', and: '(owner_number.lte.23)', deleted: 'eq.false',
      select: 'owner_number,loan:value->data->loan,principal:value->data->loanPrincipal,due_date:value->data->>loanDueDate', limit: '23' }),
    loadReceipts(),
  ]);
  const states = new Map<number, TeacherLoanStatus>();
  for (const row of rows) {
    if (typeof row.owner_number !== 'number' || !Number.isInteger(row.owner_number) || row.owner_number < 1 || row.owner_number > 23
      || states.has(row.owner_number) || typeof row.loan !== 'number' || typeof row.principal !== 'number') return invalid();
    const state = normalizeStudentEconomyState({ loan: row.loan, loanPrincipal: row.principal, loanDueDate: row.due_date });
    if (state.loan !== row.loan || state.loanPrincipal !== row.principal || state.loanDueDate !== row.due_date) return invalid();
    states.set(row.owner_number, { studentNumber: row.owner_number, principal: state.loanPrincipal, repaymentAmount: state.loan, dueDate: state.loanDueDate });
  }
  return parseTeacherLoanReport({ checkedAt, source: 'server', entries,
    students: Array.from({ length: 23 }, (_, index) => states.get(index + 1) ?? { studentNumber: index + 1, principal: 0, repaymentAmount: 0, dueDate: null }) });
};
