import { isStorageRecord } from '../lib/storageV2Codec.js';
import { parseStorageSnapshot, parseScopedStorageSnapshot, type StorageConfiguration } from './storageV2Repository.js';
import { createStorageProjectionPatch } from './storageProjection.js';
import { parseReadManifest } from '../lib/storageReadManifest.js';
import { measureStorageRequest } from './storageRequestTiming.js';
export { parseReadManifest } from '../lib/storageReadManifest.js';

const fetchTeacherChanges = async (configuration: StorageConfiguration, known: Record<string, string> | null) => {
  const response = await measureStorageRequest(() => fetch(`${configuration.url}/rest/v1/rpc/storage_load_teacher_changes`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: configuration.key, Authorization: `Bearer ${configuration.key}` },
    body: JSON.stringify({ p_known: known }), signal: AbortSignal.timeout(8000),
  }));
  if (!response.ok) throw new Error(`SHARED_SETTINGS_READ_HTTP_${response.status}`);
  const body: unknown = await response.json();
  if (!isStorageRecord(body) || typeof body.complete !== 'boolean' || (known === null && !body.complete)) throw new Error('SHARED_SETTINGS_INVALID_RESPONSE');
  const snapshot = body.complete ? parseStorageSnapshot(body.snapshot) : parseScopedStorageSnapshot(body.snapshot);
  return { id: 'school-timer-main', value: snapshot.value, updated_at: snapshot.updated_at, scope: 'full' as const,
    readManifest: parseReadManifest(body.manifest), storagePatch: createStorageProjectionPatch(snapshot, snapshot.value, body.complete) };
};

const teacherReads = new Map<string, ReturnType<typeof fetchTeacherChanges>>();
export const loadTeacherChanges = (configuration: StorageConfiguration, known: Record<string, string> | null) => {
  const identity = JSON.stringify([configuration.url, configuration.key, known]);
  const existing = teacherReads.get(identity);
  if (existing) return existing;
  const pending = fetchTeacherChanges(configuration, known).finally(() => {
    if (teacherReads.get(identity) === pending) teacherReads.delete(identity);
  });
  teacherReads.set(identity, pending);
  return pending;
};
