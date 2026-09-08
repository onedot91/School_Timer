import type { ExpectedReward, RewardAuditFeature } from '../lib/rewardAudit.js';
import { DAILY_EMOTION_MISSION_REWARD, WEEKLY_EMOTION_MISSION_REWARD } from '../lib/currency.js';
import { normalizeStudentEmotionHistory, getSchoolWeekDateKeys } from '../lib/studentEmotion.js';
import { createSudokuPuzzle, isSudokuSolved, normalizeStudentSudokuProgress, getSudokuWeeklyMissionId, SUDOKU_REWARDS } from '../lib/sudoku.js';
import { createNumberBaseballAnswer, getNumberBaseballStatus, getNumberBaseballReward, normalizeStudentNumberBaseballProgress } from '../lib/numberBaseball.js';
import { normalizeFailureStories } from '../lib/failureExhibition.js';
import { normalizeStudentLifeState } from '../lib/studentLife.js';
import { DAILY_WRITING_REWARD, normalizeDailyWritingState } from '../lib/dailyWriting.js';
import { getKoreanIsoWeekKey, FAILURE_EXHIBITION_WEEKLY_REWARD, BOOK_STACK_WEEKLY_REWARD } from '../lib/weeklyMission.js';
import { isStorageRecord } from '../lib/storageV2Codec.js';

const validDate = (dateKey: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return false;
  const date = new Date(`${dateKey}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === dateKey;
};
const validTime = (value: string | null): value is string => value !== null && Number.isFinite(Date.parse(value));
const validPeriod = (period: string): boolean => validDate(period) || /^\d{4}-(?:0[1-9]|[1-4]\d|5[0-3])$/.test(period);

export const collectActivityRewardExpectations = (settings: Record<string, unknown>): {
  expected: ExpectedReward[];
  unavailableSources: string[];
} => {
  const expected = new Map<string, ExpectedReward>();
  const unavailable = new Set([
    '1인1역: 대상 날짜와 지급 요청을 확정 연결할 증빙이 없어 검사할 수 없습니다. 화면 정규화는 31일만 보존합니다.',
    '글쓰기: 현재 과제의 교사 완료 표시만 검사하며 이전 과제 완료 여부는 확인할 수 없습니다.',
    '실패 전시회·책 쌓기: 남아 있는 원천만 검사합니다. 삭제·초기화 및 실패 기록 300개 보존 한도 이전은 확인할 수 없습니다.',
    '레거시 활동: 저장되지 않았거나 제거된 완료 기록과 별도 복구 지급은 활동 데이터만으로 확인할 수 없습니다.',
  ]);
  const add = (feature: RewardAuditFeature, studentNumber: number, dateKey: string, amount: number | null, id: string, ledgerIds: readonly string[] = [id], includeSuffix = false) => {
    expected.set(`${studentNumber}:${id}`, { id, feature, studentNumber, dateKey, amount, ledgerIds, ...(includeSuffix ? { includeSuffix: true } : {}) });
  };

  for (const [studentKey, entries] of Object.entries(normalizeStudentEmotionHistory(settings.studentEmotionHistory))) {
    const studentNumber = Number(studentKey);
    const dates = new Set(entries.map(entry => entry.dateKey).filter(validDate));
    const checkedMondays = new Set<string>();
    for (const dateKey of dates) {
      add('emotion', studentNumber, dateKey, DAILY_EMOTION_MISSION_REWARD, `daily-emotion-${studentNumber}-${dateKey}`);
      const [year, month, day] = dateKey.split('-').map(Number);
      const weekdays = getSchoolWeekDateKeys(new Date(year, month - 1, day, 12));
      const monday = weekdays[0];
      if (!checkedMondays.has(monday) && weekdays.every(date => dates.has(date))) {
        add('weeklyEmotion', studentNumber, monday, WEEKLY_EMOTION_MISSION_REWARD, `weekly-emotion-${studentNumber}-${monday}`);
      }
      checkedMondays.add(monday);
    }
  }

  const sudokuCompletions = Object.entries(normalizeStudentSudokuProgress(settings.studentSudoku))
    .filter(([, entry]) => validTime(entry.completedAt))
    .sort(([, left], [, right]) => Date.parse(left.completedAt ?? '') - Date.parse(right.completedAt ?? ''));
  for (const [key, entry] of sudokuCompletions) {
    const [studentKey, period, difficultyKey] = key.split(':');
    const difficulty = difficultyKey === 'basic' ? 'basic' : 'challenge';
    const studentNumber = Number(studentKey);
    if (!validPeriod(period)) continue;
    const puzzle = createSudokuPuzzle(studentNumber, period, difficulty);
    if (entry.puzzleId !== puzzle.id || !isSudokuSolved(puzzle, entry.cells)) {
      unavailable.add('스도쿠: 일부 완료 표시의 퍼즐 또는 정답을 검증할 수 없어 제외했습니다.');
      continue;
    }
    const legacyId = `sudoku-reward-${puzzle.id}`;
    const id = validDate(period) ? legacyId : `sudoku-reward-${getSudokuWeeklyMissionId(studentNumber, period)}`;
    if (expected.has(`${studentNumber}:${id}`)) continue;
    add('sudoku', studentNumber, period, SUDOKU_REWARDS[difficulty], id, id === legacyId ? [id] : [id, legacyId]);
  }

  for (const [key, entry] of Object.entries(normalizeStudentNumberBaseballProgress(settings.studentNumberBaseball))) {
    const [studentKey, period] = key.split(':');
    const studentNumber = Number(studentKey);
    if (!validPeriod(period) || !validTime(entry.completedAt)) continue;
    if (getNumberBaseballStatus(entry, createNumberBaseballAnswer(studentNumber, period)) !== 'completed') continue;
    const amount = getNumberBaseballReward(entry.attempts.length);
    if (amount !== null) add('baseball', studentNumber, period, amount, `number-baseball-reward-${entry.gameId}`);
  }

  const life = isStorageRecord(settings.studentLife) ? settings.studentLife : {};
  // Normalize each raw story independently so the UI's 300-row cap does not hide retained audit evidence.
  for (const rawStory of Array.isArray(life.failureStories) ? life.failureStories : []) {
    const story = normalizeFailureStories([rawStory])[0];
    if (!story || !validTime(story.createdAt)) continue;
    const week = getKoreanIsoWeekKey(new Date(story.createdAt));
    add('failure', story.studentNumber, week, FAILURE_EXHIBITION_WEEKLY_REWARD, `weekly-mission-failure_exhibition-${story.studentNumber}-${week}`);
  }
  for (const book of normalizeStudentLifeState({ books: life.books }).books) {
    if (book.librarySlot === undefined || !validTime(book.createdAt)) continue;
    const week = getKoreanIsoWeekKey(new Date(book.createdAt));
    add('bookStack', book.studentNumber, week, BOOK_STACK_WEEKLY_REWARD, `weekly-mission-book_stack-${book.studentNumber}-${week}`);
  }

  const writing = normalizeDailyWritingState(settings.dailyWriting);
  if (writing.assignment && validDate(writing.assignment.dateKey)) {
    for (const studentNumber of writing.completedStudentNumbers) {
      add('writing', studentNumber, writing.assignment.dateKey, DAILY_WRITING_REWARD,
        `daily-writing-reward-${writing.assignment.dateKey}-${studentNumber}`,
        [`daily-writing-reward-${writing.assignment.dateKey}-${studentNumber}`], true);
    }
  }
  return { expected: [...expected.values()], unavailableSources: [...unavailable] };
};
