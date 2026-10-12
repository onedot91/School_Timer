import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { ScriptTarget, transpileModule } from 'typescript';
import { AUCTION_ITEM_IDS, normalizeAuctionItems, normalizeAuctionBids, normalizeAuctionBidHistory, normalizeAuctionAwards, normalizeCurrencyBalances, normalizeCurrencyHistory, createWeeklyCurrencyCycle } from './currency.js';
import { normalizeStudentEconomyStates } from './studentEconomy.js';
import { StorageCommandError, type StorageCommandResult } from './storageCommandClient.js';
import { classifySaveFailure } from './saveFailure.js';
import { isStorageRecord } from './teacherStorageCommand.js';

const source = readFileSync(new URL('../pages/TimerPage.tsx', import.meta.url), 'utf8');
const start = source.indexOf('  const completeWeeklyAuctionCycle =');
const end = source.indexOf('  const addAuctionMission =', start);
const callbackSource = transpileModule(source.slice(start, end) + '\ncompleteWeeklyAuctionCycle;', {
  compilerOptions: { target: ScriptTarget.ES2022 },
}).outputText;

const fixture = (shared = true, localSave = true, snapshot: Record<string, unknown> = {
  currencyBalances: { '1': 100 }, currencyHistory: {}, studentEconomy: {}, studentStockMarket: {},
}) => {
  const state = { status: 'idle', message: '', busy: false, refreshPending: false, items: normalizeAuctionItems([{ id: 'lot', dayIndex: 0, name: '공책' }]), balanceCommits: 0 };
  const requests: unknown[] = [];
  let savedSnapshot: unknown;
  let resolveResponse: ((value: StorageCommandResult) => void) | undefined;
  let rejectResponse: ((error: Error) => void) | undefined;
  const response = new Promise<StorageCommandResult>((resolve, reject) => { resolveResponse = resolve; rejectResponse = reject; });
  const callback: unknown = runInNewContext(callbackSource, {
    isSupabaseSettingsEnabled: shared, crypto, AUCTION_ITEM_IDS,
    normalizeAuctionItems, normalizeAuctionBids, normalizeAuctionBidHistory, normalizeAuctionAwards,
    normalizeCurrencyBalances, normalizeCurrencyHistory, normalizeStudentEconomyStates, createWeeklyCurrencyCycle,
    classifySaveFailure, StorageCommandError, isStorageRecord,
    weeklyAuctionClosingRef: { current: false }, teacherRefreshPendingRef: { current: false },
    teacherSettingsBaseRef: { current: {} }, teacherSettingsPersistedBaseRef: { current: {} },
    lastSharedSettingsUpdatedAtRef: { current: null },
    currencyBalancesRef: { current: snapshot.currencyBalances }, currencyHistoryRef: { current: snapshot.currencyHistory },
    studentEconomyStates: snapshot.studentEconomy, studentStockMarket: snapshot.studentStockMarket,
    executeStorageCommand: (request: unknown) => { requests.push(request); return response; },
    setWeeklyAuctionCloseStatus: (value: string) => { state.status = value; },
    setWeeklyAuctionCloseMessage: (value: string) => { state.message = value; },
    setIsWeeklyAuctionClosing: (value: boolean) => { state.busy = value; },
    setTeacherRefreshPending: (value: boolean) => { state.refreshPending = value; },
    setAuctionItems: (value: typeof state.items) => { state.items = value; },
    commitCurrencyState: () => { state.balanceCommits += 1; },
    setStudentEconomyStates: () => undefined, setAuctionBids: () => undefined,
    setAuctionBidHistory: () => undefined, setAuctionAwards: () => undefined,
    setTemporaryVisibleAuctionItemIds: () => undefined, setPendingAwardItemId: () => undefined,
    setAwardPresentation: () => undefined, setCurrencyDeductionError: () => undefined,
    loadStoredStudentPetSnapshot: () => snapshot, storeStudentPetSnapshot: (value: unknown) => { savedSnapshot = value; return localSave; },
    reportSaveFailure: () => undefined,
  });
  if (typeof callback !== 'function') throw new Error('Missing weekly close callback');
  return { state, requests, saved: () => savedSnapshot, close: async () => { await callback(); },
    finish: (result: StorageCommandResult) => resolveResponse?.(result), fail: (error: Error) => rejectResponse?.(error) };
};

test('주간 마감 재클릭은 처리 중 요청을 중복 전송하지 않는다', async () => {
  const screen = fixture();
  const first = screen.close();
  const second = screen.close();
  screen.finish({ value: {}, updatedAt: '2026-10-09T00:00:00Z', result: { settled: true } });
  await Promise.all([first, second]);
  assert.equal(screen.requests.length, 1);
  assert.equal(screen.state.busy, false);
  assert.equal(screen.state.status, 'success');
  assert.match(screen.state.message, /마감.*완료/);
});

test('이미 정산한 주에는 추가 지급 없이 마감된 주임을 알린다', async () => {
  const screen = fixture();
  const pending = screen.close();
  screen.finish({ value: {}, updatedAt: '2026-10-09T00:00:00Z', result: { settled: false } });
  await pending;
  assert.match(screen.state.message, /이미.*마감/);
  assert.equal(screen.state.status, 'success');
});

test('저장 확정 후 화면 갱신 실패는 무반응 대신 갱신 대기를 표시한다', async () => {
  const screen = fixture();
  const pending = screen.close();
  screen.finish({ value: null, updatedAt: '2026-10-09T00:00:00Z', result: { settled: true }, refreshPending: true });
  await pending;
  assert.equal(screen.state.refreshPending, true);
  assert.match(screen.state.message, /마감.*완료.*다시 불러오기/);
  assert.equal(screen.state.balanceCommits, 0);
});

test('마감 오류는 경매 화면에 진단 정보와 다음 조치를 표시한다', async () => {
  const screen = fixture();
  const pending = screen.close();
  screen.fail(new StorageCommandError('STORAGE_CONFIRMATION_REQUIRED', 502, true));
  await pending;
  assert.equal(screen.state.status, 'error');
  assert.match(screen.state.message, /주간.*마감.*확인.*HTTP 502/);
  assert.match(screen.state.message, /최신 기록/);
  assert.equal(screen.state.balanceCommits, 0);
});

test('로컬 저장 실패는 마감 완료로 표시하거나 잔액을 변경하지 않는다', async () => {
  const screen = fixture(false, false);
  await screen.close();
  assert.equal(screen.state.status, 'error');
  assert.equal(screen.state.balanceCommits, 0);
  assert.equal(screen.state.items[0]?.name, '공책');
});

test('로컬 마감도 저장 후 완료 안내를 표시한다', async () => {
  const screen = fixture(false);
  await screen.close();
  assert.equal(screen.state.status, 'success');
  assert.equal(screen.state.balanceCommits, 1);
});

test('로컬 마감 버튼은 시세를 반영해 주식을 매각한 정산 결과를 저장한다', async () => {
  const screen = fixture(false, true, {
    currencyBalances: { '1': 20 }, currencyHistory: {},
    studentEconomy: { '1': { investments: {
      sunny: { investedAmount: 100, currentAmount: 100, lastSettledDateKey: '2026-01-01', lastChangeAmount: 0, lastStage: 'flat' },
    } } },
    studentStockMarket: { sunny: [{ dateKey: '2026-01-02', stage: 'rise', returnPercent: 20 }] },
  });
  await screen.close();
  const saved = screen.saved();
  assert.ok(isStorageRecord(saved));
  assert.equal(normalizeCurrencyBalances(saved.currencyBalances)['1'], 170);
  assert.deepEqual(normalizeStudentEconomyStates(saved.studentEconomy)['1'].investments, {});
  assert.deepEqual(normalizeCurrencyHistory(saved.currencyHistory)['1'].map(entry => entry.reason), ['allowance', 'tax', 'stock_trade']);
  assert.equal(screen.state.status, 'success');
});
