export const REWARD_AUDIT_INTERVAL_MS = 10 * 60_000;
/** The audit builds the whole classroom snapshot; give the screen's first reads the database first. */
export const REWARD_AUDIT_START_DELAY_MS = 30_000;
const KST_OFFSET_MS = 9 * 3_600_000;
/** Weekdays 08:00-16:00 in Korea. Under classroom load the audit only times out and adds to the stall. */
export const isRewardAuditQuietTime = (now: number): boolean => {
  const korea = new Date(now + KST_OFFSET_MS);
  const day = korea.getUTCDay(), hour = korea.getUTCHours();
  return day >= 1 && day <= 5 && hour >= 8 && hour < 16;
};
interface PollingEnvironment {
  readonly refresh: (signal: AbortSignal) => Promise<void>;
  readonly visible: () => boolean;
  readonly visibilityEvents: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
  readonly schedule: (tick: () => void) => () => void;
  readonly delayStart?: (start: () => void) => () => void;
  readonly now: () => number;
}
export const startRewardAuditPolling = (environment: PollingEnvironment): (() => void) => {
  let active = true, started = !environment.delayStart, startedAt = -Infinity;
  let pending: AbortController | null = null;
  const refresh = () => {
    // Each audit assembles the full classroom snapshot; window focus alone never starts another one.
    if (!active || !started || isRewardAuditQuietTime(environment.now()) || !environment.visible() || pending || environment.now() - startedAt < REWARD_AUDIT_INTERVAL_MS - 5_000) return;
    const request = new AbortController(), began = environment.now(); pending = request;
    void environment.refresh(request.signal).finally(() => {
      if (pending === request) { pending = null; if (!request.signal.aborted) startedAt = began; }
    });
  };
  const visibility = () => {
    if (!environment.visible()) { pending?.abort(); pending = null; }
    else refresh();
  };
  environment.visibilityEvents.addEventListener('visibilitychange', visibility);
  const clear = environment.schedule(refresh);
  const clearStart = environment.delayStart?.(() => { started = true; refresh(); });
  refresh();
  return () => { active = false; pending?.abort(); pending = null; clear(); clearStart?.(); environment.visibilityEvents.removeEventListener('visibilitychange', visibility); };
};
