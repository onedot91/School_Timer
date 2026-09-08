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

test('library feature reads and receipt replays never load unrelated histories, letters, or settings', async () => {
  const { loadCompetitionRow, commitCompetition } = await import('../../src/server/libraryCompetitionRepository.js');
  const source = { studentLife: { books: [book], letters: Array.from({ length: 1200 }, (_, index) => ({ id: `private-${index}`, content: 'unread' })), extra: { preserved: true } },
    currencyBalances: { 1: 123, 2: 987 }, currencyHistory: { 1: [], 2: [{ id: 'other', studentNumber: 2, delta: 7 }] }, studentPets: { 2: { untouched: true } } };
  const fixture = createStorageV2Fixture(source);
  const calls: { path: string; body: Record<string, unknown> }[] = [];
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    calls.push({ path: new URL(String(input)).pathname, body: record(JSON.parse(String(init?.body ?? '{}'))) });
    return fixture.fetch(input, init);
  };
  try {
    const row = await loadCompetitionRow(configuration);
    assert.ok(row && row.kind === 'scoped');
    assert.deepEqual(row.value, { studentLife: { books: [book] } });
    assert.deepEqual(row.wallets, []);
    assert.deepEqual(row.history, []);
    assert.ok(await commitCompetition(configuration, { current: row, value: { ...row.value, studentLife: { books: [book], letters: [] }, studentPets: {} }, updatedAt: row.updated_at, action: 'library-noop', requestId: 'scope-noop', payload: {} }));
    assert.deepEqual(fixture.read().value, source);
    const commits = calls.filter(call => call.path.endsWith('/storage_commit_scoped_mutation'));
    assert.equal(commits.length, 1);
    assert.deepEqual(commits[0].body.p_resources, []);
    await ensureCompetition(configuration, true);
    const settings = { requestId: 'scope-settings', expectedRevision: 0, speed: 1, paused: false, counts: [] };
    await updateCompetitionSettings(configuration, settings);
    await updateCompetitionSettings(configuration, settings);
    assert.equal(calls.some(call => call.path.endsWith('/storage_load_snapshot') || call.path.endsWith('/storage_commit_mutation')), false);
    const scopeReads = calls.filter(call => call.path.endsWith('/storage_load_scope'));
    assert.ok(scopeReads.length > 0);
    assert.ok(scopeReads.every(call => JSON.stringify(record(call.body.p_scope).resources) === JSON.stringify([{ path: '/libraryCompetition' }, { path: '/studentLife/books' }])));
    assert.deepEqual(record(fixture.read().value.studentLife).letters, source.studentLife.letters);
  } finally { globalThis.fetch = previousFetch; }
});

test('scoped book placement includes only its own wallet and history and preserves other student money', async () => {
  const { loadCompetitionRow, commitCompetition } = await import('../../src/server/libraryCompetitionRepository.js');
  const { applyLibraryPlacementCommand } = await import('../../src/lib/canvasLibraryPlacement.js');
  const otherHistory = [{ id: 'other-income', studentNumber: 2, delta: 7, before: 80, after: 87, reason: 'manual', createdAt: '2026-09-08T00:00:00.000Z' }];
  await withFixture({ studentLife: { books: [], letters: [{ id: 'private', content: 'preserve' }] }, currencyBalances: { 1: 123, 2: 87 }, currencyHistory: { 1: [], 2: otherHistory } }, async fixture => {
    const row = await loadCompetitionRow(configuration, 1);
    assert.ok(row);
    assert.deepEqual(row.wallets, [{ student_number: 1, balance: 123 }]);
    assert.deepEqual(row.scope.history, [1]);
    assert.deepEqual(row.value.currencyHistory, { 1: [] });
    assert.equal(record(row.value.studentLife).letters, undefined);
    const command = { protocolVersion: 2, action: 'placeLibraryBook', requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', slotId: 1, book: { kind: 'new', title: 'scoped book', author: 'author', pageCount: 10 } };
    const placed = applyLibraryPlacementCommand(row.value, 1, command, '2026-09-08T02:00:00.000Z');
    assert.equal(placed.ok, true);
    if (!placed.ok) assert.fail('placement should succeed');
    assert.ok(await commitCompetition(configuration, { current: row, value: placed.value, updatedAt: '2026-09-08T02:00:00.000Z', actorKey: 'student:1', action: 'placeLibraryBook', requestId: command.requestId, payload: command }));
    assert.deepEqual(fixture.read().value.currencyBalances, { 1: 133, 2: 87 });
    assert.deepEqual(record(fixture.read().value.currencyHistory)['2'], otherHistory);
    assert.deepEqual(record(fixture.read().value.studentLife).letters, [{ id: 'private', content: 'preserve' }]);
  });
});
