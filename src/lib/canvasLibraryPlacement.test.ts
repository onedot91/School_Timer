import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyLibraryPlacementCommand,
  parseLibraryPlacementCommand,
  replaceSnapshotBooksWithAuthoritative,
} from './canvasLibraryPlacement.js';
import { normalizeStudentLifeState } from './studentLife.js';
import { normalizeCurrencyBalances } from './currency.js';
import { mergeConcurrentCurrencyUpdatesIntoSettings } from './weeklyMission.js';

const requestId = '123e4567-e89b-42d3-a456-426614174000';
const createdAt = '2026-09-05T03:00:00.000Z';

test('season-scoped placement accepts a valid month and preserves it in the parsed command', () => {
  const parsed = parseLibraryPlacementCommand(newCommand({ seasonId: '2026-09' }));
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.equal(Reflect.get(parsed.command, 'seasonId'), '2026-09');
});

test('generic snapshot cannot replace server-owned competition state', () => {
  const authoritative = { libraryCompetition: { seasonId: '2026-09', revision: 3 } };
  const result = replaceSnapshotBooksWithAuthoritative({ libraryCompetition: { seasonId: '2026-08' } }, authoritative);
  assert.deepEqual(result.libraryCompetition, authoritative.libraryCompetition);
});

const makeBook = (index: number, overrides: Record<string, unknown> = {}) => ({
  id: `legacy-${index}`,
  studentNumber: (index % 23) + 1,
  title: `기존 책 ${index}`,
  author: `작가 ${index}`,
  pageCount: 100 + index,
  createdAt: new Date(Date.UTC(2025, 0, 1, 0, index)).toISOString(),
  colorIndex: index % 6,
  ...overrides,
});

const newCommand = (overrides: Record<string, unknown> = {}) => ({
  action: 'placeLibraryBook',
  requestId,
  slotId: 17,
  book: { kind: 'new', title: '  달빛 우체국  ', author: '  고마 작가  ', pageCount: 321 },
  ...overrides,
});

test('명령 파서는 신뢰하지 않는 본문을 엄격히 검사하고 문자열 본문을 실행하지 않는다', () => {
  const valid = parseLibraryPlacementCommand(newCommand());
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.deepEqual(valid.command.book, { kind: 'new', title: '달빛 우체국', author: '고마 작가', pageCount: 321 });
  }

  const invalidInputs = [
    null,
    'placeLibraryBook',
    { ...newCommand(), studentNumber: 1 },
    newCommand({ action: '<script>alert(1)</script>' }),
    newCommand({ requestId: 'not-a-uuid-0000000000000000000000000' }),
    newCommand({ slotId: -1 }),
    newCommand({ slotId: 100 }),
    newCommand({ slotId: 1.5 }),
    newCommand({ book: { kind: 'new', title: ' ', author: '작가', pageCount: 1 } }),
    newCommand({ book: { kind: 'new', title: '가'.repeat(51), author: '작가', pageCount: 1 } }),
    newCommand({ book: { kind: 'new', title: '책', author: '', pageCount: 1 } }),
    newCommand({ book: { kind: 'new', title: '책', author: '가'.repeat(31), pageCount: 1 } }),
    newCommand({ book: { kind: 'new', title: '책', author: '작가', pageCount: 0 } }),
    newCommand({ book: { kind: 'new', title: '책', author: '작가', pageCount: 5001 } }),
    newCommand({ book: { kind: 'existing', bookId: '' } }),
  ];
  for (const input of invalidInputs) {
    assert.deepEqual(parseLibraryPlacementCommand(input), {
      ok: false,
      error: { status: 400, code: 'INVALID_LIBRARY_COMMAND' },
    });
  }
});

test('정규화는 첫 유효 슬롯 주장만 유지하고 중복·범위 밖 슬롯은 기록을 지우지 않고 미배치로 만든다', () => {
  const normalized = normalizeStudentLifeState({ books: [
    makeBook(0, { librarySlot: 8 }),
    makeBook(1, { librarySlot: 8 }),
    makeBook(2, { librarySlot: -1 }),
    makeBook(3, { librarySlot: 99 }),
    makeBook(4, { librarySlot: 100 }),
  ] });

  assert.deepEqual(normalized.books.map((book) => book.id), ['legacy-0', 'legacy-1', 'legacy-2', 'legacy-3', 'legacy-4']);
  assert.deepEqual(normalized.books.map((book) => book.librarySlot), [8, undefined, undefined, 99, undefined]);
});

test('600권 레거시 기록 뒤에 새 책을 배치해도 기존 ID와 메타데이터를 모두 보존한다', () => {
  const books = Array.from({ length: 600 }, (_, index) => makeBook(index));
  const before = structuredClone(books);
  const result = applyLibraryPlacementCommand({
    currencyBalances: { 1: 0 },
    currencyHistory: { 1: [] },
    studentLife: { books },
  }, 1, newCommand({ slotId: 0 }), createdAt);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.studentLife.books.length, 601);
  assert.deepEqual(result.studentLife.books.slice(0, 600).map(({ librarySlot: _slot, ...book }) => book), before);
  assert.equal(result.book.id, `library:1:${requestId}`);
  assert.equal(result.book.librarySlot, 0);
  assert.equal(result.applied, true);
  assert.equal(result.awarded, true);
  assert.deepEqual(books, before);
});

test('새 책 재시도는 같은 명령에만 멱등 성공하고 요청 ID 재사용 불일치와 보상 중복을 거절한다', () => {
  const initial = { currencyBalances: { 1: 5 }, currencyHistory: { 1: [] }, studentLife: {} };
  const first = applyLibraryPlacementCommand(initial, 1, newCommand(), createdAt);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const replay = applyLibraryPlacementCommand(first.value, 1, newCommand(), '2026-09-05T04:00:00.000Z');
  assert.equal(replay.ok, true);
  if (!replay.ok) return;
  assert.equal(replay.replayed, true);
  assert.equal(replay.applied, false);
  assert.equal(replay.awarded, false);
  assert.equal(replay.studentLife.books.length, 1);
  assert.deepEqual(replay.value.currencyBalances, first.value.currencyBalances);
  assert.deepEqual(replay.value.currencyHistory, first.value.currencyHistory);

  const mismatch = applyLibraryPlacementCommand(first.value, 1, newCommand({ slotId: 18 }), createdAt);
  assert.deepEqual(mismatch, { ok: false, error: { status: 400, code: 'INVALID_LIBRARY_COMMAND' } });
});

test('기존 자기 책도 등록한 주에 10고마를 받고 같은 슬롯 재시도에는 중복 지급하지 않는다', () => {
  const original = makeBook(10, { studentNumber: 3 });
  const value = { currencyBalances: { 3: 44 }, currencyHistory: { 3: [] }, studentLife: { books: [original] } };
  const command = { action: 'placeLibraryBook', requestId, slotId: 22, book: { kind: 'existing', bookId: original.id } };
  const placed = applyLibraryPlacementCommand(value, 3, command, createdAt);
  assert.equal(placed.ok, true);
  if (!placed.ok) return;
  assert.equal(placed.studentLife.books.length, 1);
  assert.equal(placed.book.librarySlot, 22);
  assert.equal(placed.applied, true);
  assert.equal(placed.awarded, true);
  assert.equal(normalizeCurrencyBalances(placed.value.currencyBalances)['3'], 54);

  const replay = applyLibraryPlacementCommand(placed.value, 3, command, createdAt);
  assert.equal(replay.ok, true);
  if (!replay.ok) return;
  assert.equal(replay.replayed, true);
  assert.equal(replay.applied, false);
  assert.equal(replay.awarded, false);
  assert.equal(replay.studentLife.books.length, 1);
  assert.deepEqual(replay.value.currencyHistory, placed.value.currencyHistory);
  assert.deepEqual(replay.value.currencyBalances, placed.value.currencyBalances);

  assert.deepEqual(applyLibraryPlacementCommand(placed.value, 3, { ...command, slotId: 23 }, createdAt), {
    ok: false,
    error: { status: 409, code: 'LIBRARY_BOOK_ALREADY_PLACED' },
  });
});

test('신규·기존 책 등록은 주간 보상을 공유하고 한국 시간 월요일에 다시 한 번만 지급한다', () => {
  const initial = {
    currencyBalances: { 3: 40 }, currencyHistory: { 3: [] },
    studentLife: { books: [makeBook(0, { studentNumber: 3 }), makeBook(1, { studentNumber: 3 })] },
  };
  const first = applyLibraryPlacementCommand(initial, 3, newCommand(), '2026-09-06T14:59:58.000Z');
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.awarded, true);

  const existingCommand = {
    action: 'placeLibraryBook', requestId, slotId: 18, book: { kind: 'existing', bookId: 'legacy-0' },
  };
  const second = applyLibraryPlacementCommand(first.value, 3, existingCommand, '2026-09-06T14:59:59.000Z');
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.awarded, false);
  assert.deepEqual(second.value.currencyBalances, first.value.currencyBalances);

  const replayNextWeek = applyLibraryPlacementCommand(second.value, 3, existingCommand, '2026-09-06T15:00:00.000Z');
  assert.equal(replayNextWeek.ok, true);
  if (!replayNextWeek.ok) return;
  assert.equal(replayNextWeek.replayed, true);
  assert.equal(replayNextWeek.awarded, false);

  const nextWeek = applyLibraryPlacementCommand(replayNextWeek.value, 3, {
    ...existingCommand, slotId: 19, book: { kind: 'existing', bookId: 'legacy-1' },
  }, '2026-09-06T15:00:00.000Z');
  assert.equal(nextWeek.ok, true);
  if (!nextWeek.ok) return;
  assert.equal(nextWeek.awarded, true);
  assert.equal(normalizeCurrencyBalances(nextWeek.value.currencyBalances)['3'], 60);

  const nextNew = applyLibraryPlacementCommand(nextWeek.value, 3, newCommand({
    requestId: '123e4567-e89b-42d3-a456-426614174001', slotId: 20,
  }), '2026-09-07T03:00:00.000Z');
  assert.equal(nextNew.ok, true);
  if (!nextNew.ok) return;
  assert.equal(nextNew.awarded, false);
  assert.deepEqual(nextNew.value.currencyBalances, nextWeek.value.currencyBalances);
  assert.deepEqual(nextNew.value.currencyHistory, nextWeek.value.currencyHistory);
});

test('타인 책·잘못된 학생·잘못된 시각은 상태를 바꾸지 않고 거절한다', () => {
  const value = { studentLife: { books: [makeBook(0, { studentNumber: 2 })] } };
  const command = { action: 'placeLibraryBook', requestId, slotId: 2, book: { kind: 'existing', bookId: 'legacy-0' } };
  assert.deepEqual(applyLibraryPlacementCommand(value, 1, command, createdAt), {
    ok: false,
    error: { status: 403, code: 'LIBRARY_BOOK_FORBIDDEN' },
  });
  for (const student of [0, 24, 1.5, '1']) {
    assert.deepEqual(applyLibraryPlacementCommand(value, student, newCommand(), createdAt), {
      ok: false,
      error: { status: 400, code: 'INVALID_LIBRARY_COMMAND' },
    });
  }
  assert.deepEqual(applyLibraryPlacementCommand(value, 1, newCommand(), 'not-a-date'), {
    ok: false,
    error: { status: 400, code: 'INVALID_LIBRARY_COMMAND' },
  });
  assert.equal((value.studentLife.books[0] as { librarySlot?: number }).librarySlot, undefined);
});

test('소유자가 다른 중복 ID 책은 모호한 이동을 거절하고 어느 기록도 바꾸지 않는다', () => {
  const value = { studentLife: { books: [
    makeBook(0, { id: 'duplicate-id', studentNumber: 1 }),
    makeBook(1, { id: 'duplicate-id', studentNumber: 2, librarySlot: 63 }),
  ] } };
  const before = structuredClone(value);
  const result = applyLibraryPlacementCommand(value, 1, {
    action: 'placeLibraryBook', requestId, slotId: 3,
    book: { kind: 'existing', bookId: 'duplicate-id' },
  }, createdAt);

  assert.deepEqual(result, { ok: false, error: { status: 403, code: 'LIBRARY_BOOK_FORBIDDEN' } });
  assert.deepEqual(value, before);
});

test('점유 슬롯과 100석 만석은 모든 기록을 보존한 채 구분해 거절한다', () => {
  const oneOccupied = {
    currencyBalances: { 1: 40 }, currencyHistory: { 1: [] },
    studentLife: { books: [makeBook(0, { librarySlot: 17 }), makeBook(1, { studentNumber: 1 })] },
  };
  const beforeOccupied = structuredClone(oneOccupied);
  assert.deepEqual(applyLibraryPlacementCommand(oneOccupied, 1, newCommand(), createdAt), {
    ok: false,
    error: { status: 409, code: 'LIBRARY_SLOT_OCCUPIED' },
  });
  assert.deepEqual(applyLibraryPlacementCommand(oneOccupied, 1, newCommand({
    book: { kind: 'existing', bookId: 'legacy-1' },
  }), createdAt), {
    ok: false,
    error: { status: 409, code: 'LIBRARY_SLOT_OCCUPIED' },
  });
  assert.deepEqual(oneOccupied, beforeOccupied);

  const books = Array.from({ length: 101 }, (_, index) => makeBook(index, index < 100 ? { librarySlot: index } : {}));
  const full = { studentLife: { books } };
  const before = structuredClone(full);
  assert.deepEqual(applyLibraryPlacementCommand(full, 1, newCommand({ slotId: 50 }), createdAt), {
    ok: false,
    error: { status: 409, code: 'LIBRARY_FULL' },
  });
  assert.deepEqual(full, before);
});

test('권위 책 교체는 stale writer의 책만 무시하고 모든 다른 컬렉션과 입력을 보존한다', () => {
  const incoming = {
    marker: 'teacher-stale',
    studentLife: { books: [makeBook(1)], letters: [{ id: 'letter' }], failureStories: [{ id: 'failure' }] },
    currencyBalances: { 1: 99 },
  };
  const authoritative = { studentLife: { books: [makeBook(0, { librarySlot: 7 })] } };
  const beforeIncoming = structuredClone(incoming);
  const replaced = replaceSnapshotBooksWithAuthoritative(incoming, authoritative);

  assert.equal(replaced.marker, incoming.marker);
  assert.equal(replaced.currencyBalances, incoming.currencyBalances);
  assert.equal((replaced.studentLife as Record<string, unknown>).letters, incoming.studentLife.letters);
  assert.equal((replaced.studentLife as Record<string, unknown>).failureStories, incoming.studentLife.failureStories);
  assert.deepEqual((replaced.studentLife as { books: unknown }).books, normalizeStudentLifeState(authoritative.studentLife).books);
  assert.deepEqual(incoming, beforeIncoming);

  for (const missingAuthoritative of [{}, null, { studentLife: null }]) {
    const cleared = replaceSnapshotBooksWithAuthoritative(incoming, missingAuthoritative);
    assert.deepEqual((cleared.studentLife as { books: unknown }).books, []);
  }
  const noIncomingLife = replaceSnapshotBooksWithAuthoritative({ marker: 'empty' }, authoritative);
  assert.deepEqual((noIncomingLife.studentLife as { books: unknown }).books, normalizeStudentLifeState(authoritative.studentLife).books);
});

test('교사 통화 병합 경로도 원격 권위 책의 librarySlot을 잃지 않는다', () => {
  const remote = {
    currencyBalances: { 1: 10 },
    currencyHistory: { 1: [] },
    studentLife: { books: [makeBook(0, { studentNumber: 1, librarySlot: 31 })] },
  };
  const stale = {
    currencyBalances: { 1: 10 },
    currencyHistory: { 1: [] },
    studentLife: { books: [makeBook(0, { studentNumber: 1 })] },
  };
  const merged = mergeConcurrentCurrencyUpdatesIntoSettings(remote, stale);
  assert.equal(normalizeStudentLifeState(merged.studentLife).books[0]?.librarySlot, 31);
});

test('통화 활동 병합도 오래된 stale 책이 원격 권위 슬롯을 빼앗지 못한다', () => {
  const remoteBook = makeBook(1, { id: 'remote-book', studentNumber: 1, librarySlot: 42 });
  const staleBook = makeBook(0, { id: 'stale-only-book', studentNumber: 2, librarySlot: 42 });
  const remote = {
    currencyBalances: { 1: 10 },
    currencyHistory: { 1: [{
      id: 'currency-economy-request-1-1', delta: 10, before: 0, after: 10,
      reason: 'shop_purchase', createdAt,
    }] },
    studentEconomy: { 1: { processedRequestIds: ['request-1'] } },
    studentLife: { books: [remoteBook] },
  };
  const stale = {
    currencyBalances: { 1: 0 },
    currencyHistory: { 1: [] },
    studentEconomy: { 1: { processedRequestIds: [] } },
    studentLife: { books: [staleBook] },
  };

  const merged = mergeConcurrentCurrencyUpdatesIntoSettings(remote, stale);
  const books = normalizeStudentLifeState(merged.studentLife).books;
  assert.deepEqual(books.map((book) => book.id), ['remote-book']);
  assert.equal(books[0]?.librarySlot, 42);
});
