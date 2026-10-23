import { AsyncLocalStorage } from 'node:async_hooks';

export interface StorageRequestTiming { calls: number; duration: number; retries: number }
const timings = new AsyncLocalStorage<StorageRequestTiming>();

/** Nested callers (e.g. the legacy Netlify adapter around a handler) share the outer request's timing. */
export const withStorageRequestTiming = <T>(run: (timing: StorageRequestTiming) => Promise<T>): Promise<T> => {
  const current = timings.getStore();
  if (current) return run(current);
  const timing = { calls: 0, duration: 0, retries: 0 };
  return timings.run(timing, () => run(timing));
};

export const measureStorageRequest = async <T>(run: () => Promise<T>): Promise<T> => {
  const timing = timings.getStore();
  if (!timing) return run();
  const started = performance.now();
  timing.calls += 1;
  try { return await run(); }
  finally { timing.duration += performance.now() - started; }
};

export const countStorageRetry = (): void => {
  const timing = timings.getStore();
  if (timing) timing.retries += 1;
};

export const formatServerTiming = (appDuration: number, timing: StorageRequestTiming): string =>
  `app;dur=${appDuration.toFixed(1)}, storage;dur=${timing.duration.toFixed(1)};desc="${timing.calls} RPC"`
  + (timing.retries > 0 ? `, retry;desc="${timing.retries}"` : '');
