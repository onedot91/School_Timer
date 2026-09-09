import assert from 'node:assert/strict';
import test from 'node:test';
import { getAuctionBidErrorMessage } from './auctionBidError.js';
test('입찰 권한 거절과 미확인 저장을 구분하고 원문 오류를 노출하지 않는다', () => {
  assert.match(getAuctionBidErrorMessage(new Error('TEACHER_COMMAND_REQUIRED')), /교사 로그인/);
  assert.match(getAuctionBidErrorMessage(Object.assign(new Error('private'), { status: 403 })), /입찰 권한/);
  assert.match(getAuctionBidErrorMessage(new Error('SAVE_DRAFT_PENDING')), /이전 입찰/);
  assert.match(getAuctionBidErrorMessage(new Error('BID_TOO_LOW')), /최고 입찰가보다/);
  const unknown = getAuctionBidErrorMessage(new Error('private payload'));
  assert.doesNotMatch(unknown, /private|완료되었습니다/);
  assert.match(unknown, /최고 입찰자와 금액/);
});
