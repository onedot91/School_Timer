import assert from 'node:assert/strict';
import test from 'node:test';
import { splitStorageState } from './storageV2Codec.js';

const patch = (value: Record<string, unknown>, complete: boolean, revision = 1) => {
  const encoded = splitStorageState(value);
  return { ...encoded, complete, revisions: Object.fromEntries(encoded.resources.map(row => [row.resource_key, revision])), deletedKeys: [], historyStudents: [] };
};

test('teacher delta merging and compact student reads retain complete cache and actor boundaries', async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ configFile: false, envDir: false, logLevel: 'silent', server: { middlewareMode: true, watch: null },
    define: { 'import.meta.env.PROD': 'true', 'import.meta.env.DEV': 'false', 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://fixture.invalid'), 'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('fixture') } });
  const priorFetch = globalThis.fetch, priorWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let actor = '0';
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: { getItem: () => actor } } });
  const requests: { url: string; manifest: string | null }[] = [];
  const replies: unknown[] = [];
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), manifest: new Headers(init?.headers).get('X-Storage-Read-Manifest') });
    return Response.json(replies.shift());
  };
  const id = 'school-timer-main', at = '2026-10-10T00:00:00Z';
  try {
    const settings = await server.ssrLoadModule('/src/lib/supabaseSettings.ts') as typeof import('./supabaseSettings.js');
    const initial = { scheduleNotice: 'old', retained: { content: 'keep' } };
    const manifest = { 'resource:scheduleNotice': 'a'.repeat(32), 'resource:retained': 'b'.repeat(32) };
    replies.push({ id, updated_at: at, scope: 'full', value: initial, storagePatch: patch(initial, true), readManifest: manifest });
    await settings.loadSharedSettingsRow();
    assert.equal(settings.canLoadTeacherSettingsChanges(), true);
    replies.push({ id, updated_at: at, scope: 'full', value: { scheduleNotice: null }, storagePatch: patch({ scheduleNotice: null }, false, 2), readManifest: { ...manifest, 'resource:scheduleNotice': 'c'.repeat(32) } });
    const changed = await settings.loadSharedSettingsRow();
    assert.deepEqual(changed?.value, { scheduleNotice: null, retained: { content: 'keep' } });
    assert.deepEqual(JSON.parse(requests[1].manifest ?? 'null'), manifest);
    settings.invalidateSharedSettingsCache();
    assert.equal(settings.canLoadTeacherSettingsChanges(), true);
    const latestManifest = { ...manifest, 'resource:scheduleNotice': 'c'.repeat(32) };
    replies.push({ id, updated_at: at, scope: 'full', value: {}, storagePatch: patch({}, false, 2), readManifest: latestManifest });
    const afterInvalidation = await settings.loadSharedSettingsRow();
    assert.deepEqual(afterInvalidation?.value, { scheduleNotice: null, retained: { content: 'keep' } });
    assert.deepEqual(JSON.parse(requests.at(-1)?.manifest ?? 'null'), latestManifest);
    actor = '7';
    assert.equal(settings.canLoadTeacherSettingsChanges(), false);
    replies.push({ id, updated_at: at, scope: 'student', value: { studentPets: { '7': { name: 'pet' } } },
      readScope: 'overview', storagePatch: patch({ studentPets: { '7': { name: 'pet' } } }, false) });
    const overview = await settings.loadStudentOverviewSettingsRow();
    assert.equal(overview?.readScope, 'overview');
    assert.equal(requests.at(-1)?.manifest, null);
    assert.deepEqual(overview?.value, { studentPets: { '7': { name: 'pet' } } });
    replies.push({ id, updated_at: at, scope: 'student', encoding: 'storage-patch', storagePatch: patch({ studentPets: { '7': { name: 'pet' } }, dailyWriting: { title: 'loaded' } }, true) });
    const full = await settings.loadSharedSettingsRow();
    assert.equal(full?.readScope, undefined);
    assert.equal(requests.at(-1)?.url, '/api/shared-settings');
    assert.deepEqual(full?.value, { studentPets: { '7': { name: 'pet' } }, dailyWriting: { title: 'loaded' } });
    replies.push({ id, updated_at: at, scope: 'student', encoding: 'storage-patch', storagePatch: patch({}, false) });
    await assert.rejects(settings.loadSharedSettingsRow(), /SHARED_SETTINGS_INVALID_RESPONSE/);
    actor = '0';
    replies.push({ id, updated_at: at, scope: 'full', value: initial, storagePatch: patch(initial, true), readManifest: manifest });
    await settings.loadSharedSettingsRow();
    assert.equal(requests.at(-1)?.manifest, null, 'returning to a teacher session requires a new complete baseline');
  } finally {
    globalThis.fetch = priorFetch;
    if (priorWindow) Object.defineProperty(globalThis, 'window', priorWindow); else Reflect.deleteProperty(globalThis, 'window');
    await server.close();
  }
});

test('student reads keep the manifest of the cached parts and merge only the changed parts', async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ configFile: false, envDir: false, logLevel: 'silent', server: { middlewareMode: true, watch: null },
    define: { 'import.meta.env.PROD': 'true', 'import.meta.env.DEV': 'false', 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://fixture.invalid'), 'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('fixture') } });
  const priorFetch = globalThis.fetch, priorWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let actor = '7';
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: { getItem: () => actor } } });
  const requests: { url: string; manifest: string | null; changes: string | null }[] = [];
  const replies: unknown[] = [];
  globalThis.fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    requests.push({ url: String(input), manifest: headers.get('X-Storage-Read-Manifest'), changes: headers.get('X-Storage-Changes') });
    return Response.json(replies.shift());
  };
  const id = 'school-timer-main', at = '2026-10-30T00:00:00Z';
  try {
    const settings = await server.ssrLoadModule('/src/lib/supabaseSettings.ts') as typeof import('./supabaseSettings.js');
    const initial = { auctionBids: { 'item-a': { bidder: 3, amount: 20 } }, weeklySubjects: { w1: '국어' } };
    const first = { 'scope:/auctionBids': 'a'.repeat(32), 'scope:/weeklySubjects': 'b'.repeat(32), 'wallet:7': 'c'.repeat(32) };
    replies.push({ id, updated_at: at, scope: 'student', encoding: 'storage-patch', storagePatch: patch(initial, true), readManifest: first });
    assert.deepEqual((await settings.loadSharedSettingsRow())?.value, initial);
    assert.deepEqual(requests.at(-1), { url: '/api/shared-settings', manifest: null, changes: '1' });

    const second = { ...first, 'scope:/auctionBids': 'd'.repeat(32) };
    const bid = { auctionBids: { 'item-a': { bidder: 9, amount: 30 } } };
    replies.push({ id, updated_at: at, scope: 'student', value: bid, storagePatch: patch(bid, false, 2), readManifest: second });
    assert.deepEqual((await settings.loadSharedSettingsRow())?.value, { ...initial, ...bid });
    assert.deepEqual(JSON.parse(requests.at(-1)?.manifest ?? 'null'), first);

    // Saves invalidate the row cache but not the parts already merged into the projection.
    settings.invalidateSharedSettingsCache();
    replies.push({ id, updated_at: at, scope: 'student', value: {}, storagePatch: patch({}, false, 2), readManifest: second });
    assert.deepEqual((await settings.loadSharedSettingsRow())?.value, { ...initial, ...bid });
    assert.deepEqual(JSON.parse(requests.at(-1)?.manifest ?? 'null'), second);

    replies.push({ id, updated_at: at, scope: 'student', value: bid, readScope: 'overview', storagePatch: patch(bid, false, 2) });
    await settings.loadStudentOverviewSettingsRow();
    assert.deepEqual(requests.at(-1), { url: '/api/shared-settings?overview=1', manifest: null, changes: null });

    actor = '8';
    replies.push({ id, updated_at: at, scope: 'student', encoding: 'storage-patch', storagePatch: patch(initial, true), readManifest: { 'wallet:8': 'e'.repeat(32) } });
    await settings.loadSharedSettingsRow();
    assert.equal(requests.at(-1)?.manifest, null, 'another student starts from a complete read');
  } finally {
    globalThis.fetch = priorFetch;
    if (priorWindow) Object.defineProperty(globalThis, 'window', priorWindow); else Reflect.deleteProperty(globalThis, 'window');
    await server.close();
  }
});
