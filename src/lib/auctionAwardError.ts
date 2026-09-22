import { collectSaveFailureDiagnostics } from './saveFailureDiagnostics.js';
import { storageAvailabilityMessage } from './storageAvailabilityCopy.js';

export const getAuctionAwardErrorMessage = (error: unknown): string => {
  const availability = storageAvailabilityMessage(error);
  if (availability) return availability;
  const details = collectSaveFailureDiagnostics(error);
  const code = error instanceof Error ? Reflect.get(error, 'serverCode') ?? Reflect.get(error, 'code') ?? error.message : undefined;
  if (code === 'AUCTION_ALREADY_AWARDED') return '이미 낙찰된 상품입니다. 창을 닫고 경매 결과를 확인해 주세요.';
  if (code === 'AUCTION_BID_CHANGED') return '최고 입찰이 바뀌었습니다. 창을 닫고 최신 입찰을 확인한 뒤 낙찰해 주세요.';
  if (code === 'INSUFFICIENT_CURRENCY_FOR_AUCTION_AWARD') return '낙찰자의 보유 고마가 낙찰가보다 부족합니다. 창을 닫고 잔액을 확인해 주세요.';
  if (details?.httpStatus === 401 || details?.httpStatus === 403) return '낙찰 권한을 확인할 수 없습니다. 교사 로그인 상태를 확인해 주세요.';
  const diagnostic = [details?.causeCode ?? details?.errorCode, ...(details?.httpStatus ? [`HTTP ${details.httpStatus}`] : [])].filter(Boolean).join(' · ');
  return `저장 결과를 확인하지 못했어요${diagnostic ? ` (${diagnostic})` : ''}. 창을 닫고 낙찰 내역과 잔액을 확인해 주세요.`;
};
