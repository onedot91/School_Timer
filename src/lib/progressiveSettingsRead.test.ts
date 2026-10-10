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
    replies.push({ id, updated_at: at, scope: 'full', value: initial, storagePatch: patch(initial, true), readManifest: manifest });
    await settings.loadSharedSettingsRow();
    assert.equal(requests.at(-1)?.manifest, null, 'invalidated data needs a fresh baseline while retaining capability');
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
  } finally {
    globalThis.fetch = priorFetch;
    if (priorWindow) Object.defineProperty(globalThis, 'window', priorWindow); else Reflect.deleteProperty(globalThis, 'window');
    await server.close();
  }
});
