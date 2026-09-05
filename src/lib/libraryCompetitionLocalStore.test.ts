import assert from 'node:assert/strict';
import test from 'node:test';
import { loadStoredStudentPetSnapshot, storeStudentPetSnapshot, STUDENT_PET_STORAGE_KEY } from './studentPet.js';
import { createLibraryCompetitionLocalStore, LibraryCompetitionLocalError } from './libraryCompetitionLocalStore.js';
import { getLibraryCompetitionSettings } from './libraryCompetition.js';

class MemoryStorage {
  value: string | null = null;
  writes = 0;
  fail = false;
  getItem(_key: string) { return this.value; }
  setItem(_key: string, value: string) {
    if (this.fail) throw new DOMException('Full', 'QuotaExceededError');
    this.value = value;
    this.writes += 1;
  }
}

test('generic pet persistence preserves competition records and authoritative books', () => {
  // Given a season changed after an unrelated pet UI loaded its snapshot.
  const storage = new MemoryStorage();
  storage.setItem(STUDENT_PET_STORAGE_KEY, JSON.stringify({ libraryCompetition: { version: 1 },
    libraryCompetitionArchives: [{ seasonId: '2026-08' }], studentLife: { books: [] } }));
  const loaded = loadStoredStudentPetSnapshot();
  const stale = { ...loaded, studentLife: { ...loaded.studentLife, books: [{ id: 'archived', studentNumber: 23,
    title: '지난 책', author: 'QA', pageCount: 10, createdAt: '2026-08-01T00:00:00.000Z', colorIndex: 0, librarySlot: 0 }] } };
  // When that stale generic snapshot saves, its competition-less shape is not authoritative.
  assert.equal(storeStudentPetSnapshot(stale, storage), true);
  // Then previously persisted competition fields remain unchanged.
  const actual = JSON.parse(storage.value ?? '{}');
  assert.deepEqual(actual.libraryCompetition, { version: 1 });
  assert.deepEqual(actual.libraryCompetitionArchives, [{ seasonId: '2026-08' }]);
  assert.deepEqual(actual.studentLife.books, []);
});

const placed = { id: 'qa-book', studentNumber: 23, title: '테스트 책', author: 'QA', pageCount: 10,
  createdAt: '2026-09-01T00:00:00.000Z', colorIndex: 0, librarySlot: 0 };
function fixture() {
  const storage = new MemoryStorage();
  storage.value = JSON.stringify({ studentLife: { books: [placed, { ...placed, id: 'unplaced', librarySlot: undefined }] },
    currencyBalances: { '23': 700 }, currencyHistory: { '23': [{ id: 'reward-proof' }] } });
  let now = '2026-09-05T00:00:00.000Z';
  const store = createLibraryCompetitionLocalStore({ storage, now: () => now, createSeed: () => 'test-month-seed' });
  return { storage, store, setNow: (value: string) => { now = value; } };
}

test('enter and readonly do not create an absent competition', () => {
  const { storage, store } = fixture();
  assert.equal(store.read('enter').competition.state, null);
  assert.equal(store.read('readonly').competition.state, null);
  assert.equal(storage.writes, 0);
});

test('first open initializes once with only confirmed placed books', () => {
  const { storage, store } = fixture();
  const first = store.read('open');
  const second = store.read('open');
  assert.equal(first.competition?.standings.find(row => row.isOurSchool)?.count, 1);
  assert.deepEqual(first.competition, second.competition);
  assert.equal(storage.writes, 1);
});

test('several missed months archive only last active month and preserve unplaced books and rewards', () => {
  const { storage, store, setNow } = fixture();
  store.read('open');
  setNow('2027-01-02T00:00:00.000Z');
  const result = store.read('enter');
  assert.equal(result.rolledOver, true);
  assert.deepEqual(store.history().months.map(row => row.seasonId), ['2026-09']);
  assert.deepEqual(store.history('2026-09').archive?.books, [placed]);
  assert.equal(result.competition.state?.seasonId, '2027-01');
  assert.deepEqual(result.value.currencyBalances, { '23': 700 });
  const persisted = JSON.parse(storage.value ?? '{}');
  assert.deepEqual(persisted.studentLife.books.map((book: { id: string }) => book.id), ['unplaced']);
  assert.deepEqual(persisted.currencyHistory, { '23': [{ id: 'reward-proof' }] });
});

test('failed archive write leaves every previous byte intact', () => {
  const { storage, store, setNow } = fixture();
  store.read('open');
  const before = storage.value;
  setNow('2026-10-01T00:00:00.000Z');
  storage.fail = true;
  assert.throws(() => store.read('enter'), LibraryCompetitionLocalError);
  assert.equal(storage.value, before);
});

test('readonly month boundary does not archive or reset', () => {
  const { storage, store, setNow } = fixture();
  store.read('open');
  const before = storage.value;
  setNow('2026-10-01T00:00:00.000Z');
  assert.equal(store.read('readonly').rolledOver, false);
  assert.equal(storage.value, before);
});

test('settings enforce optimistic revision and preserve our count', () => {
  const { store } = fixture();
  store.read('open');
  const result = store.settings({ expectedRevision: 0, speed: 0.5, paused: true, counts: [{ schoolId: 'school-01', count: 100 }] });
  assert.equal(result.competition?.standings.find(row => row.schoolId === 'school-01')?.count, 100);
  assert.equal(result.competition?.standings.find(row => row.isOurSchool)?.count, 1);
  assert.throws(() => store.settings({ expectedRevision: 0, speed: 1, paused: false, counts: [] }),
    (error: unknown) => error instanceof LibraryCompetitionLocalError && error.code === 'LIBRARY_COMPETITION_CONFLICT');
});

test('malformed active state fails closed without replacing stored books', () => {
  const { storage, store } = fixture();
  storage.value = JSON.stringify({ libraryCompetition: { bad: true }, studentLife: { books: [placed] } });
  const before = storage.value;
  assert.throws(() => store.read('open'), LibraryCompetitionLocalError);
  assert.equal(storage.value, before);
});

test('rollover revision does not accept a stale previous-month teacher save', () => {
  const { store, setNow } = fixture();
  const oldRevision = store.read('open').competition.state?.revision;
  assert.equal(oldRevision, 0);
  setNow('2026-10-01T00:00:00.000Z');
  const refreshed = store.read('enter');
  assert.equal(refreshed.competition.state?.revision, 1);
  assert.throws(() => store.settings({ expectedRevision: 0, speed: 1, paused: false, counts: [] }),
    (error: unknown) => error instanceof LibraryCompetitionLocalError && error.code === 'LIBRARY_COMPETITION_CONFLICT');
});

test('23 first opens share one initialized season', () => {
  const { storage, store } = fixture();
  const results = Array.from({ length: 23 }, () => store.read('open').competition);
  assert.equal(new Set(results.map(result => JSON.stringify(result))).size, 1);
  assert.equal(storage.writes, 1);
});

test('malformed archived records prevent a destructive rollover', () => {
  const { storage, store, setNow } = fixture();
  store.read('open');
  storage.value = JSON.stringify({ ...JSON.parse(storage.value ?? '{}'), libraryCompetitionArchives: [{ seasonId: 'broken' }] });
  const before = storage.value;
  setNow('2026-10-01T00:00:00.000Z');
  assert.throws(() => store.read('enter'), LibraryCompetitionLocalError);
  assert.equal(storage.value, before);
});

test('invalid rival count and our-school adjustment never write', () => {
  const { storage, store } = fixture();
  store.read('open');
  const before = storage.value;
  for (const count of [{ schoolId: 'school-01', count: 101 }, { schoolId: 'school-03', count: 50 }]) {
    assert.throws(() => store.settings({ expectedRevision: 0, speed: 1, paused: false, counts: [count] }));
    assert.equal(storage.value, before);
  }
});

test('legacy local book storage is included when the main envelope is absent', () => {
  const storage = new MemoryStorage();
  const store = createLibraryCompetitionLocalStore({ storage, now: () => '2026-09-05T00:00:00.000Z',
    createSeed: () => 'legacy-seed', initialSnapshot: () => ({ studentLife: { books: [placed] }, currencyBalances: { '23': 300 } }) });
  const result = store.read('open');
  assert.equal(result.competition.standings.find(row => row.isOurSchool)?.count, 1);
  assert.deepEqual(result.value.currencyBalances, { '23': 300 });
});

test('monthly rollover preserves paused speed without copying manual points', () => {
  const { store, setNow } = fixture();
  setNow('2026-08-25T00:00:00.000Z');
  store.read('open');
  store.settings({ expectedRevision: 0, speed: 0.5, paused: true, counts: [{ schoolId: 'school-01', count: 100 }] });
  setNow('2026-09-01T00:00:00.000Z');
  const next = store.read('enter');
  assert.ok(next.competition.state);
  assert.deepEqual(getLibraryCompetitionSettings(next.competition.state, '2026-09-01T00:00:00.000Z'), { speed: 0.5, paused: true });
  assert.equal(next.competition.state.revision, 2);
  assert.deepEqual(next.competition.state.adjustments.flatMap(adjustment => adjustment.counts), []);
  assert.ok(next.competition.standings.every(row => row.count <= 3));
  setNow('2026-09-20T00:00:00.000Z');
  assert.deepEqual(store.read('enter').competition.standings, next.competition.standings);
});
