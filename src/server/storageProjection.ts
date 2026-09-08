import { isStorageRecord, splitStorageState } from '../lib/storageV2Codec.js';
import type { ScopedStorageSnapshot, StorageSnapshot } from './storageV2Repository.js';
import type { RequestHeaders } from './deviceSession.js';

export const supportsStorageProjection = (headers: RequestHeaders | undefined): boolean =>
  Object.entries(headers ?? {}).some(([key, value]) => key.toLowerCase() === 'x-storage-projection' && value === '1');

export const createStorageProjectionPatch = (
  snapshot: StorageSnapshot | ScopedStorageSnapshot, projected: Record<string, unknown>, complete = snapshot.kind !== 'scoped',
) => {
  const clean: unknown = JSON.parse(JSON.stringify(projected));
  if (!isStorageRecord(clean)) throw new Error('STORAGE_INVALID_PROJECTION');
  const visible = splitStorageState(clean);
  const visibleResources = new Map(visible.resources.map(row => [row.resource_key, row]));
  const raw = snapshot.resources ?? splitStorageState(snapshot.value).resources;
  const resources = raw.filter(row => visibleResources.has(row.resource_key)).map(row => {
    const projectedRow = visibleResources.get(row.resource_key);
    return projectedRow ? { ...projectedRow, value: { ...projectedRow.value,
      ...(row.value.order === undefined ? {} : { order: row.value.order }) } } : row;
  });
  const visibleWallets = new Set(visible.wallets.map(row => row.student_number));
  const wallets = (snapshot.wallets ?? visible.wallets).filter(row => visibleWallets.has(row.student_number));
  const historyStudents = snapshot.kind === 'scoped'
    ? snapshot.scope.history.filter(number => visibleWallets.has(number)) : [...visibleWallets];
  const history = (snapshot.history ?? visible.history).filter(row => historyStudents.includes(row.student_number));
  const deletedKeys = snapshot.kind === 'scoped' ? snapshot.deletedKeys : [];
  const keys = [...resources.map(row => row.resource_key), ...wallets.map(row => `wallet:${row.student_number}`), ...deletedKeys];
  const revisions = Object.fromEntries(keys.map(key => [key, snapshot.revisions[key] ?? 0]));
  return { resources, wallets, history, historyStudents, revisions, deletedKeys, complete };
};
