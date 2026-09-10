import assert from 'node:assert/strict';
import test from 'node:test';
import { getStudentEmotionExcusedDay, isStudentEmotionWeekComplete } from './studentEmotionCalendar';
import { getSchoolWeekDateKeys } from './studentEmotion';

test('학교 휴업 예외는 2026년 9월 10일에만 적용한다', () => {
  assert.equal(getStudentEmotionExcusedDay('2026-09-10'), '학교 쉬는 날');
  for (const date of ['2026-09-09', '2026-09-11', '2026-09-17', '2027-09-10', '__proto__']) {
    assert.equal(getStudentEmotionExcusedDay(date), null);
  }
  const week = getSchoolWeekDateKeys(new Date(2026, 8, 11));
  assert.equal(isStudentEmotionWeekComplete(week, new Set(week.filter(day => day !== '2026-09-10'))), true);
  assert.equal(isStudentEmotionWeekComplete(week, new Set(['2026-09-07', '2026-09-08', '2026-09-09'])), false);
  assert.equal(isStudentEmotionWeekComplete([], new Set()), false);
});

test('추석과 대체공휴일은 미리 인정하되 일반 평일은 기록해야 한다', () => {
  const chuseok = getSchoolWeekDateKeys(new Date(2026, 8, 21));
  assert.equal(isStudentEmotionWeekComplete(chuseok, new Set(chuseok.slice(0, 3))), true);
  assert.equal(isStudentEmotionWeekComplete(chuseok, new Set(chuseok.slice(0, 2))), false);
  for (const date of ['2026-03-02', '2026-05-25', '2026-08-17', '2026-10-05', '2027-02-09', '2027-05-03', '2027-07-19', '2027-08-16', '2027-10-04', '2027-10-11', '2027-12-27']) {
    assert.match(getStudentEmotionExcusedDay(date) ?? '', /대체공휴일/);
  }
  assert.equal(getStudentEmotionExcusedDay('2026-09-28'), null);
  assert.equal(getStudentEmotionExcusedDay('2027-06-07'), null);
});
