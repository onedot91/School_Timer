import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyAuctionAwardToCurrencyState,
  createDefaultCurrencyBalances,
  createDefaultCurrencyHistory,
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
