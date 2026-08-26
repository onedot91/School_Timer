export type StudentSyncView = 'overview' | 'emotions' | 'missions' | 'store';

export const STUDENT_SETTINGS_CACHE_KEY = 'school-timer-student-settings-snapshot-v2';

export const STUDENT_SETTINGS_SYNC_INTERVAL_MS: Partial<Record<StudentSyncView, number>> = {
  overview: 10_000,
  store: 2_000,
};

export const STUDENT_FOREGROUND_SYNC_COOLDOWN_MS = 2_000;

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
      || !isRecord(parsed.value)
    ) return null;
    return { studentNumber, updatedAt: parsed.updatedAt, value: parsed.value };
  } catch {
    return null;
  }
};

export const loadStudentSettingsSnapshot = (studentNumber: number): StudentSettingsSnapshot | null => {
  const stored = window.localStorage.getItem(STUDENT_SETTINGS_CACHE_KEY);
  return stored ? parseStudentSettingsSnapshot(stored, studentNumber) : null;
};

export const storeStudentSettingsSnapshot = (snapshot: StudentSettingsSnapshot) => {
  try {
    window.localStorage.setItem(STUDENT_SETTINGS_CACHE_KEY, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
};
