export const REWARD_AUDIT_INTERVAL_MS = 10 * 60_000;
interface PollingEnvironment {
  readonly refresh: (signal: AbortSignal) => Promise<void>;
  readonly visible: () => boolean;
  readonly events: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
  readonly visibilityEvents: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
  readonly schedule: (tick: () => void) => () => void;
  readonly now: () => number;
}
export const startRewardAuditPolling = (environment: PollingEnvironment): (() => void) => {
  let active = true, completedAt = -Infinity;
  let pending: AbortController | null = null;
  const refresh = () => {
    if (!active || !environment.visible() || pending || environment.now() - completedAt < 60_000) return;
    const request = new AbortController(); pending = request;
    void environment.refresh(request.signal).finally(() => {
      if (pending === request) { pending = null; if (!request.signal.aborted) completedAt = environment.now(); }
    });
  };
  const visibility = () => {
    if (!environment.visible()) { pending?.abort(); pending = null; }
    else refresh();
  };
  environment.visibilityEvents.addEventListener('visibilitychange', visibility);
  environment.events.addEventListener('focus', refresh);
  const clear = environment.schedule(refresh);
  refresh();
  return () => { active = false; pending?.abort(); pending = null; clear(); environment.visibilityEvents.removeEventListener('visibilitychange', visibility); environment.events.removeEventListener('focus', refresh); };
};
