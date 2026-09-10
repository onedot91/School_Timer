import assert from 'node:assert/strict';
import test from 'node:test';
import { collectActivityRewardExpectations } from '../../src/server/rewardAuditActivities.js';
import { createSudokuPuzzle } from '../../src/lib/sudoku.js';
import { createNumberBaseballAnswer, getNumberBaseballGameId } from '../../src/lib/numberBaseball.js';
import { compareRewardPayments } from '../../src/lib/rewardAudit.js';

const at = '2026-09-08T01:00:00.000Z';
const story = (id: string, createdAt = at) => ({ id, studentNumber: 3, failure: '실패', lesson: '배움', createdAt });
const book = (id: string, librarySlot?: number) => ({ id, studentNumber: 3, title: '책', pageCount: 5, createdAt: at, ...(librarySlot === undefined ? {} : { librarySlot }) });

test('과거 게임 완료에는 당시 스도쿠 10과 숫자야구 15 보상 기준을 적용한다', () => {
  const period = '2026-08-20';
  const puzzle = createSudokuPuzzle(2, period, 'basic');
  const completedAt = '2026-08-19T18:55:29Z';
  const settings = { studentSudoku: { [`2:${period}:basic`]: { puzzleId: puzzle.id, cells: puzzle.solution, completedAt } }, studentNumberBaseball: { [`2:${period}`]: { gameId: getNumberBaseballGameId(2, period), attempts: [{ guess: createNumberBaseballAnswer(2, period), createdAt: completedAt }], completedAt } } };
  assert.deepEqual(collectActivityRewardExpectations(settings).expected.map(row => row.amount), [10, 15]);
  settings.studentSudoku[`2:${period}:basic`].completedAt = at;
  settings.studentNumberBaseball[`2:${period}`].completedAt = at;
  assert.deepEqual(collectActivityRewardExpectations(settings).expected.map(row => row.amount), [5, 20]);
  for (const [completedAt, reward] of [['2026-08-19T19:25:06.999Z', 10], ['2026-08-19T19:25:07.000Z', 5]] as const) {
    settings.studentSudoku[`2:${period}:basic`].completedAt = completedAt;
    assert.equal(collectActivityRewardExpectations(settings).expected.find(row => row.feature === 'sudoku')?.amount, reward);
  }
  for (const [completedAt, reward] of [['2026-08-23T16:00:39.999Z', 15], ['2026-08-23T16:00:40.000Z', 20]] as const) {
    settings.studentNumberBaseball[`2:${period}`].completedAt = completedAt;
    assert.equal(collectActivityRewardExpectations(settings).expected.find(row => row.feature === 'baseball')?.amount, reward);
  }
});

test('emotion expectations require valid records and all five school weekdays, once per date and week', () => {
  const entries = ['07', '08', '09', '10', '11'].map(day => ({ id: day, studentNumber: 3, dateKey: `2026-09-${day}`, emotionId: 'happy', comment: '즐거움', createdAt: at, updatedAt: at }));
  const { expected } = collectActivityRewardExpectations({ studentEmotionHistory: { 3: [...entries, entries[0], { ...entries[0], dateKey: '2026-02-30' }], 4: entries.slice(0, 4).map(entry => ({ ...entry, studentNumber: 4 })) } });
  assert.equal(expected.filter(row => row.feature === 'emotion').length, 9);
  assert.deepEqual(expected.filter(row => row.feature === 'weeklyEmotion').map(({ studentNumber, dateKey, amount }) => ({ studentNumber, dateKey, amount })), [{ studentNumber: 3, dateKey: '2026-09-07', amount: 25 }]);
});

test('감정 보상 점검은 휴업일을 인정하고 가짜 일일 보상을 요구하지 않는다', () => {
  const entries = ['07', '08', '09', '11'].map(day => ({ id: day, studentNumber: 3, dateKey: `2026-09-${day}`, emotionId: 'happy', comment: '연습 기록', createdAt: at, updatedAt: at }));
  const { expected } = collectActivityRewardExpectations({ studentEmotionHistory: { 3: entries } });
  assert.equal(expected.filter(row => row.feature === 'emotion').length, 4);
  assert.equal(expected.filter(row => row.feature === 'weeklyEmotion').length, 1);
  assert.equal(expected.some(row => row.id === 'daily-emotion-3-2026-09-10'), false);
});

test('sudoku checks actual solved cells and deduplicates weekly difficulty completions', () => {
  const basic = createSudokuPuzzle(3, '2026-37', 'basic');
  const challenge = createSudokuPuzzle(3, '2026-37', 'challenge');
  const legacy = createSudokuPuzzle(4, '2026-08-20', 'basic');
  const { expected } = collectActivityRewardExpectations({ studentSudoku: {
    '3:2026-37:basic': { puzzleId: basic.id, cells: basic.solution, completedAt: at },
    '3:2026-37:challenge': { puzzleId: challenge.id, cells: challenge.solution, completedAt: '2026-09-09T01:00:00Z' },
    '4:2026-08-20:basic': { puzzleId: legacy.id, cells: legacy.solution, completedAt: at },
    '5:2026-37:basic': { puzzleId: createSudokuPuzzle(5, '2026-37', 'basic').id, cells: basic.puzzle, completedAt: at },
    '6:2026-37:basic': { puzzleId: createSudokuPuzzle(6, '2026-37', 'basic').id, cells: createSudokuPuzzle(6, '2026-37', 'basic').solution, completedAt: null },
  } });
  assert.equal(expected.length, 2);
  assert.equal(expected.find(row => row.studentNumber === 3)?.amount, 5);
  assert.ok(expected.find(row => row.studentNumber === 3)?.ledgerIds.includes('sudoku-reward-sudoku-weekly-3-2026-37'));
  assert.ok(expected.find(row => row.studentNumber === 4)?.ledgerIds.includes(`sudoku-reward-${legacy.id}`));
});

test('baseball replays answers and derives the reward from the first winning attempt', () => {
  const answer = createNumberBaseballAnswer(3, '2026-37');
  const wrong = answer[0] === 1 && answer[1] === 2 && answer[2] === 3 ? [3, 2, 1] : [1, 2, 3];
  const entry = { gameId: getNumberBaseballGameId(3, '2026-37'), attempts: [...Array.from({ length: 5 }, () => ({ guess: wrong, createdAt: at })), { guess: answer, createdAt: at }], completedAt: at };
  const { expected } = collectActivityRewardExpectations({ studentNumberBaseball: { '3:2026-37': entry, '4:2026-37': { ...entry, gameId: getNumberBaseballGameId(4, '2026-37'), attempts: [], completedAt: at } } });
  assert.equal(expected.length, 1);
  assert.equal(expected[0].amount, 10);
});

test('failure and placed books reward once per eligible week; unplaced and malformed sources do not', () => {
  const { expected } = collectActivityRewardExpectations({ studentLife: { failureStories: [story('one'), story('two'), story('bad', 'invalid')], books: [book('one', 0), book('two', 1), { ...book('unplaced'), studentNumber: 4 }] } });
  assert.deepEqual(expected.map(row => [row.feature, row.studentNumber, row.amount]), [['failure', 3, 10], ['bookStack', 3, 10]]);
});

test('raw historical failures survive the UI normalizer 300-entry display limit', () => {
  const { expected, unavailableSources } = collectActivityRewardExpectations({ studentLife: { failureStories: [story('old', '2025-01-06T01:00:00Z'), ...Array.from({ length: 300 }, (_, index) => story(`recent-${index}`))] }, classroomRoleMission: { results: { '2025-01-06': { 3: 'rewarded' } } } });
  assert.equal(expected.filter(row => row.feature === 'failure').length, 2);
  assert.equal(expected.some(row => row.feature === 'classroomRole'), false);
  assert.ok(unavailableSources.some(message => message.includes('1인1역')));
});

test('writing uses teacher completion only and nets cancellation and reaward suffixes', () => {
  const assignment = { dateKey: '2026-09-08', topic: '쓰기', requiredWord: '단어', publishedAt: at };
  const { expected } = collectActivityRewardExpectations({ dailyWriting: { assignment, completedStudentNumbers: [3] }, studentLife: { letters: [{ recipient: 4, id: 'daily-writing-letter-2026-09-08-4' }] } });
  assert.equal(expected.length, 1);
  const id = 'daily-writing-reward-2026-09-08-3';
  assert.deepEqual(compareRewardPayments({ expected, ledger: [{ id, studentNumber: 3, delta: 25 }, { id: `${id}:cancel`, studentNumber: 3, delta: -25 }, { id: `${id}:again`, studentNumber: 3, delta: 25 }] }), []);
  assert.equal(collectActivityRewardExpectations({ dailyWriting: { assignment, completedStudentNumbers: [] } }).expected.length, 0);
});

test('collector does not mutate persisted activity or wallet data', () => {
  const settings = { studentLife: { books: [book('one', 0)], failureStories: [story('one')] }, currencyBalances: { 3: 40 }, currencyHistory: { 3: [] } };
  const before = structuredClone(settings);
  collectActivityRewardExpectations(settings);
  assert.deepEqual(settings, before);
});
