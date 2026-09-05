import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createCanvasLibraryClient,
  type CanvasLibraryClientDependencies,
} from './canvasLibraryClient.js';
import { normalizeStudentLifeState } from './studentLife.js';
import { createLibraryCompetition, parseLibraryCompetitionState } from './libraryCompetition.js';

const UUID_ONE = '00000000-0000-4000-8000-000000000001';
const UUID_TWO = '00000000-0000-4000-8000-000000000002';
const NOW = '2026-09-05T00:00:00.000Z';

const draft = { studentNumber: 3, title: '  달빛 우체국  ', author: ' 고마 ', pageCount: 120 } as const;

const responseValue = (requestId = UUID_ONE) => ({
  studentLife: {
    books: [{
      id: `library:3:${requestId}`,
      studentNumber: 3,
      title: '달빛 우체국',
      author: '고마',
      pageCount: 120,
      createdAt: NOW,
      colorIndex: 0,
      librarySlot: 17,
    }],
  },
});

const dependencies = (
  overrides: Partial<CanvasLibraryClientDependencies> = {},
): CanvasLibraryClientDependencies => ({
  dataMode: 'production',
  isSharedConfigured: true,
  createRequestId: (() => {
    const values = [UUID_ONE, UUID_TWO];
    return () => values.shift() ?? UUID_TWO;
  })(),
  now: () => NOW,
  requestTimeoutMs: 25,
  fetcher: async () => new Response(JSON.stringify({
    book: normalizeStudentLifeState(responseValue().studentLife).books[0],
    updatedAt: NOW,
    value: responseValue(),
  }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  loadLocalSnapshot: () => ({ studentLife: {}, currencyBalances: {}, currencyHistory: {} }),
  storeLocalSnapshot: () => true,
  invalidateSharedCache: () => undefined,
  withLocalLock: async (action) => action(),
  ...overrides,
});

test('active season placement preserves the supplied season identity across the wire', async () => {
  const bodies: unknown[] = [];
  const client = createCanvasLibraryClient(dependencies({ fetcher: async (_input, init) => {
    bodies.push(JSON.parse(String(init?.body)));
    return Response.json({ book: normalizeStudentLifeState(responseValue().studentLife).books[0], updatedAt: NOW, value: responseValue() });
  } }));
  await client.placeBook(draft, 17, '2026-09');
  assert.equal(Reflect.get(Object(bodies[0]), 'seasonId'), '2026-09');
});

test('local confirmed placement advances competition with the same committed snapshot', async () => {
  const competition = createLibraryCompetition({ seasonId: '2026-09', seed: 'client-fixture', startedAt: NOW, bookIds: [] });
  let saved: Record<string, unknown> = {};
  const client = createCanvasLibraryClient(dependencies({ dataMode: 'mock', loadLocalSnapshot: () => ({ studentLife: {}, libraryCompetition: competition }),
    storeLocalSnapshot: value => { saved = value; return true; } }));
  const result = await client.placeBook(draft, 17, '2026-09');
  assert.equal(result.ok, true);
  assert.equal(normalizeStudentLifeState(saved.studentLife).books.length, 1);
  const state = parseLibraryCompetitionState(saved.libraryCompetition);
  assert.equal(state?.placements.length, 1);
});

test('shared placement sends the exact command without browser student identity', async () => {
  const bodies: unknown[] = [];
  let invalidations = 0;
  const client = createCanvasLibraryClient(dependencies({
    invalidateSharedCache: () => { invalidations += 1; },
    fetcher: async (_input, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({
        book: normalizeStudentLifeState(responseValue().studentLife).books[0],
        updatedAt: NOW,
        value: responseValue(),
      }), { status: 200 });
    },
  }));

  const result = await client.placeBook(draft, 17);
  assert.equal(result.ok, true);
  assert.deepEqual(bodies, [{
    action: 'placeLibraryBook',
    requestId: UUID_ONE,
    slotId: 17,
    book: { kind: 'new', title: '달빛 우체국', author: '고마', pageCount: 120 },
  }]);
  assert.equal('studentNumber' in (bodies[0] as Record<string, unknown>), false);
  assert.equal(invalidations, 1);
});

test('uncertain retry keeps one UUID for the same carried draft and slot', async () => {
  const requestIds: string[] = [];
  let attempts = 0;
  const client = createCanvasLibraryClient(dependencies({
    fetcher: async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { requestId: string };
      requestIds.push(body.requestId);
      attempts += 1;
      if (attempts === 1) throw new TypeError('connection lost after commit');
      return new Response(JSON.stringify({
        book: normalizeStudentLifeState(responseValue(body.requestId).studentLife).books[0],
        updatedAt: NOW,
        value: responseValue(body.requestId),
      }), { status: 200 });
    },
  }));

  const first = await client.placeBook(draft, 17);
  const second = await client.placeBook(draft, 17);
  assert.deepEqual(first, { ok: false, error: { code: 'LIBRARY_NETWORK_FAILED', retryable: true } });
  assert.equal(second.ok, true);
  assert.deepEqual(requestIds, [UUID_ONE, UUID_ONE]);
});

test('uncertain retry keeps the carried draft UUID when a different slot is selected', async () => {
  const requestIds: string[] = [];
  const client = createCanvasLibraryClient(dependencies({
    fetcher: async (_input, init) => {
      requestIds.push((JSON.parse(String(init?.body)) as { requestId: string }).requestId);
      throw new TypeError('response dropped');
    },
  }));
  assert.equal((await client.placeBook(draft, 17)).ok, false);
  assert.equal((await client.placeBook(draft, 18)).ok, false);
  assert.deepEqual(requestIds, [UUID_ONE, UUID_ONE]);
});

test('success response must match the requested student, receipt, metadata, and slot', async () => {
  const malformedBooks = [
    { ...normalizeStudentLifeState(responseValue().studentLife).books[0], id: 'library:3:wrong-request' },
    { ...normalizeStudentLifeState(responseValue().studentLife).books[0], studentNumber: 4 },
    { ...normalizeStudentLifeState(responseValue().studentLife).books[0], title: '바뀐 제목' },
    { ...normalizeStudentLifeState(responseValue().studentLife).books[0], librarySlot: 18 },
  ];
  for (const book of malformedBooks) {
    const value = { studentLife: { books: [book] } };
    const client = createCanvasLibraryClient(dependencies({
      fetcher: async () => new Response(JSON.stringify({ book, updatedAt: NOW, value }), { status: 200 }),
    }));
    assert.deepEqual(await client.placeBook(draft, 17), {
      ok: false,
      error: { code: 'INVALID_LIBRARY_RESPONSE', retryable: true },
    });
  }
});

test('success envelope and authoritative snapshot must describe the same book', async () => {
  const book = normalizeStudentLifeState(responseValue().studentLife).books[0];
  const mismatches = [
    { ...book, studentNumber: 4 },
    { ...book, title: '스냅샷에서 바뀐 제목' },
    { ...book, author: '다른 글쓴이' },
    { ...book, pageCount: 121 },
  ];
  for (const authoritativeBook of mismatches) {
    const client = createCanvasLibraryClient(dependencies({
      fetcher: async () => new Response(JSON.stringify({
        book,
        updatedAt: NOW,
        value: { studentLife: { books: [authoritativeBook] } },
      }), { status: 200 }),
    }));
    assert.deepEqual(await client.placeBook(draft, 17), {
      ok: false,
      error: { code: 'INVALID_LIBRARY_RESPONSE', retryable: true },
    });
  }
});

test('readonly blocks writes even without shared configuration', async () => {
  let fetched = false;
  let stored = false;
  const client = createCanvasLibraryClient(dependencies({
    dataMode: 'readonly',
    isSharedConfigured: false,
    fetcher: async () => { fetched = true; return new Response(); },
    storeLocalSnapshot: () => { stored = true; return true; },
  }));
  assert.deepEqual(await client.placeBook(draft, 17), {
    ok: false,
    error: { code: 'READ_ONLY_DATA_MODE', retryable: false },
  });
  assert.equal(fetched, false);
  assert.equal(stored, false);
});

test('configured shared failure never falls back to local persistence', async () => {
  let stored = false;
  const client = createCanvasLibraryClient(dependencies({
    fetcher: async () => new Response(JSON.stringify({ error: 'LIBRARY_SAVE_FAILED' }), { status: 502 }),
    storeLocalSnapshot: () => { stored = true; return true; },
  }));
  assert.deepEqual(await client.placeBook(draft, 17), {
    ok: false,
    error: { code: 'LIBRARY_SAVE_FAILED', retryable: true },
  });
  assert.equal(stored, false);
});

test('malformed success payload is rejected and does not invalidate the shared cache', async () => {
  let invalidations = 0;
  const client = createCanvasLibraryClient(dependencies({
    fetcher: async () => new Response(JSON.stringify({ updatedAt: NOW, value: {}, book: { id: 1 } }), { status: 200 }),
    invalidateSharedCache: () => { invalidations += 1; },
  }));
  assert.deepEqual(await client.placeBook(draft, 17), {
    ok: false,
    error: { code: 'INVALID_LIBRARY_RESPONSE', retryable: true },
  });
  assert.equal(invalidations, 0);
});

test('hung shared request aborts explicitly and remains retryable', async () => {
  const client = createCanvasLibraryClient(dependencies({
    fetcher: async (_input, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }),
  }));
  assert.deepEqual(await client.placeBook(draft, 17), {
    ok: false,
    error: { code: 'LIBRARY_NETWORK_FAILED', retryable: true },
  });
});

test('mock local placement couples books and reward snapshot in one persisted record', async () => {
  let snapshot: Record<string, unknown> = {
    currencyBalances: { 3: 5 },
    currencyHistory: { 3: [] },
    studentLife: { books: [] },
    unrelated: { keep: true },
  };
  let writes = 0;
  const client = createCanvasLibraryClient(dependencies({
    dataMode: 'mock',
    isSharedConfigured: false,
    loadLocalSnapshot: () => snapshot,
    storeLocalSnapshot: (next) => { writes += 1; snapshot = next; return true; },
  }));
  const result = await client.placeBook(draft, 17);
  assert.equal(result.ok, true);
  assert.equal(writes, 1);
  assert.equal(normalizeStudentLifeState(snapshot.studentLife).books.length, 1);
  assert.deepEqual(snapshot.unrelated, { keep: true });
});

test('mock mode stays local even when injected configuration claims shared availability', async () => {
  let fetched = false;
  let stored = false;
  const client = createCanvasLibraryClient(dependencies({
    dataMode: 'mock',
    isSharedConfigured: true,
    fetcher: async () => { fetched = true; return new Response(); },
    storeLocalSnapshot: () => { stored = true; return true; },
  }));
  assert.equal((await client.placeBook(draft, 17)).ok, true);
  assert.equal(fetched, false);
  assert.equal(stored, true);
});

test('local storage failure never reports success or mutates the loaded record', async () => {
  const snapshot = { studentLife: { books: [] }, currencyBalances: { 3: 5 }, currencyHistory: { 3: [] } };
  const before = structuredClone(snapshot);
  const client = createCanvasLibraryClient(dependencies({
    dataMode: 'mock',
    isSharedConfigured: false,
    loadLocalSnapshot: () => snapshot,
    storeLocalSnapshot: () => false,
  }));
  assert.deepEqual(await client.placeBook(draft, 17), {
    ok: false,
    error: { code: 'LIBRARY_LOCAL_SAVE_FAILED', retryable: true },
  });
  assert.deepEqual(snapshot, before);
});

test('existing unplaced book uses stable bookId and never serializes metadata as new', async () => {
  const bodies: unknown[] = [];
  const existing = { ...draft, bookId: 'legacy-book-3' };
  const client = createCanvasLibraryClient(dependencies({
    fetcher: async (_input, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      const value = { studentLife: { books: [{
        id: existing.bookId, studentNumber: 3, title: draft.title.trim(), author: draft.author.trim(),
        pageCount: 120, createdAt: NOW, colorIndex: 0, librarySlot: 17,
      }] } };
      return new Response(JSON.stringify({
        book: normalizeStudentLifeState(value.studentLife).books[0], updatedAt: NOW, value,
      }), { status: 200 });
    },
  }));
  assert.equal((await client.placeBook(existing, 17)).ok, true);
  assert.deepEqual((bodies[0] as { book: unknown }).book, { kind: 'existing', bookId: 'legacy-book-3' });
});
