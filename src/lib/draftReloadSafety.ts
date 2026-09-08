const checks = new Map<string, { actor: number; verify: () => boolean }>();

export const setDraftReloadCheck = (key: string, actor: number, verify: () => boolean): void => {
  checks.set(key, { actor, verify });
};
export const removeDraftReloadCheck = (key: string): void => { checks.delete(key); };
export const canReloadWithDrafts = (actor: number): boolean => {
  for (const check of checks.values()) {
    if (check.actor !== actor) continue;
    try { if (!check.verify()) return false; } catch { return false; }
  }
  return true;
};
