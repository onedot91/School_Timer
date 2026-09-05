import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanvasLibraryClient, type CanvasLibraryClientDependencies } from './canvasLibraryClient.js';
import { applyLibraryPlacementCommand, parseLibraryPlacementCommand } from './canvasLibraryPlacement.js';
import { createSmallLibraryRoom, placeLibraryDraft } from './canvasLibraryWorld.js';
import { getBookStackHeightCm, normalizeStudentLifeState } from './studentLife.js';

const NOW = '2026-09-05T03:00:00.000Z';
const REQUEST_ID = '123e4567-e89b-42d3-a456-426614174000';
const NEXT_ID = '123e4567-e89b-42d3-a456-426614174001';
const reflection = '친구의 마음을 이해하고 싶어졌어요.';
const draft = { studentNumber: 1, title: '달빛 우체국', author: '고마', pageCount: 0, reflection: `  ${reflection}  ` };
const command = { action: 'placeLibraryBook', requestId: REQUEST_ID, slotId: 0, book: { kind: 'new', title: draft.title, author: draft.author, pageCount: 0, reflection: draft.reflection } };
const legacy = { id: 'legacy-1', studentNumber: 1, title: '기존 책', author: '작가', pageCount: 120, createdAt: NOW, colorIndex: 0 };

const dependencies = (overrides: Partial<CanvasLibraryClientDependencies>): CanvasLibraryClientDependencies => ({
  dataMode: 'mock', isSharedConfigured: false, createRequestId: () => REQUEST_ID, now: () => NOW,
  requestTimeoutMs: 100, fetcher: async () => { throw new TypeError('Unexpected network access'); },
  loadLocalSnapshot: () => ({}), storeLocalSnapshot: () => true,
  invalidateSharedCache: () => undefined, withLocalLock: async action => action(), ...overrides,
});

test('reflection survives command, mission reward, JSON save and normalize while legacy pages stay intact', () => {
  // Given
  const snapshot = { studentLife: { books: [legacy] }, currencyBalances: { 1: 0 }, currencyHistory: { 1: [] } };
  // When
  const result = applyLibraryPlacementCommand(snapshot, 1, command, NOW);
  // Then
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const restored = normalizeStudentLifeState(JSON.parse(JSON.stringify(result.studentLife)));
  assert.deepEqual(restored.books[0], legacy);
  assert.equal(Reflect.get(result.book, 'reflection'), reflection);
  assert.equal(Reflect.get(restored.books[1] ?? {}, 'reflection'), reflection);
  assert.equal(restored.books[1]?.pageCount, 0);
  assert.equal(getBookStackHeightCm(restored.books), 0.6);
  assert.equal(result.awarded, true);
});

test('reflection participates in idempotent replay identity', () => {
  // Given
  const placed = applyLibraryPlacementCommand({}, 1, command, NOW);
  assert.equal(placed.ok, true);
  if (!placed.ok) return;
  // When
  const results = [command, { ...command, book: { ...command.book, reflection: '다른 감상' } }]
    .map(input => applyLibraryPlacementCommand(placed.value, 1, input, NOW));
  // Then
  assert.equal(results[0]?.ok && results[0].replayed, true);
  assert.deepEqual(results[1], { ok: false, error: { status: 400, code: 'INVALID_LIBRARY_COMMAND' } });
});

for (const invalidReflection of ['', '   ', '가'.repeat(101), '첫 줄\n둘째 줄', '\r감상', 12, null, undefined]) {
  test(`invalid reflection ${JSON.stringify(invalidReflection)} is rejected at command and stored-data boundaries`, () => {
    // Given
    const book = { ...command.book, reflection: invalidReflection };
    // When
    const parsed = parseLibraryPlacementCommand({ ...command, book });
    const restored = normalizeStudentLifeState({ books: [{ ...legacy, reflection: invalidReflection }] });
    // Then
    assert.equal(parsed.ok, false);
    assert.equal(restored.books.length, 0);
  });
}

test('unknown pages without reflection remain invalid and 100-character reflections are accepted', () => {
  // Given
  const { reflection: _reflection, ...withoutReflection } = command.book;
  // When
  const invalid = parseLibraryPlacementCommand({ ...command, book: withoutReflection });
  const maximum = parseLibraryPlacementCommand({ ...command, book: { ...command.book, reflection: '가'.repeat(100) } });
  const restored = normalizeStudentLifeState({ books: [{ ...legacy, pageCount: 0 }] });
  // Then
  assert.equal(invalid.ok, false);
  assert.equal(maximum.ok, true);
  assert.equal(restored.books.length, 0);
});

test('canvas placement accepts the reflection draft and trims its displayed value', () => {
  // Given
  const room = createSmallLibraryRoom();
  // When
  const result = placeLibraryDraft(room, [], draft, 0);
  // Then
  assert.equal(Reflect.get(result.placedBook ?? {}, 'reflection'), reflection);
  assert.equal(result.placedBook?.pageCount, 0);
});

test('local client persists a reflection book and returns the same reflection for the canvas', async () => {
  // Given
  let snapshot: Record<string, unknown> = { studentLife: { books: [legacy] } };
  const client = createCanvasLibraryClient(dependencies({
    loadLocalSnapshot: () => snapshot,
    storeLocalSnapshot: value => { snapshot = JSON.parse(JSON.stringify(value)); return true; },
  }));
  // When
  const result = await client.placeBook(draft, 0);
  // Then
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(Reflect.get(result.placedBook, 'reflection'), reflection);
  assert.equal(Reflect.get(normalizeStudentLifeState(snapshot.studentLife).books[1] ?? {}, 'reflection'), reflection);
});

test('client rejects a reflection containing a boundary newline before saving', async () => {
  // Given
  let writes = 0;
  const client = createCanvasLibraryClient(dependencies({ storeLocalSnapshot: () => { writes += 1; return true; } }));
  // When
  const result = await client.placeBook({ ...draft, reflection: `\n${reflection}` }, 0);
  // Then
  assert.deepEqual(result, { ok: false, error: { code: 'INVALID_LIBRARY_COMMAND', retryable: false } });
  assert.equal(writes, 0);
});

for (const mismatch of ['none', 'receipt', 'snapshot'] as const) {
  test(`shared client checks reflection against the request and authoritative snapshot: ${mismatch}`, async () => {
    // Given
    const client = createCanvasLibraryClient(dependencies({ dataMode: 'production', isSharedConfigured: true,
      fetcher: async (_url, init) => {
        const raw: unknown = JSON.parse(String(init?.body));
        const placed = applyLibraryPlacementCommand({}, 1, raw, NOW);
        if (placed.ok === false) return Response.json({ error: placed.error.code }, { status: 400 });
        const book = mismatch === 'receipt' ? { ...placed.book, reflection: '다른 감상' } : placed.book;
        const value = mismatch === 'snapshot' ? { ...placed.value, studentLife: { ...placed.studentLife, books: [{ ...placed.book, reflection: '다른 감상' }] } } : placed.value;
        return Response.json({ book, value, updatedAt: NOW });
      },
    }));
    // When
    const result = await client.placeBook(draft, 0);
    // Then
    if (mismatch === 'none') {
      assert.equal(result.ok, true);
      if (result.ok) assert.equal(Reflect.get(result.placedBook, 'reflection'), reflection);
    } else {
      assert.deepEqual(result, { ok: false, error: { code: 'INVALID_LIBRARY_RESPONSE', retryable: true } });
    }
  });
}

test('retry request identity changes when reflection changes but preserves trimmed equivalents', async () => {
  // Given
  const requestIds: unknown[] = [];
  const ids = [REQUEST_ID, NEXT_ID];
  const client = createCanvasLibraryClient(dependencies({ dataMode: 'production', isSharedConfigured: true,
    createRequestId: () => ids.shift() ?? NEXT_ID,
    fetcher: async (_url, init) => {
      const parsed = parseLibraryPlacementCommand(JSON.parse(String(init?.body)));
      if (parsed.ok) requestIds.push(parsed.command.requestId);
      throw new TypeError('isolated simulated dropped response');
    },
  }));
  // When
  await client.placeBook(draft, 0);
  await client.placeBook({ ...draft, reflection }, 0);
  await client.placeBook({ ...draft, reflection: '새로운 감상' }, 0);
  // Then
  assert.deepEqual(requestIds, [REQUEST_ID, REQUEST_ID, NEXT_ID]);
});
