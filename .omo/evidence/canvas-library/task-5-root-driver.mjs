import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { applyLibraryPlacementCommand, parseLibraryPlacementCommand, replaceSnapshotBooksWithAuthoritative } from '../../../src/lib/canvasLibraryPlacement.ts';
import { normalizeStudentLifeState } from '../../../src/lib/studentLife.ts';
import { mergeConcurrentCurrencyUpdatesIntoSettings } from '../../../src/lib/weeklyMission.ts';

const sourcePaths = ['src/lib/studentLife.ts', 'src/lib/canvasLibraryPlacement.ts', 'src/lib/weeklyMission.ts', 'src/lib/bookStackMission.ts'];
const hashes = () => Object.fromEntries(sourcePaths.map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')]));
const sourceStart = hashes();
const cases = [];
const now = '2026-09-05T05:00:00.000Z';
const uuid = index => `ab120987-1234-4234-a123-${String(index).padStart(12, '0')}`;
const history = Array.from({ length: 700 }, (_, index) => ({ id: `root-synthetic-${index}`, studentNumber: index % 23 + 1, title: `보존 대상 ${index}`, author: '합성 작가', pageCount: 73 + index, colorIndex: index % 6, createdAt: new Date(Date.UTC(2025, 0, 1, 0, index)).toISOString() }));
const baseline = { marker: 'untouched', studentLife: { books: history, letters: [], failureStories: [], failureProfileAssignments: {} }, currencyBalances: { 23: 45 }, currencyHistory: { 23: [] } };
const original = structuredClone(baseline);
const newCommand = { action: 'placeLibraryBook', requestId: uuid(701), slotId: 99, book: { kind: 'new', title: '<b>그대로 표시</b>', author: '글쓴이', pageCount: 129 } };
const accepted = result => { assert.equal(result.ok, true, JSON.stringify(result)); return result; };
const rejected = (result, status, code) => { assert.deepEqual(result, { ok: false, error: { status, code } }); };

const first = accepted(applyLibraryPlacementCommand(baseline, 23, newCommand, now));
assert.equal(first.book.id, `library:23:${uuid(701)}`);
assert.equal(first.book.librarySlot, 99);
assert.equal(first.book.title, '<b>그대로 표시</b>');
assert.equal(first.book.createdAt, now);
assert.deepEqual(first.studentLife.books.slice(0, 700), history);
assert.equal(first.value.currencyBalances['23'], 55);
assert.equal(first.value.currencyHistory['23'].length, 1);
assert.deepEqual(baseline, original);
cases.push({ case: '700-history-new-placement', pass: true, records: first.studentLife.books.length, rewardDelta: 10 });

const replay = accepted(applyLibraryPlacementCommand(first.value, 23, structuredClone(newCommand), '2026-09-12T05:00:00.000Z'));
assert.deepEqual(replay.value, first.value);
assert.deepEqual(replay.book, first.book);
assert.equal(replay.awarded, false);
for (const changed of [ { ...newCommand, slotId: 98 }, { ...newCommand, book: { ...newCommand.book, title: '다른 제목' } }, { ...newCommand, book: { ...newCommand.book, author: '다른 저자' } }, { ...newCommand, book: { ...newCommand.book, pageCount: 130 } } ]) {
  rejected(applyLibraryPlacementCommand(first.value, 23, changed, now), 400, 'INVALID_LIBRARY_COMMAND');
}
cases.push({ case: 'cross-week-identical-replay-and-metadata-reuse', pass: true, records: replay.studentLife.books.length, rewardDelta: 0 });

for (const bad of [-1, 100, NaN, Infinity, 1.2, '1', null, undefined]) rejected(applyLibraryPlacementCommand(baseline, 23, { ...newCommand, slotId: bad }, now), 400, 'INVALID_LIBRARY_COMMAND');
for (const bad of [0, 24, '23', null, NaN]) rejected(applyLibraryPlacementCommand(baseline, bad, newCommand, now), 400, 'INVALID_LIBRARY_COMMAND');
for (const bad of ['', 'x'.repeat(36), 123, null]) assert.equal(parseLibraryPlacementCommand({ ...newCommand, requestId: bad }).ok, false);
for (const bad of [0, 5001, 3.2, '12', NaN, null]) assert.equal(parseLibraryPlacementCommand({ ...newCommand, book: { ...newCommand.book, pageCount: bad } }).ok, false);
assert.equal(parseLibraryPlacementCommand({ ...newCommand, studentNumber: 1 }).ok, false);
assert.equal(parseLibraryPlacementCommand({ ...newCommand, book: { ...newCommand.book, title: '가'.repeat(51) } }).ok, false);
assert.deepEqual(baseline, original);
cases.push({ case: 'malformed-types-and-forged-session-field', pass: true });

const carryExisting = { action: 'placeLibraryBook', requestId: uuid(702), slotId: 3, book: { kind: 'existing', bookId: history[0].id } };
rejected(applyLibraryPlacementCommand(baseline, 2, carryExisting, now), 403, 'LIBRARY_BOOK_FORBIDDEN');
const own = accepted(applyLibraryPlacementCommand(baseline, 1, carryExisting, now));
assert.deepEqual(own.book, { ...history[0], librarySlot: 3 });
assert.deepEqual(own.value.currencyHistory, baseline.currencyHistory);
assert.deepEqual(own.value.currencyBalances, baseline.currencyBalances);
assert.equal(own.studentLife.books.length, 700);
const ownReplay = accepted(applyLibraryPlacementCommand(own.value, 1, { ...carryExisting, requestId: uuid(703) }, now));
assert.deepEqual(ownReplay.value, own.value);
rejected(applyLibraryPlacementCommand(own.value, 1, { ...carryExisting, slotId: 4 }, now), 409, 'LIBRARY_BOOK_ALREADY_PLACED');
rejected(applyLibraryPlacementCommand(own.value, 23, { ...newCommand, slotId: 3 }, now), 409, 'LIBRARY_SLOT_OCCUPIED');
cases.push({ case: 'existing-ownership-and-replay', pass: true, records: 700, rewardDelta: 0 });

let full = baseline;
for (let index = 0; index < 100; index += 1) {
  full = accepted(applyLibraryPlacementCommand(full, history[index].studentNumber, { action: 'placeLibraryBook', requestId: uuid(index), slotId: index, book: { kind: 'existing', bookId: history[index].id } }, now)).value;
}
const fullBefore = structuredClone(full);
rejected(applyLibraryPlacementCommand(full, 23, newCommand, now), 409, 'LIBRARY_FULL');
rejected(applyLibraryPlacementCommand(full, 23, { ...newCommand, slotId: 100 }, now), 400, 'INVALID_LIBRARY_COMMAND');
assert.deepEqual(full, fullBefore);
assert.equal(normalizeStudentLifeState(full.studentLife).books.filter(book => book.librarySlot !== undefined).length, 100);
assert.deepEqual(normalizeStudentLifeState(full.studentLife).books.map(({ librarySlot, ...book }) => book), history);
cases.push({ case: '100-actual-transforms-capacity-no-eviction', pass: true, records: 700, placed: 100 });

const stale = { marker: 'new setting', studentLife: { books: [], letters: ['synthetic unrelated unchanged'], failureStories: ['unrelated'] } };
const protectedValue = replaceSnapshotBooksWithAuthoritative(stale, full);
assert.deepEqual(protectedValue.studentLife.books, full.studentLife.books);
assert.deepEqual(protectedValue.studentLife.letters, stale.studentLife.letters);
assert.deepEqual(protectedValue.studentLife.failureStories, stale.studentLife.failureStories);
assert.equal(protectedValue.marker, stale.marker);
for (const missing of [null, {}, { studentLife: null }]) {
  const guarded = replaceSnapshotBooksWithAuthoritative({ studentLife: { books: [{ ...history[0], librarySlot: 42 }] } }, missing);
  assert.deepEqual(normalizeStudentLifeState(guarded.studentLife).books, []);
}
const teacher = mergeConcurrentCurrencyUpdatesIntoSettings(full, { ...baseline, studentLife: { ...baseline.studentLife, books: [] } });
assert.deepEqual(normalizeStudentLifeState(teacher.studentLife).books, normalizeStudentLifeState(full.studentLife).books);
cases.push({ case: 'generic-stale-removal-and-teacher-no-economy-reconcile', pass: true });

const duplicateInput = [ { ...history[0], librarySlot: 7 }, { ...history[1], librarySlot: 7 }, { ...history[2], librarySlot: 100 }, { ...history[3], librarySlot: -1 }, { ...history[4], librarySlot: '4' }, { ...history[5], librarySlot: 99 } ];
const normalized = normalizeStudentLifeState({ books: duplicateInput }).books;
assert.deepEqual(normalized.map(book => book.librarySlot), [7, undefined, undefined, undefined, undefined, 99]);
assert.deepEqual(normalized.map(({ librarySlot, ...book }) => book), history.slice(0, 6));
assert.deepEqual(baseline, original);
assert.deepEqual(hashes(), sourceStart, 'source changed during driver');
cases.push({ case: 'duplicate-and-invalid-slots-retain-all-records', pass: true });
const duplicateIds = [{ ...history[0], id: 'same-id' }, { ...history[1], id: 'same-id', librarySlot: 63 }];
const duplicateResult = applyLibraryPlacementCommand({ studentLife: { books: duplicateIds } }, 1, { ...carryExisting, book: { kind: 'existing', bookId: 'same-id' } }, now);
if (duplicateResult.ok) {
  assert.deepEqual(duplicateResult.studentLife.books[1], duplicateIds[1], 'duplicate ID must not modify foreign record');
} else {
  assert.equal(duplicateResult.error.status, 403);
}
cases.push({ case: 'duplicate-legacy-id-cannot-modify-foreign-record', pass: true });
const economyRemote = { ...full, studentEconomy: { 1: { processedRequestIds: ['verified-root-request'] } } };
const economyStale = { ...baseline, studentEconomy: { 1: { processedRequestIds: [] } }, studentLife: { ...baseline.studentLife, books: [{ ...history[0], id: 'stale-fake-older', librarySlot: 0, createdAt: '2024-01-01T00:00:00.000Z' }] } };
const economyMerged = mergeConcurrentCurrencyUpdatesIntoSettings(economyRemote, economyStale);
assert.deepEqual(normalizeStudentLifeState(economyMerged.studentLife).books, normalizeStudentLifeState(full.studentLife).books);
cases.push({ case: 'economy-active-teacher-cannot-clear-remote-slot', pass: true, preservedRecords: 700 });
assert.deepEqual(hashes(), sourceStart, 'source changed before final receipt');
const receipt = { generatedAt: new Date().toISOString(), passed: true, source: sourceStart, cases, cleanup: 'No browser/server/process resources created; synchronous library driver exited.', deferred: 'HTTP/auth/CAS/size enforcement and route integration are task6.' };
writeFileSync(new URL('./task-5-root-driver.json', import.meta.url), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
