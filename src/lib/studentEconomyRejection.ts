import type { StudentEconomyAction } from './studentEconomy';
import type { StudentProfilePurchaseReason } from './studentProfilePurchase';

/** These flows keep their own dialog open, so their messages stay in the status dialog on top of it. */
const DIALOG_OWNED_ACTION_TYPES: ReadonlySet<StudentEconomyAction['type']> = new Set([
  'draw_character',
  'choose_draw_character',
  'claim_halloween_character',
  'buy_house',
]);

/**
 * Normal business rejections: the request was answered and nothing was saved or lost.
 * Unconfirmed drafts, storage problems and unknown errors are not listed here and stay in the status dialog.
 */
const STUDENT_ECONOMY_REJECTION_MESSAGES: Readonly<Record<string, string>> = {
  HOUSE_CREATOR_BALANCE_LIMIT: '제작자의 고마 보유 한도로 구매할 수 없습니다. 선생님께 알려 주세요.',
  INSUFFICIENT_AVAILABLE_CURRENCY: '사용 가능한 고마가 부족합니다.',
  CHARACTER_CHOICE_PENDING: '진행 중인 초성 선택을 먼저 완료해 주세요.',
  HALLOWEEN_EVENT_CLAIMED: '할로윈 스킨은 이미 받았습니다.',
  HALLOWEEN_EVENT_NOT_OPEN: '아직 받을 수 없습니다.',
  INVALID_BANK_AMOUNT: '예금은 10고마부터 맡길 수 있습니다.',
  INSUFFICIENT_BANK_BALANCE: '예금 잔액이 부족합니다.',
  EXCESSIVE_LOAN_REPAYMENT: '대출 잔액보다 많이 갚을 수 없습니다.',
  DEPOSIT_NOT_AVAILABLE_TODAY: '예금은 월요일부터 금요일까지만 들 수 있습니다.',
  DEPOSIT_NOT_MATURED: '아직 만기 전입니다. 예금을 깨면 원금만 받을 수 있습니다.',
  LOAN_LIMIT_EXCEEDED: '대출은 한 번에 50고마까지 받을 수 있고, 기존 대출을 먼저 갚아야 합니다.',
  TRANSFER_DAILY_LIMIT_REACHED: '이체는 하루에 한 번, 한 명에게만 보낼 수 있습니다.',
  TRANSFER_AMOUNT_LIMIT_EXCEEDED: '한 번에 30고마까지만 보낼 수 있습니다.',
  STOCK_MARKET_CLOSED: '오늘은 휴장입니다.',
  INVESTMENT_LIMIT_EXCEEDED: '최대 투자 금액을 넘을 수 없습니다.',
  INVALID_INVESTMENT_AMOUNT: '투자할 고마를 다시 확인해 주세요.',
  INVESTMENT_NOT_FOUND: '찾을 투자금이 없습니다.',
  HOUSE_ALREADY_REPAIRED: '이미 집을 고쳤습니다.',
  HOUSE_SHOP_LOCKED: '집을 먼저 고쳐야 합니다.',
  ALL_CHARACTERS_OWNED: '모든 캐릭터를 모았습니다.',
  CUSTOM_HOUSE_COUPON_REQUIRED: '집 만들기 쿠폰이 필요합니다.',
};

export const getStudentEconomyRejectionMessage = (code: string, actionType: StudentEconomyAction['type']): string | null => {
  if (code === 'INVALID_CHARACTER_CHOICE') {
    return actionType === 'claim_halloween_character' ? '다른 스킨을 골라 주세요.' : '초성 선택지를 새로 확인한 뒤 선택해 주세요.';
  }
  return Object.hasOwn(STUDENT_ECONOMY_REJECTION_MESSAGES, code) ? STUDENT_ECONOMY_REJECTION_MESSAGES[code] : null;
};

export const shouldToastStudentEconomyResult = (actionType: StudentEconomyAction['type']): boolean => (
  !DIALOG_OWNED_ACTION_TYPES.has(actionType)
);

const STUDENT_PROFILE_REJECTION_REASONS: ReadonlySet<StudentProfilePurchaseReason> = new Set([
  'already_selected',
  'profile_in_use',
  'first_profile_must_be_random',
  'no_profile_available',
  'insufficient_currency',
]);

/** `invalid_profile` and a missing reason are not normal rejections; they stay in the status dialog. */
export const isStudentProfileRejection = (reason: StudentProfilePurchaseReason | undefined): boolean => (
  reason !== undefined && STUDENT_PROFILE_REJECTION_REASONS.has(reason)
);
