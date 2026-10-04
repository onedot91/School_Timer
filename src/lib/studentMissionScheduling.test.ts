import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { studentSettingsBurstDelay } from './studentSettingsSync.js';

const source = readFileSync(new URL('../pages/AuctionPage.tsx', import.meta.url), 'utf8');
const start = source.lastIndexOf('  useEffect(() => {', source.indexOf('    const syncWeeklyMission = async'));
const end = source.indexOf('  }, [studentNumber]);', start) + '  }, [studentNumber]);'.length;
const effect = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

test('보상 확인은 첫 기록 조회 뒤 실행하며 성공해도 전체 조회를 강제하지 않는다', async () => {
  let now = 0, calls = 0;
  const timers = new Map<number, { at: number; run: () => void }>();
  const listeners = new Map<string, () => void>();
  const loaded = { current: false }, navigator = { onLine: true };
  const refreshes: unknown[] = [];
  let id = 0;
  let cleanup = () => {};
  const events = { addEventListener: (key: string, run: () => void) => listeners.set(key, run), removeEventListener: (key: string) => listeners.delete(key) };
  runInNewContext(effect, {
    useEffect: (run: () => () => void) => { cleanup = run(); },
    window: { ...events, setTimeout: (run: () => void, ms: number) => { timers.set(++id, { at: now + ms, run }); return id; }, clearTimeout: (key: number) => timers.delete(key) },
    document: { ...events, visibilityState: 'visible' }, navigator,
    Date: { now: () => now }, Math: { random: () => 0, max: Math.max, min: Math.min },
    studentSettingsBurstDelay: (student: number) => studentSettingsBurstDelay(student, () => 0),
    isSupabaseSettingsEnabled: true, hasLoadedSharedSettingsRef: loaded, studentNumber: 1,
    syncWeeklyMissions: async () => { calls++; return { missions: [] }; },
    setWeeklyMissionStatuses: () => {}, setHasWeeklyMissionSyncError: () => {},
    createWeeklyMissionStatuses: () => ({}), getWeeklyMissionStatus: () => 'incomplete', WEEKLY_MISSION_TYPES: [],
    refreshAuctionState: async (options: unknown) => { refreshes.push(options); },
  });
  const advance = async (ms: number) => {
    now += ms;
    for (const [key, timer] of [...timers]) if (timer.at <= now) { timers.delete(key); timer.run(); }
    await new Promise(resolve => setImmediate(resolve));
  };
  assert.equal(calls, 0);
  await advance(1_500);
  assert.equal(calls, 0, 'an unresolved initial read must not start the reward API');
  loaded.current = true;
  await advance(2_000);
  await advance(0);
  assert.equal(calls, 1);
  assert.deepEqual(refreshes, [undefined], 'normal metadata refresh detects actual changes without forcing a full row');
  listeners.get('focus')?.();
  navigator.onLine = false;
  await advance(30_000);
  assert.equal(calls, 1, 'going offline while a retry is scheduled must prevent the request');
  navigator.onLine = true;
  listeners.get('online')?.();
  await advance(0);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 2);
  listeners.get('focus')?.();
  await advance(5_000);
  assert.equal(calls, 2, 'focus must not repeat settlement after only five seconds');
  listeners.get('school-timer-newspaper-change')?.();
  await advance(5_000);
  assert.equal(calls, 3, 'new evidence must shorten a previously scheduled foreground wait');
  cleanup();
  assert.equal(timers.size, 0);
  assert.equal(listeners.size, 0);
});

test('23명 보상 확인은 첫 접속과 장시간 대기 후 복귀에도 동시에 시작하지 않는다', async () => {
  const screens = Array.from({ length: 23 }, (_, index) => {
    let now = 0, id = 0;
    const starts: number[] = [];
    const timers = new Map<number, { at: number; run: () => void }>();
    const listeners = new Map<string, () => void>();
    let cleanup = () => {};
    const events = { addEventListener: (key: string, run: () => void) => listeners.set(key, run), removeEventListener: (key: string) => listeners.delete(key) };
    runInNewContext(effect, {
      useEffect: (run: () => () => void) => { cleanup = run(); },
      window: { ...events, setTimeout: (run: () => void, ms: number) => { timers.set(++id, { at: now + ms, run }); return id; }, clearTimeout: (key: number) => timers.delete(key) },
      document: { ...events, visibilityState: 'visible' }, navigator: { onLine: true },
      Date: { now: () => now }, Math: { random: () => 0, max: Math.max, min: Math.min },
      studentSettingsBurstDelay: (student: number) => studentSettingsBurstDelay(student, () => 0),
      isSupabaseSettingsEnabled: true, hasLoadedSharedSettingsRef: { current: true }, studentNumber: index + 1,
      syncWeeklyMissions: async () => { starts.push(now); return { missions: [] }; },
      setWeeklyMissionStatuses: () => {}, setHasWeeklyMissionSyncError: () => {},
      createWeeklyMissionStatuses: () => ({}), getWeeklyMissionStatus: () => 'incomplete', WEEKLY_MISSION_TYPES: [],
      refreshAuctionState: async () => {},
    });
    return { starts, cleanup, focus: () => listeners.get('focus')?.(), advance: async (time: number) => {
      for (const [key, timer] of [...timers]) if (timer.at <= time) {
        now = timer.at; timers.delete(key); timer.run();
        await new Promise(resolve => setImmediate(resolve));
      }
      now = time;
    } };
  });
  try {
    await Promise.all(screens.map(screen => screen.advance(5_000)));
    assert.ok(new Set(screens.map(screen => screen.starts[0])).size > 1, 'initial settlement must not align all 23 students');
    await Promise.all(screens.map(screen => screen.advance(60_000)));
    screens.forEach(screen => { screen.focus(); screen.focus(); });
    assert.ok(screens.every(screen => screen.starts.length === 1), 'foreground events must reserve one delayed settlement');
    await Promise.all(screens.map(screen => screen.advance(62_000)));
    assert.ok(screens.every(screen => screen.starts.length === 2));
    assert.ok(new Set(screens.map(screen => screen.starts[1])).size > 1);
  } finally { screens.forEach(screen => screen.cleanup()); }
});
