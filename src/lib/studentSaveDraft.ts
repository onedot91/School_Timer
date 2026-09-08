import { createBrowserRequestId } from './requestId.js';
import { setDraftReloadCheck, removeDraftReloadCheck } from './draftReloadSafety.js';

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

type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
interface StudentSaveDraftOptions {
  readonly storage?: DraftStorage | null;
  readonly createRequestId?: () => string;
  readonly now?: () => Date;
}

const PREFIX = 'school-timer-student-save-draft-v1:';
const validScope = (scope: StudentSaveDraftScope): boolean => (
  Number.isInteger(scope.studentNumber) && scope.studentNumber >= 0 && scope.studentNumber <= 23
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

/** This store never sends or replays requests. Its caller supplies the current authenticated actor's scope. */
export const createStudentSaveDraftStore = (options: StudentSaveDraftOptions = {}) => {
  const memory = new Map<string, string>();
  const persistedKeys = new Set<string>();
  const createRequestId = options.createRequestId ?? createBrowserRequestId;
  const now = options.now ?? (() => new Date());
  const getStorage = (): DraftStorage | null => {
    try { // no-excuse-ok: catch
      return options.storage !== undefined ? options.storage : (typeof window === 'undefined' ? null : window.localStorage);
    } catch {
      return null;
    }
  };
  const protectReload = (key: string, scope: StudentSaveDraftScope, text: string) => {
    setDraftReloadCheck(key, scope.studentNumber, () => getStorage()?.getItem(key) === text);
  };

  const load = (scope: StudentSaveDraftScope): LoadedStudentSaveDraft | null => {
    if (!validScope(scope)) return null;
    const key = keyFor(scope);
    const storage = getStorage();
    if (storage) {
      try { // no-excuse-ok: catch
        const text = storage.getItem(key);
        if (text !== null) {
          const draft = parseDraft(text, scope);
          if (draft) {
            memory.set(key, text);
            persistedKeys.add(key);
            protectReload(key, scope, text);
            return { draft, durable: true };
          }
          memory.delete(key);
          persistedKeys.delete(key);
          removeDraftReloadCheck(key);
          return null;
        }
        if (persistedKeys.has(key)) {
          memory.delete(key);
          persistedKeys.delete(key);
          removeDraftReloadCheck(key);
        }
      } catch {
        // Retain this screen's request identity when browser storage is unavailable.
        const draft = parseDraft(memory.get(key) ?? '', scope);
        return draft ? { draft, durable: false } : null;
      }
    }
    const draft = parseDraft(memory.get(key) ?? '', scope);
    return draft ? { draft, durable: false } : null;
  };

  const save = (scope: StudentSaveDraftScope, payload: unknown): StudentSaveDraftResult => {
    if (!validScope(scope) || !isJsonPayload(payload)) return { status: 'invalid' };
    const existing = load(scope);
    if (existing) return {
      status: canonicalPayload(existing.draft.payload) === canonicalPayload(payload) ? 'existing' : 'payload_changed',
      ...existing,
    };
    const text = JSON.stringify({ version: 1, scope, requestId: createRequestId(), createdAt: now().toISOString(), payload });
    const draft = parseDraft(text, scope);
    if (!draft) return { status: 'invalid' };
    const key = keyFor(scope);
    memory.set(key, text);
    protectReload(key, scope, text);
    const storage = getStorage();
    try { // no-excuse-ok: catch
      storage?.setItem(key, text);
      if (storage) persistedKeys.add(key);
      return { status: 'saved', draft, durable: storage !== null };
    } catch {
      return { status: 'saved', draft, durable: false };
    }
  };

  const remove = (scope: StudentSaveDraftScope, requestId: string): boolean => {
    const existing = load(scope);
    if (!existing || existing.draft.requestId !== requestId) return false;
    const key = keyFor(scope);
    const storage = getStorage();
    if (!storage && persistedKeys.has(key)) return false;
    try { // no-excuse-ok: catch
      storage?.removeItem(key);
      memory.delete(key);
      persistedKeys.delete(key);
      removeDraftReloadCheck(key);
      return true;
    } catch {
      return false;
    }
  };

  return { load, save, remove, confirm: remove };
};
