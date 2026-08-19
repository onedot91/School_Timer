import { getDepositMaturityDate, getRelativeKoreanWeekdayLabel, type StudentEconomyAction } from './studentEconomy';

export type BankMailboxLetter = {
  readonly id: string;
  readonly recipient: number;
  readonly senderLabel: '은행원';
  readonly senderStudentNumber: null;
  readonly title: string;
  readonly content: string;
  readonly createdAt: string;
};

const bankerLetter = (
  id: string,
  recipient: number,
  title: string,
  content: string,
  createdAt: string,
): BankMailboxLetter => ({ id, recipient, senderLabel: '은행원', senderStudentNumber: null, title, content, createdAt });

export const createBankMailboxLetters = ({
  action,
  studentNumber,
  requestId,
  createdAt,
}: {
  readonly action: StudentEconomyAction;
  readonly studentNumber: number;
  readonly requestId: string;
  readonly createdAt: string;
}): readonly BankMailboxLetter[] => {
  const requestKey = requestId.slice(-36);
  if (action.type === 'open_deposit') {
    const maturityDate = getDepositMaturityDate(action.dateKey);
    const interest = Math.round(action.amount / 10);
    return [bankerLetter(`bank-${requestKey}-deposit`, studentNumber, '◆ 예금 접수', `${action.amount} 고마를 맡겼어요. ${getRelativeKoreanWeekdayLabel(action.dateKey, maturityDate)}에 ${action.amount + interest} 고마를 받을 수 있어요.`, createdAt)];
  }
  if (action.type === 'close_deposit') {
    return [bankerLetter(`bank-${requestKey}-deposit-close`, studentNumber, '◆ 예금 해지', '예금을 해지했어요. 중도 해지라 원금만 사용 가능한 고마에 더해졌어요.', createdAt)];
  }
  if (action.type === 'claim_deposit') {
    return [bankerLetter(`bank-${requestKey}-deposit-mature`, studentNumber, '◆ 예금 만기', '예금 만기 금액이 사용 가능한 고마에 더해졌어요.', createdAt)];
  }
  if (action.type === 'borrow') {
    const repayment = action.amount + Math.round(action.amount / 10);
    return [bankerLetter(`bank-${requestKey}-loan`, studentNumber, '△ 대출 안내', `${action.amount} 고마를 빌렸어요. 일주일 안에 ${repayment} 고마를 갚아야 해요.`, createdAt)];
  }
  if (action.type === 'repay') {
    return [bankerLetter(`bank-${requestKey}-loan-repay`, studentNumber, '△ 대출 상환', `${action.amount} 고마를 갚았어요.`, createdAt)];
  }
  if (action.type === 'transfer') {
    return [
      bankerLetter(`bank-${requestKey}-transfer-out`, studentNumber, '↗ 이체 완료', `${action.recipientNumber}번에게 ${action.amount} 고마를 보냈어요.`, createdAt),
      bankerLetter(`bank-${requestKey}-transfer-in`, action.recipientNumber, '↙ 이체 도착', `${studentNumber}번에게서 ${action.amount} 고마를 받았어요.`, createdAt),
    ];
  }
  return [];
};
