import assert from 'node:assert/strict';
import test from 'node:test';
import { REWARD_AUDIT_INTERVAL_MS, startRewardAuditPolling } from './rewardAuditPolling.js';

test('자동 점검은 겹치지 않으며 화면 숨김·종료 시 중단하고 복귀 시 다시 조회한다', async () => {
  const visibilityEvents = new EventTarget(); let visible = true; let tick = () => {}; let cleared = false;
  const signals: AbortSignal[] = []; const pending: (() => void)[] = [];
  const refresh = (signal: AbortSignal) => { signals.push(signal); return new Promise<void>(resolve => { pending.push(resolve); }); };
  const stop = startRewardAuditPolling({ refresh, visible: () => visible, visibilityEvents, schedule: fn => { tick = fn; return () => { cleared = true; }; }, now: () => 100_000 });
  assert.equal(signals.length, 1); tick(); assert.equal(signals.length, 1);
  visible = false; visibilityEvents.dispatchEvent(new Event('visibilitychange')); assert.equal(signals[0].aborted, true);
  visible = true; visibilityEvents.dispatchEvent(new Event('visibilitychange')); assert.equal(signals.length, 2);
  pending.forEach(resolve => resolve()); await Promise.resolve(); await Promise.resolve();
  stop(); tick(); assert.equal(cleared, true); assert.equal(signals.length, 2);
});

test('창 전환만으로는 다시 점검하지 않고 10분 주기를 지킨다', async () => {
  const visibilityEvents = new EventTarget(); let now = 0; let tick = () => {};
  let calls = 0;
  const stop = startRewardAuditPolling({ refresh: async () => { calls += 1; now += 8_000; }, visible: () => true, visibilityEvents,
    schedule: fn => { tick = fn; return () => {}; }, now: () => now });
  await Promise.resolve(); await Promise.resolve(); assert.equal(calls, 1);
  now = 60_000; visibilityEvents.dispatchEvent(new Event('visibilitychange'));
  assert.equal(calls, 1, '1분 뒤 화면 복귀는 점검을 다시 시작하지 않는다');
  now = REWARD_AUDIT_INTERVAL_MS; tick(); assert.equal(calls, 2, '느린 점검 뒤에도 다음 주기를 건너뛰지 않는다');
  stop();
});
