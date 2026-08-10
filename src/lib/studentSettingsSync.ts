export type StudentSyncView = 'overview' | 'emotions' | 'missions' | 'store';

export const STUDENT_SETTINGS_CACHE_KEY = 'school-timer-student-settings-snapshot-v1';

export const STUDENT_SETTINGS_SYNC_INTERVAL_MS: Partial<Record<StudentSyncView, number>> = {
  overview: 300_000,
  store: 30_000,
};

export const STUDENT_FOREGROUND_SYNC_COOLDOWN_MS = 30_000;

export type StudentSettingsSnapshot = {
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

export const loadStudentSettingsSnapshot = (): StudentSettingsSnapshot | null => {
  try {
    const stored = window.localStorage.getItem(STUDENT_SETTINGS_CACHE_KEY);
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    if (!isRecord(parsed) || typeof parsed.updatedAt !== 'string' || !isRecord(parsed.value)) return null;
    return { updatedAt: parsed.updatedAt, value: parsed.value };
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
