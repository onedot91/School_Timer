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

test('shared placement sends its immutable command with the expected authenticated student', async () => {
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
    protocolVersion: 2,
    expectedStudentNumber: 3,
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

test('uncertain retry keeps the original UUID and original slot when another slot is selected', async () => {
  const requestIds: string[] = [];
  const slots: number[] = [];
  const client = createCanvasLibraryClient(dependencies({
    fetcher: async (_input, init) => {
      const sent = JSON.parse(String(init?.body)) as { requestId: string; slotId: number };
      requestIds.push(sent.requestId); slots.push(sent.slotId);
      throw new TypeError('response dropped');
    },
  }));
  assert.equal((await client.placeBook(draft, 17)).ok, false);
  assert.equal((await client.placeBook(draft, 18)).ok, false);
  assert.deepEqual(requestIds, [UUID_ONE, UUID_ONE]);
  assert.deepEqual(slots, [17, 17]);
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
    error: { code: 'LIBRARY_SAVE_FAILED', retryable: true, status: 502 },
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

test('exact maintenance and upgrade responses publish notices once and preserve manual retry identity', async () => {
  const { dismissStorageAvailabilityNotice, getStorageAvailabilityNotice } = await import('./storageAvailability.js');
  for (const [code, status, kind, expected] of [
    ['STORAGE_MAINTENANCE', 503, 'maintenance', 'LIBRARY_STORAGE_MAINTENANCE'],
    ['STORAGE_NOT_ACTIVE', 503, 'maintenance', 'LIBRARY_STORAGE_MAINTENANCE'],
    ['STORAGE_PROTOCOL_UPGRADE_REQUIRED', 426, 'update', 'LIBRARY_STORAGE_UPDATE_REQUIRED'],
    ['STORAGE_PROTOCOL_REQUIRED', 409, 'update', 'LIBRARY_STORAGE_UPDATE_REQUIRED'],
  ] as const) {
    dismissStorageAvailabilityNotice();
    const calls: Record<string, unknown>[] = [];
    const client = createCanvasLibraryClient(dependencies({ fetcher: async (_input, init) => {
      calls.push(JSON.parse(String(init?.body)));
      return Response.json({ error: code }, { status });
    } }));
    const result = await client.placeBook(draft, 17);
    assert.deepEqual(result, { ok: false, error: { code: expected, retryable: true } });
    assert.equal(getStorageAvailabilityNotice()?.kind, kind);
    assert.equal(calls.length, 1);
    await client.placeBook(draft, 17);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].requestId, calls[1].requestId);
    assert.deepEqual(calls[0].book, calls[1].book);
  }
  dismissStorageAvailabilityNotice();
});

test('arbitrary 503 malformed success and network failure remain uncertain without a maintenance notice', async () => {
  const { dismissStorageAvailabilityNotice, getStorageAvailabilityNotice } = await import('./storageAvailability.js');
  for (const [fetcher, expected, status] of [
    [async () => Response.json({ error: 'OTHER_FAILURE' }, { status: 503 }), 'INVALID_LIBRARY_RESPONSE', 503],
    [async () => Response.json({ error: 'STORAGE_MAINTENANCE' }, { status: 502 }), 'INVALID_LIBRARY_RESPONSE', 502],
    [async () => Response.json({ ok: true }), 'INVALID_LIBRARY_RESPONSE', undefined],
    [async () => { throw new TypeError('network'); }, 'LIBRARY_NETWORK_FAILED', undefined],
  ] as const) {
    dismissStorageAvailabilityNotice();
    let writes = 0;
    const client = createCanvasLibraryClient(dependencies({ fetcher: async (_url, init) => { if (init?.method === 'PUT') writes += 1; return fetcher(); } }));
    const result = await client.placeBook(draft, 17);
    assert.deepEqual(result, { ok: false, error: { code: expected, retryable: true, ...(status === undefined ? {} : { status }) } });
    assert.equal(writes, 1);
    assert.equal(getStorageAvailabilityNotice(), null);
  }
});

test('reload preserves a pending book request ID and changed actor receives no stale save alert', async () => {
  const { dismissStorageAvailabilityNotice, getStorageAvailabilityNotice } = await import('./storageAvailability.js');
  const { captureStorageResponseContext } = await import('./storageResponseOrder.js');
  const { classifySaveFailure } = await import('./saveFailure.js');
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const data = new Map<string, string>();
  let actor = '3';
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
    getItem: (key: string) => key === 'school-timer-entry-number-v1' ? actor : data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key),
  } } });
  dismissStorageAvailabilityNotice();
  try {
    const bodies: Record<string, unknown>[] = [];
    const fetcher: typeof fetch = async (_input, init) => { bodies.push(JSON.parse(String(init?.body))); return Response.json({ error: 'STORAGE_MAINTENANCE' }, { status: 503 }); };
    await createCanvasLibraryClient(dependencies({ createRequestId: () => UUID_ONE, fetcher })).placeBook(draft, 17);
    await createCanvasLibraryClient(dependencies({ createRequestId: () => UUID_TWO, fetcher })).placeBook(draft, 17);
    assert.equal(bodies.length, 2);
    assert.equal(bodies[0].requestId, UUID_ONE);
    assert.equal(bodies[1].requestId, UUID_ONE);
    dismissStorageAvailabilityNotice();
    const changedActorClient = createCanvasLibraryClient(dependencies({ fetcher: async () => {
      actor = '4'; return Response.json({ error: 'STORAGE_MAINTENANCE' }, { status: 503 });
    } }));
    await assert.rejects(changedActorClient.placeBook(draft, 17), error => {
      assert.ok(error instanceof Error);
      assert.equal(error.name, 'StorageResponseActorChangedError');
      assert.equal(classifySaveFailure(error), null);
      return true;
    });
    assert.equal(getStorageAvailabilityNotice(), null);
  } finally {
    if (original) Object.defineProperty(globalThis, 'window', original); else Reflect.deleteProperty(globalThis, 'window');
    captureStorageResponseContext(); dismissStorageAvailabilityNotice();
  }
});

test('receipt confirmation succeeds after committed placement when the display refresh is offline', async () => {
  const { featurePayloadHash } = await import('./featureReceipt.js');
  let writes = 0;
  let invalidated = false;
  let command: Record<string, unknown> | null = null;
  const book = normalizeStudentLifeState(responseValue().studentLife).books[0];
  const client = createCanvasLibraryClient(dependencies({ invalidateSharedCache: () => { invalidated = true; }, fetcher: async (url, init) => {
    if (init?.method === 'PUT') {
      writes += 1;
      const body: unknown = JSON.parse(String(init.body));
      assert.ok(body && typeof body === 'object');
      const { protocolVersion: _version, expectedStudentNumber: _student, ...rest } = body as Record<string, unknown>;
      command = rest;
      throw new TypeError('response lost after commit');
    }
    if (String(url).includes('receiptOnly=1')) return Response.json({ status: 'committed', action: 'placeLibraryBook',
      payloadHash: await featurePayloadHash('placeLibraryBook', command), committedAt: NOW, result: { book } });
    assert.equal(invalidated, true, 'confirmed commits invalidate the old snapshot before attempting a view refresh');
    throw new TypeError('display unavailable');
  } }));
  const result = await client.placeBook(draft, 17);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error('receipt should confirm');
  assert.equal(result.value, null);
  assert.equal(result.refreshPending, true);
  assert.equal(result.placedBook.slotId, 17);
  assert.equal(writes, 1);
});

test('the first library Retry-After persists across client reloads and preserves the original request', async (context) => {
  context.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-09T03:00:00Z') });
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const values = new Map<string, string>([['school-timer-entry-number-v1', '3']]);
  const storage: Storage = { get length() { return values.size; }, key: index => [...values.keys()][index] ?? null,
    clear: () => values.clear(), getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); } };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage } });
  try {
    const bodies: Record<string, unknown>[] = [];
    let reads = 0;
    const inputs = dependencies({ createRequestId: () => '00000000-0000-4000-8000-000000000429', fetcher: async (_url, init) => {
      if (init?.method === 'PUT') {
        bodies.push(JSON.parse(String(init.body)));
        return new Response('rate limited', { status: 429, headers: { 'Retry-After': '12' } });
      }
      reads += 1;
      return Response.json({ status: 'unknown' });
    } });
    const first = await createCanvasLibraryClient(inputs).placeBook(draft, 17, '2026-09');
    assert.equal(first.ok, false);
    const reloaded = createCanvasLibraryClient(inputs);
    const waiting = await reloaded.placeBook(draft, 18, '2026-09');
    assert.equal(waiting.ok, false);
    assert.equal(bodies.length, 1);
    assert.equal(reads, 1, 'confirmation is allowed while the write delay is active');
    context.mock.timers.tick(11_999);
    await reloaded.placeBook(draft, 18, '2026-09');
    assert.equal(bodies.length, 1);
    context.mock.timers.tick(1);
    await reloaded.placeBook(draft, 18, '2026-09');
    assert.equal(bodies.length, 2);
    assert.deepEqual(bodies[1], bodies[0]);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('a definitive occupied-slot rejection allows a new request ID for a newly selected slot', async () => {
  const requests: Array<{ requestId: string; slotId: number }> = [];
  const client = createCanvasLibraryClient(dependencies({ fetcher: async (_url, init) => {
    if (init?.method !== 'PUT') return Response.json({ status: 'unknown' });
    const body = JSON.parse(String(init.body)) as { requestId: string; slotId: number };
    requests.push(body);
    return Response.json({ error: 'LIBRARY_SLOT_OCCUPIED' }, { status: 409 });
  } }));
  await client.placeBook(draft, 17);
  await client.placeBook(draft, 18);
  assert.deepEqual(requests.map(({ requestId, slotId }) => [requestId, slotId]), [[UUID_ONE, 17], [UUID_TWO, 18]]);
});

test('library transport preserves authentication status and Retry-After for the recovery policy', async () => {
  for (const status of [401, 429]) {
    const client = createCanvasLibraryClient(dependencies({
      fetcher: async () => new Response('<html>unavailable</html>', { status, headers: { 'Retry-After': '15' } }),
    }));
    const result = await client.placeBook(draft, 17, '2026-09');
    assert.equal(result.ok, false);
    if (result.ok === false) {
      assert.equal(result.error.status, status);
      assert.equal(result.error.retryAfterMs, 15_000);
    }
  }
});

for (const storedSlot of [undefined, 17]) test(`legacy placement with saved slot ${storedSlot ?? 'missing'} and no actor guard only confirms the original request`, async () => {
  const { createStudentSaveDraftStore } = await import('./studentSaveDraft.js');
  const { featurePayloadHash } = await import('./featureReceipt.js');
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const values = new Map<string, string>([['school-timer-entry-number-v1', '3']]);
  const storage: Storage = { get length() { return values.size; }, key: index => [...values.keys()][index] ?? null,
    clear: () => values.clear(), getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); } };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage } });
  try {
    const book = { kind: 'new', title: draft.title.trim(), author: draft.author.trim(), pageCount: draft.pageCount };
    const pending = createStudentSaveDraftStore({ createRequestId: () => UUID_ONE });
    await pending.saveDurable({ studentNumber: 3, feature: 'library-placement', entityId: `2026-09:${JSON.stringify([null, 3, book.title, book.author, book.pageCount, null])}` }, { book, seasonId: '2026-09', ...(storedSlot === undefined ? {} : { slotId: storedSlot }) });
    const command = { action: 'placeLibraryBook', requestId: UUID_ONE, book, slotId: 17, seasonId: '2026-09' };
    let committed = false;
    const methods: string[] = [];
    const client = createCanvasLibraryClient(dependencies({ fetcher: async (url, init) => {
      methods.push(init?.method ?? 'GET');
      assert.notEqual(init?.method, 'PUT');
      assert.equal(new URL(String(url), 'https://fixture.invalid').searchParams.get('studentNumber'), '3');
      if (!committed) return Response.json({ status: 'unknown' });
      if (String(url).includes('receiptOnly')) return Response.json({ status: 'committed', action: 'placeLibraryBook',
        payloadHash: await featurePayloadHash('placeLibraryBook', command), committedAt: NOW, result: { book: normalizeStudentLifeState(responseValue().studentLife).books[0] } });
      return Response.json({ value: responseValue(), updatedAt: NOW });
    } }));
    assert.equal((await client.listLegacy(3)).length, 1);
    const unknown = await client.placeBook(draft, 18, '2026-09');
    assert.equal(unknown.ok, false);
    if (unknown.ok === false) assert.equal(unknown.error.code, 'LIBRARY_LEGACY_CONFIRMATION_REQUIRED');
    assert.equal((await client.listLegacy(3))[0]?.requestId, UUID_ONE);
    committed = true;
    const confirmed = await client.placeBook(draft, 18, '2026-09');
    assert.equal(confirmed.ok, true);
    if (confirmed.ok) assert.equal(confirmed.book.librarySlot, 17);
    assert.equal((await client.listLegacy(3)).length, 0);
    assert.equal(methods.every(method => method === 'GET'), true);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else Reflect.deleteProperty(globalThis, 'window');
  }
});
