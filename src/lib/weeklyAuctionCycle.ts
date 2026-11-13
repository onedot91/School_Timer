import { getKoreanDateKey } from './studentEconomy.js';

export type WeeklyAuctionCloseCycle = {
  /** 마감하는 주의 일요일 날짜. 예전 키(월요일 날짜)와 겹치지 않는다. */
  cycleKey: string;
  weekStart: string;
  weekEnd: string;
  label: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const toUtcDay = (dateKey: string): number => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
};

const toDateKey = (time: number): string => new Date(time).toISOString().slice(0, 10);

const toShortLabel = (dateKey: string): string => {
  const [, month, day] = dateKey.split('-').map(Number);
  return `${month}/${day}`;
};

/**
 * 월~수에는 지난주(월~일), 목~일에는 이번 주(월~일)를 마감 대상으로 본다.
 */
export const getWeeklyAuctionCloseCycle = (now: Date = new Date()): WeeklyAuctionCloseCycle => {
  const today = toUtcDay(getKoreanDateKey(now));
  const daysSinceMonday = (new Date(today).getUTCDay() + 6) % 7;
  const thisMonday = today - daysSinceMonday * DAY_MS;
  const monday = daysSinceMonday <= 2 ? thisMonday - 7 * DAY_MS : thisMonday;
  const sunday = monday + 6 * DAY_MS;
  const weekStart = toDateKey(monday);
  const weekEnd = toDateKey(sunday);
  return {
    cycleKey: weekEnd,
    weekStart,
    weekEnd,
    label: `${toShortLabel(weekStart)}~${toShortLabel(weekEnd)}`,
  };
};
