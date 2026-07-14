import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyAuctionAwardToCurrencyState,
  createDefaultCurrencyBalances,
  createDefaultCurrencyHistory,
  finalizeAuctionAwardInSettings,
} from './currency.ts';

test('낙찰 완료 시 낙찰자의 보유 고마를 낙찰가만큼 차감한다', () => {
  // Given
  const balances = createDefaultCurrencyBalances();
  const history = createDefaultCurrencyHistory();

  // When
  const result = applyAuctionAwardToCurrencyState(balances, history, {
    itemId: 'item-a',
    winner: 7,
    amount: 30,
    awardedAt: '2026-07-14T00:00:00.000Z',
  });

  // Then
  assert.equal(result.balances['7'], 70);
  assert.deepEqual(
    result.history['7']?.map(({ studentNumber, delta, before, after, reason, createdAt }) => ({
      studentNumber,
      delta,
      before,
      after,
      reason,
      createdAt,
    })),
    [{
      studentNumber: 7,
      delta: -30,
      before: 100,
      after: 70,
      reason: 'auction_award',
      createdAt: '2026-07-14T00:00:00.000Z',
    }],
  );
});

test('같은 낙찰은 공유 설정에서 한 번만 차감한다', () => {
  const award = {
    itemId: 'item-a',
    winner: 7,
    amount: 30,
    awardedAt: '2026-07-14T00:00:00.000Z',
  };
  const initial = {
    currencyBalances: { 7: 100 },
    currencyHistory: { 7: [] },
    auctionBids: { 'item-a': { bidder: 7, amount: 30 } },
    auctionAwards: {},
  };

  const first = finalizeAuctionAwardInSettings(initial, award);
  const second = finalizeAuctionAwardInSettings(first.value, award);

  assert.equal(first.awarded, true);
  assert.equal(second.awarded, false);
  assert.equal(second.balances['7'], 70);
  assert.equal(second.history['7'].filter((entry) => entry.reason === 'auction_award').length, 1);
});

test('잔액보다 큰 낙찰과 확정 중 변경된 입찰은 거부한다', () => {
  const base = {
    currencyBalances: { 7: 20 },
    currencyHistory: { 7: [] },
    auctionBids: { 'item-a': { bidder: 7, amount: 40 } },
    auctionAwards: {},
  };

  assert.throws(() => finalizeAuctionAwardInSettings(base, {
    itemId: 'item-a', winner: 7, amount: 40, awardedAt: '2026-07-14T00:00:00.000Z',
  }), /INSUFFICIENT_CURRENCY_FOR_AUCTION_AWARD/);
  assert.throws(() => finalizeAuctionAwardInSettings({
    ...base,
    currencyBalances: { 7: 100 },
    auctionBids: { 'item-a': { bidder: 8, amount: 45 } },
  }, {
    itemId: 'item-a', winner: 7, amount: 40, awardedAt: '2026-07-14T00:00:00.000Z',
  }), /AUCTION_BID_CHANGED/);
});
