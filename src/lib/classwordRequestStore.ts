import { browserDraftStorage } from './featureInputDraft.js';
import { createStudentSaveDraftStore, type StudentSaveDraft } from './studentSaveDraft.js';
import { canonicalStorageJson, isStorageRecord } from './storageV2Codec.js';

type PendingPayload = { readonly body: Record<string, unknown>; readonly transportHash: boolean };
const stores = new WeakMap<Storage, ReturnType<typeof createStudentSaveDraftStore>>();
const unavailable = createStudentSaveDraftStore();
const storeFor = (storage: Storage | null) => {
  if (!storage) return unavailable;
  let store = stores.get(storage);
  if (!store) { store = storage === browserDraftStorage() ? createStudentSaveDraftStore() : createStudentSaveDraftStore({ storage }); stores.set(storage, store); }
  return store;
};
const keyFor = (actor: number, action: string): string => `school-timer-classword-request-v2:${actor}:${action}`;
const scopeFor = (actor: number, body: Record<string, unknown>) => {
  const { requestId: _requestId, expectedRevision: _revision, ...payload } = body;
  return { studentNumber: actor, feature: 'classword-request', entityId: canonicalStorageJson(payload) };
};
const legacyFingerprint = (body: Record<string, unknown>): string => {
  const { requestId: _id, expectedRevision: _revision, expectedTopic: _topic, expectedQuestionId: _question, expectedStudentNumber: _student, ...payload } = body;
  return canonicalStorageJson(payload);
};
const pendingPayload = (draft: StudentSaveDraft): PendingPayload | null => {
  const value = draft.payload;
  if (!isStorageRecord(value) || !isStorageRecord(value.body) || typeof value.body.action !== 'string' || typeof value.transportHash !== 'boolean') return null;
  return { body: value.body, transportHash: value.transportHash };
};
export const listClasswordRequests = async (storage: Storage | null, actor: number) => {
  const store = storeFor(storage);
  await store.ready();
  for (const action of ['save_entry', 'answer_quiz', 'delete_entry', 'save_quiz', 'delete_quiz', 'save_topic', 'delete_date_entries']) {
    const key = keyFor(actor, action);
    try {
      const raw = storage?.getItem(key);
      const legacy: unknown = JSON.parse(raw ?? 'null');
      if (!isStorageRecord(legacy) || typeof legacy.fingerprint !== 'string' || typeof legacy.requestId !== 'string') continue;
      const body: unknown = JSON.parse(legacy.fingerprint);
      if (!isStorageRecord(body) || body.action !== action) continue;
      const original = { ...body, ...(typeof legacy.expectedRevision === 'string' ? { expectedRevision: legacy.expectedRevision } : {}) };
      const imported = await store.importDurable({ version: 1, scope: scopeFor(actor, body), requestId: legacy.requestId,
        createdAt: new Date().toISOString(), payload: { body: original, transportHash: false } });
      if (imported.status !== 'invalid' && imported.durable && imported.draft.requestId === legacy.requestId && storage?.getItem(key) === raw) storage.removeItem(key);
    } catch { /* Keep unreadable legacy requests for a later recovery attempt. */ }
  }
  return store.list(actor).flatMap((draft) => {
    const pending = draft.scope.feature === 'classword-request' ? pendingPayload(draft) : null;
    return pending ? [{ draft, ...pending }] : [];
  });
};
export const prepareClasswordRequest = async (storage: Storage | null, actor: number, body: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const store = storeFor(storage);
  await store.ready();
  const pending = await listClasswordRequests(storage, actor);
  const existing = pending.find((entry) => entry.draft.requestId === body.requestId)
    ?? pending.find((entry) => (!entry.transportHash || entry.body.expectedStudentNumber === undefined) && legacyFingerprint(entry.body) === legacyFingerprint(body));
  if (existing) return { ...existing.body, requestId: existing.draft.requestId };
  const { requestId: _requestId, ...original } = body;
  const payload: Record<string, unknown> = JSON.parse(JSON.stringify(original));
  if (actor > 0 && (payload.action === 'save_entry' || payload.action === 'answer_quiz') && payload.expectedStudentNumber === undefined) payload.expectedStudentNumber = actor;
  const scope = scopeFor(actor, payload);
  if (!store.load(scope)) {
    try {
      const key = keyFor(actor, String(body.action));
      const raw = storage?.getItem(key);
      const legacy: unknown = JSON.parse(raw ?? 'null');
      if (isStorageRecord(legacy) && typeof legacy.fingerprint === 'string' && typeof legacy.requestId === 'string') {
        const previous: unknown = JSON.parse(legacy.fingerprint);
        if (isStorageRecord(previous) && scopeFor(actor, previous).entityId === scope.entityId) {
          const imported = await store.importDurable({ version: 1, scope, requestId: legacy.requestId, createdAt: new Date().toISOString(), payload: {
            body: { ...previous, ...(typeof legacy.expectedRevision === 'string' ? { expectedRevision: legacy.expectedRevision } : {}) }, transportHash: false,
          } });
          if (imported.status !== 'invalid' && imported.durable && imported.draft.requestId === legacy.requestId && storage?.getItem(key) === raw) storage.removeItem(key);
        }
      }
    } catch { /* A legacy storage error must retain the new request in the common memory fallback. */ }
  }
  const transportHash = actor > 0 && (payload.action === 'save_entry' || payload.action === 'answer_quiz');
  const saved = await store.saveDurable(scope, { body: payload, transportHash });
  if (saved.status === 'invalid') throw new Error('CLASSWORD_INVALID_REQUEST');
  const selected = pendingPayload(saved.draft);
  if (!selected) throw new Error('CLASSWORD_INVALID_REQUEST');
  return { ...selected.body, requestId: saved.draft.requestId };
};
export const classwordRequestTransportHash = async (storage: Storage | null, actor: number, requestId: unknown): Promise<boolean> => (
  (await listClasswordRequests(storage, actor)).find((pending) => pending.draft.requestId === requestId)?.transportHash ?? false
);
export const finishClasswordRequest = async (storage: Storage | null, actor: number, action: string, requestId: unknown): Promise<void> => {
  const pending = (await listClasswordRequests(storage, actor)).find((entry) => entry.draft.requestId === requestId && entry.body.action === action);
  if (pending) await storeFor(storage).confirmDurable(pending.draft.scope, pending.draft.requestId);
};
