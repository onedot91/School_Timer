import type { ClassPrepSource } from './useClassPrepState';

// Browser-only: mirrors the teacher timer's localStorage keys for no-Supabase mode.
export const CLASS_PREP_RELEASE_STORAGE_KEY = 'classPrepRelease-v1';
const WEEKLY_SCHEDULE_STORAGE_KEY = 'weeklySchedule';
const WEEKLY_SUBJECTS_STORAGE_KEY = 'weeklySubjects-v1';
const CLOCK_OFFSET_STORAGE_KEY = 'scheduleClockOffsetSeconds';

const readJson = (storage: Storage, key: string): unknown => {
  try {
    const raw = storage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
};

export const loadStoredClassPrepSource = (storage: Storage): ClassPrepSource => ({
  weeklySchedule: readJson(storage, WEEKLY_SCHEDULE_STORAGE_KEY),
  weeklySubjects: readJson(storage, WEEKLY_SUBJECTS_STORAGE_KEY),
  clockOffsetSeconds: readJson(storage, CLOCK_OFFSET_STORAGE_KEY),
  release: readJson(storage, CLASS_PREP_RELEASE_STORAGE_KEY),
});
