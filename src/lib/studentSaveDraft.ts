import { createBrowserRequestId } from './requestId.js';
import { setDraftReloadCheck, removeDraftReloadCheck } from './draftReloadSafety.js';
import { createStudentDraftDatabase, type StudentDraftDatabase, type StudentDraftDatabaseEntry } from './studentDraftDatabase.js';

export interface StudentSaveDraftScope {
  readonly studentNumber: number;
  readonly feature: string;
  readonly entityId: string;
}

export type StudentSaveDraftPayload = null | boolean | number | string
  | readonly StudentSaveDraftPayload[] | { readonly [key: string]: StudentSaveDraftPayload };

export interface StudentSaveDraft {
  readonly version: 1;
  readonly scope: StudentSaveDraftScope;
  readonly requestId: string;
  readonly createdAt: string;
  readonly payload: StudentSaveDraftPayload;
}

export interface LoadedStudentSaveDraft {
  readonly draft: StudentSaveDraft;
  readonly durable: boolean;
}

export type StudentSaveDraftResult =
  | ({ readonly status: 'saved' | 'existing' | 'payload_changed' } & LoadedStudentSaveDraft)
  | { readonly status: 'invalid' };

export type StudentSaveDraftImportResult = StudentSaveDraftResult
  | ({ readonly status: 'already_migrated' } & LoadedStudentSaveDraft);

type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & Partial<Pick<Storage, 'key' | 'length'>>;
interface StudentSaveDraftOptions {
  readonly storage?: DraftStorage | null;
  readonly database?: StudentDraftDatabase | null;
  readonly createRequestId?: () => string;
  readonly now?: () => Date;
}

const PREFIX = 'school-timer-student-save-draft-v1:';
const validScope = (scope: StudentSaveDraftScope): boolean => (
  !!scope && typeof scope === 'object' && Number.isInteger(scope.studentNumber) && scope.studentNumber >= 0 && scope.studentNumber <= 23
  && typeof scope.feature === 'string' && scope.feature.length > 0
  && typeof scope.entityId === 'string' && scope.entityId.length > 0
);
const keyFor = (scope: StudentSaveDraftScope): string => (
  `${PREFIX}${encodeURIComponent(JSON.stringify([scope.studentNumber, scope.feature, scope.entityId]))}`
);

const isJsonPayload = (value: unknown, ancestors = new Set<object>()): value is StudentSaveDraftPayload => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || ancestors.has(value)) return false;
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) return false;
  ancestors.add(value);
  const valid = Object.values(value).every((child) => isJsonPayload(child, ancestors));
  ancestors.delete(value);
  return valid;
};

const canonicalPayload = (value: StudentSaveDraftPayload): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalPayload).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalPayload(child)}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

const parseDraft = (text: string, scope: StudentSaveDraftScope): StudentSaveDraft | null => {
  // Local persistence is an optional boundary; malformed or inaccessible data must not block saving.
  try { // no-excuse-ok: catch
    const value: unknown = JSON.parse(text);
    if (value === null || typeof value !== 'object'
      || !('version' in value) || value.version !== 1
      || !('scope' in value) || value.scope === null || typeof value.scope !== 'object'
      || !('studentNumber' in value.scope) || value.scope.studentNumber !== scope.studentNumber
      || !('feature' in value.scope) || value.scope.feature !== scope.feature
      || !('entityId' in value.scope) || value.scope.entityId !== scope.entityId
      || !('requestId' in value) || typeof value.requestId !== 'string' || !value.requestId
      || !('createdAt' in value) || typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt))
      || !('payload' in value) || !isJsonPayload(value.payload)) return null;
    return { version: 1, scope: { ...scope }, requestId: value.requestId, createdAt: value.createdAt, payload: value.payload };
  } catch {
    return null;
  }
};

const scopeFromKey = (key: string): StudentSaveDraftScope | null => {
  if (!key.startsWith(PREFIX)) return null;
  try {
    const tuple: unknown = JSON.parse(decodeURIComponent(key.slice(PREFIX.length)));
    if (!Array.isArray(tuple) || tuple.length !== 3
      || typeof tuple[0] !== 'number' || typeof tuple[1] !== 'string' || typeof tuple[2] !== 'string') return null;
    const scope = { studentNumber: tuple[0], feature: tuple[1], entityId: tuple[2] };
    return validScope(scope) ? scope : null;
  } catch { return null; }
};

let nextStoreOwner = 0;

export const createStudentSaveDraftStore = (options: StudentSaveDraftOptions = {}) => {
  const owner = ++nextStoreOwner;
  const checkKey = (key: string) => `${key}:store-${owner}`;
  const memory = new Map<string, { text: string; durable: boolean; dirty: boolean }>();
  const listeners = new Set<() => void>();
  const persistedVersions = new Map<string, string>();
  const createRequestId = options.createRequestId ?? createBrowserRequestId;
  const now = options.now ?? (() => new Date());
  let revision = 0;
  let queue = Promise.resolve();
  let readyPromise: Promise<void> | null = null;
  let databaseHydrated = false;
  const getStorage = (): DraftStorage | null => {
    try {
      return options.storage !== undefined ? options.storage : (typeof window === 'undefined' ? null : window.localStorage);
    } catch { return null; }
  };
  const database = (() => {
    if (options.database !== undefined) return options.database;
    if (options.storage !== undefined) return null;
    try { return typeof window !== 'undefined' && window.indexedDB ? createStudentDraftDatabase(window.indexedDB) : null; }
    catch { return null; }
  })();
  let channel: BroadcastChannel | null = null;
  const notify = () => { revision++; for (const listener of listeners) listener(); };
  const protectReload = (key: string, scope: StudentSaveDraftScope) => {
    setDraftReloadCheck(checkKey(key), scope.studentNumber, () => {
      const entry = memory.get(key);
      if (!entry) return true;
      if (!entry.durable || entry.dirty) return false;
      return database ? true : getStorage()?.getItem(key) === entry.text;
    }, () => {
      const draft = parseDraft(memory.get(key)?.text ?? '', scope);
      return draft ? JSON.stringify(draft.payload, null, 2) : '';
    });
  };
  const remember = (key: string, draft: StudentSaveDraft, durable: boolean, dirty = false) => {
    memory.set(key, { text: JSON.stringify(draft), durable, dirty });
    if (durable) persistedVersions.set(key, draft.requestId);
    protectReload(key, draft.scope);
    notify();
  };
  const forget = (key: string) => { memory.delete(key); persistedVersions.delete(key); removeDraftReloadCheck(checkKey(key)); notify(); };
  const publish = (key: string) => { channel?.postMessage(key); };
  const localKeys = (): string[] => {
    const storage = getStorage();
    try {
      if (!storage?.key || typeof storage.length !== 'number') return [];
      return Array.from({ length: storage.length }, (_, index) => storage.key?.(index))
        .filter((key): key is string => typeof key === 'string' && key.startsWith(PREFIX));
    } catch { return []; }
  };
  const readLocal = (scope: StudentSaveDraftScope): StudentSaveDraft | null => {
    try { return parseDraft(getStorage()?.getItem(keyFor(scope)) ?? '', scope); }
    catch { return null; }
  };
  const entryFor = (draft: StudentSaveDraft): StudentDraftDatabaseEntry => ({
    key: keyFor(draft.scope), requestId: draft.requestId, value: JSON.stringify(draft),
  });
  const parseEntry = (entry: StudentDraftDatabaseEntry | null): StudentSaveDraft | null => {
    const scope = entry ? scopeFromKey(entry.key) : null;
    const draft = scope && entry ? parseDraft(entry.value, scope) : null;
    return draft?.requestId === entry?.requestId ? draft : null;
  };
  const adoptRemote = (key: string, entry: StudentDraftDatabaseEntry | null) => {
    if (memory.get(key)?.dirty) return;
    const draft = parseEntry(entry);
    if (draft) remember(key, draft, true);
    else if (memory.has(key)) forget(key);
  };
  const migrate = async (scope: StudentSaveDraftScope): Promise<void> => {
    if (!database) return;
    const key = keyFor(scope);
    let sourceText: string | null = null;
    try { sourceText = getStorage()?.getItem(key) ?? null; } catch { return; }
    const legacy = sourceText ? parseDraft(sourceText, scope) : null;
    if (!legacy) return;
    const entry = await database.migrateLegacy(entryFor(legacy));
    adoptRemote(key, entry);
    const verified = await database.getLegacy(key, legacy.requestId);
    if (verified?.requestId === legacy.requestId && verified.value === JSON.stringify(legacy)) {
      try {
        const storage = getStorage();
        if (storage?.getItem(key) === sourceText) storage.removeItem(key);
      } catch { /* The migration archive prevents an undeleted legacy value from being reimported. */ }
    }
  };
  const ready = (): Promise<void> => {
    if (readyPromise) return readyPromise;
    readyPromise = (async () => {
      if (!database) return;
      try {
        if (!channel && typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
          channel = new BroadcastChannel('school-timer-student-drafts');
          channel.onmessage = event => {
            if (typeof event.data !== 'string' || !scopeFromKey(event.data)) return;
            const key: string = event.data;
            void database.get(key).then(entry => adoptRemote(key, entry)).catch(() => {});
          };
        }
        for (const entry of await database.readAll()) adoptRemote(entry.key, entry);
        databaseHydrated = true;
        for (const key of new Set([...localKeys(), ...memory.keys()])) {
          const scope = scopeFromKey(key);
          if (scope) await migrate(scope);
        }

      } catch {
        readyPromise = null;
        for (const key of localKeys()) {
          const scope = scopeFromKey(key);
          const draft = scope ? readLocal(scope) : null;
          if (draft && !memory.has(key)) remember(key, draft, false, true);
        }
      }
    })();
    return readyPromise;
  };
  const enqueue = (operation: () => Promise<void>) => {
    queue = queue.then(async () => { await ready(); await operation(); }).catch(() => {});
  };
  const flush = async (): Promise<void> => {
    await ready();
    let pending: Promise<void>;
    do { pending = queue; await pending; } while (pending !== queue);
  };

  const load = (scope: StudentSaveDraftScope): LoadedStudentSaveDraft | null => {
    if (!validScope(scope)) return null;
    const key = keyFor(scope);
    const current = memory.get(key);
    if (current && (database || current.dirty)) {
      const draft = parseDraft(current.text, scope);
      return draft ? { draft, durable: current.durable } : null;
    }
    if (database && databaseHydrated) return null;
    const storage = getStorage();
    if (storage) {
      try {
        const text = storage.getItem(key);
        const draft = text ? parseDraft(text, scope) : null;
        if (draft) {
          const durable = !database;
          if (database) persistedVersions.set(key, draft.requestId);
          if (current?.text !== text || current.durable !== durable) remember(key, draft, durable);
          return { draft, durable };
        }
        if (current) forget(key);
        return null;
      } catch {
        const draft = current ? parseDraft(current.text, scope) : null;
        return draft ? { draft, durable: false } : null;
      }
    }
    const draft = current ? parseDraft(current.text, scope) : null;
    return draft ? { draft, durable: false } : null;
  };
  const createDraft = (scope: StudentSaveDraftScope, payload: StudentSaveDraftPayload): StudentSaveDraft | null => (
    parseDraft(JSON.stringify({ version: 1, scope, requestId: createRequestId(), createdAt: now().toISOString(), payload }), scope)
  );
  const persistLocal = (draft: StudentSaveDraft): boolean => {
    const key = keyFor(draft.scope);
    const text = JSON.stringify(draft);
    try {
      const storage = getStorage();
      storage?.setItem(key, text);
      const durable = !!storage && storage.getItem(key) === text;
      remember(key, draft, durable, !durable);
      return durable;
    } catch { return false; }
  };
  const persist = (draft: StudentSaveDraft, replace: boolean) => {
    if (!database) return persistLocal(draft);
    const key = keyFor(draft.scope);
    enqueue(async () => {
      try {
        const entry = entryFor(draft);
        const selected = replace
          ? (await database.replace(entry, persistedVersions.get(key) ?? null) ? entry : null)
          : await database.insert(entry);
        const current = memory.get(key);
        if (!selected) return;
        const saved = parseEntry(selected);
        if (saved) persistedVersions.set(key, saved.requestId);
        if (saved && current?.text === JSON.stringify(draft)) remember(key, saved, true);
        publish(key);
      } catch {
        if (memory.get(key)?.text === JSON.stringify(draft)) remember(key, draft, false, true);
      }
    });
    return false;
  };
  const save = (scope: StudentSaveDraftScope, payload: unknown): StudentSaveDraftResult => {
    if (!validScope(scope) || !isJsonPayload(payload)) return { status: 'invalid' };
    const existing = load(scope);
    if (existing) return {
      status: canonicalPayload(existing.draft.payload) === canonicalPayload(payload) ? 'existing' : 'payload_changed',
      ...existing,
    };
    const draft = createDraft(scope, payload);
    if (!draft) return { status: 'invalid' };
    remember(keyFor(scope), draft, false, true);
    return { status: 'saved', draft, durable: persist(draft, false) };
  };
  const replace = (scope: StudentSaveDraftScope, payload: unknown): StudentSaveDraftResult => {
    if (!validScope(scope) || !isJsonPayload(payload)) return { status: 'invalid' };
    const existing = load(scope);
    if (existing && canonicalPayload(existing.draft.payload) === canonicalPayload(payload)) {
      if (!existing.durable) persist(existing.draft, true);
      return { status: 'existing', ...existing };
    }
    const draft = createDraft(scope, payload);
    if (!draft) return { status: 'invalid' };
    remember(keyFor(scope), draft, false, true);
    return { status: 'saved', draft, durable: persist(draft, true) };
  };
  const saveDurable = async (scope: StudentSaveDraftScope, payload: unknown): Promise<StudentSaveDraftResult> => {
    if (!validScope(scope) || !isJsonPayload(payload)) return { status: 'invalid' };
    await ready();
    const initial = save(scope, payload);
    if (initial.status === 'invalid') return initial;
    if (database && !initial.durable) persist(initial.draft, false);
    await flush();
    const selected = load(scope);
    if (!selected) return { ...initial, durable: false };
    const same = canonicalPayload(selected.draft.payload) === canonicalPayload(payload);
    return { status: !same ? 'payload_changed' : selected.draft.requestId === initial.draft.requestId ? initial.status : 'existing', ...selected };
  };
  const importDurable = async (value: StudentSaveDraft): Promise<StudentSaveDraftImportResult> => {
    if (!value || !validScope(value.scope)) return { status: 'invalid' };
    let draft: StudentSaveDraft | null = null;
    try { draft = parseDraft(JSON.stringify(value), value.scope); } catch { return { status: 'invalid' }; }
    if (!draft) return { status: 'invalid' };
    await flush();
    const existing = load(draft.scope);
    if (database) {
      try {
        const key = keyFor(draft.scope);
        const entry = await database.migrateLegacy(entryFor(draft));
        const verified = parseEntry(await database.getLegacy(key, draft.requestId));
        if (!entry && verified) {
          adoptRemote(key, null);
          return { status: 'already_migrated', draft: verified, durable: true };
        }
        const selected = parseEntry(entry);
        if (selected) {
          adoptRemote(key, entry);
          return { status: canonicalPayload(selected.payload) === canonicalPayload(draft.payload)
            ? (existing ? 'existing' : 'saved') : 'payload_changed', draft: selected, durable: true };
        }
      } catch {
        if (!existing) remember(keyFor(draft.scope), draft, false, true);
      }
      return existing ? { status: 'existing', ...existing } : { status: 'saved', draft, durable: false };
    }
    if (existing) return { status: canonicalPayload(existing.draft.payload) === canonicalPayload(draft.payload)
      ? 'existing' : 'payload_changed', ...existing };
    remember(keyFor(draft.scope), draft, false, true);
    return { status: 'saved', draft, durable: persistLocal(draft) };
  };
  const confirmDurable = async (scope: StudentSaveDraftScope, requestId: string): Promise<boolean> => {
    if (!validScope(scope)) return false;
    if (!database) return remove(scope, requestId);
    await flush();
    const key = keyFor(scope);
    try {
      const removed = await database.remove(key, requestId);
      if (removed) {
        if (load(scope)?.draft.requestId === requestId) forget(key);
        publish(key);
      }
      return removed;
    } catch { return false; }
  };
  const remove = (scope: StudentSaveDraftScope, requestId: string): boolean => {
    const existing = load(scope);
    if (!existing || existing.draft.requestId !== requestId) return false;
    const key = keyFor(scope);
    if (database) {
      enqueue(async () => {
        try {
          if (await database.remove(key, requestId)) {
            if (load(scope)?.draft.requestId === requestId) forget(key);
            publish(key);
          }
        } catch { /* Retain the request identity when confirmation cannot be persisted. */ }
      });
      return true;
    }
    const storage = getStorage();
    try {
      storage?.removeItem(key);
      if (storage && storage.getItem(key) !== null) return false;
      forget(key);
      return true;
    } catch { return false; }
  };
  const list = (studentNumber: number): StudentSaveDraft[] => {
    for (const key of localKeys()) {
      const scope = scopeFromKey(key);
      if (scope?.studentNumber === studentNumber) load(scope);
    }
    return [...memory.entries()].flatMap(([key, entry]) => {
      const scope = scopeFromKey(key);
      const draft = scope?.studentNumber === studentNumber ? parseDraft(entry.text, scope) : null;
      return draft ? [draft] : [];
    });
  };
  void ready();
  return {
    load, save, replace, remove, confirm: remove, ready, flush, saveDurable, importDurable, confirmDurable, list,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => revision,
    dispose: () => { channel?.close(); listeners.clear(); for (const key of memory.keys()) removeDraftReloadCheck(checkKey(key)); },
  };
};
