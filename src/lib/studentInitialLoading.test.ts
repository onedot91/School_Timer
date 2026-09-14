import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { shouldLoadFullStudentSettings, studentSettingsRetryDelay } from './studentSettingsSync';

const source = readFileSync(new URL('../pages/AuctionPage.tsx', import.meta.url), 'utf8');
const start = source.indexOf('  const refreshAuctionState = useCallback');
const end = source.indexOf('  const applyCompetitionSnapshot =', start);
assert.ok(start >= 0 && end > start);
const callbackSource = ts.transpileModule(source.slice(start, end) + '\nrefreshAuctionState;', {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;

const stamp = '2026-09-14T00:00:00.000Z';
const savedRow = { value: { currencyBalances: { 24: 321 }, currencyHistory: { 24: [{ id: 'saved-record' }] } }, updated_at: stamp };
const fixture = (read: () => Promise<unknown>, loaded = false) => {
  let now = 0;
  const state = { loading: !loaded, error: false, applied: [] as unknown[], reads: 0, metadataReads: 0 };
  const hasLoaded = { current: loaded };
  const lastUpdatedAt = { current: stamp as string | null };
  const callback: unknown = runInNewContext(callbackSource, {
    useCallback: (fn: unknown) => fn,
    isSupabaseSettingsEnabled: true,
    studentNumber: 24,
    hasLoadedSharedSettingsRef: hasLoaded,
    sharedSettingsUpdatedAtRef: lastUpdatedAt,
    isSharedSettingsRefreshInFlightRef: { current: false },
    pendingFullSettingsRefreshRef: { current: false },
    settingsReadFailuresRef: { current: 0 },
    nextSettingsReadAtRef: { current: 0 },
    Date: { now: () => now },
    studentSettingsRetryDelay: (failures: number, error: unknown) => studentSettingsRetryDelay(failures, error, () => 0),
    setIsLoading: (value: boolean) => { state.loading = value; },
    setHasSettingsLoadError: (value: boolean) => { state.error = value; },
    loadSharedSettingsRow: () => { state.reads += 1; return read(); },
    loadSharedSettingsUpdatedAt: async () => { state.metadataReads += 1; return stamp; },
    shouldLoadFullStudentSettings,
    getSaveRefreshVersion: () => 0,
    isSaveRefreshVersionCurrent: () => true,
    markSaveRefreshComplete: () => undefined,
    applySharedSettingsValue: (value: unknown) => { state.applied.push(value); return true; },
    storeStudentSettingsSnapshot: () => true,
    refreshLocalNumberBaseball: () => undefined,
    refreshLocalStudentSudoku: () => undefined,
    setStudentLifeSnapshot: () => undefined,
    console: { error: () => undefined },
  });
  return { state, hasLoaded, advance: (milliseconds: number) => { now += milliseconds; }, refresh: async (forceFull = false, manualRetry = forceFull) => {
    if (typeof callback !== 'function') throw new Error('Missing student refresh callback');
    await callback({ forceFull, manualRetry });
  } };
};

test('첫 입장은 캐시 시각이 같아도 전체 기록을 기다린 뒤 로딩을 종료한다', async () => {
  let resolveRead: ((value: unknown) => void) | undefined;
  const screen = fixture(() => new Promise(resolve => { resolveRead = resolve; }));
  const pending = screen.refresh();
  assert.equal(screen.state.reads, 1);
  assert.equal(screen.state.metadataReads, 0);
  assert.equal(screen.state.loading, true);
  assert.equal(screen.hasLoaded.current, false);
  resolveRead?.(savedRow);
  await pending;
  assert.deepEqual(screen.state.applied, [savedRow.value]);
  assert.equal(screen.hasLoaded.current, true);
  assert.equal(screen.state.loading, false);
});

test('첫 조회 실패는 빈 기록으로 처리하지 않고 재시도로 저장된 기록을 복구한다', async () => {
  let fails = true;
  const screen = fixture(async () => { if (fails) throw new Error('offline'); return savedRow; });
  await screen.refresh();
  assert.equal(screen.hasLoaded.current, false);
  assert.equal(screen.state.error, true);
  assert.equal(screen.state.loading, false);
  assert.deepEqual(screen.state.applied, []);
  fails = false;
  const retry = screen.refresh(true);
  assert.equal(screen.state.loading, true);
  await retry;
  assert.equal(screen.hasLoaded.current, true);
  assert.equal(screen.state.error, false);
  assert.deepEqual(screen.state.applied, [savedRow.value]);
});

test('초기 실패 후 자동 조회 중에는 오류 안내를 유지한다', async () => {
  let reads = 0;
  let resolveRead: ((value: unknown) => void) | undefined;
  const screen = fixture(async () => {
    if (++reads === 1) throw new Error('offline');
    return new Promise(resolve => { resolveRead = resolve; });
  });
  await screen.refresh();
  screen.advance(5_000);
  const retry = screen.refresh();
  assert.equal(screen.state.loading, false);
  assert.equal(screen.state.error, true);
  resolveRead?.(savedRow);
  await retry;
  assert.equal(screen.hasLoaded.current, true);
  assert.equal(screen.state.error, false);
});

test('null 조회 결과는 기본값으로 적용하지 않는다', async () => {
  const screen = fixture(async () => null);
  await screen.refresh();
  assert.equal(screen.hasLoaded.current, false);
  assert.equal(screen.state.error, true);
  assert.deepEqual(screen.state.applied, []);
});

test('백그라운드 조회 실패는 이미 불러온 기록을 유지한다', async () => {
  const screen = fixture(async () => { throw new Error('offline'); }, true);
  await screen.refresh(true);
  assert.equal(screen.hasLoaded.current, true);
  assert.equal(screen.state.loading, false);
  assert.equal(screen.state.error, true);
  assert.deepEqual(screen.state.applied, []);
});

test('초기 기록 확인 전에 화면을 열지 않고 캐시는 조회 성공으로 취급하지 않는다', () => {
  const cacheEffect = source.slice(source.indexOf('    const snapshot = loadStudentSettingsSnapshot(studentNumber);'), source.indexOf('    let lastForegroundRefreshAt = 0;'));
  assert.doesNotMatch(cacheEffect, /setIsLoading\(false\)|sharedSettingsUpdatedAtRef.current =|hasLoadedSharedSettingsRef.current = true/);
  assert.match(source, /if \(!hasLoadedSharedSettingsRef.current\) \{[\s\S]*학생 기록 불러오는 중[\s\S]*학생 기록을 불러오지 못했어요[\s\S]*onRetry=\{\(\) => void refreshAuctionState\(\{ forceFull: true, manualRetry: true \}\)\}/);
});

test('23명과 46명의 반복 접속·화면 복귀도 장애 중 조회를 계속 증폭하지 않는다', async () => {
  for (const count of [23, 46]) {
    const screens = Array.from({ length: count }, () => fixture(async () => { throw new Error('synthetic outage'); }));
    for (let second = 0; second <= 120; second += 2) {
      for (const screen of screens) {
        if (second > 0) screen.advance(2_000);
        await screen.refresh(true, false);
        await screen.refresh();
      }
    }
    assert.equal(screens.reduce((sum, screen) => sum + screen.state.reads, 0), count * 5);
    assert.ok(screens.every(screen => !screen.hasLoaded.current && screen.state.error && screen.state.applied.length === 0));
  }
});

test('실패 중 예약된 전체 조회는 즉시 반복하지 않고 대기 후 성공 시 정상 간격으로 복귀한다', async () => {
  let rejectRead: ((error: Error) => void) | undefined;
  let fail = true;
  const screen = fixture(() => fail ? new Promise((_resolve, reject) => { rejectRead = reject; }) : Promise.resolve(savedRow), true);
  const active = screen.refresh(true, false);
  await screen.refresh(true, false);
  rejectRead?.(new Error('synthetic outage'));
  await active;
  assert.equal(screen.state.reads, 1);
  fail = false;
  await screen.refresh(true, false);
  assert.equal(screen.state.reads, 1);
  screen.advance(5_000);
  await screen.refresh();
  assert.equal(screen.state.reads, 2);
  assert.equal(screen.state.error, false);
  await screen.refresh();
  assert.equal(screen.state.metadataReads, 1);
});

test('서버 Retry-After 동안 자동 요청은 대기하되 사용자 직접 재시도는 가능하다', async () => {
  let fail = true;
  const screen = fixture(async () => {
    if (fail) throw Object.assign(new Error('busy'), { retryAfterMs: 120_000 });
    return savedRow;
  });
  await screen.refresh();
  screen.advance(60_000);
  await screen.refresh(true, false);
  assert.equal(screen.state.reads, 1);
  fail = false;
  await screen.refresh(true);
  assert.equal(screen.state.reads, 2);
  assert.equal(screen.hasLoaded.current, true);
});
