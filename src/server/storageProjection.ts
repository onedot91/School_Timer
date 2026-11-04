import { isStorageRecord, splitStorageState } from '../lib/storageV2Codec.js';
import type { ScopedStorageSnapshot, StorageSnapshot } from './storageV2Repository.js';
import type { RequestHeaders } from './deviceSession.js';

export const supportsStorageProjection = (headers: RequestHeaders | undefined): boolean =>
  Object.entries(headers ?? {}).some(([key, value]) => key.toLowerCase() === 'x-storage-projection' && value === '1');

const DAY_MS = 86_400_000, KST_OFFSET_MS = 9 * 3_600_000;
/** Matches SQL storage_teacher_history_since: 13 days before today's Korean midnight. */
export const recentHistorySince = (now = Date.now()): number =>
  Math.floor((now + KST_OFFSET_MS) / DAY_MS) * DAY_MS - 13 * DAY_MS - KST_OFFSET_MS;

const isOlderHistoryEntry = (entry: unknown, since: number): boolean => {
  const createdAt = isStorageRecord(entry) ? Date.parse(String(entry.createdAt)) : NaN;
  return Number.isFinite(createdAt) && createdAt < since;
};

/**
 * Student screens use coin history only for today's and this week's checks. This trims only what is
 * sent to the browser; commands still read and write the full ledger.
 */
export const withRecentHistory = <T extends StorageSnapshot | ScopedStorageSnapshot>(snapshot: T, now = Date.now()): T => {
  const since = recentHistorySince(now);
  const history = snapshot.value.currencyHistory;
  return { ...snapshot,
    ...(snapshot.history ? { history: snapshot.history.filter(row => !isOlderHistoryEntry(row.value.data, since)) } : {}),
    value: isStorageRecord(history) ? { ...snapshot.value, currencyHistory: Object.fromEntries(Object.entries(history).map(([student, entries]) => [
      student, Array.isArray(entries) ? entries.filter(entry => !isOlderHistoryEntry(entry, since)) : entries,
    ])) } : snapshot.value };
};

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
  for (const category of ['studentSudoku', 'studentEmotionHistory', 'studentPets']) {
    if (!Object.hasOwn(projected, category)) continue;
    const owners = new Set([...visibleWallets,
      ...resources.flatMap(row => row.category !== category || row.owner_number === null ? [] : [row.owner_number]),
      ...(snapshot.kind === 'scoped' ? snapshot.scope.resources.flatMap(selection => selection.path === `/${category}` ? selection.students ?? [] : []) : [])]);
    for (const owner of owners) keys.push(`scope:${category}:${owner}`);
  }
  const revisions = Object.fromEntries(keys.map(key => [key, snapshot.revisions[key] ?? 0]));
  return { resources, wallets, history, historyStudents, revisions, deletedKeys, complete };
};
