import assert from 'node:assert/strict';
import test from 'node:test';
import { startRewardAuditPolling } from './rewardAuditPolling.js';

test('자동 점검은 겹치지 않으며 화면 숨김·종료 시 중단하고 복귀 시 다시 조회한다', async () => {
  const events = new EventTarget(), visibilityEvents = new EventTarget(); let visible = true; let tick = () => {}; let cleared = false;
  const signals: AbortSignal[] = []; const pending: (() => void)[] = [];
  const refresh = (signal: AbortSignal) => { signals.push(signal); return new Promise<void>(resolve => { pending.push(resolve); }); };
  const stop = startRewardAuditPolling({ refresh, visible: () => visible, events, visibilityEvents, schedule: fn => { tick = fn; return () => { cleared = true; }; }, now: () => 100_000 });
  assert.equal(signals.length, 1); tick(); assert.equal(signals.length, 1);
  visible = false; visibilityEvents.dispatchEvent(new Event('visibilitychange')); assert.equal(signals[0].aborted, true);
  visible = true; visibilityEvents.dispatchEvent(new Event('visibilitychange')); assert.equal(signals.length, 2);
  pending.forEach(resolve => resolve()); await Promise.resolve(); await Promise.resolve();
  stop(); tick(); assert.equal(cleared, true); assert.equal(signals.length, 2);
});
