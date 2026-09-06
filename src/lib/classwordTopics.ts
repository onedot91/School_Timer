import { getKoreanDateKey, isClasswordMonthKey, type ClasswordRoundSummary } from './classword.js';
import { TOPICS_SCHOOL } from './classwordCatalog/topicsSchool.js';
import { TOPICS_NATURE } from './classwordCatalog/topicsNature.js';
import { TOPICS_LIFE } from './classwordCatalog/topicsLife.js';
import type { ClasswordTopicSeed } from './classwordCatalog/types.js';
import {
  arrangeClasswordCatalog, CLASSWORD_ANNUAL_START, ClasswordScheduleError,
  getClasswordWeekdayIndex, isClasswordWeekday,
} from './classwordSchedule.js';

export const CLASSWORD_TOPICS_V1: readonly ClasswordTopicSeed[] = arrangeClasswordCatalog<ClasswordTopicSeed>([
  ...TOPICS_SCHOOL, ...TOPICS_NATURE, ...TOPICS_LIFE,
], 9072026);

export const resolveClasswordTopic = (dateKey: string, storedTopic: string): {
  readonly topic: string;
  readonly source: 'automatic' | 'teacher';
} => {
  if (storedTopic.trim()) return { topic: storedTopic.trim(), source: 'teacher' };
  if (dateKey < CLASSWORD_ANNUAL_START) return { topic: '', source: 'automatic' };
  const index = getClasswordWeekdayIndex(dateKey) % CLASSWORD_TOPICS_V1.length;
  return { topic: CLASSWORD_TOPICS_V1[index]?.title ?? '', source: 'automatic' };
};

export const resolveClasswordMonth = (
  monthKey: string,
  storedRounds: readonly ClasswordRoundSummary[],
): readonly ClasswordRoundSummary[] => {
  const firstDay = new Date(`${monthKey}-01T00:00:00Z`);
  if (!isClasswordMonthKey(monthKey) || !Number.isFinite(firstDay.getTime())) {
    throw new ClasswordScheduleError('CLASSWORD_INVALID_DATE');
  }
  const rounds: ClasswordRoundSummary[] = [];
  for (const day = firstDay; day.toISOString().startsWith(monthKey); day.setUTCDate(day.getUTCDate() + 1)) {
    const dateKey = day.toISOString().slice(0, 10);
    const stored = storedRounds.find((round) => round.dateKey === dateKey);
    if (stored || (dateKey >= CLASSWORD_ANNUAL_START && isClasswordWeekday(dateKey))) {
      rounds.push({ dateKey, ...resolveClasswordTopic(dateKey, stored?.topic ?? '') });
    }
  }
  return rounds;
};

export const getElapsedClasswordTopics = (today = getKoreanDateKey()): readonly string[] => {
  if (today < CLASSWORD_ANNUAL_START) return [];
  const count = Math.min(getClasswordWeekdayIndex(today) + 1, CLASSWORD_TOPICS_V1.length);
  return CLASSWORD_TOPICS_V1.slice(0, count).map((topic) => topic.title);
};

export const getClasswordTopicCandidates = (usedTopics: readonly string[]): readonly string[] => {
  const used = new Set(usedTopics.map((topic) => topic.trim()));
  return CLASSWORD_TOPICS_V1.map((topic) => topic.title).filter((title) => !used.has(title));
};
