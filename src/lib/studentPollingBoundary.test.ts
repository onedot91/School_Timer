import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import {
  STUDENT_FOREGROUND_SYNC_COOLDOWN_MS,
  STUDENT_SETTINGS_DEFAULT_SYNC_INTERVAL_MS,
  STUDENT_SETTINGS_SYNC_INTERVAL_MS,
} from './studentSettingsSync.js';

const source = readFileSync(new URL('../pages/AuctionPage.tsx', import.meta.url), 'utf8');
const start = source.indexOf('  useEffect(() => {\n    let lastForegroundRefreshAt = 0;');
const end = source.indexOf('\n  useEffect(', start + 1);
assert.ok(start >= 0 && end > start);
const effect = ts.transpile(source.slice(start, end), { target: ts.ScriptTarget.ES2022 });

const fixture = () => {
  let now = 0;
  let nextId = 0;
  let cleanup: (() => void) | undefined;
  let finishRead: (() => void) | undefined;
  let reading = false;
  const starts: number[] = [];
  const timers = new Map<number, { at: number; callback: () => void; interval?: number }>();
  const events = new Map<string, () => void>();
  const document = { visibilityState: 'visible', addEventListener: (key: string, fn: () => void) => events.set(key, fn),
    removeEventListener: (key: string) => events.delete(key) };
  const navigator = { onLine: true };
  const schedule = (callback: () => void, delay: number, interval?: number) => {
    timers.set(++nextId, { at: now + delay, callback, interval });
    return nextId;
  };
  runInNewContext(effect, {
    useEffect: (callback: () => () => void) => { cleanup = callback(); },
    window: { ...document, setTimeout: schedule, clearTimeout: (id: number) => timers.delete(id),
      setInterval: (callback: () => void, delay: number) => schedule(callback, delay, delay),
      clearInterval: (id: number) => timers.delete(id) },
    document, navigator, Date: { now: () => now },
    studentNumber: 1, SAVE_RECOVERED_EVENT: 'save-recovered', activeStudentView: 'store-auction',
    isStudentStoreView: () => true, STUDENT_SETTINGS_SYNC_INTERVAL_MS,
    STUDENT_SETTINGS_DEFAULT_SYNC_INTERVAL_MS, STUDENT_FOREGROUND_SYNC_COOLDOWN_MS,
    studentSettingsPollInterval: (interval: number) => interval + 200,
    refreshAuctionState: async () => {
      if (reading) return;
      reading = true;
      starts.push(now);
      await new Promise<void>(resolve => { finishRead = resolve; });
      reading = false;
    },
  });
  const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
  return {
    starts, timers, document, navigator,
    event: (name: string) => events.get(name)?.(),
    finish: async () => { finishRead?.(); await flush(); },
    stop: () => cleanup?.(),
    advance: async (time: number) => {
      while (true) {
        const next = [...timers].sort((a, b) => a[1].at - b[1].at).find(([, timer]) => timer.at <= time);
        if (!next) break;
        const [id, timer] = next;
        now = timer.at;
        if (timer.interval) timer.at += timer.interval;
        else timers.delete(id);
        timer.callback();
        await flush();
      }
      now = time;
    },
  };
};

test('느린 학생 조회는 완료 후 대기 간격을 보장하고 포커스 이벤트가 중복 polling을 만들지 않는다', async () => {
  const screen = fixture();
  await screen.advance(3_900);
  screen.event('focus');
  await screen.finish();
  await screen.advance(6_099);
  assert.deepEqual(screen.starts, [0]);
  await screen.advance(6_100);
  assert.deepEqual(screen.starts, [0, 6_100]);
  screen.stop();
  await screen.finish();
  assert.equal(screen.timers.size, 0, 'unmounted pending read must not restart polling');
});

test('숨김 및 오프라인에서는 조회하지 않고 복귀 시 갱신한 뒤 하나의 예약만 유지한다', async () => {
  const screen = fixture();
  await screen.finish();
  screen.document.visibilityState = 'hidden';
  await screen.advance(4_400);
  assert.deepEqual(screen.starts, [0]);
  screen.document.visibilityState = 'visible';
  screen.navigator.onLine = false;
  await screen.advance(6_600);
  assert.deepEqual(screen.starts, [0]);
  screen.navigator.onLine = true;
  screen.event('online');
  await screen.finish();
  assert.deepEqual(screen.starts, [0, 6_600]);
  assert.equal(screen.timers.size, 1);
  screen.stop();
  await screen.advance(20_000);
  assert.equal(screen.starts.length, 2);
});
