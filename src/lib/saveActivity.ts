// Counts saves that have started but not yet settled, so one indicator can show "saving" for every write path.
const listeners = new Set<() => void>();
const pendingKeys = new Set<string>();
let inFlight = 0;
let snapshot = 0;

const publish = () => {
  const next = inFlight + pendingKeys.size;
  if (next === snapshot) return;
  snapshot = next;
  listeners.forEach(listener => listener());
};

export const subscribeSaveActivity = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getSaveActivitySnapshot = () => snapshot;

/** Counts the work as one in-flight save until it settles, whether it succeeds or fails. */
export const trackSaveActivity = <T>(work: () => Promise<T>): Promise<T> => {
  inFlight += 1;
  publish();
  let result: Promise<T>;
  try { result = work(); } catch (error) { result = Promise.reject(error); }
  return result.finally(() => { inFlight -= 1; publish(); });
};

/** Marks a save that is scheduled but not sent yet (debounced edits), keyed so repeated calls stay one entry. */
export const setSaveActivityPending = (key: string, pending: boolean) => {
  if (pending) pendingKeys.add(key); else pendingKeys.delete(key);
  publish();
};
