import type { StudentEconomyAction } from './studentEconomy.js';

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
  '예금 접수 · 고마를 맡겼어요': '은행 중요 알림이 왔꿀!',
  '예금 해지 · 맡긴 고마를 일찍 꺼냈어요': '은행 중요 알림이 왔꿀!',
  '예금 만기 · 고마를 찾는 날이에요': '은행 중요 알림이 왔꿀!',
  '대출 · 고마를 빌렸어요': '은행 중요 알림이 왔꿀!',
  '대출 상환 · 빌린 고마를 갚았어요': '은행 중요 알림이 왔꿀!',
  '송금 완료 · 고마를 보냈어요': '은행 중요 알림이 왔꿀!',
  '송금 도착 · 고마가 왔어요': '고마가 도착했꿀!',
  '예금 접수': '은행 중요 알림이 왔꿀!',
  '예금 해지': '은행 중요 알림이 왔꿀!',
  '예금 만기': '은행 중요 알림이 왔꿀!',
  '대출': '은행 중요 알림이 왔꿀!',
  '대출 상환': '은행 중요 알림이 왔꿀!',
  '송금 완료': '은행 중요 알림이 왔꿀!',
  '송금 도착': '고마가 도착했꿀!',
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
  if (action.type === 'claim_deposit') {
    return [bankerLetter(
      `bank-${requestKey}-deposit-mature`,
      studentNumber,
      '은행 중요 알림이 왔꿀!',
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
      '은행 중요 알림이 왔꿀!',
      selectBankerMessage(requestKey, [
        `꿀꿀, ${action.amount} 고마를 대출했어요. 대출은 은행에서 고마를 빌리는 거예요. 일주일 안에 이자를 더한 ${repayment} 고마를 갚아야 하꿀!`,
        `요청한 ${action.amount} 고마를 보내드렸꿀. 이것을 대출이라고 해요. 빌린 고마와 이자를 합쳐 ${repayment} 고마를 일주일 안에 갚아 주세요.`,
        `꿀꿀, 대출한 ${action.amount} 고마가 들어왔어요. 이자는 고마를 빌린 값으로 더 갚는 고마예요. 갚을 금액은 모두 ${repayment} 고마이니 꼭 기억해 주꿀!`,
      ]),
      createdAt,
    )];
  }
  if (action.type === 'transfer') {
    return [
      bankerLetter(
        `bank-${requestKey}-transfer-in`,
        action.recipientNumber,
        '고마가 도착했꿀!',
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
