import { STUDENT_DEPOSIT_MINIMUM, STUDENT_LOAN_MAXIMUM, STUDENT_TRANSFER_MAXIMUM } from './studentEconomy';

export type StudentBankAmountKind = 'deposit' | 'loan' | 'transfer';

const BANK_AMOUNT_RULES: Readonly<Record<StudentBankAmountKind, { readonly min: number; readonly max: number | null; readonly verb: string }>> = {
  deposit: { min: STUDENT_DEPOSIT_MINIMUM, max: null, verb: '맡길' },
  loan: { min: 1, max: STUDENT_LOAN_MAXIMUM, verb: '빌릴' },
  transfer: { min: 1, max: STUDENT_TRANSFER_MAXIMUM, verb: '보낼' },
};

export type StudentBankAmountIssue = {
  readonly reason: 'format' | 'below_minimum' | 'above_maximum';
  readonly message: string;
};

/**
 * Why the bank confirm button is off, matching the bank page's own button rules.
 * Empty input is not an issue yet: the student has not tried anything.
 */
export const getStudentBankAmountIssue = (kind: StudentBankAmountKind, raw: string): StudentBankAmountIssue | null => {
  const text = raw.trim();
  if (text === '') return null;
  const amount = Number(text);
  if (!Number.isInteger(amount)) return { reason: 'format', message: '소수점 없이 숫자만 써요.' };
  const rule = BANK_AMOUNT_RULES[kind];
  if (amount < rule.min) return { reason: 'below_minimum', message: `${rule.min}고마부터 ${rule.verb} 수 있어요.` };
  if (rule.max !== null && amount > rule.max) return { reason: 'above_maximum', message: `${rule.max}고마까지 ${rule.verb} 수 있어요.` };
  return null;
};

/** Why the bid button is off for the typed amount; `null` when the amount can be bid. */
export const getAuctionBidAmountIssue = ({ draft, amount, minimumBid, maxBid }: {
  readonly draft: string;
  readonly amount: number;
  readonly minimumBid: number;
  readonly maxBid: number;
}): string | null => {
  if (maxBid < minimumBid) return `고마가 모자라요. ${minimumBid}고마가 있어야 입찰할 수 있어요.`;
  if (draft.trim() === '') return null;
  if (amount < minimumBid) return `${minimumBid}고마부터 입찰할 수 있어요.`;
  if (amount > maxBid) return `${maxBid}고마까지 입찰할 수 있어요.`;
  return null;
};
