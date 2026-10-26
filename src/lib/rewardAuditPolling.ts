export const REWARD_AUDIT_INTERVAL_MS = 10 * 60_000;
interface PollingEnvironment {
  readonly refresh: (signal: AbortSignal) => Promise<void>;
  readonly visible: () => boolean;
  readonly visibilityEvents: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
  readonly schedule: (tick: () => void) => () => void;
  readonly now: () => number;
}
export const startRewardAuditPolling = (environment: PollingEnvironment): (() => void) => {
  let active = true, startedAt = -Infinity;
  let pending: AbortController | null = null;
  const refresh = () => {
    // Each audit assembles the full classroom snapshot; window focus alone never starts another one.
    if (!active || !environment.visible() || pending || environment.now() - startedAt < REWARD_AUDIT_INTERVAL_MS - 5_000) return;
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
  refresh();
  return () => { active = false; pending?.abort(); pending = null; clear(); environment.visibilityEvents.removeEventListener('visibilitychange', visibility); };
};
