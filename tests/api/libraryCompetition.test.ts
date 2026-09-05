import assert from 'node:assert/strict';
import test from 'node:test';
import { fixture, record, book } from './libraryCompetitionFixture.js';
import { adjustLibraryCompetition, createLibraryCompetition, LIBRARY_COMPETITION_SCHOOLS } from '../../src/lib/libraryCompetition.js';


test('first open under 23 simultaneous students creates one shared season with placed books only', async () => fixture(async ({ call, read }) => {
  const results = await Promise.all(Array.from({ length: 23 }, (_, index) => call({ action: 'libraryCompetition', intent: 'open' }, index + 1)));
  assert.ok(results.every((result) => result.status === 200));
  assert.equal(new Set(results.map((result) => record(record(result.body.competition).state).seed)).size, 1);
  const placements = record(read().value.libraryCompetition).placements;
  assert.ok(Array.isArray(placements));
  assert.equal(placements.length, 1);
}));

test('student cannot issue teacher adjustment command', async () => fixture(async ({ call }) => {
  const result = await call({ action: 'libraryCompetitionSettings', expectedRevision: 0, speed: 1, paused: false, counts: [] });
  assert.equal(result.status, 403);
}));

test('readonly projection does not initialize a season', async () => fixture(async ({ call, read }) => {
  const result = await call(undefined, 'student', 'GET');
  assert.equal(result.status, 200);
  assert.equal(record(result.body.competition).state, null);
  assert.equal(read().value.libraryCompetition, undefined);
}));

const oldCompetition = () => createLibraryCompetition({ seasonId: '2025-12', startedAt: '2025-12-01T00:00:00.000Z', seed: 'old-season', bookIds: ['placed'] });
const command = (seasonId: string, slotId = 1) => ({ action: 'placeLibraryBook', requestId: '123e4567-e89b-42d3-a456-426614174000', seasonId, slotId, book: { kind: 'new', title: '새 책', author: '작가', pageCount: 150 } });
const counts = LIBRARY_COMPETITION_SCHOOLS.filter(school => school.schoolId !== 'school-03').map(school => ({ schoolId: school.schoolId, count: 100 }));

test('cross-site competition command does not initialize state', async () => fixture(async ({ call, read }) => {
  assert.equal((await call({ action: 'libraryCompetition', intent: 'open' }, 'cross-site')).status, 403);
  assert.equal(read().value.libraryCompetition, undefined);
}));

test('multi-month rollover archives last active month once and preserves unplaced books and rewards', async () => fixture(async ({ call, read, set, archives }) => {
  const before: Record<string, unknown> = { ...read().value, libraryCompetition: oldCompetition(), claimedRewards: ['earned'] };
  set(before);
  const responses = await Promise.all(Array.from({ length: 23 }, () => call({ action: 'libraryCompetition', intent: 'enter' })));
  assert.ok(responses.every(result => result.status === 200));
  assert.equal(archives.size, 1);
  assert.deepEqual(archives.get('2025-12')?.books, [book('placed', 0)]);
  assert.deepEqual(record(read().value.studentLife).books, [book('carried')]);
  assert.deepEqual(read().value.currencyBalances, before.currencyBalances);
  assert.deepEqual(read().value.claimedRewards, ['earned']);
  assert.equal(record(read().value.libraryCompetition).revision, 1);
}));

test('archive transaction failure leaves original book slots competition and rewards untouched', async () => fixture(async ({ call, read, set, fail, archives }) => {
  set({ ...read().value, libraryCompetition: oldCompetition() });
  const before = structuredClone(read());
  fail();
  assert.equal((await call({ action: 'libraryCompetition', intent: 'enter' })).status, 502);
  assert.deepEqual(read(), before);
  assert.equal(archives.size, 0);
}));

test('missing SQL disables new competition but leaves inactive legacy placement usable', async () => fixture(async ({ call, read, fail }) => {
  fail(404);
  assert.equal((await call({ action: 'libraryCompetition', intent: 'open' })).body.error, 'LIBRARY_COMPETITION_UNAVAILABLE');
  const { seasonId: _seasonId, ...legacy } = command('2026-09');
  assert.equal((await call(legacy)).status, 200);
  assert.equal(read().value.libraryCompetition, undefined);
}));

test('old-season delayed placement triggers safe rollover but never creates new month score or reward', async () => fixture(async ({ call, read, set }) => {
  set({ ...read().value, libraryCompetition: oldCompetition() });
  const balance = structuredClone(read().value.currencyBalances);
  const response = await call(command('2025-12'));
  assert.equal(response.status, 409);
  assert.equal(response.body.error, 'LIBRARY_SEASON_CHANGED');
  assert.deepEqual(record(read().value.libraryCompetition).placements, []);
  assert.deepEqual(read().value.currencyBalances, balance);
}));

test('active placement and duplicate retry count once and preserve confirmed book', async () => fixture(async ({ call, read }) => {
  await call({ action: 'libraryCompetition', intent: 'open' });
  const seasonId = record(read().value.libraryCompetition).seasonId;
  assert.equal(typeof seasonId, 'string');
  if (typeof seasonId !== 'string') return;
  const placed = await call(command(seasonId));
  const replay = await call(command(seasonId));
  assert.equal(placed.status, 200);
  assert.equal(replay.status, 200);
  assert.deepEqual(placed.body.book, replay.body.book);
  const state = record(read().value.libraryCompetition);
  assert.ok(Array.isArray(state.placements));
  assert.equal(state.placements.length, 2);
}));

test('teacher count bounds and simultaneous settings revisions are enforced', async () => fixture(async ({ call, read }) => {
  await call({ action: 'libraryCompetition', intent: 'open' });
  const settings = { action: 'libraryCompetitionSettings', expectedRevision: 0, speed: 1, paused: false, counts };
  assert.equal((await call({ ...settings, counts: counts.map((row, index) => index ? row : { ...row, count: 101 }) }, 'teacher')).status, 400);
  const responses = await Promise.all([call(settings, 'teacher'), call(settings, 'teacher')]);
  assert.deepEqual(responses.map(result => result.status).sort(), [200, 409]);
  const adjustment = record(read().value.libraryCompetition).adjustments;
  assert.ok(Array.isArray(adjustment));
  assert.equal(adjustment.length, 1);
}));

test('generic teacher stale snapshot cannot resurrect archived books or overwrite season', async () => fixture(async ({ call, read, set }) => {
  set({ ...read().value, libraryCompetition: oldCompetition() });
  const stale = structuredClone(read().value);
  await call({ action: 'libraryCompetition', intent: 'enter' });
  const active = structuredClone(read().value.libraryCompetition);
  assert.equal((await call({ value: stale, expectedUpdatedAt: read().updated_at }, 'teacher')).status, 200);
  assert.deepEqual(read().value.libraryCompetition, active);
  assert.deepEqual(record(read().value.studentLife).books, [book('carried')]);
}));

test('lost archive commit response is recovered without double archival', async () => fixture(async ({ call, read, set, archives, loseResponse }) => {
  set({ ...read().value, libraryCompetition: oldCompetition() });
  loseResponse();
  const result = await call({ action: 'libraryCompetition', intent: 'enter' });
  assert.equal(result.status, 200);
  assert.equal(result.body.rolledOver, true);
  assert.equal(archives.size, 1);
}));

test('lost active placement response is idempotently recovered', async () => fixture(async ({ call, read, loseResponse }) => {
  await call({ action: 'libraryCompetition', intent: 'open' });
  const season = record(read().value.libraryCompetition).seasonId;
  if (typeof season !== 'string') assert.fail('missing season');
  loseResponse();
  const result = await call(command(season));
  assert.equal(result.status, 200);
  const placements = record(read().value.libraryCompetition).placements;
  assert.ok(Array.isArray(placements));
  assert.equal(placements.length, 2);
}));

test('active same-slot conflict and failed save cannot inflate counts', async () => fixture(async ({ call, read, fail }) => {
  await call({ action: 'libraryCompetition', intent: 'open' });
  const season = record(read().value.libraryCompetition).seasonId;
  if (typeof season !== 'string') assert.fail('missing season');
  assert.equal((await call(command(season, 0))).body.error, 'LIBRARY_SLOT_OCCUPIED');
  const before = structuredClone(read());
  fail();
  assert.equal((await call(command(season))).status, 502);
  assert.deepEqual(read(), before);
}));

test('selected past month is read-only and retains all archived books', async () => fixture(async ({ call, read, set }) => {
  set({ ...read().value, libraryCompetition: oldCompetition() });
  await call({ action: 'libraryCompetition', intent: 'enter' });
  const before = structuredClone(read());
  const result = await call({ action: 'libraryCompetitionHistory', month: '2025-12' });
  assert.equal(result.status, 200);
  assert.deepEqual(record(result.body.archive).books, [book('placed', 0)]);
  const standings = record(result.body.archive).standings;
  assert.ok(Array.isArray(standings));
  assert.equal(standings.length, 17);
  assert.deepEqual(read(), before);
}));

test('teacher lower adjustment speed and pause are recorded while own count remains authoritative', async () => fixture(async ({ call, read }) => {
  await call({ action: 'libraryCompetition', intent: 'open' });
  await call({ action: 'libraryCompetitionSettings', expectedRevision: 0, speed: 1.5, paused: false, counts }, 'teacher');
  const result = await call({ action: 'libraryCompetitionSettings', expectedRevision: 1, speed: 0.5, paused: true, counts: counts.map(row => ({ ...row, count: 0 })) }, 'teacher');
  assert.equal(result.status, 200);
  const rows = record(result.body.competition).standings;
  assert.ok(Array.isArray(rows));
  assert.equal(record(rows.find(row => record(row).schoolId === 'school-03')).count, 1);
  assert.ok(rows.filter(row => record(row).schoolId !== 'school-03').every(row => record(row).count === 0));
  const adjustments = record(read().value.libraryCompetition).adjustments;
  assert.ok(Array.isArray(adjustments));
  assert.equal(adjustments.length, 2);
  assert.equal(record(adjustments[1]).paused, true);
  assert.equal(record(adjustments[1]).speed, 0.5);
}));

test('same-millisecond CAS projection includes the just-committed initialization', async () => {
  const originalNow = Date.now;
  Date.now = () => Date.parse('2026-09-05T01:00:00.000Z');
  try {
    await fixture(async ({ call, read }) => {
      read().updated_at = '2026-09-05T01:00:00.000Z';
      const result = await call({ action: 'libraryCompetition', intent: 'open' });
      assert.equal(result.status, 200);
      const view = record(result.body.competition);
      assert.equal(view.serverAt, '2026-09-05T01:00:00.001Z');
      assert.equal(record(view.state).startedAt, view.serverAt);
    });
  } finally { Date.now = originalNow; }
});

test('pause-only adjustment with no edited counts preserves rival counts', async () => fixture(async ({ call }) => {
  await call({ action: 'libraryCompetition', intent: 'open' });
  await call({ action: 'libraryCompetitionSettings', expectedRevision: 0, speed: 1, paused: false, counts }, 'teacher');
  const result = await call({ action: 'libraryCompetitionSettings', expectedRevision: 1, speed: 0.5, paused: true, counts: [] }, 'teacher');
  assert.equal(result.status, 200);
  const rows = record(result.body.competition).standings;
  assert.ok(Array.isArray(rows));
  assert.ok(rows.filter(row => record(row).schoolId !== 'school-03').every(row => record(row).count === 100));
}));

test('rollover retains speed and pause but not past manual rival counts', async () => fixture(async ({ call, read, set }) => {
  const state = adjustLibraryCompetition(oldCompetition(), { id: 'old-adjustment', at: '2025-12-03T00:00:00.000Z', speed: 1.5, paused: true, counts });
  set({ ...read().value, libraryCompetition: state });
  const result = await call({ action: 'libraryCompetition', intent: 'enter' });
  assert.equal(result.status, 200);
  const settings = record(read().value.libraryCompetition).adjustments;
  assert.ok(Array.isArray(settings));
  assert.equal(record(settings[0]).speed, 1.5);
  assert.equal(record(settings[0]).paused, true);
  assert.deepEqual(record(settings[0]).counts, []);
  const rows = record(result.body.competition).standings;
  assert.ok(Array.isArray(rows));
  assert.ok(rows.every(row => Number(record(row).count) <= 3));
}));
