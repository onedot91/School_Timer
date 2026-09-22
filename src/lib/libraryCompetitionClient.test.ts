import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryCompetitionClient, type LibraryCompetitionClientDependencies } from './libraryCompetitionClient.js';
import { SAVE_FAILURE_STORAGE_KEY } from './saveFailureClient.js';

const empty = { competition: { state: null, standings: [], serverAt: '2026-09-05T00:00:00.000Z' }, value: {}, updatedAt: null, rolledOver: false };
const deps = (overrides: Partial<LibraryCompetitionClientDependencies> = {}): LibraryCompetitionClientDependencies => ({
  dataMode: 'mock', isSharedConfigured: true,
  fetcher: async () => { throw new Error('Mock must never reach network'); },
  localRead: () => empty, localHistory: () => ({ months: [], archive: null }), localSettings: () => empty,
  withLocalLock: async action => action(), invalidate: () => undefined, ...overrides,
});
test('mock open is local even when Supabase configuration exists', async () => {
  assert.deepEqual(await createLibraryCompetitionClient(deps()).read('open'), empty);
});
test('readonly open uses GET and never initializes local or remote state', async () => {
  const requests: { url: string; method: string | undefined }[] = [];
  const client = createLibraryCompetitionClient(deps({ dataMode: 'readonly', fetcher: async (url, init) => {
    assert.equal(new Headers(init?.headers).get('X-Storage-Projection'), '1');
    requests.push({ url: String(url), method: init?.method }); return Response.json(empty);
  }, localRead: () => { throw new Error('must not use local'); } }));
  await client.read('open');
  assert.deepEqual(requests, [{ url: '/api/shared-settings?libraryCompetition=1', method: 'GET' }]);
});
test('readonly settings reject before any write', async () => {
  await assert.rejects(createLibraryCompetitionClient(deps({ dataMode: 'readonly' })).settings({ expectedRevision: 0, speed: 1, paused: false, counts: [] }), { code: 'READ_ONLY_DATA_MODE' });
});
test('malformed shared response fails rather than showing fabricated empty standings', async () => {
  await assert.rejects(createLibraryCompetitionClient(deps({ dataMode: 'production', fetcher: async () => Response.json({ competition: {} }) })).read('open'), { code: 'LIBRARY_COMPETITION_INVALID_RESPONSE' });
});

test('학생의 자동 순위판 조회 실패는 책장 저장 오류로 보고하지 않는다', async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const storage = new Map<string, string>([['school-timer-entry-number-v1', '12']]);
  const localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
  };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: Object.assign(new EventTarget(), { localStorage, location: { hash: '#student-library' } }) });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false } });
  try {
    const client = createLibraryCompetitionClient(deps({ dataMode: 'production', fetcher: async () => { throw new TypeError('offline'); } }));

    await assert.rejects(client.read('open'), { code: 'LIBRARY_COMPETITION_NETWORK' });

    assert.equal(storage.get(SAVE_FAILURE_STORAGE_KEY), undefined);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else Reflect.deleteProperty(globalThis, 'window');
    if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator); else Reflect.deleteProperty(globalThis, 'navigator');
  }
});

test('uncertain teacher adjustment keeps one protocol v2 request identity until confirmed', async () => {
  const bodies: Record<string, unknown>[] = [];
  const client = createLibraryCompetitionClient(deps({ dataMode: 'production', fetcher: async (_url, init) => {
    assert.equal(new Headers(init?.headers).get('X-Storage-Projection'), '1');
    const body: unknown = JSON.parse(String(init?.body));
    assert.ok(body !== null && typeof body === 'object' && !Array.isArray(body));
    bodies.push(Object.fromEntries(Object.entries(body)));
    if (bodies.length === 1) throw new TypeError('response lost');
    return Response.json(empty);
  } }));
  const settings = { expectedRevision: 0, speed: 1 as const, paused: false, counts: [] };
  await assert.rejects(client.settings(settings), { code: 'LIBRARY_COMPETITION_NETWORK' });
  await client.settings(settings);
  assert.equal(bodies[0].protocolVersion, 2);
  assert.equal(typeof bodies[0].requestId, 'string');
  assert.equal(bodies[0].requestId, bodies[1].requestId);
});

test('부분 순위 응답은 DB 저장 시각 대신 서버 현재 시각으로 계산한다', async () => {
  const { createLibraryCompetition, projectLibraryCompetition } = await import('./libraryCompetition.js');
  const { splitStorageState } = await import('./storageV2Codec.js');
  const state = createLibraryCompetition({ seasonId: '2026-09', seed: 'clock-regression', startedAt: '2026-09-08T00:00:00.000Z', bookIds: ['fixture-book'] });
  const value = { libraryCompetition: state };
  const encoded = splitStorageState(value);
  const updatedAt = '2026-09-08T00:00:00.40954+00:00';
  const serverAt = '2026-09-09T03:00:00.000Z';
  const standings = projectLibraryCompetition(state, serverAt);
  const client = createLibraryCompetitionClient(deps({ dataMode: 'readonly', fetcher: async () => Response.json({
    competition: { state, standings, serverAt }, value, updatedAt, rolledOver: false,
    storagePatch: { ...encoded, revisions: Object.fromEntries(encoded.resources.map(row => [row.resource_key, 1])), historyStudents: [], deletedKeys: [], complete: false },
  }) }));
  const result = await client.read('readonly');
  assert.equal(result.updatedAt, updatedAt);
  assert.equal(result.competition.serverAt, serverAt);
  assert.deepEqual(result.competition.standings, standings);
});
