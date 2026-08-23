import { getDepositMaturityDate, getRelativeKoreanWeekdayLabel, type StudentEconomyAction } from './studentEconomy';

export type BankMailboxLetter = {
  readonly id: string;
  readonly recipient: number;
  readonly senderLabel: '은행원 돝돝';
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
): BankMailboxLetter => ({ id, recipient, senderLabel: '은행원 돝돝', senderStudentNumber: null, title, content, createdAt });

const LEGACY_BANK_LETTER_TITLES: Readonly<Record<string, string>> = {
  '예금 접수 · 고마를 맡겼어요': '예금 접수',
  '예금 해지 · 맡긴 고마를 일찍 꺼냈어요': '예금 해지',
  '예금 만기 · 고마를 찾는 날이에요': '예금 만기',
  '대출 · 고마를 빌렸어요': '대출',
  '대출 상환 · 빌린 고마를 갚았어요': '대출 상환',
  '송금 완료 · 고마를 보냈어요': '송금 완료',
  '송금 도착 · 고마가 왔어요': '송금 도착',
};

export const normalizeBankMailboxCopy = (title: string, content: string): { title: string; content: string } => ({
  title: LEGACY_BANK_LETTER_TITLES[title] ?? title,
  content: content.replaceAll('돝돝이가', '제가'),
});

const selectBankerMessage = (
  seed: string,
  messages: readonly [string, string, string],
) => {
  const index = Array.from(seed).reduce((total, character) => total + character.charCodeAt(0), 0) % 3;
  if (index === 0) return messages[0];
  if (index === 1) return messages[1];
  return messages[2];
};

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
    const maturityLabel = getRelativeKoreanWeekdayLabel(action.dateKey, maturityDate);
    const payout = action.amount + interest;
    return [bankerLetter(
      `bank-${requestKey}-deposit`,
      studentNumber,
      '예금 접수',
      selectBankerMessage(requestKey, [
        `꿀꿀, ${action.amount} 고마를 예금했어요. 예금은 고마를 은행에 맡겨 두는 거예요. ${maturityLabel}에 찾으면 이자를 더해 ${payout} 고마를 받을 수 있꿀!`,
        `${action.amount} 고마를 은행 금고에 안전하게 넣어 두었꿀. 이렇게 고마를 은행에 맡기는 것을 예금이라고 해요. ${maturityLabel}까지 기다리면 모두 ${payout} 고마가 돼요.`,
        `꿀꿀, 예금한 ${action.amount} 고마를 제가 잘 보관하고 있어요. 만기는 고마를 찾기로 약속한 날이에요. ${maturityLabel}이 되면 ${payout} 고마를 돌려드릴게요!`,
      ]),
      createdAt,
    )];
  }
  if (action.type === 'close_deposit') {
    return [bankerLetter(
      `bank-${requestKey}-deposit-close`,
      studentNumber,
      '예금 해지',
      selectBankerMessage(requestKey, [
        '꿀꿀, 예금을 해지했어요. 해지는 맡긴 고마를 약속한 날보다 먼저 꺼내는 거예요. 만기 전이라 이자 없이 처음 맡긴 고마만 돌려드렸꿀.',
        '요청한 대로 예금을 금고에서 꺼냈꿀. 이것을 예금 해지라고 해요. 약속한 날 전에 꺼내서 이자는 받지 못하고 처음 맡긴 고마만 사용할 수 있어요.',
        '꿀꿀, 예금 해지가 끝났어요. 아직 만기가 되지 않아 이자는 붙지 않았어요. 처음 맡긴 고마는 지금 쓸 수 있게 옮겨 두었꿀.',
      ]),
      createdAt,
    )];
  }
  if (action.type === 'claim_deposit') {
    return [bankerLetter(
      `bank-${requestKey}-deposit-mature`,
      studentNumber,
      '예금 만기',
      selectBankerMessage(requestKey, [
        '꿀꿀, 예금 만기가 되었어요! 만기는 맡긴 고마를 찾기로 약속한 날이에요. 처음 맡긴 고마와 이자를 모두 지금 쓸 수 있게 넣어 두었꿀.',
        '오늘은 예금의 만기일이에요. 이자는 고마를 맡기고 기다린 보답으로 더 받는 고마예요. 이자까지 빠짐없이 돌려드렸꿀!',
        '꿀꿀, 맡겨 둔 예금이 만기가 되었어요. 약속한 날까지 잘 기다려서 이자도 함께 받을 수 있꿀!',
      ]),
      createdAt,
    )];
  }
  if (action.type === 'borrow') {
    const repayment = action.amount + Math.round(action.amount / 10);
    return [bankerLetter(
      `bank-${requestKey}-loan`,
      studentNumber,
      '대출',
      selectBankerMessage(requestKey, [
        `꿀꿀, ${action.amount} 고마를 대출했어요. 대출은 은행에서 고마를 빌리는 거예요. 일주일 안에 이자를 더한 ${repayment} 고마를 갚아야 하꿀!`,
        `요청한 ${action.amount} 고마를 보내드렸꿀. 이것을 대출이라고 해요. 빌린 고마와 이자를 합쳐 ${repayment} 고마를 일주일 안에 갚아 주세요.`,
        `꿀꿀, 대출한 ${action.amount} 고마가 들어왔어요. 이자는 고마를 빌린 값으로 더 갚는 고마예요. 갚을 금액은 모두 ${repayment} 고마이니 꼭 기억해 주꿀!`,
      ]),
      createdAt,
    )];
  }
  if (action.type === 'repay') {
    return [bankerLetter(
      `bank-${requestKey}-loan-repay`,
      studentNumber,
      '대출 상환',
      selectBankerMessage(requestKey, [
        `꿀꿀, ${action.amount} 고마를 잘 받았어요. 빌린 고마를 은행에 갚는 것을 상환이라고 해요. 제가 장부에도 정확하게 적어 두었꿀!`,
        `대출 상환이 끝났꿀! 대출 상환은 은행에서 빌린 고마를 다시 갚는 일이에요. 보내 준 ${action.amount} 고마를 모두 확인했어요.`,
        `꿀꿀, 빌렸던 ${action.amount} 고마를 잘 갚았어요. 이것을 대출 상환이라고 해요. 약속을 지켜 줘서 고맙꿀!`,
      ]),
      createdAt,
    )];
  }
  if (action.type === 'transfer') {
    return [
      bankerLetter(
        `bank-${requestKey}-transfer-out`,
        studentNumber,
        '송금 완료',
        selectBankerMessage(requestKey, [
          `${action.recipientNumber}번에게 ${action.amount} 고마를 송금했어요. 송금은 다른 사람에게 고마를 보내는 일이에요. 제가 잘 도착하도록 안전하게 보냈꿀!`,
          `꿀꿀, 송금이 끝났어요! ${action.recipientNumber}번에게 ${action.amount} 고마를 보냈어요. 받는 학생과 금액을 두 번 확인했꿀.`,
          `${action.amount} 고마를 ${action.recipientNumber}번에게 보냈꿀. 이렇게 친구에게 고마를 보내는 것을 송금이라고 해요.`,
        ]),
        createdAt,
      ),
      bankerLetter(
        `bank-${requestKey}-transfer-in`,
        action.recipientNumber,
        '송금 도착',
        selectBankerMessage(requestKey, [
          `꿀꿀, ${studentNumber}번이 송금한 ${action.amount} 고마가 도착했어요. 이제 이 고마를 사용할 수 있꿀!`,
          `${studentNumber}번에게서 ${action.amount} 고마를 받았꿀. 다른 사람이 보낸 고마가 도착하는 것도 송금이에요. 제가 안전하게 넣어 두었어요.`,
          `꿀꿀, 반가운 송금이 도착했어요! ${studentNumber}번이 보낸 ${action.amount} 고마를 지금부터 사용할 수 있꿀.`,
        ]),
        createdAt,
      ),
    ];
  }
  return [];
};
