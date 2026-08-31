import { CLASSWORD_WORD_ENTRY_WEEKLY_MISSION_TYPE } from '../lib/weeklyMission.js';

export interface ClasswordMissionConfiguration {
  readonly url: string;
  readonly serviceRoleKey: string;
}

export interface ClasswordMissionEntry {
  readonly id: string;
  readonly studentNumber: number;
  readonly dateKey: string;
}

const createHeaders = (configuration: ClasswordMissionConfiguration) => ({
  Accept: 'application/json',
  apikey: configuration.serviceRoleKey,
  Authorization: `Bearer ${configuration.serviceRoleKey}`,
});

const parseStudentNumber = (row: object, errorCode: string) => {
  const studentNumber = Reflect.get(row, 'student_number');
  if (
    typeof studentNumber !== 'number' ||
    !Number.isInteger(studentNumber) ||
    studentNumber < 1 ||
    studentNumber > 23
  ) throw new Error(errorCode);
  return studentNumber;
};

export const loadClasswordEntries = async (
  configuration: ClasswordMissionConfiguration,
  dateKey: string,
): Promise<ClasswordMissionEntry[]> => {
  const url = new URL(`${configuration.url.replace(/\/$/, '')}/rest/v1/classword_entries`);
  url.searchParams.set('round_date', `eq.${dateKey}`);
  url.searchParams.set('select', 'id,student_number');
  url.searchParams.set('order', 'created_at.asc');
  const response = await fetch(url, {
    headers: createHeaders(configuration),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`CLASSWORD_ENTRY_HTTP_${response.status}`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('CLASSWORD_ENTRY_INVALID_RESPONSE');
  return rows.map((row): ClasswordMissionEntry => {
    if (!row || typeof row !== 'object' || typeof Reflect.get(row, 'id') !== 'string') {
      throw new Error('CLASSWORD_ENTRY_INVALID_RESPONSE');
    }
    return {
      id: String(Reflect.get(row, 'id')),
      studentNumber: parseStudentNumber(row, 'CLASSWORD_ENTRY_INVALID_RESPONSE'),
      dateKey,
    };
  });
};

export const loadFinalizedClasswordEntries = async (
  configuration: ClasswordMissionConfiguration,
  beforeDateKey: string,
): Promise<ClasswordMissionEntry[]> => {
  const pageSize = 1000;
  const entries: ClasswordMissionEntry[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const url = new URL(`${configuration.url.replace(/\/$/, '')}/rest/v1/classword_entries`);
    url.searchParams.set('round_date', `lt.${beforeDateKey}`);
    url.searchParams.set('select', 'id,student_number,round_date');
    url.searchParams.set('order', 'round_date.asc,created_at.asc');
    url.searchParams.set('limit', String(pageSize));
    url.searchParams.set('offset', String(offset));
    const response = await fetch(url, {
      headers: createHeaders(configuration),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`CLASSWORD_ENTRY_HTTP_${response.status}`);
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error('CLASSWORD_ENTRY_INVALID_RESPONSE');
    entries.push(...rows.map((row): ClasswordMissionEntry => {
      const dateKey = row && typeof row === 'object' ? Reflect.get(row, 'round_date') : null;
      if (
        !row || typeof row !== 'object' ||
        typeof Reflect.get(row, 'id') !== 'string' ||
        typeof dateKey !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)
      ) throw new Error('CLASSWORD_ENTRY_INVALID_RESPONSE');
      return {
        id: String(Reflect.get(row, 'id')),
        studentNumber: parseStudentNumber(row, 'CLASSWORD_ENTRY_INVALID_RESPONSE'),
        dateKey,
      };
    }));
    if (rows.length < pageSize) return entries;
  }
};

export const loadFinalizedClasswordRewardKeys = async (
  configuration: ClasswordMissionConfiguration,
  beforeDateKey: string,
): Promise<ReadonlySet<string>> => {
  const pageSize = 1000;
  const rewardKeys = new Set<string>();
  for (let offset = 0; ; offset += pageSize) {
    const url = new URL(`${configuration.url.replace(/\/$/, '')}/rest/v1/weekly_mission_rewards`);
    url.searchParams.set('mission_type', `eq.${CLASSWORD_WORD_ENTRY_WEEKLY_MISSION_TYPE}`);
    url.searchParams.set('week_key', `lt.${beforeDateKey}`);
    url.searchParams.set('select', 'student_number,week_key');
    url.searchParams.set('order', 'week_key.asc,student_number.asc');
    url.searchParams.set('limit', String(pageSize));
    url.searchParams.set('offset', String(offset));
    const response = await fetch(url, {
      headers: createHeaders(configuration),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`WEEKLY_MISSION_REWARDS_HTTP_${response.status}`);
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error('WEEKLY_MISSION_REWARDS_INVALID_RESPONSE');
    rows.forEach((row) => {
      const weekKey = row && typeof row === 'object' ? Reflect.get(row, 'week_key') : null;
      if (typeof weekKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(weekKey) || !row || typeof row !== 'object') {
        throw new Error('WEEKLY_MISSION_REWARDS_INVALID_RESPONSE');
      }
      const studentNumber = parseStudentNumber(row, 'WEEKLY_MISSION_REWARDS_INVALID_RESPONSE');
      rewardKeys.add(`${weekKey}:${studentNumber}`);
    });
    if (rows.length < pageSize) return rewardKeys;
  }
};
