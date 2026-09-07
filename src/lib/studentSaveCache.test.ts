import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

test('늦은 조회가 저장 영수증을 덮지 않고 무효화 후에는 다시 조회한다', async (t) => {
  const server = await createServer({ configFile: false, envDir: false, logLevel: 'silent', server: { middlewareMode: true, watch: null }, define: {
    'import.meta.env.PROD': 'true', 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://fake.invalid'), 'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('fake'),
  } });
  const initial = { id: 'school-timer-main', scope: 'student', value: { currencyBalances: { 7: 100 } }, updated_at: '2026-09-07T00:00:00.000Z' };
  const committedAt = '2026-09-07T00:00:01.000Z';
  let releaseRead: ((response: Response) => void) | undefined;
  let delayRead = false;
  let reads = 0;
  const versions: unknown[] = [];
  t.mock.method(globalThis, 'fetch', async (_input: unknown, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      versions.push(JSON.parse(String(init.body)).expectedUpdatedAt);
      return Response.json({ updatedAt: committedAt });
    }
    reads++;
    if (delayRead) { delayRead = false; return new Promise<Response>((resolve) => { releaseRead = resolve; }); }
    return Response.json(initial);
  });
  try {
    const client = await server.ssrLoadModule('/src/lib/supabaseSettings.ts') as typeof import('./supabaseSettings.js');
    await client.loadSharedSettingsRow();
    delayRead = true;
    const background = client.loadSharedSettingsRow();
    await client.updateStudentSharedSettings(7, () => ({ currencyBalances: { 7: 110 } }));
    assert.ok(releaseRead);
    releaseRead(Response.json(initial));
    await background;
    await client.updateStudentSharedSettings(7, () => ({ currencyBalances: { 7: 120 } }));
    assert.deepEqual(versions, [initial.updated_at, committedAt]);
    assert.equal(reads, 2, '두 저장 모두 별도 사전 조회 없이 실행한다');
    client.invalidateSharedSettingsCache();
    await client.updateStudentSharedSettings(7, () => ({ currencyBalances: { 7: 130 } }));
    assert.equal(reads, 3, '전용 API 저장 등으로 무효화한 캐시는 재조회한다');
  } finally { await server.close(); }
});
