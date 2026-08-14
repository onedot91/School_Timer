import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyStudentEconomyAction,
  calculateInvestmentAmount,
  investmentMultiplierToPercent,
  investmentPercentToMultiplier,
  getInvestmentStageFromPercent,
  getInvestmentStagePresentation,
  getInvestmentWeekDateKeys,
  getDailyStockQuotes,
  normalizeStudentEconomyState,
  normalizeStudentStockMarket,
  normalizeStudentShopCatalog,
  STUDENT_STOCKS,
  upsertStudentStockMarketEntry,
} from './studentEconomy.ts';

test('학생 증권은 4개 종목과 날짜별 등락 단계를 유지한다', () => {
  assert.equal(STUDENT_STOCKS.length, 4);
  const market = upsertStudentStockMarketEntry({}, 'sunny', {
    dateKey: '2026-08-12', stage: 'rise', comment: '새 문구류가 인기를 얻었어요.',
  });
  const updated = upsertStudentStockMarketEntry(market, 'sunny', {
    dateKey: '2026-08-13', stage: 'fall', comment: '재료비가 올랐어요.',
  });
  const quote = getDailyStockQuotes('2026-08-13', updated).find((stock) => stock.id === 'sunny');
  assert.equal(quote?.stage, 'fall');
  assert.equal(quote?.comment, '재료비가 올랐어요.');
  assert.deepEqual(quote?.history.map((entry) => entry.dateKey), ['2026-08-13', '2026-08-12']);
});

test('같은 날짜의 증권 코멘트는 최신 내용으로 교체된다', () => {
  const market = upsertStudentStockMarketEntry({}, 'sprout', {
    dateKey: '2026-08-13', stage: 'rise', comment: '첫 소식',
  });
  const updated = upsertStudentStockMarketEntry(market, 'sprout', {
    dateKey: '2026-08-13', stage: 'big_rise', comment: '수정된 소식',
  });
  assert.deepEqual(normalizeStudentStockMarket(updated).sprout, [{
    dateKey: '2026-08-13', stage: 'big_rise', comment: '수정된 소식',
  }]);
});

test('학생은 원하는 고마를 투자하고 같은 종목에 추가 투자할 수 있다', () => {
  const market = upsertStudentStockMarketEntry({}, 'sunny', {
    dateKey: '2026-08-13', stage: 'rise', comment: '주문 증가',
  });
  const result = applyStudentEconomyAction({
    state: null,
    action: { type: 'invest', stockId: 'sunny', amount: 40, dateKey: '2026-08-13' },
    wallet: 100,
    availableWallet: 100,
    requestId: 'market-stock-buy',
    stockMarket: market,
  });
  assert.equal(result.wallet, 60);
  assert.equal(result.state.investments.sunny?.investedAmount, 40);
  assert.equal(result.state.investments.sunny?.currentAmount, 40);
  const added = applyStudentEconomyAction({
    state: result.state,
    action: { type: 'invest', stockId: 'sunny', amount: 20, dateKey: '2026-08-13' },
    wallet: result.wallet,
    availableWallet: result.wallet,
    requestId: 'market-stock-buy-again',
    stockMarket: market,
  });
  assert.equal(added.wallet, 40);
  assert.equal(added.state.investments.sunny?.currentAmount, 60);
});

test('배율 계산은 투자금에 비례하고 정수 처리 방식을 따른다', () => {
  assert.equal(calculateInvestmentAmount(35, 1.1, 'round'), 39);
  assert.equal(calculateInvestmentAmount(35, 1.1, 'floor'), 38);
  assert.equal(calculateInvestmentAmount(35, 1.1, 'ceil'), 39);
  assert.deepEqual([10, 30, 50, 100].map((amount) => calculateInvestmentAmount(amount, 1.1, 'round')), [11, 33, 55, 110]);
  assert.equal(getInvestmentStagePresentation('big_fall').studentLabel, '많이 내렸어요');
});

test('교사용 수익률은 -50%부터 +50%까지만 내부 배율로 변환한다', () => {
  assert.equal(investmentPercentToMultiplier(20), 1.2);
  assert.equal(investmentPercentToMultiplier(-10), 0.9);
  assert.equal(investmentPercentToMultiplier(80), 1.5);
  assert.equal(investmentPercentToMultiplier(-80), 0.5);
  assert.equal(investmentMultiplierToPercent(1.2), 20);
  assert.equal(investmentMultiplierToPercent(0.9), -10);
});

test('교사가 고른 퍼센트는 학생용 다섯 단계 문구로 바뀐다', () => {
  assert.deepEqual(
    [-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50].map(getInvestmentStageFromPercent),
    ['big_fall', 'big_fall', 'big_fall', 'fall', 'fall', 'flat', 'rise', 'rise', 'big_rise', 'big_rise', 'big_rise'],
  );
});

test('선택한 날짜가 포함된 월요일부터 금요일까지를 반환한다', () => {
  assert.deepEqual(getInvestmentWeekDateKeys('2026-08-15'), [
    '2026-08-10',
    '2026-08-11',
    '2026-08-12',
    '2026-08-13',
    '2026-08-14',
  ]);
});

test('날짜별로 고른 퍼센트가 해당 종목 투자금에 직접 적용된다', () => {
  const market = upsertStudentStockMarketEntry({}, 'sunny', {
    dateKey: '2026-08-14', stage: 'rise', returnPercent: 20, comment: '주문 증가',
  });
  const state = normalizeStudentEconomyState({ investments: { sunny: { investedAmount: 40, currentAmount: 40, lastSettledDateKey: '2026-08-13', lastChangeAmount: 0, lastStage: 'flat' } } });
  const settled = applyStudentEconomyAction({ state, action: { type: 'settle_investments', dateKey: '2026-08-14' }, wallet: 60, availableWallet: 60, requestId: 'percent-settle', stockMarket: market });
  assert.equal(settled.state.investments.sunny?.currentAmount, 48);
  assert.equal(settled.state.investments.sunny?.lastStage, 'rise');
});

test('평일 결과는 날짜마다 한 번만 적용되고 주말은 적용하지 않는다', () => {
  let market = upsertStudentStockMarketEntry({}, 'sunny', { dateKey: '2026-08-14', stage: 'rise', comment: '금요일 소식' });
  market = upsertStudentStockMarketEntry(market, 'sunny', { dateKey: '2026-08-15', stage: 'big_rise', comment: '토요일 소식' });
  const state = normalizeStudentEconomyState({ investments: { sunny: { investedAmount: 40, currentAmount: 40, lastSettledDateKey: '2026-08-13', lastChangeAmount: 0, lastStage: 'flat' } } });
  const settled = applyStudentEconomyAction({ state, action: { type: 'settle_investments', dateKey: '2026-08-16' }, wallet: 60, availableWallet: 60, requestId: 'settle-1', stockMarket: market });
  assert.equal(settled.state.investments.sunny?.currentAmount, 44);
  assert.equal(settled.state.investments.sunny?.lastChangeAmount, 4);
  const repeated = applyStudentEconomyAction({ state: settled.state, action: { type: 'settle_investments', dateKey: '2026-08-16' }, wallet: 60, availableWallet: 60, requestId: 'settle-2', stockMarket: market });
  assert.equal(repeated.state.investments.sunny?.currentAmount, 44);
  assert.equal(repeated.applied, false);
  assert.equal(repeated.state.processedRequestIds.includes('settle-2'), false);
});

test('교사 결과가 없는 평일은 그대로예요로 정산 날짜가 진행된다', () => {
  const state = normalizeStudentEconomyState({ investments: { sunny: { investedAmount: 40, currentAmount: 40, lastSettledDateKey: '2026-08-13', lastChangeAmount: 5, lastStage: 'rise' } } });
  const settled = applyStudentEconomyAction({ state, action: { type: 'settle_investments', dateKey: '2026-08-14' }, wallet: 60, availableWallet: 60, requestId: 'flat-settle' });
  assert.equal(settled.state.investments.sunny?.currentAmount, 40);
  assert.equal(settled.state.investments.sunny?.lastChangeAmount, 0);
  assert.equal(settled.state.investments.sunny?.lastStage, 'flat');
  assert.equal(settled.state.investments.sunny?.lastSettledDateKey, '2026-08-14');
});

test('토·일에는 투자와 투자금 찾기를 할 수 없다', () => {
  assert.throws(() => applyStudentEconomyAction({
    state: null,
    action: { type: 'invest', stockId: 'sunny', amount: 10, dateKey: '2026-08-15' },
    wallet: 100,
    availableWallet: 100,
    requestId: 'weekend-invest',
  }), /STOCK_MARKET_CLOSED/);
  const state = normalizeStudentEconomyState({ investments: { sunny: { investedAmount: 10, currentAmount: 10, lastSettledDateKey: '2026-08-14', lastChangeAmount: 0, lastStage: 'flat' } } });
  assert.throws(() => applyStudentEconomyAction({
    state,
    action: { type: 'withdraw_investment', stockId: 'sunny', dateKey: '2026-08-16' },
    wallet: 90,
    availableWallet: 90,
    requestId: 'weekend-withdraw',
  }), /STOCK_MARKET_CLOSED/);
});

test('추가 투자 후 현재 금액이 최대 투자 한도를 넘을 수 없다', () => {
  const stockMarket = { settings: { minimumAmount: 1, maximumAmount: 50 } };
  const state = normalizeStudentEconomyState({ investments: { sunny: { investedAmount: 40, currentAmount: 40, lastSettledDateKey: '2026-08-13', lastChangeAmount: 0, lastStage: 'flat' } } });
  assert.throws(() => applyStudentEconomyAction({
    state,
    action: { type: 'invest', stockId: 'sunny', amount: 11, dateKey: '2026-08-14' },
    wallet: 60,
    availableWallet: 60,
    requestId: 'over-limit-invest',
    stockMarket,
  }), /INVESTMENT_LIMIT_EXCEEDED/);
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

test('투자금을 찾으면 현재 투자 금액이 지갑으로 돌아온다', () => {
  const quote = getDailyStockQuotes('2026-08-11')[0];
  const bought = applyStudentEconomyAction({
    state: null,
    action: { type: 'invest', stockId: quote.id, amount: 40, dateKey: '2026-08-11' },
    wallet: 100,
    availableWallet: 100,
    requestId: 'stock-buy-1',
  });
  const sold = applyStudentEconomyAction({
    state: bought.state,
    action: { type: 'withdraw_investment', stockId: quote.id, dateKey: '2026-08-12' },
    wallet: bought.wallet,
    availableWallet: bought.wallet,
    requestId: 'stock-sell-1',
  });
  assert.equal(sold.wallet, 100);
  assert.equal(sold.state.investments[quote.id], undefined);
  assert.throws(() => applyStudentEconomyAction({
    state: sold.state,
    action: { type: 'withdraw_investment', stockId: quote.id, dateKey: '2026-08-12' },
    wallet: sold.wallet,
    availableWallet: sold.wallet,
    requestId: 'stock-sell-again',
  }), /INVESTMENT_NOT_FOUND/);
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
