export type StudentSyncView = 'overview' | 'emotions' | 'missions' | 'store' | 'store-auction';

export const STUDENT_SETTINGS_CACHE_KEY = 'school-timer-student-settings-snapshot-v2';

export const STUDENT_SETTINGS_SYNC_INTERVAL_MS: Partial<Record<StudentSyncView, number>> = {
  overview: 10_000,
  store: 10_000,
  'store-auction': 2_000,
};

export const STUDENT_FOREGROUND_SYNC_COOLDOWN_MS = 2_000;
export const STUDENT_SETTINGS_DEFAULT_SYNC_INTERVAL_MS = 10_000;

export const studentSettingsRetryDelay = (failures: number, error: unknown, random = Math.random): number => {
  const retryAfter: unknown = error instanceof Error ? Reflect.get(error, 'retryAfterMs') : undefined;
  const serverDelay = typeof retryAfter === 'number' && Number.isFinite(retryAfter) ? Math.max(0, retryAfter) : 0;
  return Math.max(serverDelay, Math.min(60_000, 5_000 * 2 ** Math.min(4, Math.max(0, failures - 1))) * (1 + random() * 0.2));
};

export const studentSettingsPollInterval = (intervalMs: number, random = Math.random): number => (
  intervalMs + random() * Math.min(2_000, intervalMs * 0.2)
);

export const isStudentSettingsSnapshotFresh = (updatedAt: string | null | undefined, minimumUpdatedAt: string | null) => (
  minimumUpdatedAt === null || (typeof updatedAt === 'string'
    && Number.isFinite(Date.parse(updatedAt)) && Number.isFinite(Date.parse(minimumUpdatedAt))
    && compareStorageTimestamps(updatedAt, minimumUpdatedAt) >= 0)
);

export type StudentSettingsSnapshot = {
  studentNumber: number;
  updatedAt: string;
  value: Record<string, unknown>;
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

export const shouldLoadFullStudentSettings = (
  knownUpdatedAt: string | null,
  nextUpdatedAt: string | null,
) => knownUpdatedAt === null || knownUpdatedAt !== nextUpdatedAt;

export const parseStudentSettingsSnapshot = (
  stored: string,
  studentNumber: number,
): StudentSettingsSnapshot | null => {
  try {
    const parsed: unknown = JSON.parse(stored);
    if (
      !isRecord(parsed)
      || parsed.studentNumber !== studentNumber
      || typeof parsed.updatedAt !== 'string'
      || !Number.isFinite(Date.parse(parsed.updatedAt))
      || !isRecord(parsed.value)
    ) return null;
    return { studentNumber, updatedAt: parsed.updatedAt, value: parsed.value };
  } catch {
    return null;
  }
};

export const loadStudentSettingsSnapshot = (studentNumber: number): StudentSettingsSnapshot | null => {
  try {
    const stored = window.localStorage.getItem(STUDENT_SETTINGS_CACHE_KEY);
    return stored ? parseStudentSettingsSnapshot(stored, studentNumber) : null;
  } catch {
    return null;
  }
};

export const storeStudentSettingsSnapshot = (snapshot: StudentSettingsSnapshot) => {
  try {
    window.localStorage.setItem(STUDENT_SETTINGS_CACHE_KEY, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
};

export const storeStudentProfileSnapshot = (studentNumber: number, studentLife: unknown) => {
  try {
    const snapshot = loadStudentSettingsSnapshot(studentNumber);
    if (!snapshot) return false;
    // A partial receipt must not advance the full-row synchronization timestamp.
    return storeStudentSettingsSnapshot({ ...snapshot, value: { ...snapshot.value, studentLife } });
  } catch {
    return false;
  }
};
import { compareStorageTimestamps } from './storageResponseOrder';
