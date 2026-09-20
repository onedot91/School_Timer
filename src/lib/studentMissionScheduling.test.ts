import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

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
  assert.equal(calls, 1);
  assert.deepEqual(refreshes, [undefined], 'normal metadata refresh detects actual changes without forcing a full row');
  listeners.get('focus')?.();
  navigator.onLine = false;
  await advance(30_000);
  assert.equal(calls, 1, 'going offline while a retry is scheduled must prevent the request');
  navigator.onLine = true;
  listeners.get('online')?.();
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
