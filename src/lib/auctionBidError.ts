import { storageAvailabilityMessage } from './storageAvailabilityCopy.js';

export const getAuctionBidErrorMessage = (error: unknown): string => {
  const availability = storageAvailabilityMessage(error);
  if (availability) return availability;
  const code = error instanceof Error ? error.message : '';
  const messages: Record<string, string> = {
    INSUFFICIENT_FUNDS: '예약금을 제외한 사용 가능 고마가 부족합니다.',
    BID_TOO_LOW: '현재 최고 입찰가보다 높게 입찰해야 합니다.',
    ALREADY_HIGHEST_BIDDER: '다른 번호가 더 높게 입찰한 뒤 다시 입찰할 수 있습니다.',
    ALREADY_AWARDED: '이미 낙찰된 물품입니다.',
    DUPLICATE_BID_AMOUNT: '이미 입찰된 금액입니다. 다른 금액으로 입찰해 주세요.',
    TEACHER_COMMAND_REQUIRED: '교사 로그인 상태에서는 학생 입찰을 처리할 수 없습니다. 학생으로 로그인한 화면에서 입찰해 주세요.',
    DEVICE_REGISTRATION_REQUIRED: '로그인 정보를 확인할 수 없습니다. 학생 로그인을 다시 확인해 주세요.',
    STUDENT_SETTINGS_SCOPE_VIOLATION: '로그인한 학생과 요청 권한이 맞지 않습니다. 학생 로그인을 확인해 주세요.',
    SAVE_DRAFT_PENDING: '이전 입찰의 저장 여부를 확인 중입니다. 이전 입찰 금액으로 다시 확인해 주세요.',
  };
  if (Object.hasOwn(messages, code)) return messages[code];
  const status = error instanceof Error ? Reflect.get(error, 'status') : undefined;
  if (status === 401 || status === 403) return '입찰 권한을 확인할 수 없습니다. 학생 로그인을 확인해 주세요.';
  return '입찰 결과를 확인하지 못했습니다. 현재 최고 입찰자와 금액을 확인한 뒤 다시 시도해 주세요.';
};
