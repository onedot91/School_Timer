import assert from 'node:assert/strict';
import test from 'node:test';
import { createStorageV2Fixture } from './storageV2Fixture.js';
import { createLibraryCompetition } from '../../src/lib/libraryCompetition.js';
import { ensureCompetition, updateCompetitionSettings } from '../../src/server/libraryCompetitionService.js';

const configuration = { url: 'https://library-storage-test.invalid', key: 'test-only' };
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : {};
const book = { id: 'placed', studentNumber: 1, title: '검증', author: '검증', pageCount: 10, librarySlot: 0, createdAt: '2025-12-01T00:00:00.000Z', colorIndex: 0, legacyMetadata: { preserve: true } };
const withFixture = async (value: Record<string, unknown>, action: (fixture: ReturnType<typeof createStorageV2Fixture>) => Promise<void>) => {
  const fixture = createStorageV2Fixture(value);
  const previousFetch = globalThis.fetch;
  globalThis.fetch = fixture.fetch;
  try { await action(fixture); } finally { globalThis.fetch = previousFetch; }
};

test('storage v2 library initialization across 23 students commits one season', async () => withFixture({ studentLife: { books: [book] } }, async fixture => {
  const outcomes = await Promise.all(Array.from({ length: 23 }, () => ensureCompetition(configuration, true)));
  assert.equal(new Set(outcomes.map(outcome => record(outcome.row?.value.libraryCompetition).seed)).size, 1);
  assert.equal(fixture.receipts.size, 1);
  assert.deepEqual(record(fixture.read().value.studentLife).books, [book]);
}));

test('storage v2 rollover archives raw placed books and preserves unrelated raw student life', async () => {
  const letters = Array.from({ length: 605 }, (_, i) => ({ id: `letter-${i}`, rawField: i }));
  const unplaced = { ...book, id: 'unplaced', librarySlot: undefined };
  delete unplaced.librarySlot;
  await withFixture({ libraryCompetition: createLibraryCompetition({ seasonId: '2025-12', seed: 'old', startedAt: '2025-12-01T00:00:00.000Z', bookIds: ['placed'] }), studentLife: { books: [book, unplaced], letters, extra: 'retained' }, currencyBalances: { 1: 123 } }, async fixture => {
    fixture.loseNextCommitResponse();
    const result = await ensureCompetition(configuration, true);
    assert.equal(result.rolledOver, true);
    assert.equal(fixture.archives.size, 1);
    assert.deepEqual(fixture.archives.get('2025-12')?.books, [book]);
    assert.deepEqual(record(fixture.read().value.studentLife), { books: [unplaced], letters, extra: 'retained' });
    assert.deepEqual(fixture.read().value.currencyBalances, { 1: 123 });
  });
});

test('storage v2 teacher setting retry after lost response uses original receipt', async () => withFixture({ studentLife: { books: [book] } }, async fixture => {
  await ensureCompetition(configuration, true);
  const command = { requestId: 'setting-retry', expectedRevision: 0, speed: 0.5, paused: true, counts: [] };
  fixture.loseNextCommitResponse();
  await assert.rejects(updateCompetitionSettings(configuration, command), TypeError);
  await updateCompetitionSettings(configuration, command);
  const state = record(fixture.read().value.libraryCompetition);
  assert.equal(state.revision, 1);
  assert.equal(Array.isArray(state.adjustments) ? state.adjustments.length : -1, 1);
  await assert.rejects(updateCompetitionSettings(configuration, { ...command, speed: 1 }), { code: 'STORAGE_REQUEST_REUSED' });
}));
