import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

test('학생 변경 버전은 개인 저장만 재조회하고 캐시 무효화·구형 서버·조회 실패를 보존한다', async (t) => {
  const server = await createServer({ configFile: false, envDir: false, logLevel: 'silent', server: { middlewareMode: true, watch: null }, define: {
    'import.meta.env.PROD': 'true', 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://fake.invalid'), 'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('fake'),
  } });
  const timestamp = '2026-09-16T00:00:00.000001Z';
  let version: string | undefined = 'a'.repeat(32);
  let remoteTime = timestamp;
  let metadata: { readVersion?: string; updatedAt: string } = { updatedAt: timestamp, readVersion: version };
  let lastUrl = '';
  let fail = false;
  let beforeMetadata: (() => void) | undefined;
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    lastUrl = String(input);
    if (lastUrl.includes('metadata=1')) {
      beforeMetadata?.();
      if (fail) return Response.json({ error: 'UNAVAILABLE' }, { status: 502 });
      return Response.json(metadata);
    }
    return Response.json({ id: 'school-timer-main', value: { currencyBalances: { 7: 100 } }, scope: 'student', updated_at: remoteTime, readVersion: version });
  });
  try {
    const client = await server.ssrLoadModule('/src/lib/supabaseSettings.ts') as typeof import('./supabaseSettings.js');
    await client.loadSharedSettingsRow();
    metadata.updatedAt = '2026-09-16T00:00:01.000001Z';
    assert.equal(await client.loadSharedSettingsUpdatedAt(), timestamp);
    assert.match(lastUrl, /scoped=1/);
    metadata.readVersion = 'b'.repeat(32);
    metadata.updatedAt = timestamp;
    assert.equal(await client.loadSharedSettingsUpdatedAt(), null);
    version = metadata.readVersion;
    await client.loadSharedSettingsRow();
    assert.equal(await client.loadSharedSettingsUpdatedAt(), timestamp);
    beforeMetadata = () => client.invalidateSharedSettingsCache();
    assert.equal(await client.loadSharedSettingsUpdatedAt(), null);
    beforeMetadata = undefined;
    await client.loadSharedSettingsUpdatedAt();
    assert.equal(lastUrl, '/api/shared-settings?metadata=1');
    version = undefined;
    remoteTime = '2026-09-16T00:00:02.000001Z';
    await client.loadSharedSettingsRow();
    metadata = { updatedAt: remoteTime };
    assert.equal(await client.loadSharedSettingsUpdatedAt(), remoteTime);
    assert.equal(lastUrl, '/api/shared-settings?metadata=1');
    fail = true;
    await assert.rejects(client.loadSharedSettingsUpdatedAt());
  } finally { await server.close(); }
});
