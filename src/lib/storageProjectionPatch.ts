import { assembleStorageState, canonicalStorageJson, isStorageRecord, splitStorageState, storagePathPart, type StorageEncodedState, type StorageHistoryRecord, type StorageResource, type StorageResourceValue, type StorageWallet } from './storageV2Codec.js';

export interface StorageProjectionPatch extends StorageEncodedState {
  readonly revisions: Readonly<Record<string, number>>;
  readonly deletedKeys: readonly string[];
  readonly historyStudents: readonly number[];
  readonly complete: boolean;
}

const invalid = (): never => { throw new Error('STORAGE_INVALID_RESPONSE'); };
const student = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 23;
const resourceValue = (input: unknown): StorageResourceValue => {
  if (!isStorageRecord(input) || (input.kind !== 'value' && input.kind !== 'object' && input.kind !== 'array')
    || (input.parentKey !== null && typeof input.parentKey !== 'string') || typeof input.member !== 'string'
    || (input.order !== undefined && (typeof input.order !== 'number' || !Number.isFinite(input.order)))) return invalid();
  if (input.kind === 'value') {
    if (!Object.hasOwn(input, 'data')) return invalid();
    try { canonicalStorageJson(input.data); } catch { return invalid(); }
  }
  return { kind: input.kind, parentKey: typeof input.parentKey === 'string' ? input.parentKey : null, member: input.member,
    ...(typeof input.order === 'number' ? { order: input.order } : {}), ...(input.kind === 'value' ? { data: input.data } : {}) };
};
const validateKey = (key: string, value: StorageResourceValue): void => {
  if (key === '') {
    if (value.parentKey !== null || value.member !== '' || value.kind !== 'object') invalid();
  } else if (value.parentKey === null || key !== `${value.parentKey}/${storagePathPart(value.member)}`) invalid();
};

export const parseStorageProjectionPatch = (input: unknown): StorageProjectionPatch => {
  if (!isStorageRecord(input) || !Array.isArray(input.resources) || !Array.isArray(input.wallets)
    || !Array.isArray(input.history) || !Array.isArray(input.historyStudents) || !Array.isArray(input.deletedKeys)
    || !isStorageRecord(input.revisions) || typeof input.complete !== 'boolean') return invalid();
  const revisions: Record<string, number> = {};
  for (const [key, revision] of Object.entries(input.revisions)) {
    if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0) return invalid();
    Object.defineProperty(revisions, key, { value: revision, enumerable: true });
  }
  const requireRevision = (key: string) => { if (!Object.hasOwn(revisions, key)) invalid(); };
  const resources: StorageResource[] = input.resources.map((row: unknown) => {
    if (!isStorageRecord(row) || typeof row.resource_key !== 'string' || typeof row.category !== 'string'
      || (row.owner_number !== null && !student(row.owner_number))) return invalid();
    const value = resourceValue(row.value);
    validateKey(row.resource_key, value);
    requireRevision(row.resource_key);
    return { resource_key: row.resource_key, category: row.category, owner_number: typeof row.owner_number === 'number' ? row.owner_number : null, value };
  });
  const resourceMap = new Map(resources.map(row => [row.resource_key, row]));
  if (resourceMap.size !== resources.length || !resourceMap.has('')) return invalid();
  for (const row of resources) {
    if (row.value.parentKey === null) continue;
    const parent = resourceMap.get(row.value.parentKey);
    if (!parent || parent.value.kind === 'value') return invalid();
  }
  const wallets: StorageWallet[] = input.wallets.map((row: unknown) => {
    if (!isStorageRecord(row) || !student(row.student_number) || typeof row.balance !== 'number'
      || !Number.isSafeInteger(row.balance) || row.balance < 0 || row.balance > 999999) return invalid();
    requireRevision(`wallet:${row.student_number}`);
    return { student_number: row.student_number, balance: row.balance };
  });
  const walletStudents = new Set(wallets.map(row => row.student_number));
  if (walletStudents.size !== wallets.length || (wallets.length && resourceMap.get('/currencyBalances')?.value.kind !== 'object')) return invalid();
  const historyStudents = input.historyStudents.map((value: unknown) => student(value) && walletStudents.has(value) ? value : invalid());
  if (new Set(historyStudents).size !== historyStudents.length) return invalid();
  if (input.complete && historyStudents.length !== wallets.length) return invalid();
  for (const number of historyStudents) if (resourceMap.get(`/currencyHistory/${number}`)?.value.kind !== 'array') return invalid();
  const history: StorageHistoryRecord[] = input.history.map((row: unknown) => {
    if (!isStorageRecord(row) || typeof row.resource_key !== 'string' || !student(row.student_number)
      || !historyStudents.includes(row.student_number) || typeof row.entry_id !== 'string'
      || typeof row.sort_order !== 'number' || !Number.isFinite(row.sort_order)) return invalid();
    const value = resourceValue(row.value);
    validateKey(row.resource_key, value);
    if (value.kind !== 'value' || value.parentKey !== `/currencyHistory/${row.student_number}`
      || !isStorageRecord(value.data) || value.data.id !== row.entry_id || resourceMap.has(row.resource_key)) return invalid();
    return { resource_key: row.resource_key, student_number: row.student_number, entry_id: row.entry_id, sort_order: row.sort_order, value };
  });
  if (new Set(history.map(row => row.resource_key)).size !== history.length) return invalid();
  const deletedKeys = input.deletedKeys.map((key: unknown) => {
    if (typeof key !== 'string' || !key.startsWith('/') || resourceMap.has(key)) return invalid();
    requireRevision(key);
    return key;
  });
  if (new Set(deletedKeys).size !== deletedKeys.length) return invalid();
  return { resources, wallets, history, revisions, deletedKeys, historyStudents, complete: input.complete };
};

interface Versioned<T> { readonly value: T | null; readonly revision: number | null; readonly at: string }
export class StorageProjectionPatchCache {
  private resources = new Map<string, Versioned<StorageResource>>();
  private wallets = new Map<number, Versioned<StorageWallet>>();
  private history = new Map<number, Versioned<readonly StorageHistoryRecord[]>>();
  private completeAt: string | null = null;
  constructor(private readonly compare: (left: string, right: string) => number) {}

  seedLegacy(value: Record<string, unknown>, at: string): void {
    const encoded = splitStorageState(value);
    this.resources = new Map(encoded.resources.map(row => [row.resource_key, { value: row, revision: null, at }]));
    this.wallets = new Map(encoded.wallets.map(row => [row.student_number, { value: row, revision: null, at }]));
    this.history = new Map(encoded.wallets.map(row => [row.student_number, { value: encoded.history.filter(entry => entry.student_number === row.student_number), revision: null, at }]));
    this.completeAt = at;
  }

  private accept<T>(map: Map<string | number, Versioned<T>>, key: string | number, value: T | null, revision: number, at: string): void {
    const previous = map.get(key);
    if (!previous && this.completeAt && this.compare(at, this.completeAt) < 0) return;
    if (previous?.value === null && this.compare(at, previous.at) < 0) return;
    if (previous && (previous.revision === null ? this.compare(at, previous.at) < 0
      : revision < previous.revision || (revision === previous.revision && this.compare(at, previous.at) < 0))) return;
    map.set(key, { value, revision, at });
  }

  apply(patch: StorageProjectionPatch, at: string): Record<string, unknown> {
    this.compare(at, at);
    if (patch.complete) {
      const removeAbsent = <K extends string | number, T>(map: Map<K, Versioned<T>>, present: ReadonlySet<K>) => {
        for (const [key, row] of map) if (!present.has(key) && this.compare(row.at, at) <= 0) map.set(key, { value: null, revision: row.revision, at });
      };
      removeAbsent(this.resources, new Set(patch.resources.map(row => row.resource_key)));
      removeAbsent(this.wallets, new Set(patch.wallets.map(row => row.student_number)));
      removeAbsent(this.history, new Set(patch.historyStudents));
    }
    for (const row of patch.resources) this.accept(this.resources, row.resource_key, row, patch.revisions[row.resource_key], at);
    for (const key of patch.deletedKeys) this.accept(this.resources, key, null, patch.revisions[key], at);
    for (const row of patch.wallets) this.accept(this.wallets, row.student_number, row, patch.revisions[`wallet:${row.student_number}`], at);
    for (const number of patch.historyStudents) this.accept(this.history, number, patch.history.filter(row => row.student_number === number), patch.revisions[`wallet:${number}`], at);
    if (patch.complete && (!this.completeAt || this.compare(at, this.completeAt) > 0)) this.completeAt = at;
    return assembleStorageState({ resources: [...this.resources.values()].flatMap(row => row.value ? [row.value] : []),
      wallets: [...this.wallets.values()].flatMap(row => row.value ? [row.value] : []), history: [...this.history.values()].flatMap(row => row.value ?? []) });
  }
}
