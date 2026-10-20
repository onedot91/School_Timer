import { isStorageRecord } from '../lib/storageV2Codec.js';
import { parseStorageSnapshot, parseScopedStorageSnapshot, type StorageConfiguration } from './storageV2Repository.js';
import { createStorageProjectionPatch } from './storageProjection.js';
import { parseReadManifest } from '../lib/storageReadManifest.js';
import { measureStorageRequest } from './storageRequestTiming.js';
export { parseReadManifest } from '../lib/storageReadManifest.js';

// v2 limits ledger rows to a recent window. Until its SQL is applied, PostgREST answers 404 and v1 is used.
let windowedReadUnavailableUntil = 0;
const requestTeacherChanges = (configuration: StorageConfiguration, known: Record<string, string> | null, rpc: string) =>
  measureStorageRequest(() => fetch(`${configuration.url}/rest/v1/rpc/${rpc}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: configuration.key, Authorization: `Bearer ${configuration.key}` },
    body: JSON.stringify({ p_known: known }), signal: AbortSignal.timeout(8000),
  }));

const fetchTeacherChanges = async (configuration: StorageConfiguration, known: Record<string, string> | null) => {
  let response: Response | null = null;
  if (process.env.STORAGE_TEACHER_HISTORY_WINDOW !== '0' && Date.now() >= windowedReadUnavailableUntil) {
    response = await requestTeacherChanges(configuration, known, 'storage_load_teacher_changes_v2');
    if (response.status === 404) { windowedReadUnavailableUntil = Date.now() + 60_000; response = null; }
  }
  response ??= await requestTeacherChanges(configuration, known, 'storage_load_teacher_changes');
  if (!response.ok) throw new Error(`SHARED_SETTINGS_READ_HTTP_${response.status}`);
  const body: unknown = await response.json();
  if (!isStorageRecord(body) || typeof body.complete !== 'boolean' || (known === null && !body.complete)) throw new Error('SHARED_SETTINGS_INVALID_RESPONSE');
  const snapshot = body.complete ? parseStorageSnapshot(body.snapshot) : parseScopedStorageSnapshot(body.snapshot);
  return { id: 'school-timer-main', value: snapshot.value, updated_at: snapshot.updated_at, scope: 'full' as const,
    readManifest: parseReadManifest(body.manifest),
    ...(typeof body.historySince === 'string' ? { historySince: body.historySince } : {}), storagePatch: createStorageProjectionPatch(snapshot, snapshot.value, body.complete) };
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
