export const INITIAL_LOAD_RETRY_DELAYS_MS: readonly number[] = [2000, 5000, 10000];

export type InitialLoadRetryOptions<T> = {
  load: () => Promise<T>;
  // True once the screen no longer needs this read (hydrated elsewhere or unmounted).
  isSettled: () => boolean;
  // Claims the shared read/save slot; false while another read or save owns it.
  acquire: () => boolean;
  release: () => void;
  onSuccess: (value: T) => void;
  onFinalFailure: (error: unknown) => void;
  onAttemptFailure?: (error: unknown, attempt: number) => void;
  delaysMs?: readonly number[];
  busyRetryMs?: number;
  random?: () => number;
  setTimer?: (callback: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
};

export type InitialLoadRetryHandle = { cancel: () => void };

// Read-only retry for the first shared-settings load: ±20% jitter keeps recovering screens from retrying in lockstep.
export const jitterRetryDelay = (delayMs: number, random: () => number = Math.random): number =>
  Math.round(delayMs * (0.8 + Math.min(Math.max(random(), 0), 1) * 0.4));

export const startInitialLoadWithRetry = <T>(options: InitialLoadRetryOptions<T>): InitialLoadRetryHandle => {
  const delays = options.delaysMs ?? INITIAL_LOAD_RETRY_DELAYS_MS;
  const busyRetryMs = options.busyRetryMs ?? 250;
  const random = options.random ?? Math.random;
  const setTimer = options.setTimer ?? ((callback: () => void, ms: number) => setTimeout(callback, ms));
  const clearTimer = options.clearTimer ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  let cancelled = false;
  let timer: unknown;
  let hasTimer = false;
  let lastError: unknown;

  const stopped = () => cancelled || options.isSettled();

  const schedule = (attempt: number, ms: number) => {
    hasTimer = true;
    timer = setTimer(() => {
      hasTimer = false;
      run(attempt);
    }, ms);
  };

  const scheduleNext = (failedAttempt: number) => {
    if (stopped()) return;
    if (failedAttempt >= delays.length) {
      options.onFinalFailure(lastError);
      return;
    }
    schedule(failedAttempt + 1, jitterRetryDelay(delays[failedAttempt], random));
  };

  const run = (attempt: number) => {
    if (stopped()) return;
    if (!options.acquire()) {
      // Wait for the current owner without spending an attempt; a manual retry cancels this chain instead.
      schedule(attempt, busyRetryMs);
      return;
    }
    let loading: Promise<T>;
    try {
      loading = options.load();
    } catch (error) {
      loading = Promise.reject(error);
    }
    void loading
      .then((value) => {
        options.release();
        // onSuccess may reject the row (e.g. missing settings); that counts as a failed attempt.
        if (!stopped()) options.onSuccess(value);
      }, (error: unknown) => {
        options.release();
        throw error;
      })
      .catch((error: unknown) => {
        lastError = error;
        options.onAttemptFailure?.(error, attempt);
        scheduleNext(attempt);
      });
  };

  run(0);

  return {
    cancel: () => {
      cancelled = true;
      if (hasTimer) clearTimer(timer);
      hasTimer = false;
    },
  };
};
