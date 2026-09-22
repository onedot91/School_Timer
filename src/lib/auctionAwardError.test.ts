import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { AuctionAwardError } from './currency.js';
import { getAuctionAwardErrorMessage } from './auctionAwardError.js';
import { classifySaveFailure } from './saveFailure.js';
import { StorageCommandError } from './storageCommandClient.js';

test('낙찰 업무 거절은 원인을 안내하고 저장 실패 알림으로 신고하지 않는다', () => {
  const cases = [
    ['INSUFFICIENT_CURRENCY_FOR_AUCTION_AWARD', /보유 고마.*부족/],
    ['AUCTION_ALREADY_AWARDED', /이미 낙찰/],
    ['AUCTION_BID_CHANGED', /최고 입찰이 바뀌/],
  ] as const;
  for (const [code, message] of cases) {
    for (const error of [new AuctionAwardError(code), new StorageCommandError(code, 409)]) {
      assert.match(getAuctionAwardErrorMessage(error), message);
      assert.doesNotMatch(getAuctionAwardErrorMessage(error), /저장 결과를 확인하지/);
      assert.equal(classifySaveFailure(error), null);
    }
  }
  const page = readFileSync(new URL('../pages/TimerPage.tsx', import.meta.url), 'utf8');
  assert.match(page, /error: getAuctionAwardErrorMessage\(error\)/);
});

test('실제 낙찰 저장 미확정은 안전한 진단 코드만 표시하고 반영 여부 확인을 안내한다', () => {
  const error = new StorageCommandError('STORAGE_CONFIRMATION_REQUIRED', 502, true);
  assert.match(getAuctionAwardErrorMessage(error), /STORAGE_CONFIRMATION_REQUIRED · HTTP 502/);
  assert.match(getAuctionAwardErrorMessage(error), /낙찰 내역과 잔액/);
  assert.notEqual(classifySaveFailure(error), null);
  assert.doesNotMatch(getAuctionAwardErrorMessage(new Error('private student data')), /private|student data/);
  assert.match(getAuctionAwardErrorMessage(new StorageCommandError('DEVICE_REGISTRATION_REQUIRED', 401)), /교사 로그인/);
});
