import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { shouldLoadFullStudentSettings } from './studentSettingsSync';

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
  return { state, hasLoaded, refresh: async (forceFull = false) => {
    if (typeof callback !== 'function') throw new Error('Missing student refresh callback');
    await callback({ forceFull });
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
  assert.match(source, /if \(!hasLoadedSharedSettingsRef.current\) \{[\s\S]*학생 기록 불러오는 중[\s\S]*학생 기록을 불러오지 못했어요[\s\S]*onRetry=\{\(\) => void refreshAuctionState\(\{ forceFull: true \}\)\}/);
});
