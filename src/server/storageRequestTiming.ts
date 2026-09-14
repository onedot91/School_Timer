import { AsyncLocalStorage } from 'node:async_hooks';

interface StorageRequestTiming { calls: number; duration: number }
const timings = new AsyncLocalStorage<StorageRequestTiming>();

export const withStorageRequestTiming = <T>(run: (timing: StorageRequestTiming) => Promise<T>): Promise<T> => {
  const timing = { calls: 0, duration: 0 };
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
