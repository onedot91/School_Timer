import { createStudentSaveDraftStore, type StudentSaveDraftScope } from './studentSaveDraft.js';

export type FeatureDraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export const browserDraftStorage = (): FeatureDraftStorage | null => {
  try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; }
};

/** Legacy input stays available until its replacement and migration marker are durable. */
export const createFeatureInputDraftStore = <T>(parse: (value: unknown, scope: StudentSaveDraftScope) => T | null) => {
  const stores = new WeakMap<FeatureDraftStorage, ReturnType<typeof createStudentSaveDraftStore>>();
  const unavailable = createStudentSaveDraftStore();
  const hydrated = new WeakSet<ReturnType<typeof createStudentSaveDraftStore>>();
  const storeFor = (storage: FeatureDraftStorage | null) => {
    if (!storage) return unavailable;
    let store = stores.get(storage);
    if (!store) { store = storage === browserDraftStorage() ? createStudentSaveDraftStore() : createStudentSaveDraftStore({ storage }); stores.set(storage, store); }
    return store;
  };
  const markerScope = (scope: StudentSaveDraftScope) => ({ ...scope, feature: `${scope.feature}-legacy-import` });
  const migrate = (storage: FeatureDraftStorage | null, scope: StudentSaveDraftScope, legacy: () => unknown) => {
    const store = storeFor(storage);
    if (store.load(scope) || store.load(markerScope(scope))) return;
    let value: T | null = null;
    try { value = parse(legacy(), scope); } catch { return; }
    if (value !== null) store.save(scope, value);
  };
  const load = (storage: FeatureDraftStorage | null, scope: StudentSaveDraftScope, legacy: () => unknown) => {
    const store = storeFor(storage);
    let indexed = false;
    try { indexed = typeof window !== 'undefined' && Boolean(window.indexedDB) && storage === browserDraftStorage(); } catch { /* Use memory and legacy storage when IndexedDB is inaccessible. */ }
    if (hydrated.has(store) || !indexed) migrate(storage, scope, legacy);
    const saved = store.load(scope);
    if (!saved) return null;
    const value = parse(saved.draft.payload, scope);
    return value === null ? null : { value, version: saved.draft.requestId, durable: saved.durable };
  };
  const ready = async (storage: FeatureDraftStorage | null, scope: StudentSaveDraftScope, legacy: () => unknown) => {
    const store = storeFor(storage);
    await store.ready();
    hydrated.add(store);
    migrate(storage, scope, legacy);
    await store.flush();
    return load(storage, scope, legacy);
  };
  return {
    load, ready,
    settled: async (storage: FeatureDraftStorage | null, scope: StudentSaveDraftScope) => {
      const store = storeFor(storage);
      await store.flush();
      return store.load(scope)?.durable ?? true;
    },
    save: (storage: FeatureDraftStorage | null, scope: StudentSaveDraftScope, value: T) => {
      if (parse(value, scope) === null) return false;
      const saved = storeFor(storage).replace(scope, value);
      return saved.status !== 'invalid' && saved.durable;
    },
    confirm: async (storage: FeatureDraftStorage | null, scope: StudentSaveDraftScope, version: string) => {
      const store = storeFor(storage);
      await store.ready();
      if (store.load(scope)?.draft.requestId !== version) return false;
      // A durable marker prevents a legacy value from reappearing after confirmation.
      await store.saveDurable(markerScope(scope), { imported: true });
      const marker = store.load(markerScope(scope));
      if (!marker?.durable) return false;
      return store.confirmDurable(scope, version);
    },
  };
};
