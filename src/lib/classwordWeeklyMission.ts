export interface KoreanWeekDateRange {
  readonly startDate: string;
  readonly endDate: string;
  readonly today: string;
}

const formatUtcDateKey = (date: Date) => date.toISOString().slice(0, 10);

export const getKoreanWeekDateRange = (date = new Date()): KoreanWeekDateRange => {
  const koreanTime = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const today = new Date(Date.UTC(
    koreanTime.getUTCFullYear(),
    koreanTime.getUTCMonth(),
    koreanTime.getUTCDate(),
  ));
  const weekday = today.getUTCDay() || 7;
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() - weekday + 1);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  return {
    startDate: formatUtcDateKey(monday),
    endDate: formatUtcDateKey(sunday),
    today: formatUtcDateKey(today),
  };
};
