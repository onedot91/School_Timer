import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryCompetitionClient } from '../../src/lib/libraryCompetitionClient.js';
import { createCanvasLibraryClient } from '../../src/lib/canvasLibraryClient.js';
import { createLibraryCompetition, projectLibraryCompetition } from '../../src/lib/libraryCompetition.js';
import { acceptStorageProjection, captureStorageResponseContext } from '../../src/lib/storageResponseOrder.js';
import { isStorageRecord, splitStorageState } from '../../src/lib/storageV2Codec.js';
import { parseStorageSnapshot } from '../../src/server/storageV2Repository.js';
import { createStorageProjectionPatch } from '../../src/server/storageProjection.js';

const at = '2026-09-08T02:00:00.000Z';
const snapshot = (value: Record<string, unknown>, revision: number) => {
  const encoded = splitStorageState(value);
  return parseStorageSnapshot({ ...encoded, updated_at: at, revisions: Object.fromEntries([...encoded.resources.map(row => [row.resource_key, revision]), ...encoded.wallets.map(row => [`wallet:${row.student_number}`, revision])]) });
};
const withActorCache = async (action: (initial: Record<string, unknown>) => Promise<void>) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: { getItem: () => '1' } } });
  const initial = { studentLife: { books: [], letters: [{ id: 'preserved-mail', content: 'keep' }] }, currencyBalances: { 1: 123 }, currencyHistory: { 1: [] }, studentPets: { 1: { preserved: true } } };
  acceptStorageProjection(captureStorageResponseContext(), { value: initial, updatedAt: '2026-09-08T01:00:00.000Z', scope: 'student' });
  try { await action(initial); } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous); else Reflect.deleteProperty(globalThis, 'window');
    captureStorageResponseContext();
  }
};
const competition = createLibraryCompetition({ seasonId: '2026-09', seed: 'scope-patch', startedAt: at, bookIds: [] });

test('library scoped response merges into actor projection without clearing unread features', async () => withActorCache(async initial => {
  const value = { libraryCompetition: competition, studentLife: { books: [] } };
  const client = createLibraryCompetitionClient({ dataMode: 'production', isSharedConfigured: true, fetcher: async () => Response.json({ value, updatedAt: at, rolledOver: false,
    competition: { state: competition, standings: projectLibraryCompetition(competition, at), serverAt: at }, storagePatch: createStorageProjectionPatch(snapshot(value, 2), value, false) }),
    invalidate: () => undefined, withLocalLock: async action => action(), localRead: () => { throw new Error('no local'); }, localHistory: () => { throw new Error('no local'); }, localSettings: () => { throw new Error('no local'); } });
  const response = await client.read('enter');
  assert.deepEqual(response.value, { ...initial, libraryCompetition: competition });
}));

test('book placement scoped response preserves cached mail and pet while updating its wallet and book', async () => withActorCache(async initial => {
  const requestId = '123e4567-e89b-42d3-a456-426614174000';
  const book = { id: `library:1:${requestId}`, studentNumber: 1, title: '검증 책', author: '작가', pageCount: 30, createdAt: at, colorIndex: 0, librarySlot: 2 };
  const value = { studentLife: { books: [book] }, currencyBalances: { 1: 133 }, currencyHistory: { 1: [] } };
  const client = createCanvasLibraryClient({ dataMode: 'production', isSharedConfigured: true, createRequestId: () => requestId, now: () => at, requestTimeoutMs: 1000,
    fetcher: async (_input, init) => { assert.equal(new Headers(init?.headers).get('X-Storage-Projection'), '1'); return Response.json({ book, value, updatedAt: at, storagePatch: createStorageProjectionPatch(snapshot(value, 2), value, false) }); },
    loadLocalSnapshot: () => { throw new Error('no local'); }, storeLocalSnapshot: () => false, invalidateSharedCache: () => undefined, withLocalLock: async action => action() });
  const result = await client.placeBook({ studentNumber: 1, title: book.title, author: book.author, pageCount: book.pageCount }, 2);
  assert.equal(result.ok, true);
  if (!result.ok) assert.fail('expected placement');
  assert.ok(isStorageRecord(initial.studentLife));
  assert.deepEqual(result.value, { ...initial, studentLife: { ...initial.studentLife, books: [book] }, currencyBalances: { 1: 133 } });
}));
