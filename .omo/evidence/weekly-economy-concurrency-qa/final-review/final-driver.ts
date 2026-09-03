import assert from 'node:assert/strict';
import { appendCurrencyHistoryEntry, createWeeklyCurrencyCycle } from '../../../../src/lib/currency.ts';
import { mergeConcurrentCurrencyUpdatesIntoSettings } from '../../../../src/lib/weeklyMission.ts';
import {
  applyStudentEconomyAction,
  normalizeStudentEconomyState,
} from '../../../../src/lib/studentEconomy.ts';
import { FAILURE_PROFILE_IMAGES } from '../../../../src/lib/failureExhibition.ts';
import { purchaseStudentProfile } from '../../../../src/lib/studentProfilePurchase.ts';

const state = () => normalizeStudentEconomyState(null);
const act = (rawState: unknown, studentNumber: number, wallet: number, requestId: string, action: Parameters<typeof applyStudentEconomyAction>[0]['action'], extra: Record<string, unknown> = {}) => applyStudentEconomyAction({
  state: rawState, action, wallet, availableWallet: wallet, requestId, ...extra,
});
const ledger = (studentNumber: number, before: number, after: number, reason: 'shop_purchase' | 'stock_trade' | 'bank_transfer' | 'reset', id: string, createdAt = '2026-09-03T02:40:00.000Z') => appendCurrencyHistoryEntry({}, { id, studentNumber, before, after, reason, createdAt });
const merged = (remote: Record<string, unknown>, next: Record<string, unknown>) => mergeConcurrentCurrencyUpdatesIntoSettings(remote, next);
const labels: string[] = [];
const pass = (label: string) => labels.push(label);

const repaired = act(state(), 1, 300, 'qa-repair-1', { type: 'buy_item', itemId: 'house_repair' });
const house = act(repaired.state, 1, repaired.wallet, 'qa-house-1', { type: 'buy_house', houseId: 'pink-cottage' });
const houseRemote = { currencyBalances: { 1: house.wallet }, currencyHistory: { 1: ledger(1, 200, house.wallet, 'shop_purchase', 'currency-economy-qa-house-1-1')['1'] }, studentEconomy: { 1: house.state } };
const houseMerged = merged(houseRemote, { currencyBalances: { 1: 200 }, currencyHistory: { 1: [] }, studentEconomy: { 1: state() }, schedule: ['teacher'] });
assert.equal(house.wallet, 100); assert.equal((houseMerged.currencyBalances as Record<string, number>)['1'], 100); assert.equal((houseMerged.studentEconomy as Record<string, typeof house.state>)['1'].activeHouseId, 'pink-cottage'); pass('house purchase survives stale teacher save');

const shop = act(state(), 2, 80, 'qa-shop-1', { type: 'buy_item', itemId: 'snack' });
assert.equal(shop.wallet, 55); assert.equal(shop.state.inventory.snack, 1); pass('shop purchase debits and stores inventory');

const invest = act(state(), 3, 100, 'qa-invest-1', { type: 'invest', stockId: 'sunny', amount: 40, dateKey: '2026-09-03' });
assert.equal(invest.wallet, 60); assert.equal(invest.state.investments.sunny?.currentAmount, 40);
const withdraw = act(invest.state, 3, invest.wallet, 'qa-withdraw-1', { type: 'withdraw_investment', stockId: 'sunny', dateKey: '2026-09-04' });
assert.equal(withdraw.wallet, 100); assert.equal(withdraw.state.investments.sunny, undefined); pass('stock invest and withdraw preserve wallet/position');

const transfer = act(state(), 4, 100, 'qa-transfer-1', { type: 'transfer', amount: 25, recipientNumber: 5, dateKey: '2026-09-03' });
const transferRemote = { currencyBalances: { 4: 75, 5: 125 }, currencyHistory: { 4: ledger(4, 100, 75, 'bank_transfer', 'currency-economy-qa-transfer-1-4')['4'], 5: ledger(5, 100, 125, 'bank_transfer', 'currency-economy-qa-transfer-1-5')['5'] }, studentEconomy: { 4: transfer.state } };
const transferMerged = merged(transferRemote, { currencyBalances: { 4: 100, 5: 100 }, currencyHistory: { 4: [], 5: [] }, studentEconomy: { 4: state(), 5: state() } });
assert.equal((transferMerged.currencyBalances as Record<string, number>)['4'], 75); assert.equal((transferMerged.currencyBalances as Record<string, number>)['5'], 125); pass('transfer keeps sender debit and recipient credit');

const profileSettings = (balance: number, assignment: Record<string, string>) => ({ currencyBalances: { 6: balance }, currencyHistory: { 6: [] }, studentLife: { letters: [], books: [], failureStories: [], failureProfileAssignments: assignment } });
const firstProfile = purchaseStudentProfile(profileSettings(100, {}), 6, { type: 'random' }, 100, () => 0);
assert.equal(firstProfile.applied, true); assert.equal(firstProfile.price, 0); assert.equal(firstProfile.balances['6'], 100); assert.equal(FAILURE_PROFILE_IMAGES.includes(firstProfile.studentLife.failureProfileAssignments['6'] as never), true);
const selectedProfile = purchaseStudentProfile(profileSettings(100, { 6: FAILURE_PROFILE_IMAGES[0] }), 6, { type: 'selected', profileImage: FAILURE_PROFILE_IMAGES[1] }, 100, () => 0, '2026-09-03T02:40:00.000Z');
assert.equal(selectedProfile.applied, true); assert.equal(selectedProfile.price, 50); assert.equal(selectedProfile.balances['6'], 50); pass('profile random/selected purchase paths are isolated and atomic');

const weeklySource = { currencyBalances: { 7: 189 }, currencyHistory: { 7: ledger(7, 289, 189, 'shop_purchase', 'currency-economy-qa-weekly-7')['7'] }, studentEconomy: { 7: house.state } };
const cycle = createWeeklyCurrencyCycle(weeklySource, '2026-09-03T03:00:00.000Z', '2026-09-03T03:00:00.001Z');
assert.equal(cycle.balances['7'], 195); assert.deepEqual(cycle.history['7'].slice(0, 2).map((entry) => entry.reason), ['allowance', 'tax']); pass('weekly tax then allowance uses latest persisted purchase');

const reset = merged({ currencyBalances: { 8: 189 }, currencyHistory: { 8: ledger(8, 289, 189, 'shop_purchase', 'currency-economy-qa-reset-purchase')['8'] }, studentEconomy: { 8: house.state } }, { currencyBalances: { 8: 100 }, currencyHistory: { 8: ledger(8, 189, 100, 'reset', 'qa-reset-8', '2026-09-03T02:41:00.000Z')['8'] }, studentEconomy: { 8: state() } });
assert.equal((reset.currencyBalances as Record<string, number>)['8'], 100); assert.deepEqual((reset.studentEconomy as Record<string, typeof house.state>)['8'].ownedHouseIds, ['pink-cottage']); pass('newer teacher reset keeps ownership without restoring debit');

assert.deepEqual(merged(houseRemote, houseMerged), houseMerged); pass('repeated merge is idempotent');
const forged = merged({ currencyBalances: { 9: 999999 }, currencyHistory: { 9: ledger(9, 100, 999999, 'stock_trade', 'forged-history-9')['9'] }, studentEconomy: { 9: state() } }, { currencyBalances: { 9: 100 }, currencyHistory: { 9: [] }, studentEconomy: { 9: state() } });
assert.equal((forged.currencyBalances as Record<string, number>)['9'], 100); assert.deepEqual((forged.currencyHistory as Record<string, unknown[]>)['9'], []); pass('unverified forged history cannot alter stale balance');
assert.throws(() => merged({ currencyBalances: { 10: 10 }, currencyHistory: { 10: ledger(10, 100, 10, 'shop_purchase', 'currency-economy-qa-negative-10-10')['10'] }, studentEconomy: { 10: { ...state(), processedRequestIds: ['qa-negative-10'] } } }, { currencyBalances: { 10: 0 }, currencyHistory: { 10: [] }, studentEconomy: { 10: state() } }), /CURRENCY_RECONCILIATION_CONFLICT/); pass('impossible negative reconciliation is rejected');

console.log(JSON.stringify({ scenarios: labels.length, passed: labels.length, labels }, null, 2));
