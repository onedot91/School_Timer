import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyStudentEconomyAction,
  getDailyStockQuotes,
} from './studentEconomy.ts';

test('예약 고마를 제외한 금액만 은행에 맡길 수 있다', () => {
  assert.throws(() => applyStudentEconomyAction({
    state: null,
    action: { type: 'deposit', amount: 15 },
    wallet: 20,
    availableWallet: 10,
    requestId: 'deposit-1',
  }), /INSUFFICIENT_AVAILABLE_CURRENCY/);
});

test('정가 물품 구매는 잔액을 차감하고 보유 수량을 늘린다', () => {
  const result = applyStudentEconomyAction({
    state: null,
    action: { type: 'buy_item', itemId: 'pencil' },
    wallet: 30,
    availableWallet: 30,
    requestId: 'shop-1',
  });
  assert.equal(result.wallet, 20);
  assert.equal(result.state.inventory.pencil, 1);
});

test('집 고치기는 학생별로 한 번만 구매할 수 있다', () => {
  const repaired = applyStudentEconomyAction({
    state: null,
    action: { type: 'buy_item', itemId: 'house_repair' },
    wallet: 145,
    availableWallet: 145,
    requestId: 'house-repair-1',
  });
  assert.equal(repaired.wallet, 45);
  assert.equal(repaired.state.inventory.house_repair, 1);
  assert.throws(() => applyStudentEconomyAction({
    state: repaired.state,
    action: { type: 'buy_item', itemId: 'house_repair' },
    wallet: repaired.wallet,
    availableWallet: repaired.wallet,
    requestId: 'house-repair-2',
  }), /HOUSE_ALREADY_REPAIRED/);
});

test('주가는 날짜별로 결정되고 매수와 매도가 보유 수량을 보존한다', () => {
  const quote = getDailyStockQuotes('2026-08-11')[0];
  const bought = applyStudentEconomyAction({
    state: null,
    action: { type: 'buy_stock', stockId: quote.id, dateKey: '2026-08-11' },
    wallet: 100,
    availableWallet: 100,
    requestId: 'stock-buy-1',
  });
  const sold = applyStudentEconomyAction({
    state: bought.state,
    action: { type: 'sell_stock', stockId: quote.id, dateKey: '2026-08-11' },
    wallet: bought.wallet,
    availableWallet: bought.wallet,
    requestId: 'stock-sell-1',
  });
  assert.equal(sold.wallet, 100);
  assert.equal(sold.state.holdings[quote.id], 0);
});

test('같은 요청 식별자는 두 번 반영하지 않는다', () => {
  const first = applyStudentEconomyAction({
    state: null,
    action: { type: 'borrow', amount: 10 },
    wallet: 20,
    availableWallet: 20,
    requestId: 'loan-1',
  });
  const second = applyStudentEconomyAction({
    state: first.state,
    action: { type: 'borrow', amount: 10 },
    wallet: first.wallet,
    availableWallet: first.wallet,
    requestId: 'loan-1',
  });
  assert.equal(second.wallet, 30);
  assert.equal(second.state.loan, 10);
  assert.equal(second.applied, false);
});
