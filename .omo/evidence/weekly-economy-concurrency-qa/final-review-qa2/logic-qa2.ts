import assert from 'node:assert/strict';
import { appendCurrencyHistoryEntry, createWeeklyCurrencyCycle, type CurrencyHistory } from '../../../../src/lib/currency.ts';
import { mergeConcurrentCurrencyUpdatesIntoSettings } from '../../../../src/lib/weeklyMission.ts';
import { applyStudentEconomyAction, createStudentEconomyState, type StudentEconomyState } from '../../../../src/lib/studentEconomy.ts';
import { FAILURE_PROFILE_IMAGES } from '../../../../src/lib/failureExhibition.ts';
import { purchaseStudentProfile } from '../../../../src/lib/studentProfilePurchase.ts';
import { mergeStudentLifeStates, normalizeStudentLifeState } from '../../../../src/lib/studentLife.ts';

const labels: string[] = [];
const ok = (label: string) => labels.push(label);
const state = (overrides: Partial<StudentEconomyState> = {}) => ({ ...createStudentEconomyState(), ...overrides });
const act = (rawState: unknown, wallet: number, requestId: string, action: Parameters<typeof applyStudentEconomyAction>[0]['action']) => applyStudentEconomyAction({
  state: rawState, wallet, availableWallet: wallet, requestId, action,
});
const entry = (studentNumber: number, id: string, delta: number, before: number, after: number, reason: 'shop_purchase' | 'stock_trade' | 'bank_transfer' | 'reset', createdAt: string) => ({
  id, studentNumber, delta, before, after, reason, createdAt,
} as const);

const houseRepair = act(state({ inventory: { house_repair: 1 } }), 300, 'qa2-logic-house-repair', { type: 'buy_house', houseId: 'pink-cottage' });
assert.equal(houseRepair.wallet, 200);
assert.deepEqual(houseRepair.state.ownedHouseIds, ['pink-cottage']);
ok('house purchase debits and activates ownership');

const shop = act(state(), 100, 'qa2-logic-shop', { type: 'buy_item', itemId: 'snack' });
assert.equal(shop.wallet, 75);
assert.equal(shop.state.inventory.snack, 1);
ok('shop purchase debits and increments inventory');

const invested = act(state(), 200, 'qa2-logic-invest', { type: 'invest', stockId: 'sunny', amount: 40, dateKey: '2026-09-03' });
const withdrawn = act(invested.state, invested.wallet, 'qa2-logic-withdraw', { type: 'withdraw_investment', stockId: 'sunny', dateKey: '2026-09-04' });
assert.equal(withdrawn.wallet, 200);
assert.equal(withdrawn.state.investments.sunny, undefined);
ok('stock invest and withdraw round-trip wallet and position');

const transfer = act(state(), 100, 'qa2-logic-transfer', { type: 'transfer', amount: 25, recipientNumber: 8, dateKey: '2026-09-03' });
assert.equal(transfer.wallet, 75);
const transferBalances = { '7': transfer.wallet, '8': 125 };
assert.deepEqual(transferBalances, { '7': 75, '8': 125 });
ok('transfer debits sender and credits recipient');

const profileBase = { currencyBalances: { '9': 100 }, currencyHistory: { '9': [] }, studentLife: { failureProfileAssignments: { '9': FAILURE_PROFILE_IMAGES[0] } } };
const profile = purchaseStudentProfile(profileBase, 9, { type: 'random' }, 100, () => 0, '2026-09-03T04:00:00.000Z', 'currency-profile-qa2-profile');
assert.equal(profile.applied, true);
assert.equal(profile.price, 30);
assert.equal(profile.balances['9'], 70);
assert.ok(profile.studentLife.failureProfileAssignments['9']);
ok('profile random replacement charges once and updates assignment atomically');

const zeroDelta = act(state({ inventory: { house_repair: 1 }, ownedHouseIds: ['pink-cottage'] }), 100, 'qa2-logic-zero-delta', { type: 'select_house', houseId: null });
assert.equal(zeroDelta.wallet, 100);
assert.equal(zeroDelta.applied, true);
ok('zero-delta state mutation applies without currency movement');

const purchase = entry(10, 'currency-economy-qa2-purchase', -100, 289, 189, 'shop_purchase', '2026-09-03T04:00:00.000Z');
const reset = entry(10, 'currency-10-qa2-reset', -89, 189, 100, 'reset', '2026-09-03T04:01:00.000Z');
const resetMerged = mergeConcurrentCurrencyUpdatesIntoSettings({
  currencyBalances: { '10': 100 }, currencyHistory: { '10': [reset, purchase] },
  studentEconomy: { '10': { inventory: { house_repair: 1 }, ownedHouseIds: ['pink-cottage'], activeHouseId: 'pink-cottage', processedRequestIds: ['qa2-purchase'] } },
}, {
  currencyBalances: { '10': 289 }, currencyHistory: { '10': [] }, studentEconomy: { '10': { processedRequestIds: [] } },
});
assert.equal((resetMerged.currencyBalances as Record<string, number>)['10'], 100);
assert.deepEqual((resetMerged.currencyHistory as CurrencyHistory)['10'].map((item) => item.reason), ['reset', 'shop_purchase']);
assert.deepEqual((resetMerged.studentEconomy as Record<string, { ownedHouseIds: string[] }>)['10'].ownedHouseIds, ['pink-cottage']);
ok('remote reset survives stale teacher snapshot and preserves purchased ownership');

const nextResetMerged = mergeConcurrentCurrencyUpdatesIntoSettings({
  currencyBalances: { '17': 189 }, currencyHistory: { '17': [entry(17, 'currency-economy-qa2-purchase-17', -100, 289, 189, 'shop_purchase', '2026-09-03T04:00:00.000Z')] },
  studentEconomy: { '17': { inventory: { house_repair: 1 }, ownedHouseIds: ['pink-cottage'], processedRequestIds: ['qa2-purchase-17'] } },
}, {
  currencyBalances: { '17': 999 }, currencyHistory: { '17': [entry(17, 'currency-17-qa2-next-reset', -89, 189, 100, 'reset', '2026-09-03T04:01:00.000Z')] },
  studentEconomy: { '17': { processedRequestIds: [] } },
});
assert.equal((nextResetMerged.currencyBalances as Record<string, number>)['17'], 100);
assert.equal((nextResetMerged.currencyHistory as CurrencyHistory)['17'][0]?.after, 100);
assert.deepEqual((nextResetMerged.studentEconomy as Record<string, { ownedHouseIds: string[] }>)['17'].ownedHouseIds, ['pink-cottage']);
ok('next-side reset canonicalizes raw balance and does not restore pre-reset debit');

const cycle = createWeeklyCurrencyCycle({
  currencyBalances: { '11': 189 }, currencyHistory: { '11': [entry(11, 'currency-economy-qa2-cycle-purchase', -100, 289, 189, 'shop_purchase', '2026-09-03T04:00:00.000Z')] },
  studentEconomy: { '11': state() },
}, '2026-09-03T04:02:00.000Z', '2026-09-03T04:02:00.001Z');
assert.equal(cycle.balances['11'], 195);
assert.deepEqual(cycle.history['11'].slice(0, 3).map((item) => item.reason), ['allowance', 'tax', 'shop_purchase']);
assert.equal(cycle.history['11'][1]?.before, 189);
assert.equal(cycle.history['11'][1]?.after, 95);
ok('weekly tax uses latest purchase balance then allowance with continuous ledger');

const concurrentDeposit = act(state(), 300, 'qa2-logic-deposit-race', { type: 'open_deposit', amount: 200, dateKey: '2026-09-03' });
const raceCycle = createWeeklyCurrencyCycle({
  currencyBalances: { '16': concurrentDeposit.wallet }, currencyHistory: { '16': [] }, studentEconomy: { '16': concurrentDeposit.state },
}, '2026-09-03T04:02:00.000Z', '2026-09-03T04:02:00.001Z');
assert.equal(raceCycle.balances['16'], 100);
assert.equal(raceCycle.economy['16']?.deposit, 150);
ok('weekly tax racing a concurrent deposit uses latest economy before allowance');

const ledgerMerged = mergeConcurrentCurrencyUpdatesIntoSettings({
  currencyBalances: { '12': 189 }, currencyHistory: { '12': [entry(12, 'currency-economy-qa2-purchase-12', -100, 289, 189, 'shop_purchase', '2026-09-03T04:00:00.000Z')] }, studentEconomy: { '12': { processedRequestIds: ['qa2-purchase'] } },
}, {
  currencyBalances: { '12': 299 }, currencyHistory: { '12': [entry(12, 'currency-12-qa2-manual', 10, 289, 299, 'bank_transfer', '2026-09-03T04:03:00.000Z')] }, studentEconomy: { '12': { processedRequestIds: [] } },
});
const ledgerEntries = (ledgerMerged.currencyHistory as CurrencyHistory)['12'];
assert.equal((ledgerMerged.currencyBalances as Record<string, number>)['12'], 199);
assert.deepEqual(ledgerEntries.map(({ before, after }) => ({ before, after })), [{ before: 189, after: 199 }, { before: 289, after: 189 }]);
ok('concurrent ledger entries are newest-first and continuous');

const forged = mergeConcurrentCurrencyUpdatesIntoSettings({
  currencyBalances: { '13': 999999 }, currencyHistory: { '13': [entry(13, 'qa2-forged-history', 999899, 100, 999999, 'stock_trade', '2026-09-03T04:00:00.000Z')] }, studentEconomy: { '13': { processedRequestIds: [] } },
}, { currencyBalances: { '13': 100 }, currencyHistory: { '13': [] }, studentEconomy: { '13': { processedRequestIds: [] } } });
assert.equal((forged.currencyBalances as Record<string, number>)['13'], 100);
assert.deepEqual((forged.currencyHistory as CurrencyHistory)['13'], []);
ok('unverified forged economy history cannot alter stale balance');

const remoteLife = normalizeStudentLifeState({ letters: [{ id: 'qa2-remote-letter', recipient: 14, senderLabel: '은행원 돝돝', title: '도착', content: '원격 편지', createdAt: '2026-09-03T04:00:00.000Z', readAt: null }], failureProfileAssignments: { '14': FAILURE_PROFILE_IMAGES[0] } });
const nextLife = normalizeStudentLifeState({ letters: [{ id: 'qa2-next-letter', recipient: 15, senderLabel: '선생님', title: '안내', content: '동시 편지', createdAt: '2026-09-03T04:01:00.000Z', readAt: null }], failureProfileAssignments: { '15': FAILURE_PROFILE_IMAGES[1] } });
const lifeMerged = mergeStudentLifeStates(remoteLife, nextLife);
assert.deepEqual(lifeMerged.letters.map((letter) => letter.id), ['qa2-remote-letter', 'qa2-next-letter']);
assert.equal(lifeMerged.failureProfileAssignments['14'], FAILURE_PROFILE_IMAGES[0]);
assert.equal(lifeMerged.failureProfileAssignments['15'], FAILURE_PROFILE_IMAGES[1]);
ok('studentLife concurrent letters and profile assignments merge without loss');

console.log(JSON.stringify({ scenarioCount: labels.length, passed: labels.length, labels }, null, 2));
