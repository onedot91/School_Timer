import {
  getInvestmentStageFromPercent,
  getInvestmentWeekDateKeys,
  STUDENT_STOCKS,
  upsertStudentStockMarketEntry,
  type StudentStockId,
  type StudentStockMarket,
} from './studentEconomy';

export interface StockMarketWeekImportEntry {
  readonly dateKey: string;
  readonly stockId: StudentStockId;
  readonly returnPercent: number | 'closed';
  readonly comment: string;
}

export type StockMarketWeekImportResult =
  | { readonly ok: true; readonly entries: readonly StockMarketWeekImportEntry[] }
  | { readonly ok: false; readonly errors: readonly string[] };

const HEADER = '날짜 | 종목 | 등락 | 이유';

export const getStockMarketWeekLabel = (dateKey: string, todayDateKey: string) => {
  const selectedMonday = getInvestmentWeekDateKeys(dateKey)[0];
  const currentMonday = getInvestmentWeekDateKeys(todayDateKey)[0];
  const offset = Math.round((Date.parse(selectedMonday) - Date.parse(currentMonday)) / (7 * 24 * 60 * 60 * 1000));
  if (offset === 0) return '이번 주';
  if (offset === -1) return '지난 주';
  if (offset === 1) return '다음 주';
  return offset < 0 ? `${-offset}주 전` : `${offset}주 후`;
};

export const buildStockMarketWeekImportTemplate = (dateKey: string) => [
  HEADER,
  ...getInvestmentWeekDateKeys(dateKey).flatMap(date => STUDENT_STOCKS.map(stock => `${date} | ${stock.name} |  | `)),
].join('\n');

export const parseStockMarketWeekImport = (text: string, dateKey: string): StockMarketWeekImportResult => {
  const errors: string[] = [];
  const entries: StockMarketWeekImportEntry[] = [];
  const weekDates = getInvestmentWeekDateKeys(dateKey);
  const seen = new Set<string>();
  for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith('```')) continue;
    const row = line.startsWith('|') ? line.slice(1).replace(/\|$/, '') : line;
    const cells = row.split('|').map(cell => cell.trim());
    if (cells.join(' | ') === HEADER || cells.length === 4 && cells.every(cell => /^:?-{3,}:?$/.test(cell))) continue;
    const prefix = `${index + 1}행: `;
    if (cells.length < 3) {
      errors.push(`${prefix}날짜 | 종목 | 등락 | 이유 형식으로 입력해 주세요. 이유가 없으면 마지막 칸을 비워 주세요.`);
      continue;
    }
    const [date, name, percentText, ...reasonParts] = cells;
    const stock = STUDENT_STOCKS.find(item => item.name === name);
    if (!weekDates.includes(date)) {
      errors.push(`${prefix}선택한 주의 월~금 날짜(${weekDates[0]} ~ ${weekDates[4]})를 입력해 주세요.`);
      continue;
    }
    if (!stock) {
      errors.push(`${prefix}종목은 ${STUDENT_STOCKS.map(item => item.name).join(', ')} 중 하나여야 합니다.`);
      continue;
    }
    const percent = Number(percentText.replace(/%$/, ''));
    const closed = percentText === '휴장';
    if (!closed && (!/^[+-]?\d{1,2}%?$/.test(percentText) || !Number.isInteger(percent) || percent < -50 || percent > 50 || percent % 10 !== 0)) {
      errors.push(`${prefix}등락은 -50% ~ +50% 사이의 10% 단위 또는 휴장으로 입력해 주세요.`);
      continue;
    }
    const comment = reasonParts.join(' | ').trim();
    if (comment.length > 120) {
      errors.push(`${prefix}이유는 120자 이내로 입력해 주세요.`);
      continue;
    }
    const key = `${date}:${stock.id}`;
    if (seen.has(key)) {
      errors.push(`${prefix}같은 날짜의 같은 종목이 중복되었습니다.`);
      continue;
    }
    seen.add(key);
    entries.push({ dateKey: date, stockId: stock.id, returnPercent: closed ? 'closed' : percent === 0 ? 0 : percent, comment });
  }
  if (errors.length > 0) return { ok: false, errors };
  const expectedCount = weekDates.length * STUDENT_STOCKS.length;
  if (entries.length !== expectedCount) {
    return { ok: false, errors: [`월~금 4종목의 ${expectedCount}개 항목이 필요합니다. 현재 ${entries.length}개입니다.`] };
  }
  const ordered = weekDates.flatMap(date => STUDENT_STOCKS.flatMap(stock => entries.filter(entry => entry.dateKey === date && entry.stockId === stock.id)));
  return { ok: true, entries: ordered };
};

export const applyStockMarketWeekImport = (market: StudentStockMarket, entries: readonly StockMarketWeekImportEntry[]) =>
  entries.reduce<StudentStockMarket>((current, entry) => upsertStudentStockMarketEntry(current, entry.stockId, {
    dateKey: entry.dateKey,
    ...(entry.returnPercent === 'closed'
      ? { stage: 'flat' as const, isClosed: true }
      : { stage: getInvestmentStageFromPercent(entry.returnPercent), returnPercent: entry.returnPercent }),
    comment: entry.comment,
  }), market);
