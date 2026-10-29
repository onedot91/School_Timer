export type TeacherSeasonalTheme = 'halloween';

const HALLOWEEN_MONTH_INDEX = 9;
const HALLOWEEN_DAYS = new Set([30, 31]);

export const getTeacherSeasonalTheme = (date: Date): TeacherSeasonalTheme | null => {
  if (Number.isNaN(date.getTime())) return null;
  if (date.getMonth() === HALLOWEEN_MONTH_INDEX && HALLOWEEN_DAYS.has(date.getDate())) return 'halloween';
  return null;
};
