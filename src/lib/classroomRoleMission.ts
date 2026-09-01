import { CURRENCY_STUDENT_NUMBERS } from './currency.js';

export const CLASSROOM_ROLE_MISSION_REWARD = 20;
export const CLASSROOM_ROLE_MISSION_STORAGE_KEY = 'classroomRoleMission-v1';
export const DEFAULT_CLASSROOM_ROLE_ANCHOR_DATE_KEY = '2026-08-26';
export const CLASSROOM_ROLE_NAMES = [
  '칠판 전문가',
  '재활용 전문가',
  '크롬북 전문가',
  '밀대 전문가',
  '물수건 전문가',
  '우유 전문가',
] as const;

export const CLASSROOM_ROLE_ASSIGNMENT_NAMES = [
  ...CLASSROOM_ROLE_NAMES,
  '우유 전문가',
] as const;

export type ClassroomRoleName = (typeof CLASSROOM_ROLE_NAMES)[number];
export type ClassroomRoleMissionResult = 'rewarded' | 'penalized';

export interface ClassroomRoleAssignment {
  readonly roleName: ClassroomRoleName;
  readonly studentNumber: number;
}

export interface ClassroomRoleMissionSettings {
  readonly enabled: boolean;
  readonly anchorDateKey: string;
  readonly anchorStartStudentNumber: number;
  readonly results: Readonly<Record<string, Readonly<Record<string, ClassroomRoleMissionResult>>>>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const formatLocalDateKey = (date: Date) => {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getTodayClassroomRoleDateKey = () => formatLocalDateKey(new Date());

const parseDateKeyAtUtcNoon = (dateKey: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day, 12);
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) return null;
  return timestamp;
};

const normalizeStudentNumber = (value: unknown) => {
  const numericValue = typeof value === 'number' ? value : Number(value);
  const roundedValue = Number.isFinite(numericValue) ? Math.floor(numericValue) : 1;
  return CURRENCY_STUDENT_NUMBERS.includes(roundedValue) ? roundedValue : 1;
};

const normalizeResults = (value: unknown): ClassroomRoleMissionSettings['results'] => {
  if (!isRecord(value)) return {};
  const results: Record<string, Record<string, ClassroomRoleMissionResult>> = {};
  Object.entries(value)
    .sort(([leftDateKey], [rightDateKey]) => rightDateKey.localeCompare(leftDateKey))
    .slice(0, 31)
    .forEach(([dateKey, rawDailyResults]) => {
      if (parseDateKeyAtUtcNoon(dateKey) === null || !isRecord(rawDailyResults)) return;
      const dailyResults: Record<string, ClassroomRoleMissionResult> = {};
      Object.entries(rawDailyResults).forEach(([studentKey, result]) => {
        if (
          CURRENCY_STUDENT_NUMBERS.includes(Number(studentKey))
          && (result === 'rewarded' || result === 'penalized')
        ) dailyResults[studentKey] = result;
      });
      if (Object.keys(dailyResults).length > 0) results[dateKey] = dailyResults;
    });
  return results;
};

export const normalizeClassroomRoleMissionSettings = (
  value: unknown,
  fallbackDateKey = DEFAULT_CLASSROOM_ROLE_ANCHOR_DATE_KEY,
): ClassroomRoleMissionSettings => {
  const parsed = isRecord(value) ? value : {};
  const anchorDateKey = typeof parsed.anchorDateKey === 'string'
    && parseDateKeyAtUtcNoon(parsed.anchorDateKey) !== null
    ? parsed.anchorDateKey
    : fallbackDateKey;
  return {
    enabled: parsed.enabled !== false,
    anchorDateKey,
    anchorStartStudentNumber: normalizeStudentNumber(parsed.anchorStartStudentNumber),
    results: normalizeResults(parsed.results),
  };
};

const getDateOffset = (anchorDateKey: string, dateKey: string) => {
  const anchorTimestamp = parseDateKeyAtUtcNoon(anchorDateKey);
  const dateTimestamp = parseDateKeyAtUtcNoon(dateKey);
  if (anchorTimestamp === null || dateTimestamp === null) return 0;
  return Math.floor((dateTimestamp - anchorTimestamp) / 86_400_000);
};

const wrapStudentNumber = (value: number) => (
  ((value - 1) % CURRENCY_STUDENT_NUMBERS.length + CURRENCY_STUDENT_NUMBERS.length)
  % CURRENCY_STUDENT_NUMBERS.length + 1
);

export const getClassroomRoleAssignments = (
  settingsValue: unknown,
  dateKey = getTodayClassroomRoleDateKey(),
): readonly ClassroomRoleAssignment[] => {
  const settings = normalizeClassroomRoleMissionSettings(settingsValue);
  if (!settings.enabled) return [];
  const firstStudentNumber = wrapStudentNumber(
    settings.anchorStartStudentNumber + getDateOffset(settings.anchorDateKey, dateKey),
  );
  return CLASSROOM_ROLE_ASSIGNMENT_NAMES.map((roleName, index) => ({
    roleName,
    studentNumber: wrapStudentNumber(firstStudentNumber + index),
  }));
};

export const getStudentClassroomRole = (
  settingsValue: unknown,
  studentNumber: number,
  dateKey = getTodayClassroomRoleDateKey(),
) => getClassroomRoleAssignments(settingsValue, dateKey)
  .find((assignment) => assignment.studentNumber === studentNumber) ?? null;

export const setClassroomRoleMissionStartForDate = (
  settingsValue: unknown,
  studentNumber: number,
  dateKey = getTodayClassroomRoleDateKey(),
): ClassroomRoleMissionSettings => {
  const settings = normalizeClassroomRoleMissionSettings(settingsValue);
  return {
    ...settings,
    anchorDateKey: dateKey,
    anchorStartStudentNumber: normalizeStudentNumber(studentNumber),
    results: Object.fromEntries(
      Object.entries(settings.results).filter(([resultDateKey]) => resultDateKey !== dateKey),
    ),
  };
};

export const setClassroomRoleMissionResult = (
  settingsValue: unknown,
  studentNumber: number,
  result: ClassroomRoleMissionResult | undefined,
  dateKey = getTodayClassroomRoleDateKey(),
): ClassroomRoleMissionSettings => {
  const settings = normalizeClassroomRoleMissionSettings(settingsValue);
  const studentKey = String(normalizeStudentNumber(studentNumber));
  const dailyResults = settings.results[dateKey] ?? {};
  if (dailyResults[studentKey] === result) return settings;
  if (result === undefined) {
    const nextDailyResults = Object.fromEntries(
      Object.entries(dailyResults).filter(([resultStudentKey]) => resultStudentKey !== studentKey),
    );
    const nextResults = Object.fromEntries(
      Object.entries(settings.results).filter(([resultDateKey]) => resultDateKey !== dateKey),
    );
    if (Object.keys(nextDailyResults).length > 0) nextResults[dateKey] = nextDailyResults;
    return { ...settings, results: nextResults };
  }
  return {
    ...settings,
    results: {
      ...settings.results,
      [dateKey]: { ...dailyResults, [studentKey]: result },
    },
  };
};

export const getClassroomRoleMissionBalanceDelta = (
  previousResult: ClassroomRoleMissionResult | undefined,
  nextResult: ClassroomRoleMissionResult | undefined,
) => {
  if (previousResult === nextResult) return 0;
  if (nextResult === undefined) {
    return previousResult === 'rewarded'
      ? -CLASSROOM_ROLE_MISSION_REWARD
      : CLASSROOM_ROLE_MISSION_REWARD;
  }
  if (nextResult === 'rewarded') {
    return previousResult === 'penalized'
      ? CLASSROOM_ROLE_MISSION_REWARD * 2
      : CLASSROOM_ROLE_MISSION_REWARD;
  }
  return previousResult === 'rewarded'
    ? CLASSROOM_ROLE_MISSION_REWARD * -2
    : -CLASSROOM_ROLE_MISSION_REWARD;
};

export const loadStoredClassroomRoleMissionSettings = () => {
  try {
    const saved = localStorage.getItem(CLASSROOM_ROLE_MISSION_STORAGE_KEY);
    return normalizeClassroomRoleMissionSettings(saved ? JSON.parse(saved) : null);
  } catch (error) {
    if (error instanceof Error) return normalizeClassroomRoleMissionSettings(null);
    throw error;
  }
};

export const storeClassroomRoleMissionSettings = (value: unknown) => {
  try {
    localStorage.setItem(
      CLASSROOM_ROLE_MISSION_STORAGE_KEY,
      JSON.stringify(normalizeClassroomRoleMissionSettings(value)),
    );
    return true;
  } catch (error) {
    if (error instanceof Error) return false;
    throw error;
  }
};
