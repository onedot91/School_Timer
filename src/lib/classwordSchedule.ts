import { getKoreanDateKey, isClasswordDateKey } from './classword.js';

// Published schedules are immutable: introduce a new dated version for future catalogs.
export const CLASSWORD_ANNUAL_START = '2026-09-07';
const DAY_MS = 86_400_000;
const START_TIME = Date.parse(`${CLASSWORD_ANNUAL_START}T00:00:00Z`);

export class ClasswordScheduleError extends Error {
  readonly code: 'CLASSWORD_INVALID_DATE' | 'CLASSWORD_WEEKEND_CLOSED' | 'TODAY_ONLY';

  constructor(code: ClasswordScheduleError['code']) {
    super(code);
    this.name = 'ClasswordScheduleError';
    this.code = code;
  }
}

const parseDay = (dateKey: string): Date => {
  const day = new Date(`${dateKey}T00:00:00Z`);
  if (!isClasswordDateKey(dateKey) || !Number.isFinite(day.getTime())
    || day.toISOString().slice(0, 10) !== dateKey) {
    throw new ClasswordScheduleError('CLASSWORD_INVALID_DATE');
  }
  return day;
};

export const isClasswordWeekday = (dateKey: string): boolean => {
  const weekday = parseDay(dateKey).getUTCDay();
  return weekday !== 0 && weekday !== 6;
};

export const getClasswordDisplayDate = (dateKey: string): string => {
  const day = parseDay(dateKey);
  const weekday = day.getUTCDay();
  if (weekday === 0 || weekday === 6) day.setUTCDate(day.getUTCDate() - (weekday === 0 ? 2 : 1));
  return day.toISOString().slice(0, 10);
};

export const getClasswordWeekdayIndex = (dateKey: string): number => {
  const elapsedDays = Math.floor((parseDay(getClasswordDisplayDate(dateKey)).getTime() - START_TIME) / DAY_MS);
  return Math.floor(elapsedDays / 7) * 5 + Math.min(((elapsedDays % 7) + 7) % 7, 4);
};

export const assertClasswordParticipation = (dateKey: string, today = getKoreanDateKey()): void => {
  parseDay(dateKey);
  if (!isClasswordWeekday(today)) throw new ClasswordScheduleError('CLASSWORD_WEEKEND_CLOSED');
  if (dateKey !== today) throw new ClasswordScheduleError('TODAY_ONLY');
};

/** Stable group interleaving avoids adjacent semantic families, including the cycle seam. */
export const arrangeClasswordCatalog = <T extends { readonly family: string }>(
  values: readonly T[],
  seed: number,
): readonly T[] => {
  let randomState = seed >>> 0;
  const nextRandom = (): number => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 4_294_967_296;
  };
  const groups = new Map<string, T[]>();
  for (const value of values) groups.set(value.family, [...(groups.get(value.family) ?? []), value]);
  for (const group of groups.values()) {
    for (let index = group.length - 1; index > 0; index -= 1) {
      const other = Math.floor(nextRandom() * (index + 1));
      const left = group[index];
      const right = group[other];
      if (left && right) { group[index] = right; group[other] = left; }
    }
  }
  const result: T[] = [];
  while (result.length < values.length) {
    const candidates = [...groups.entries()]
      .filter(([family, group]) => group.length > 0 && family !== result.at(-1)?.family)
      .map(([family, group]) => ({ family, group, tie: nextRandom() }))
      .sort((left, right) => right.group.length - left.group.length || left.tie - right.tie);
    const candidate = candidates[0];
    const value = candidate?.group.pop();
    if (!value) throw new RangeError('CLASSWORD_CATALOG_FAMILY_IMBALANCE');
    result.push(value);
  }
  if (result.length > 1 && result[0]?.family === result.at(-1)?.family) {
    const last = result.at(-1);
    const replacementIndex = result.findIndex((value, index) => index > 0 && index < result.length - 2
      && value.family !== result[0]?.family && value.family !== result.at(-2)?.family
      && result[index - 1]?.family !== last?.family && result[index + 1]?.family !== last?.family);
    const replacement = result[replacementIndex];
    if (!last || !replacement) throw new RangeError('CLASSWORD_CATALOG_CYCLE_CONFLICT');
    result[replacementIndex] = last;
    result[result.length - 1] = replacement;
  }
  return result;
};
