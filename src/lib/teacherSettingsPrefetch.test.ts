import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { createServer } from 'vite';

const withTeacherClient = async (t: TestContext, actor: string, run: (
  client: typeof import('./supabaseSettings.js'),
  backend: { reads: number; failNext: boolean; delayMs: number },
) => Promise<void>) => {
  const storage = new Map([['school-timer-entry-number-v1', actor]]);
  const previousWindow = Reflect.get(globalThis, 'window');
  Reflect.set(globalThis, 'window', {
    localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) },
    addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true,
  });
  const server = await createServer({ configFile: false, envDir: false, logLevel: 'silent', server: { middlewareMode: true, watch: null }, define: {
    'import.meta.env.PROD': 'true', 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://fake.invalid'), 'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('fake'),
  } });
  const backend = { reads: 0, failNext: false, delayMs: 0 };
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    assert.equal(String(input), '/api/shared-settings?changes=1');
    backend.reads++;
    if (backend.delayMs) await new Promise(resolve => setTimeout(resolve, backend.delayMs));
    if (backend.failNext) { backend.failNext = false; return Response.json({}, { status: 400 }); }
    return Response.json({ id: 'school-timer-main', scope: 'full', value: { auctionItems: [], read: backend.reads }, updated_at: new Date(Date.UTC(2026, 9, 20, 0, 0, backend.reads)).toISOString() });
  });
  try {
    await run(await server.ssrLoadModule('/src/lib/supabaseSettings.ts') as typeof import('./supabaseSettings.js'), backend);
  } finally {
    await server.close();
    Reflect.set(globalThis, 'window', previousWindow);
  }
};

test('교사 화면은 부팅 때 미리 출발한 설정 조회를 첫 불러오기에서 그대로 이어받는다', async (t) => {
  await withTeacherClient(t, '0', async (client, backend) => {
    client.prefetchTeacherSettingsRow();
    client.prefetchTeacherSettingsRow();
    assert.equal(backend.reads, 1, '미리 조회는 한 번만 출발한다');
    const row = await client.loadInitialTeacherSettingsRow();
    assert.equal(backend.reads, 1, '첫 불러오기는 새 요청 없이 미리 조회를 사용한다');
    assert.equal((row?.value as { read?: number }).read, 1);
    await client.loadInitialTeacherSettingsRow();
    assert.equal(backend.reads, 2, '미리 조회는 한 번만 이어받고 이후에는 새로 조회한다');
  });
});

test('학생 기기와 실패한 미리 조회는 교사 첫 불러오기를 막지 않는다', async (t) => {
  await withTeacherClient(t, '5', async (client, backend) => {
    client.prefetchTeacherSettingsRow();
    assert.equal(backend.reads, 0, '학생 번호에서는 교사 설정을 미리 받지 않는다');
  });
  await withTeacherClient(t, '0', async (client, backend) => {
    backend.failNext = true;
    client.prefetchTeacherSettingsRow();
    await assert.rejects(client.loadInitialTeacherSettingsRow());
    const row = await client.loadInitialTeacherSettingsRow();
    assert.ok(row);
    assert.equal(backend.reads, 2, '실패 후 재시도는 새 요청을 보낸다');
  });
});

test('미리 조회는 기기 확인·화면 코드 로드와 겹쳐 첫 설정 표시까지의 대기를 줄인다', async (t) => {
  const SESSION_MS = 120;
  const PAGE_MS = 160;
  const SETTINGS_MS = 200;
  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const measure = async (prefetch: boolean) => {
    let elapsed = 0;
    await withTeacherClient(t, '0', async (client, backend) => {
      backend.delayMs = SETTINGS_MS;
      const started = performance.now();
      if (prefetch) client.prefetchTeacherSettingsRow();
      await Promise.all([wait(SESSION_MS), wait(PAGE_MS)]);
      await (prefetch ? client.loadInitialTeacherSettingsRow() : client.loadSharedSettingsRow());
      elapsed = performance.now() - started;
    });
    return elapsed;
  };
  const before = await measure(false);
  const after = await measure(true);
  t.diagnostic(`simulated first settings ready: before ${before.toFixed(0)}ms → after ${after.toFixed(0)}ms`);
  assert.ok(before >= PAGE_MS + SETTINGS_MS - 5);
  assert.ok(after < PAGE_MS + SETTINGS_MS - 100, '설정 조회가 화면 준비와 병렬로 진행된다');
});
