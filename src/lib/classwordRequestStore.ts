import { createBrowserRequestId } from './requestId';
import { setDraftReloadCheck, removeDraftReloadCheck } from './draftReloadSafety.js';

type PendingRequest = { readonly fingerprint: string; readonly requestId: string; readonly expectedRevision?: string };
const memory = new Map<string, PendingRequest>();
const keyFor = (actor: number, action: string): string => `school-timer-classword-request-v2:${actor}:${action}`;

export const prepareClasswordRequest = (storage: Storage | null, actor: number, body: Record<string, unknown>): Record<string, unknown> => {
  const { requestId: _requestId, expectedRevision, ...payload } = body;
  const fingerprint = JSON.stringify(payload);
  const key = keyFor(actor, String(body.action));
  let pending = memory.get(key);
  try {
    const value: unknown = JSON.parse(storage?.getItem(key) ?? 'null');
    if (value && typeof value === 'object') {
      const storedFingerprint: unknown = Reflect.get(value, 'fingerprint');
      const storedRequestId: unknown = Reflect.get(value, 'requestId');
      const storedRevision: unknown = Reflect.get(value, 'expectedRevision');
      if (typeof storedFingerprint === 'string' && typeof storedRequestId === 'string' && storedRequestId.length >= 8 && storedRequestId.length <= 160) {
        pending = { fingerprint: storedFingerprint, requestId: storedRequestId, ...(typeof storedRevision === 'string' ? { expectedRevision: storedRevision } : {}) };
      }
    }
  } catch { pending = memory.get(key); }
  if (!pending || pending.fingerprint !== fingerprint) pending = {
    fingerprint, requestId: createBrowserRequestId(), ...(typeof expectedRevision === 'string' ? { expectedRevision } : {}),
  };
  memory.set(key, pending);
  const serialized = JSON.stringify(pending);
  setDraftReloadCheck(key, actor, () => storage?.getItem(key) === serialized);
  try { storage?.setItem(key, JSON.stringify(pending)); } catch { return { ...payload, requestId: pending.requestId, ...(pending.expectedRevision ? { expectedRevision: pending.expectedRevision } : {}) }; }
  return { ...payload, requestId: pending.requestId, ...(pending.expectedRevision ? { expectedRevision: pending.expectedRevision } : {}) };
};

export const finishClasswordRequest = (storage: Storage | null, actor: number, action: string, requestId: unknown): void => {
  const key = keyFor(actor, action);
  if (memory.get(key)?.requestId !== requestId) return;
  memory.delete(key);
  removeDraftReloadCheck(key);
  try { storage?.removeItem(key); } catch { return; }
};
