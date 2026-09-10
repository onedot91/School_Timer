import assert from 'node:assert/strict';
import test from 'node:test';
import { applyStudentStorageCommand } from '../../src/server/studentStorageCommands.js';
import { createSudokuPuzzle, getSudokuProgressKey } from '../../src/lib/sudoku.js';
import { createNumberBaseballAnswer } from '../../src/lib/numberBaseball.js';
import { getKoreanIsoWeekKey } from '../../src/lib/weeklyMission.js';
import { normalizeCurrencyBalances, normalizeCurrencyHistory, normalizeAuctionItems } from '../../src/lib/currency.js';
import { createStudentEmotionEntry, getSchoolWeekDateKeys } from '../../src/lib/studentEmotion.js';
import { getStudentEmotionExcusedDay } from '../../src/lib/studentEmotionCalendar.js';

const context = { requestId: 'isolated-request-1', createdAt: '2026-09-08T02:00:00.000Z' };

for (const date of ['2026-09-11', '2026-09-23', '2026-10-08']) {
  test(`감정 저장 ${date}: 휴일을 인정하고 주간 보상은 한 번만 지급한다`, () => {
    const at = `${date}T02:00:00.000Z`;
    const dates = getSchoolWeekDateKeys(new Date(at)).filter(day => !getStudentEmotionExcusedDay(day) && day !== date);
    const entries = dates.map(day => createStudentEmotionEntry(1, 'happy', '연습 기록', new Date(`${day}T02:00:00.000Z`), undefined, '잘했어'));
    const other = [{ preserve: null }];
    const before = { currencyBalances: { 1: 100, 2: 333 }, currencyHistory: { 1: [], 2: other }, studentEmotionHistory: { 1: entries, 2: other } };
    const payload = { emotionId: 'happy', comment: '연습 기록', selfMessage: '잘했어' };
    const first = applyStudentStorageCommand(before, 1, 'student.emotion.save', payload, { requestId: 'holiday-first', createdAt: at });
    assert.ok(first);
    assert.equal(normalizeCurrencyBalances(first.value.currencyBalances)['1'], 130);
    const second = applyStudentStorageCommand(first.value, 1, 'student.emotion.save', payload, { requestId: 'holiday-retry', createdAt: at });
    assert.ok(second);
    assert.equal(normalizeCurrencyBalances(second.value.currencyBalances)['1'], 130);
    assert.equal(normalizeCurrencyHistory(second.value.currencyHistory)['1'].length, 2);
    assert.deepEqual(Reflect.get(Object(second.value.studentEmotionHistory), '2'), other);
    assert.deepEqual(Reflect.get(Object(second.value.currencyHistory), '2'), other);
    assert.equal(normalizeCurrencyBalances(second.value.currencyBalances)['2'], 333);
    assert.equal(Reflect.get(Object(second.value.studentEmotionHistory), '1').length, dates.length + 1);
  });
}
const week = getKoreanIsoWeekKey(new Date(context.createdAt));
const fixture = () => ({ currencyBalances: { '1': 100, '2': 333 }, currencyHistory: { '1': [{ legacy: 'preserve-original' }], '2': [{ raw: null }] }, studentPets: { '2': { preserve: true } }, studentLife: { letters: [], books: [{ preserve: null }], failureStories: [] } });
const apply = (value: unknown, action: string, payload: unknown) => {
  const result = applyStudentStorageCommand(value, 1, action, payload, context);
  assert.ok(result);
  return result.value;
};

test('서버가 펫 비용을 계산하고 다른 학생 및 원본 기록을 보존한다', () => {
  const before = fixture();
  const after = apply(before, 'student.pet.feed', { currencyBalances: { '1': 999999 } });
  assert.equal(normalizeCurrencyBalances(after.currencyBalances)['1'], 95);
  assert.equal(normalizeCurrencyBalances(after.currencyBalances)['2'], 333);
  assert.deepEqual((after.currencyHistory as Record<string, unknown>)['2'], before.currencyHistory['2']);
  assert.deepEqual((after.currencyHistory as Record<string, unknown[]>)['1'].at(-1), { legacy: 'preserve-original' });
  assert.deepEqual((after.studentPets as Record<string, unknown>)['2'], { preserve: true });
  assert.equal(normalizeCurrencyHistory(after.currencyHistory)['1'][0].delta, -5);
});

test('펫 먹이 비용은 최신 예약금을 제외하고 검증한다', () => {
  const items = normalizeAuctionItems(null);
  assert.throws(() => apply({ ...fixture(), auctionItems: items, auctionBids: { [items[0].id]: { bidder: 1, amount: 99 } } }, 'student.pet.feed', {}), /INSUFFICIENT_FUNDS/);
});

test('학생은 타인의 우편을 읽음 처리할 수 없고 본인 읽음은 멱등이다', () => {
  const sent = apply(fixture(), 'student.letter.send', { recipient: 2, title: '제목', content: '내용' });
  assert.throws(() => apply(sent, 'student.letter.read', { letterId: context.requestId }), /LETTER_NOT_FOUND/);
  const recipientRead = applyStudentStorageCommand(sent, 2, 'student.letter.read', { letterId: context.requestId }, context);
  assert.ok(recipientRead);
  const again = applyStudentStorageCommand(recipientRead.value, 2, 'student.letter.read', { letterId: context.requestId }, { ...context, createdAt: '2026-09-09T01:00:00Z' });
  assert.deepEqual(again?.value, recipientRead.value);
  assert.deepEqual((sent.studentLife as Record<string, unknown>).books, fixture().studentLife.books);
});

test('스도쿠는 서버에서 정답·학생·주차를 검증하고 보상을 한 번 지급한다', () => {
  const puzzle = createSudokuPuzzle(1, week, 'basic');
  const key = getSudokuProgressKey(1, week, 'basic');
  assert.throws(() => apply(fixture(), 'student.sudoku.complete', { key, cells: puzzle.puzzle }), /SUDOKU_NOT_SOLVED/);
  assert.throws(() => apply(fixture(), 'student.sudoku.complete', { key: getSudokuProgressKey(2, week, 'basic'), cells: puzzle.solution }), /STUDENT_COMMAND_INVALID/);
  const paid = apply(fixture(), 'student.sudoku.complete', { key, cells: puzzle.solution, rewardAmount: 99999 });
  const retry = apply(paid, 'student.sudoku.complete', { key, cells: puzzle.solution });
  assert.equal(normalizeCurrencyBalances(retry.currencyBalances)['1'], normalizeCurrencyBalances(paid.currencyBalances)['1']);
  assert.equal(normalizeCurrencyHistory(retry.currencyHistory)['1'].length, 1);
});

test('숫자야구 보상은 서버에서 계산하며 과거 추측을 바꿀 수 없다', () => {
  const answer = createNumberBaseballAnswer(1, week);
  const key = `1:${week}`;
  const wrong = answer[0] === 1 && answer[1] === 2 && answer[2] === 3 ? [3, 2, 1] : [1, 2, 3];
  const started = apply(fixture(), 'student.baseball.save', { key, attempts: [{ guess: wrong }] });
  assert.throws(() => apply(started, 'student.baseball.complete', { key, attempts: [{ guess: answer }] }), /GAME_PROGRESS_CONFLICT/);
  const paid = apply(started, 'student.baseball.complete', { key, attempts: [{ guess: wrong }, { guess: answer }], rewardAmount: 999 });
  assert.equal(normalizeCurrencyBalances(paid.currencyBalances)['1'], 120);
  assert.equal(normalizeCurrencyHistory(paid.currencyHistory)['1'][0].delta, 20);
});

test('실패 이야기와 보상을 함께 만들고 기존 원본 이야기를 보존한다', () => {
  const oldStory = { legacy: null };
  const before = { ...fixture(), studentLife: { ...fixture().studentLife, failureStories: [oldStory] } };
  const after = apply(before, 'student.failure.create', { failure: '실패했던 일', lesson: '다음에는 확인하기' });
  assert.deepEqual((after.studentLife as { failureStories: unknown[] }).failureStories[0], oldStory);
  assert.equal(normalizeCurrencyBalances(after.currencyBalances)['1'], 110);
});

test('오늘의 친구 편지는 기존 결정적 ID를 유지하고 다른 요청의 중복 전송을 막는다', () => {
  const payload = { letterId: 'today-friend-recommendation-2026-09-08-1-r2', recipient: 2, title: '[오늘의 친구] 책 추천', content: '읽어볼 책' };
  const first = apply(fixture(), 'student.letter.send', payload);
  const second = applyStudentStorageCommand(first, 1, 'student.letter.send', payload, { ...context, requestId: 'different-request' });
  assert.deepEqual(second?.value, first);
  assert.throws(() => apply(first, 'student.letter.send', { ...payload, letterId: 'today-friend-recommendation-2026-09-08-2-r2' }), /STUDENT_COMMAND_INVALID/);
});

test('감정 입력과 하루 보상을 함께 저장하며 같은 날 수정은 추가 지급하지 않는다', () => {
  const untouched = { legacy: '원본 보존' };
  const before = { ...fixture(), studentEmotionHistory: { '1': [untouched], '2': [null] } };
  const first = apply(before, 'student.emotion.save', { emotionId: 'happy', comment: '친구와 책을 읽었어요', selfMessage: '잘했어' });
  const second = apply(first, 'student.emotion.save', { emotionId: 'happy', comment: '친구와 두 권 읽었어요', selfMessage: '즐거웠어' });
  assert.equal(normalizeCurrencyBalances(second.currencyBalances)['1'], 105);
  assert.deepEqual((second.studentEmotionHistory as Record<string, unknown[]>)['2'], [null]);
  assert.deepEqual((second.studentEmotionHistory as Record<string, unknown[]>)['1'].at(-1), untouched);
  assert.equal(normalizeCurrencyHistory(second.currencyHistory)['1'].length, 1);
});
