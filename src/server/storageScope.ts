import { isStorageRecord, storageResourceKey, type StorageResource } from '../lib/storageV2Codec.js';

export interface StorageResourceSelector {
  readonly path: string;
  readonly students?: readonly number[];
  readonly mail?: { readonly actor: number; readonly direction: 'participant' | 'recipient' };
}
export interface StorageScope {
  readonly resources: readonly StorageResourceSelector[];
  readonly wallets: readonly number[];
  readonly history: readonly number[];
  readonly writeResources: readonly StorageResourceSelector[];
  readonly writeWallets: readonly number[];
  readonly revisionKeys?: readonly string[];
}
export interface StorageOrderingBound {
  readonly minimum: number;
  readonly maximum: number;
}
export type StorageOrderingBounds = Readonly<Record<string, StorageOrderingBound>>;
export class StorageScopeError extends Error {
  readonly code = 'STORAGE_SCOPE_VIOLATION';
  readonly status = 400;
  constructor() { super('STORAGE_SCOPE_VIOLATION'); }
}
const invalid = (): never => { throw new StorageScopeError(); };
const numbers = (value: unknown): readonly number[] => {
  if (!Array.isArray(value) || value.length > 23 || value.some(number => !Number.isInteger(number) || number < 1 || number > 23)) return invalid();
  return [...new Set(value)].sort((left, right) => left - right);
};
const validPath = (path: unknown): path is string => typeof path === 'string' && path.startsWith('/') && path.length > 1
  && path.length <= 1024 && !path.includes('\0') && !path.endsWith('/') && !/~(?![01])/.test(path);
export const storagePathWithin = (key: string, path: string): boolean => key === path || key.startsWith(`${path}/`);
const selector = (value: unknown): StorageResourceSelector => {
  if (!isStorageRecord(value) || !validPath(value.path) || Object.keys(value).some(key => !['path', 'students', 'mail'].includes(key))) return invalid();
  const students = value.students === undefined ? undefined : numbers(value.students);
  if (students?.length === 0) return invalid();
  let mail: StorageResourceSelector['mail'];
  if (value.mail !== undefined) {
    const input = value.mail;
    if (!isStorageRecord(input) || !Number.isInteger(input.actor) || typeof input.actor !== 'number' || input.actor < 0 || input.actor > 23
      || (input.direction !== 'participant' && input.direction !== 'recipient')
      || Object.keys(input).some(key => !['actor', 'direction'].includes(key))
      || !storagePathWithin(value.path, '/studentLife/letters') || students !== undefined) return invalid();
    mail = { actor: input.actor, direction: input.direction };
  }
  return { path: value.path, ...(students ? { students } : {}), ...(mail ? { mail } : {}) };
};
const selectors = (value: unknown): readonly StorageResourceSelector[] => {
  if (!Array.isArray(value) || value.length > 128) return invalid();
  return value.map(selector);
};
const selectorIncludes = (read: StorageResourceSelector, write: StorageResourceSelector): boolean => {
  if (!storagePathWithin(write.path, read.path)) return false;
  if (read.students && (!write.students || write.students.some(student => !read.students?.includes(student)))) return false;
  if (read.mail && (!write.mail || read.mail.actor !== write.mail.actor
    || (read.mail.direction === 'recipient' && write.mail.direction !== 'recipient'))) return false;
  return true;
};
export const parseStorageScope = (value: unknown): StorageScope => {
  if (!isStorageRecord(value) || Object.keys(value).some(key => !['resources', 'wallets', 'history', 'writeResources', 'writeWallets', 'revisionKeys'].includes(key))) return invalid();
  const resources = selectors(value.resources), writeResources = selectors(value.writeResources);
  const wallets = numbers(value.wallets), history = numbers(value.history), writeWallets = numbers(value.writeWallets);
  if (writeResources.some(write => !resources.some(read => selectorIncludes(read, write)))
    || writeWallets.some(student => !wallets.includes(student))) return invalid();
  let revisionKeys: readonly string[] | undefined;
  if (value.revisionKeys !== undefined) {
    if (!Array.isArray(value.revisionKeys) || value.revisionKeys.length > 512
      || value.revisionKeys.some(key => typeof key !== 'string' || key.length > 2048 || key.includes('\0')
        || !(key === '' || validPath(key) || /^(?:wallet:[1-9][0-9]?|scope:[^:]+:(?:all|shared|[1-9][0-9]?)|collection:\/.*)$/.test(key)))) return invalid();
    revisionKeys = [...new Set<string>(value.revisionKeys)];
  }
  return { resources, wallets, history, writeResources, writeWallets, ...(revisionKeys ? { revisionKeys } : {}) };
};
export const storageResourceMatchesSelector = (resource: StorageResource, scope: StorageResourceSelector): boolean => {
  if (!storagePathWithin(resource.resource_key, scope.path)) return false;
  if (scope.students && (resource.owner_number === null || !scope.students.includes(resource.owner_number))) return false;
  if (scope.mail) {
    const data = resource.value.data;
    if (resource.value.parentKey !== '/studentLife/letters' || !isStorageRecord(data)) return false;
    return data.recipient === scope.mail.actor || (scope.mail.direction === 'participant' && data.senderStudentNumber === scope.mail.actor);
  }
  return true;
};
export const storageResourceMatchesScope = (resource: StorageResource, selectors: readonly StorageResourceSelector[]): boolean => selectors.some(scope => storageResourceMatchesSelector(resource, scope));
export const storageStructuralAncestor = (resource: StorageResource, keys: readonly string[]): boolean => resource.value.kind !== 'value'
  && keys.some(key => resource.resource_key === '' || storagePathWithin(key, resource.resource_key));
export const storageScopeRevisionKeys = (scope: StorageScope): readonly string[] => {
  const keys = new Set(scope.revisionKeys ?? []);
  for (const student of [...scope.wallets, ...scope.history]) keys.add(`wallet:${student}`);
  for (const resource of scope.resources) {
    const category = resource.path.slice(1).split('/')[0];
    if (!resource.students && !resource.mail) keys.add(`scope:${category}:all`);
    for (const owner of resource.students ?? []) keys.add(`scope:${category}:${owner}`);
    if (!resource.students && !resource.mail) keys.add(`scope:${category}:shared`);
    keys.add(resource.path);
  }
  return [...keys];
};

/** The SQL RPC supplies these containers when only wallet/history rows are requested. */
export const storageScopeStructuralKeys = (scope: StorageScope): readonly string[] => [
  '', ...(scope.wallets.length ? ['/currencyBalances'] : []),
  ...(scope.history.length ? ['/currencyHistory', ...scope.history.map(student => storageResourceKey('currencyHistory', String(student)))] : []),
];
