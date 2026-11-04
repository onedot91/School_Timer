export const REWARD_AUDIT_INTERVAL_MS = 10 * 60_000;
/** The audit builds the whole classroom snapshot; give the screen's first reads the database first. */
export const REWARD_AUDIT_START_DELAY_MS = 30_000;
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
    if (!active || !started || !environment.visible() || pending || environment.now() - startedAt < REWARD_AUDIT_INTERVAL_MS - 5_000) return;
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
