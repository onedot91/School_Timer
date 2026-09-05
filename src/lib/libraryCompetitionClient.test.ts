import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryCompetitionClient, type LibraryCompetitionClientDependencies } from './libraryCompetitionClient.js';

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
