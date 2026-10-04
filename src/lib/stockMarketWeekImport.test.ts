import assert from 'node:assert/strict';
import test from 'node:test';
import { createTeacherSettingsChanges } from './teacherStorageCommand';
import {
  getInvestmentWeekDateKeys,
  normalizeStudentStockMarket,
  STUDENT_STOCKS,
  upsertStudentStockMarketEntry,
} from './studentEconomy';
import { applyStockMarketWeekImport, buildStockMarketWeekImportTemplate, parseStockMarketWeekImport } from './stockMarketWeekImport';

const weekDate = '2026-10-05';
const weekDates = getInvestmentWeekDateKeys(weekDate);
const rows = weekDates.flatMap((date, day) => STUDENT_STOCKS.map((stock, index) =>
  `${date} | ${stock.name} | ${[-50, -10, 0, 20, 50][day]}% | ${day + 1}일 ${index + 1}종목 이유`));
const input = ['날짜 | 종목 | 등락 | 이유', ...rows].join('\n');

test('한 주의 20개 등락과 날짜별 이유를 정렬해 읽고 월말·연말 경계도 지원한다', () => {
  const parsed = parseStockMarketWeekImport(input, '2026-10-11');
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.entries.length, 20);
  assert.deepEqual(parsed.entries[0], { dateKey: '2026-10-05', stockId: 'sunny', returnPercent: -50, comment: '1일 1종목 이유' });
  assert.deepEqual(parsed.entries[19], { dateKey: '2026-10-09', stockId: 'star', returnPercent: 50, comment: '5일 4종목 이유' });
  const reversed = parseStockMarketWeekImport([...rows].reverse().join('\r\n'), weekDate);
  assert.deepEqual(reversed, parsed);
  for (const date of ['2026-09-30', '2026-12-31']) {
    const template = buildStockMarketWeekImportTemplate(date);
    const completed = template.replaceAll(' |  | ', ' | +10% | 이유');
    const result = parseStockMarketWeekImport(completed, date);
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual([...new Set(result.entries.map(entry => entry.dateKey))], getInvestmentWeekDateKeys(date));
  }
});

test('이유가 빈 행과 Markdown 표를 읽고 입력 양식은 등락 입력 전 등록할 수 없다', () => {
  const blankReasons = rows.map(row => row.split('|').slice(0, 3).join('|') + '|').join('\n');
  const empty = parseStockMarketWeekImport(blankReasons, weekDate);
  assert.equal(empty.ok, true);
  if (empty.ok) assert.ok(empty.entries.every(entry => entry.comment === ''));
  const markdown = ['```text', '| 날짜 | 종목 | 등락 | 이유 |', '| --- | --- | --- | --- |', ...rows.map(row => `| ${row} |`), '```'].join('\n');
  assert.deepEqual(parseStockMarketWeekImport(markdown, weekDate), parseStockMarketWeekImport(input, weekDate));
  assert.equal(parseStockMarketWeekImport(buildStockMarketWeekImportTemplate(weekDate), weekDate).ok, false);
});

test('잘못된 날짜·종목·등락·긴 이유·중복·누락은 전체 등록을 막는다', () => {
  const invalidFirstRows = [
    rows[0].replace(weekDate, '2026-10-12'),
    rows[0].replace(weekDate, '2026-10-10'),
    rows[0].replace(weekDate, '2026-02-30'),
    rows[0].replace('냠냠푸드', '알 수 없는 종목'),
    ...['', '5%', '51%', '-60%', 'NaN', '1e1', '+10.5%', '10%%'].map(value => rows[0].replace('-50%', value)),
    rows[0].replace('1일 1종목 이유', '가'.repeat(121)),
  ];
  for (const firstRow of invalidFirstRows) {
    const result = parseStockMarketWeekImport([firstRow, ...rows.slice(1)].join('\n'), weekDate);
    assert.equal(result.ok, false, firstRow);
    assert.ok('errors' in result && result.errors.length > 0);
    assert.ok(!('entries' in result));
  }
  assert.equal(parseStockMarketWeekImport([...rows, rows[0]].join('\n'), weekDate).ok, false);
  assert.equal(parseStockMarketWeekImport(rows.slice(1).join('\n'), weekDate).ok, false);
  assert.equal(parseStockMarketWeekImport('', weekDate).ok, false);
});

test('일괄 등록은 해당 주만 갱신하고 다른 주·투자 설정·학생 기록을 보존한다', () => {
  let market = upsertStudentStockMarketEntry({}, 'sunny', { dateKey: '2026-09-25', stage: 'rise', returnPercent: 10, comment: '이전 주 이유' });
  market = upsertStudentStockMarketEntry(market, 'sunny', { dateKey: weekDate, stage: 'flat', returnPercent: 0, comment: '기존 이유' });
  const before = { studentStockMarket: market, studentEconomy: { 1: { deposit: 73 } }, weeklySchedule: { 1: [] } };
  const result = parseStockMarketWeekImport(input, weekDate);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const nextMarket = applyStockMarketWeekImport(market, result.entries);
  assert.equal(nextMarket.sunny?.find(entry => entry.dateKey === weekDate)?.stage, 'big_fall');
  assert.equal(nextMarket.sunny?.find(entry => entry.dateKey === weekDate)?.comment, '1일 1종목 이유');
  assert.equal(nextMarket.sunny?.find(entry => entry.dateKey === '2026-09-25')?.comment, '이전 주 이유');
  assert.deepEqual(nextMarket.settings, market.settings);
  assert.equal(STUDENT_STOCKS.reduce((sum, stock) => sum + (nextMarket[stock.id]?.length ?? 0), 0), 21);
  assert.deepEqual(applyStockMarketWeekImport(nextMarket, result.entries), nextMarket);
  assert.deepEqual(normalizeStudentStockMarket(nextMarket), nextMarket);
  const changes = createTeacherSettingsChanges(before, { ...before, studentStockMarket: nextMarket });
  assert.deepEqual(changes.map(change => change.field), ['studentStockMarket']);
  assert.deepEqual(changes[0].before, market);
  assert.deepEqual(changes[0].after, nextMarket);
  assert.deepEqual(before.studentEconomy, { 1: { deposit: 73 } });
});
