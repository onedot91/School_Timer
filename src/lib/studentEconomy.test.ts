import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyStudentEconomyAction,
  getDailyStockQuotes,
  normalizeStudentStockMarket,
  normalizeStudentShopCatalog,
  STUDENT_STOCKS,
  upsertStudentStockMarketEntry,
} from './studentEconomy.ts';

test('학생 증권은 4개 종목과 날짜별 등락 이유를 유지한다', () => {
  assert.equal(STUDENT_STOCKS.length, 4);
  const market = upsertStudentStockMarketEntry({}, 'sunny', {
    dateKey: '2026-08-12', changeAmount: 3, comment: '새 문구류가 인기를 얻었어요.',
  });
  const updated = upsertStudentStockMarketEntry(market, 'sunny', {
    dateKey: '2026-08-13', changeAmount: -2, comment: '재료비가 올랐어요.',
  });
  const quote = getDailyStockQuotes('2026-08-13', updated).find((stock) => stock.id === 'sunny');
  assert.equal(quote?.changeAmount, -2);
  assert.equal(quote?.comment, '재료비가 올랐어요.');
  assert.deepEqual(quote?.history.map((entry) => entry.dateKey), ['2026-08-13', '2026-08-12']);
  assert.equal(quote?.price, 15);
});

test('같은 날짜의 증권 코멘트는 최신 내용으로 교체된다', () => {
  const market = upsertStudentStockMarketEntry({}, 'sprout', {
    dateKey: '2026-08-13', changeAmount: 1, comment: '첫 소식',
  });
  const updated = upsertStudentStockMarketEntry(market, 'sprout', {
    dateKey: '2026-08-13', changeAmount: 4, comment: '수정된 소식',
  });
  assert.deepEqual(normalizeStudentStockMarket(updated).sprout, [{
    dateKey: '2026-08-13', changeAmount: 4, comment: '수정된 소식',
  }]);
});

test('학생은 기준가로 사고 보유한 종목을 다시 살 수 없다', () => {
  const market = upsertStudentStockMarketEntry({}, 'sunny', {
    dateKey: '2026-08-13', changeAmount: 3, comment: '주문 증가',
  });
  const result = applyStudentEconomyAction({
    state: null,
    action: { type: 'buy_stock', stockId: 'sunny', dateKey: '2026-08-13' },
    wallet: 100,
    availableWallet: 100,
    requestId: 'market-stock-buy',
    stockMarket: market,
  });
  assert.equal(result.wallet, 85);
  assert.equal(result.state.holdings.sunny, 1);
  assert.deepEqual(result.state.stockPurchases.sunny, { dateKey: '2026-08-13', price: 15 });
  assert.throws(() => applyStudentEconomyAction({
    state: result.state,
    action: { type: 'buy_stock', stockId: 'sunny', dateKey: '2026-08-13' },
    wallet: result.wallet,
    availableWallet: result.wallet,
    requestId: 'market-stock-buy-again',
    stockMarket: market,
  }), /STOCK_ALREADY_OWNED/);
});

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

test('보유 종목을 팔면 오늘 등락 고마를 반영해 직접 정산한다', () => {
  const quote = getDailyStockQuotes('2026-08-11')[0];
  const bought = applyStudentEconomyAction({
    state: null,
    action: { type: 'buy_stock', stockId: quote.id, dateKey: '2026-08-11' },
    wallet: 100,
    availableWallet: 100,
    requestId: 'stock-buy-1',
  });
  const market = upsertStudentStockMarketEntry({}, quote.id, {
    dateKey: '2026-08-12', changeAmount: 3, comment: '좋은 소식이 생겼어요.',
  });
  const sold = applyStudentEconomyAction({
    state: bought.state,
    action: { type: 'sell_stock', stockId: quote.id, dateKey: '2026-08-12' },
    wallet: bought.wallet,
    availableWallet: bought.wallet,
    requestId: 'stock-sell-1',
    stockMarket: market,
  });
  assert.equal(sold.wallet, 103);
  assert.equal(sold.state.holdings[quote.id], undefined);
  assert.equal(sold.state.stockPurchases[quote.id], undefined);
  assert.throws(() => applyStudentEconomyAction({
    state: sold.state,
    action: { type: 'sell_stock', stockId: quote.id, dateKey: '2026-08-12' },
    wallet: sold.wallet,
    availableWallet: sold.wallet,
    requestId: 'stock-sell-again',
    stockMarket: market,
  }), /STOCK_NOT_OWNED/);
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

test('교사가 등록한 물품을 정가로 구매할 수 있다', () => {
  const catalog = normalizeStudentShopCatalog([
    { id: 'teacher-notebook', name: '칭찬 공책', price: 35, isActive: true },
  ]);
  const result = applyStudentEconomyAction({
    state: null,
    action: { type: 'buy_item', itemId: 'teacher-notebook' },
    wallet: 50,
    availableWallet: 50,
    requestId: 'teacher-item-1',
    shopCatalog: catalog,
  });
  assert.equal(result.wallet, 15);
  assert.equal(result.state.inventory['teacher-notebook'], 1);
});

test('고마 스킨 뽑기는 100고마를 차감하고 고마에 적용한다', () => {
  const result = applyStudentEconomyAction({
    state: null,
    action: { type: 'draw_character' },
    wallet: 145,
    availableWallet: 145,
    requestId: 'character-draw-1',
  });
  assert.equal(result.wallet, 45);
  assert.equal(result.state.ownedCharacterIds.length, 1);
  assert.equal(result.state.activeCharacterId, result.state.ownedCharacterIds[0]);
});

test('집 상점은 집 고치기 전에는 잠기고 수리 후 집과 만들기 쿠폰을 살 수 있다', () => {
  assert.throws(() => applyStudentEconomyAction({
    state: null,
    action: { type: 'buy_house', houseId: 'cozy-wood' },
    wallet: 300,
    availableWallet: 300,
    requestId: 'house-locked-1',
  }), /HOUSE_SHOP_LOCKED/);

  const repairedState = {
    inventory: { house_repair: 1 },
  };
  const house = applyStudentEconomyAction({
    state: repairedState,
    action: { type: 'buy_house', houseId: 'cozy-wood' },
    wallet: 300,
    availableWallet: 300,
    requestId: 'house-buy-1',
  });
  const coupon = applyStudentEconomyAction({
    state: house.state,
    action: { type: 'buy_custom_house_coupon' },
    wallet: house.wallet,
    availableWallet: house.wallet,
    requestId: 'house-coupon-1',
  });
  assert.equal(house.wallet, 200);
  assert.deepEqual(house.state.ownedHouseIds, ['cozy-wood']);
  assert.equal(house.state.activeHouseId, 'cozy-wood');
  assert.equal(coupon.wallet, 50);
  assert.equal(coupon.state.hasCustomHouseCoupon, true);
});
