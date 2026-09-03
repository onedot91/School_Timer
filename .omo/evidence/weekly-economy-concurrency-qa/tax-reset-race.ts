import {
  appendCurrencyHistoryEntry,
  collectCurrencyTax,
  createWeeklyCurrencyCycle,
  grantWeeklyCurrencyAllowance,
} from '../../../src/lib/currency.ts';
import { applyStudentEconomyAction, normalizeStudentEconomyState } from '../../../src/lib/studentEconomy.ts';
import { mergeConcurrentCurrencyUpdatesIntoSettings } from '../../../src/lib/weeklyMission.ts';

const staleState = normalizeStudentEconomyState(null);
const opened = applyStudentEconomyAction({
  state: staleState,
  action: { type: 'open_deposit', amount: 200, dateKey: '2026-09-03' },
  wallet: 289,
  availableWallet: 289,
  requestId: 'qa-deposit-race',
});
const remote = {
  currencyBalances: { 16: opened.wallet },
  currencyHistory: appendCurrencyHistoryEntry({}, {
    id: 'qa-deposit-race', studentNumber: 16, before: 289, after: opened.wallet,
    reason: opened.reason, createdAt: '2026-09-03T02:40:00.000Z',
  }),
  studentEconomy: { 16: opened.state },
};

const staleTax = collectCurrencyTax({ 16: 289 }, { 16: staleState });
const staleAllowance = grantWeeklyCurrencyAllowance(staleTax.balances);
let taxHistory = appendCurrencyHistoryEntry({}, {
  id: 'qa-tax', studentNumber: 16, before: 289, after: staleTax.balances['16'],
  reason: 'tax', createdAt: '2026-09-03T02:45:00.000Z',
});
taxHistory = appendCurrencyHistoryEntry(taxHistory, {
  id: 'qa-allowance', studentNumber: 16, before: staleTax.balances['16'], after: staleAllowance['16'],
  reason: 'allowance', createdAt: '2026-09-03T02:46:00.000Z',
});
const taxMerged = mergeConcurrentCurrencyUpdatesIntoSettings(remote, {
  currencyBalances: { 16: staleAllowance['16'] },
  currencyHistory: taxHistory,
  studentEconomy: { 16: staleState },
});
const currentTax = collectCurrencyTax({ 16: opened.wallet }, { 16: opened.state });
const currentAllowance = grantWeeklyCurrencyAllowance(currentTax.balances);
const latestCycle = createWeeklyCurrencyCycle(remote, '2026-09-03T02:45:00.000Z', '2026-09-03T02:46:00.000Z');
const taxPass = latestCycle.balances['16'] === currentAllowance['16']
  && latestCycle.economy['16'].deposit === currentTax.economy['16'].deposit;

let resetError = '';
try {
  mergeConcurrentCurrencyUpdatesIntoSettings(remote, {
    currencyBalances: { 16: 100 },
    currencyHistory: appendCurrencyHistoryEntry({}, {
      id: 'qa-reset', studentNumber: 16, before: 289, after: 100,
      reason: 'reset', createdAt: '2026-09-03T02:47:00.000Z',
    }),
    studentEconomy: { 16: staleState },
  });
} catch (error) {
  resetError = error instanceof Error ? error.message : String(error);
}

console.log(JSON.stringify({
  scenario: 'teacher tax/reset racing a 200-goma deposit',
  tax: {
    rawMergeWallet: taxMerged.currencyBalances['16'],
    cycleWallet: latestCycle.balances['16'],
    expectedWalletUsingRemoteEconomy: currentAllowance['16'],
    rawMergeDeposit: taxMerged.studentEconomy['16'].deposit,
    cycleDeposit: latestCycle.economy['16'].deposit,
    expectedDepositAfterTax: currentTax.economy['16'].deposit,
    verdict: taxPass ? 'PASS' : 'FAIL',
  },
  reset: {
    observedError: resetError || null,
    expectedError: null,
    verdict: resetError ? 'FAIL' : 'PASS',
  },
}, null, 2));
