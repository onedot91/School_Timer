import { canonicalStorageJson } from './storageV2Codec.js';

export const TEACHER_SETTING_FIELDS = [
  'weeklySchedule', 'weeklySubjects', 'subjectCatalog', 'scheduleNotice', 'scheduleNoticeHighlights',
  'isNoticeEnabled', 'scheduleClockOffsetSeconds', 'scheduleYoutubeUrls', 'scheduleYoutubeFavorites',
  'isScheduleYoutubeVisible', 'randomDraw', 'manualTimer', 'auctionItems', 'auctionMissions',
  'studentMissionVisibility', 'bookstoreSettings', 'studentShopCatalog', 'studentStockMarket',
] as const;

export type TeacherSettingChange = {
  readonly field: string;
  readonly before: unknown;
  readonly after: unknown;
};

export const isStorageRecord = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

export const selectTeacherSettings = (value: unknown): Record<string, unknown> => {
  const source = isStorageRecord(value) ? value : {};
  const settings: Record<string, unknown> = {};
  for (const field of TEACHER_SETTING_FIELDS) {
    if (source[field] !== undefined) settings[field] = source[field];
  }
  for (const [parent, fields] of [
    ['classroomRoleMission', ['enabled', 'anchorDateKey', 'anchorStartStudentNumber']],
    ['classDonation', ['enabled', 'itemName', 'targetAmount']],
  ] as const) {
    const nested = source[parent];
    if (!isStorageRecord(nested)) continue;
    for (const field of fields) {
      if (nested[field] !== undefined) settings[`${parent}.${field}`] = nested[field];
    }
  }
  return settings;
};

// Compare the same JSON representation sent to the API: optional object fields are omitted.
const persistedSettingJson = (value: unknown): string => (
  canonicalStorageJson(JSON.parse(JSON.stringify(value ?? null)))
);

export const createTeacherSettingsChanges = (base: unknown, value: unknown, persistedBase: unknown = base): TeacherSettingChange[] => {
  const previous = selectTeacherSettings(base);
  const next = selectTeacherSettings(value);
  const persisted = selectTeacherSettings(persistedBase);
  return Object.keys(next).filter(field => persistedSettingJson(previous[field]) !== persistedSettingJson(next[field]))
    .map(field => ({ field, before: persisted[field] ?? null, after: next[field] }));
};

export const applyAcknowledgedTeacherChanges = (
  base: Record<string, unknown>, changes: readonly TeacherSettingChange[],
): Record<string, unknown> => {
  const next = { ...base };
  for (const change of changes) {
    const [parent, child] = change.field.split('.');
    if (child) next[parent] = { ...(isStorageRecord(next[parent]) ? next[parent] : {}), [child]: change.after };
    else next[parent] = change.after;
  }
  return next;
};
