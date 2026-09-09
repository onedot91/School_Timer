interface DraftReloadCheck {
  actor: number;
  verify: () => boolean;
  recoverText?: () => string;
}
const checks = new Map<string, DraftReloadCheck>();
const listeners = new Set<() => void>();
let revision = 0;
let listeningWindow: Window | null = null;
const isSafe = (check: DraftReloadCheck): boolean => {
  try { return check.verify(); } catch { return false; }
};
const beforeUnload = (event: BeforeUnloadEvent) => {
  if ([...checks.values()].every(isSafe)) return;
  event.preventDefault();
  event.returnValue = '';
};
const notify = () => {
  revision++;
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function' && listeningWindow !== window) {
    listeningWindow?.removeEventListener('beforeunload', beforeUnload);
    window.addEventListener('beforeunload', beforeUnload);
    listeningWindow = window;
  }
  for (const listener of listeners) listener();
};

export const setDraftReloadCheck = (key: string, actor: number, verify: () => boolean, recoverText?: () => string): void => {
  checks.set(key, { actor, verify, recoverText });
  notify();
};
export const removeDraftReloadCheck = (key: string): void => { if (checks.delete(key)) notify(); };
export const canReloadWithDrafts = (actor: number): boolean => (
  [...checks.values()].filter(check => check.actor === actor).every(isSafe)
);
export const canReloadAllDrafts = (): boolean => [...checks.values()].every(isSafe);
export const subscribeDraftReloadSafety = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const getDraftReloadSafetySnapshot = (): number => revision;
export const getUnsafeDraftRecoveryText = (actor: number): string => (
  [...checks.values()].filter(check => check.actor === actor && !isSafe(check)).flatMap(check => {
    try { const text = check.recoverText?.(); return text ? [text] : []; } catch { return []; }
  }).join('\n\n')
);
