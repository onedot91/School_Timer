import { deferSaveFailure, getSaveFailureFeature, reportDeferredSaveFailure, resolveDeferredSaveFailure } from './saveFailureClient.js';
import { appDataMode } from './dataMode.js';
import { captureStorageResponseContext, isStorageResponseContextCurrent } from './storageResponseOrder.js';

export interface RecoveryRequest {
  readonly id: string;
  readonly actor: number;
  readonly feature: string;
  readonly createdAt: string;
  readonly mode: 'automatic' | 'confirm-only';
  readonly contextKey?: string;
}
export interface SaveRecoveryAdapter {
  readonly id: string;
  readonly list: (actor: number) => Promise<readonly RecoveryRequest[]>;
  readonly confirm: (request: RecoveryRequest) => Promise<boolean>;
  readonly retry: (request: RecoveryRequest) => Promise<void>;
  readonly eligible: (request: RecoveryRequest) => boolean;
}
export interface SaveRecoveryStatus {
  readonly pending: number;
  readonly recovering: boolean;
  readonly paused: boolean;
  readonly refreshPending: boolean;
}
export interface SaveRecoveryPassResult {
  readonly pending: number;
  readonly failed: boolean;
  readonly retryAfterMs: number;
  readonly failedRequests: readonly RecoveryRequest[];
  readonly waitingMs: number;
  readonly attempted: boolean;
}
const adapters = new Map<string, SaveRecoveryAdapter>();
const statuses = new Map<number, SaveRecoveryStatus>();
const refreshVersions = new Map<number, number>();
const listeners = new Set<() => void>();
const wakeListeners = new Set<(resume: boolean) => void>();
const queues = new Map<number, Promise<unknown>>();
const activeRecoveryPasses = new Map<number, Promise<SaveRecoveryPassResult>>();
let revision = 0;
const emptyStatus: SaveRecoveryStatus = { pending: 0, recovering: false, paused: false, refreshPending: false };
export const SAVE_RECOVERED_EVENT = 'school-timer-save-recovered';
export const subscribeSaveRecovery = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getSaveRecoverySnapshot = () => revision;
export const getSaveRecoveryStatus = (actor: number): SaveRecoveryStatus => statuses.get(actor) ?? emptyStatus;
const publish = (actor: number, patch: Partial<SaveRecoveryStatus>) => {
  statuses.set(actor, { ...getSaveRecoveryStatus(actor), ...patch });
  revision += 1;
  listeners.forEach(listener => listener());
};
export const notifySaveRecovery = (resume = false) => { wakeListeners.forEach(listener => listener(resume)); };
export const registerSaveRecoveryAdapter = (adapter: SaveRecoveryAdapter) => {
  adapters.set(adapter.id, adapter);
  notifySaveRecovery();
  return () => { if (adapters.get(adapter.id) === adapter) adapters.delete(adapter.id); };
};
export const serializeStudentSave = <T>(actor: number, work: () => Promise<T>): Promise<T> => {
  const run = (queues.get(actor) ?? Promise.resolve()).then(work, work);
  queues.set(actor, run);
  void run.finally(() => { if (queues.get(actor) === run) queues.delete(actor); }).catch(() => undefined);
  return run;
};
export const getSaveRefreshVersion = (actor: number): number => refreshVersions.get(actor) ?? 0;
export const isSaveRefreshVersionCurrent = (actor: number, version: number): boolean => getSaveRefreshVersion(actor) === version;
export const markSaveRefreshPending = (actor: number) => {
  refreshVersions.set(actor, getSaveRefreshVersion(actor) + 1);
  publish(actor, { refreshPending: true });
};
export const markSaveRefreshComplete = (actor: number, version: number) => {
  if (!isSaveRefreshVersionCurrent(actor, version)) return;
  if (getSaveRecoveryStatus(actor).refreshPending) publish(actor, { refreshPending: false });
};
export const announceSaveRecovered = (actor: number) => {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SAVE_RECOVERED_EVENT, { detail: { actor } }));
};
export const SAVE_RECOVERY_DELAY_PREFIX = 'school-timer-save-recovery-not-before-v1:';
const recoveryDeadlines = new Map<string, number>();
const deadlineKey = (actor: number, requestId: string): string | null => (
  Number.isInteger(actor) && actor >= 0 && actor <= 23 && typeof requestId === 'string' && requestId.length > 0 && requestId.length <= 160
    ? `${SAVE_RECOVERY_DELAY_PREFIX}${actor}:${encodeURIComponent(requestId)}` : null
);
const readRecoveryDeadline = (key: string): number => {
  let deadline = recoveryDeadlines.get(key) ?? 0;
  try {
    const stored = typeof window === 'undefined' ? null : window.localStorage.getItem(key);
    const value = stored === null ? 0 : Number(stored);
    if (Number.isSafeInteger(value) && value > 0) deadline = Math.max(deadline, value);
  } catch { /* A blocked device store must not shorten a known server deadline. */ }
  if (deadline > 0) recoveryDeadlines.set(key, deadline);
  return deadline;
};

/** Persist server Retry-After per actor and immutable request, including the first foreground failure. */
export const deferSaveRecoveryUntil = (actor: number, requestId: string, delayMs: number): void => {
  const key = deadlineKey(actor, requestId);
  if (!key || !Number.isFinite(delayMs) || delayMs <= 0) return;
  const deadline = Math.max(readRecoveryDeadline(key), Date.now() + Math.ceil(delayMs));
  if (!Number.isSafeInteger(deadline)) return;
  recoveryDeadlines.set(key, deadline);
  try { if (typeof window !== 'undefined') window.localStorage.setItem(key, String(deadline)); }
  catch { /* Keep the server deadline in memory when local persistence is unavailable. */ }
};

/** Manual retries must also check this delay before issuing another POST. Receipt reads remain safe. */
export const getSaveRecoveryDelay = (actor: number, requestId: string): number => {
  const key = deadlineKey(actor, requestId);
  return key ? Math.max(0, readRecoveryDeadline(key) - Date.now()) : 0;
};
const clearSaveRecoveryDelay = (actor: number, requestId: string) => {
  const key = deadlineKey(actor, requestId);
  if (!key) return;
  recoveryDeadlines.delete(key);
  try { if (typeof window !== 'undefined') window.localStorage.removeItem(key); } catch { /* An expired deadline never changes a committed result. */ }
};
export const recoveryRetryDelay = (attempt: number, retryAfterMs = 0, random = Math.random): number => (
  Math.max(retryAfterMs, Math.min(30_000, 1000 * 2 ** Math.max(0, attempt - 1) * (0.8 + random() * 0.4)))
);
export const canRetrySaveError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  if (['SESSION_CHANGED', 'SAVE_DRAFT_PENDING', 'STUDENT_EDIT_CONFLICT', 'STUDENT_SAVE_CONTEXT_CHANGED'].includes(error.message)) return false;
  const status: unknown = Reflect.get(error, 'status');
  return status === undefined || status === 408 || status === 429 || (typeof status === 'number' && status >= 500);
};
const runSaveRecoveryPassInternal = async (actor: number, isCurrent: () => boolean): Promise<SaveRecoveryPassResult> => {
  let pending = 0, retryAfterMs = 0, waitingMs = 0, failed = false, attempted = false;
  const failedRequests: RecoveryRequest[] = [];
  publish(actor, { recovering: true });
  try {
    for (const adapter of adapters.values()) {
      const requests = await adapter.list(actor);
      for (const request of requests) {
        if (!isCurrent()) return { pending, failed: false, retryAfterMs, failedRequests, waitingMs, attempted };
        if (request.actor !== actor) continue;
        const remainingDelay = getSaveRecoveryDelay(actor, request.id);
        if (remainingDelay > 0) {
          pending += 1;
          waitingMs = waitingMs === 0 ? remainingDelay : Math.min(waitingMs, remainingDelay);
          continue;
        }
        try {
          attempted = true;
          if (await adapter.confirm(request)) { clearSaveRecoveryDelay(actor, request.id); resolveDeferredSaveFailure(actor, request.id); announceSaveRecovered(actor); continue; }
          if (!isCurrent()) return { pending, failed: false, retryAfterMs, failedRequests, waitingMs, attempted };
          if (request.mode === 'automatic' && adapter.eligible(request)) {
            // A concurrent foreground request can receive Retry-After while this receipt read is in flight.
            const delayAfterReceipt = getSaveRecoveryDelay(actor, request.id);
            if (delayAfterReceipt > 0) {
              pending += 1;
              waitingMs = waitingMs === 0 ? delayAfterReceipt : Math.min(waitingMs, delayAfterReceipt);
              continue;
            }
            await adapter.retry(request);
            clearSaveRecoveryDelay(actor, request.id);
            resolveDeferredSaveFailure(actor, request.id);
            announceSaveRecovered(actor);
          } else pending += 1;
        } catch (error) {
          pending += 1;
          if (request.mode === 'automatic' && adapter.eligible(request) && canRetrySaveError(error)) {
            failed = true;
            failedRequests.push(request);
            deferSaveFailure(getSaveFailureFeature(), error, actor, { requestId: request.id, stage: 'recovery' });
          } else reportDeferredSaveFailure(actor, request.id, { stage: 'recovery' });
          const delay: unknown = error instanceof Error ? Reflect.get(error, 'retryAfterMs') : undefined;
          if (typeof delay === 'number' && Number.isFinite(delay) && delay > 0) {
            deferSaveRecoveryUntil(actor, request.id, delay);
            retryAfterMs = Math.max(retryAfterMs, delay);
          }
        }
      }
    }
  } catch { failed = true; attempted = true; pending += 1; }
  finally { publish(actor, { pending, recovering: false }); }
  return { pending, failed, retryAfterMs, failedRequests, waitingMs, attempted };
};

export const runSaveRecoveryPass = (actor: number, isCurrent: () => boolean = () => true): Promise<SaveRecoveryPassResult> => {
  const active = activeRecoveryPasses.get(actor);
  if (active) return active;
  const pass = runSaveRecoveryPassInternal(actor, isCurrent);
  activeRecoveryPasses.set(actor, pass);
  void pass.then(() => {
    if (activeRecoveryPasses.get(actor) === pass) activeRecoveryPasses.delete(actor);
  }, () => {
    if (activeRecoveryPasses.get(actor) === pass) activeRecoveryPasses.delete(actor);
  });
  return pass;
};

export const requestSaveRecovery = (actor: number): Promise<SaveRecoveryPassResult> => runSaveRecoveryPass(actor);

export const startSaveRecovery = (actor: number): (() => void) => {
  if (typeof window === 'undefined' || appDataMode !== 'production') return () => undefined;
  const context = captureStorageResponseContext();
  let stopped = false, running = false, wakeRequested = false, attempts = 0, timer: ReturnType<typeof setTimeout> | undefined;
  const current = () => !stopped && isStorageResponseContextCurrent(context);
  const pass = async () => {
    timer = undefined;
    if (!current() || running || !navigator.onLine) return;
    running = true;
    try {
      const result = await runSaveRecoveryPass(actor, current);
      if (!current()) return;
      if (result.attempted) attempts = result.failed ? attempts + 1 : 0;
      publish(actor, { paused: result.pending > 0 && ((!result.failed && result.waitingMs === 0) || attempts >= 5) });
      if (attempts >= 5) for (const request of result.failedRequests) reportDeferredSaveFailure(actor, request.id, { retryCount: attempts, stage: 'recovery' });
      if (attempts < 5) {
        if (result.failed) timer = setTimeout(() => void pass(), Math.min(2_147_483_647, recoveryRetryDelay(attempts, result.retryAfterMs)));
        else if (result.waitingMs > 0) timer = setTimeout(() => void pass(), Math.min(2_147_483_647, result.waitingMs));
      }
    } finally {
      running = false;
      if (wakeRequested && !timer && attempts < 5 && current()) {
        wakeRequested = false;
        timer = setTimeout(() => void pass(), 250);
      }
    }
  };
  const wake = () => {
    if (!current()) return;
    attempts = 0;
    if (running) { wakeRequested = true; return; }
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void pass(), 250 + Math.random() * 1000);
  };
  const requestWake = (resume: boolean) => {
    if (resume) { wake(); return; }
    if (!current() || attempts >= 5) return;
    if (running) { wakeRequested = true; return; }
    if (!timer) timer = setTimeout(() => void pass(), 250);
  };
  const focus = () => { if (document.visibilityState !== 'hidden') wake(); };
  window.addEventListener('online', wake);
  window.addEventListener('focus', focus);
  document.addEventListener('visibilitychange', focus);
  wakeListeners.add(requestWake);
  wake();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    wakeListeners.delete(requestWake);
    window.removeEventListener('online', wake);
    window.removeEventListener('focus', focus);
    document.removeEventListener('visibilitychange', focus);
  };
};
