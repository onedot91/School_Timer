import assert from 'node:assert/strict';
import {
  appendCurrencyHistoryEntry,
  createWeeklyCurrencyCycle,
  normalizeCurrencyHistory,
} from '../../../src/lib/currency.ts';
import {
  applyStudentEconomyAction,
  normalizeStudentEconomyState,
  upsertStudentStockMarketEntry,
  type StudentEconomyState,
} from '../../../src/lib/studentEconomy.ts';
import { mergeConcurrentCurrencyUpdatesIntoSettings } from '../../../src/lib/weeklyMission.ts';

const baseState = () => normalizeStudentEconomyState(null);
const historyFor = (studentNumber: number, before: number, after: number, reason: 'shop_purchase' | 'stock_trade' | 'bank_transfer', id: string) => (
  appendCurrencyHistoryEntry({}, {
    id,
    studentNumber,
    before,
    after,
    reason,
    createdAt: '2026-09-03T02:40:00.000Z',
  })
);
const mergeStale = (studentNumber: number, initialWallet: number, result: { state: StudentEconomyState; wallet: number; reason: 'shop_purchase' | 'stock_trade' | 'bank_transfer' }, id: string, staleState = baseState()) => {
  const remote = {
    currencyBalances: { [studentNumber]: result.wallet },
    currencyHistory: historyFor(studentNumber, initialWallet, result.wallet, result.reason, id),
    studentEconomy: { [studentNumber]: result.state },
  };
  const stale = {
    currencyBalances: { [studentNumber]: initialWallet },
    currencyHistory: { [studentNumber]: [] },
    studentEconomy: { [studentNumber]: staleState },
    scheduleNotice: 'teacher-edit',
  };
  return { remote, stale, merged: mergeConcurrentCurrencyUpdatesIntoSettings(remote, stale) };
};

const action = (state: unknown, studentNumber: number, wallet: number, requestId: string, economyAction: Parameters<typeof applyStudentEconomyAction>[0]['action'], extra: Record<string, unknown> = {}) => applyStudentEconomyAction({
  state,
  action: economyAction,
  wallet,
  availableWallet: wallet,
  requestId,
  ...extra,
});

const repaired = action(null, 10, 300, 'qa-house-repair', { type: 'buy_item', itemId: 'house_repair' });
const house = action(repaired.state, 10, repaired.wallet, 'qa-house-buy', { type: 'buy_house', houseId: 'pink-cottage' });
const houseCase = mergeStale(10, 200, house, 'currency-economy-qa-house-buy-10');
assert.equal(house.wallet, 100);
assert.equal((houseCase.merged.currencyBalances as Record<string, number>)['10'], 100);
assert.deepEqual(houseCase.merged.studentEconomy, houseCase.remote.studentEconomy);

const shop = action(null, 11, 80, 'qa-shop-buy', { type: 'buy_item', itemId: 'snack' });
const shopCase = mergeStale(11, 80, shop, 'currency-economy-qa-shop-buy-11');
assert.equal(shop.wallet, 55);
assert.equal((shopCase.merged.currencyBalances as Record<string, number>)['11'], 55);
assert.equal((shopCase.merged.studentEconomy as Record<string, StudentEconomyState>)['11'].inventory.snack, 1);

const stock = action(null, 12, 100, 'qa-stock-buy', { type: 'invest', stockId: 'sunny', amount: 40, dateKey: '2026-09-03' });
const stockCase = mergeStale(12, 100, stock, 'currency-economy-qa-stock-buy-12');
assert.equal(stock.wallet, 60);
assert.equal((stockCase.merged.currencyBalances as Record<string, number>)['12'], 60);
assert.equal((stockCase.merged.studentEconomy as Record<string, StudentEconomyState>)['12'].investments.sunny?.currentAmount, 40);

const sold = action(stock.state, 12, stock.wallet, 'qa-stock-sell', { type: 'withdraw_investment', stockId: 'sunny', dateKey: '2026-09-04' });
const sellCase = mergeStale(12, 60, sold, 'currency-economy-qa-stock-sell-12');
assert.equal(sold.wallet, 100);
assert.equal((sellCase.merged.currencyBalances as Record<string, number>)['12'], 100);
assert.equal((sellCase.merged.studentEconomy as Record<string, StudentEconomyState>)['12'].investments.sunny, undefined);

const transfer = action(null, 13, 100, 'qa-transfer', { type: 'transfer', amount: 25, recipientNumber: 14, dateKey: '2026-09-03' });
const transferRemoteHistory = historyFor(13, 100, 75, 'bank_transfer', 'currency-economy-qa-transfer-13');
const recipientHistory = historyFor(14, 100, 125, 'bank_transfer', 'currency-economy-qa-transfer-14');
const transferRemote = {
  currencyBalances: { 13: 75, 14: 125 },
  currencyHistory: {
    ...transferRemoteHistory,
    14: recipientHistory['14'],
  },
  studentEconomy: { 13: transfer.state },
};
const transferStale = {
  currencyBalances: { 13: 100, 14: 100 },
  currencyHistory: { 13: [], 14: [] },
  studentEconomy: { 13: baseState(), 14: baseState() },
};
const transferMerged = mergeConcurrentCurrencyUpdatesIntoSettings(transferRemote, transferStale);
assert.equal((transferMerged.currencyBalances as Record<string, number>)['13'], 75);
assert.equal((transferMerged.currencyBalances as Record<string, number>)['14'], 125);
assert.equal((transferMerged.studentEconomy as Record<string, StudentEconomyState>)['13'].lastTransferRecipientNumber, 14);

const zeroHouse = action(house.state, 10, house.wallet, 'qa-zero-select-house', { type: 'select_house', houseId: 'pink-cottage' });
const zeroCase = mergeStale(10, 100, zeroHouse, 'qa-zero-select-house', baseState());
assert.equal(zeroHouse.wallet, 100);
assert.deepEqual((zeroCase.merged.studentEconomy as Record<string, StudentEconomyState>)['10'], zeroHouse.state);
const zeroSettle = action(stock.state, 12, stock.wallet, 'qa-zero-settle', { type: 'settle_investments', dateKey: '2026-09-03' });
assert.equal(zeroSettle.applied, false);
assert.deepEqual(zeroSettle.state, stock.state);
const priorStock = action(null, 12, 100, 'qa-prior-stock-buy', { type: 'invest', stockId: 'sunny', amount: 40, dateKey: '2026-09-02' });
const stockMarket = upsertStudentStockMarketEntry({}, 'sunny', {
  dateKey: '2026-09-03', stage: 'rise', returnPercent: 20, comment: 'qa',
});
const zeroDeltaSettle = action(priorStock.state, 12, priorStock.wallet, 'qa-zero-delta-settle', {
  type: 'settle_investments', dateKey: '2026-09-03',
}, { stockMarket });
const zeroDeltaSettleCase = mergeStale(12, priorStock.wallet, zeroDeltaSettle, 'qa-zero-delta-settle', baseState());
assert.equal(zeroDeltaSettle.applied, true);
assert.equal(zeroDeltaSettle.wallet, priorStock.wallet);
assert.equal(zeroDeltaSettle.state.investments.sunny?.currentAmount, 48);
assert.deepEqual((zeroDeltaSettleCase.merged.studentEconomy as Record<string, StudentEconomyState>)['12'], zeroDeltaSettle.state);

assert.deepEqual(mergeConcurrentCurrencyUpdatesIntoSettings(houseCase.remote, houseCase.merged), houseCase.merged);
assert.deepEqual(mergeConcurrentCurrencyUpdatesIntoSettings(transferRemote, transferMerged), transferMerged);

const duplicate = mergeConcurrentCurrencyUpdatesIntoSettings(houseCase.remote, {
  ...houseCase.merged,
  currencyBalances: { 10: 100 },
  currencyHistory: houseCase.remote.currencyHistory,
});
assert.equal((duplicate.currencyBalances as Record<string, number>)['10'], 100);

assert.throws(() => mergeConcurrentCurrencyUpdatesIntoSettings({
  currencyBalances: { 15: 10 },
  currencyHistory: historyFor(15, 100, 10, 'shop_purchase', 'currency-economy-qa-conflict-15'),
  studentEconomy: { 15: normalizeStudentEconomyState({ processedRequestIds: ['qa-conflict'] }) },
}, {
  currencyBalances: { 15: 0 },
  currencyHistory: { 15: [] },
  studentEconomy: { 15: baseState() },
}), /CURRENCY_RECONCILIATION_CONFLICT/);

const remoteTax = {
  currencyBalances: { 16: 189 },
  currencyHistory: historyFor(16, 289, 189, 'shop_purchase', 'currency-economy-qa-tax-purchase-16'),
  studentEconomy: { 16: normalizeStudentEconomyState({
    ...houseCase.remote.studentEconomy['10'],
    processedRequestIds: ['qa-tax-purchase'],
  }) },
};
const taxCycle = createWeeklyCurrencyCycle(
  remoteTax,
  '2026-09-03T02:41:00.000Z',
  '2026-09-03T02:41:00.001Z',
);
const taxSnapshot = {
  currencyBalances: taxCycle.balances,
  currencyHistory: taxCycle.history,
  studentEconomy: taxCycle.economy,
};
const taxMerged = mergeConcurrentCurrencyUpdatesIntoSettings(remoteTax, taxSnapshot);
assert.equal((taxMerged.currencyBalances as Record<string, number>)['16'], 195);
assert.deepEqual((taxMerged.studentEconomy as Record<string, StudentEconomyState>)['16'], taxCycle.economy['16']);

const resetMerged = mergeConcurrentCurrencyUpdatesIntoSettings(remoteTax, {
  currencyBalances: { 16: 999 },
  currencyHistory: appendCurrencyHistoryEntry(normalizeCurrencyHistory({ 16: [] }), {
    id: 'qa-reset-after-purchase',
    studentNumber: 16,
    before: 189,
    after: 100,
    reason: 'reset',
    createdAt: '2026-09-03T02:42:00.000Z',
  }),
  studentEconomy: { 16: baseState() },
});
assert.equal((resetMerged.currencyBalances as Record<string, number>)['16'], 100);
assert.deepEqual((resetMerged.studentEconomy as Record<string, StudentEconomyState>)['16'], remoteTax.studentEconomy['16']);

console.log(JSON.stringify({
  scenarios: 16,
  passed: 16,
  labels: [
    'house purchase', 'shop purchase', 'stock invest', 'stock withdraw', 'bank transfer sender+recipient',
    'zero-delta select-house', 'zero-delta settle no-op', 'zero-delta settle state update', 'repeated merge purchase', 'repeated merge transfer',
    'duplicate history id', 'negative reconciliation conflict', 'teacher weekly tax + allowance', 'teacher reset',
    'house economy ownership', 'currency ledger continuity',
  ],
}, null, 2));
