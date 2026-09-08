import assert from 'node:assert/strict';
import test from 'node:test';
import { StorageResponseOrder, StorageResponseActorChangedError, compareStorageTimestamps } from './storageResponseOrder.js';
import { splitStorageState } from './storageV2Codec.js';

const projection = (balance: number, updatedAt: string) => ({ value: { currencyBalances: { '17': balance } }, updatedAt });

test('older command and background read projections retain the newest authoritative wallet', () => {
  const order = new StorageResponseOrder();
  const first = order.capture('17');
  const second = order.capture('17');
  const newer = projection(334, '2026-09-08T02:00:00.000002Z');
  order.accept(second, newer, '17');
  assert.deepEqual(order.accept(first, projection(328, '2026-09-08T02:00:00.000001Z'), '17'), newer);
  assert.deepEqual(order.read(first, '17'), newer);
});

test('actor changes reject old completions and clear the previous actor projection', () => {
  const order = new StorageResponseOrder();
  const old = order.capture('0');
  order.accept(old, { value: { teacherPrivate: 'fixture' }, updatedAt: '2026-09-08T02:00:00Z', scope: 'full' }, '0');
  const student = order.capture('17');
  assert.equal(order.read(student, '17'), null);
  assert.throws(() => order.accept(old, projection(999, '2026-09-08T02:01:00Z'), '17'), StorageResponseActorChangedError);
  order.capture('0');
  assert.throws(() => order.read(old, '0'), StorageResponseActorChangedError);
});

test('unknown actors do not share retained projections', () => {
  const order = new StorageResponseOrder();
  const context = order.capture(null);
  order.accept(context, projection(334, '2026-09-08T02:00:00Z'), null);
  assert.equal(order.read(context, null), null);
});

test('timestamp ordering keeps microseconds and accepts equivalent timezone formats', () => {
  assert.equal(compareStorageTimestamps('2026-09-08T02:00:00.000002Z', '2026-09-08T02:00:00.000001+00:00'), 1);
  assert.equal(compareStorageTimestamps('2026-09-08T11:00:00.123456+09:00', '2026-09-08T02:00:00.123456Z'), 0);
  assert.equal(compareStorageTimestamps('2026-09-08T02:00:00Z', '2026-09-08T02:00:00.000001Z'), -1);
});

test('command client and GET share response ordering and reject a completion after actor switch', async () => {
  const { createServer } = await import('vite');
  const server = await createServer({
    configFile: false, envDir: false, logLevel: 'silent', server: { middlewareMode: true, watch: null },
    define: { 'import.meta.env.PROD': 'true', 'import.meta.env.DEV': 'false', 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://fixture.invalid'), 'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('fixture-only') },
  });
  const originalFetch = globalThis.fetch;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let actor = '17';
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: { getItem: () => actor }, location: { hash: '#student-overview' } } });
  const pending: { path: string; body: unknown; resolve: (response: Response) => void }[] = [];
  globalThis.fetch = async (input, init) => new Promise<Response>((resolve) => pending.push({ path: String(input), body: typeof init?.body === 'string' ? JSON.parse(init.body) : null, resolve }));
  const complete = (index: number, value: unknown) => pending[index].resolve(new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  try {
    const client = await server.ssrLoadModule('/src/lib/storageCommandClient.ts') as typeof import('./storageCommandClient.js');
    const settings = await server.ssrLoadModule('/src/lib/supabaseSettings.ts') as typeof import('./supabaseSettings.js');
    const older = client.executeStorageCommand({ requestId: 'older', action: 'student.reward', payload: {} });
    const newer = client.executeStorageCommand({ requestId: 'newer', action: 'student.reward', payload: {} });
    complete(1, { ...projection(334, '2026-09-08T02:00:00.000002Z'), result: 'newer action result' });
    assert.deepEqual((await newer).value, projection(334, 'x').value);
    complete(0, { ...projection(328, '2026-09-08T02:00:00.000001Z'), result: 'older action result' });
    const olderResult = await older;
    assert.deepEqual(olderResult.value, projection(334, 'x').value);
    assert.equal(olderResult.result, 'older action result');

    const read = settings.loadSharedSettingsRow();
    const newest = client.executeStorageCommand({ requestId: 'newest', action: 'student.reward', payload: {} });
    complete(3, { ...projection(340, '2026-09-08T02:00:00.000003Z'), result: null });
    await newest;
    complete(2, { id: 'school-timer-main', value: projection(328, 'x').value, updated_at: '2026-09-08T02:00:00.000001Z', scope: 'student' });
    assert.deepEqual((await read)?.value, projection(340, 'x').value);

    const previousActor = client.executeStorageCommand({ requestId: 'previous-actor', action: 'student.reward', payload: {} });
    actor = '4';
    const nextActorRead = settings.loadSharedSettingsRow();
    complete(5, { id: 'school-timer-main', value: { currencyBalances: { '4': 12 } }, updated_at: '2026-09-08T02:00:00.000004Z', scope: 'student' });
    assert.deepEqual((await nextActorRead)?.value, { currencyBalances: { '4': 12 } });
    complete(4, { ...projection(346, '2026-09-08T02:00:00.000005Z'), result: null });
    await assert.rejects(previousActor, /SESSION_CHANGED/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow); else Reflect.deleteProperty(globalThis, 'window');
    await server.close();
  }
});

test('실제 full GET와 command partial을 역순 응답해도 모든 기능을 보존하고 손상 patch는 저장 미확정으로 처리한다', async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ configFile: false, envDir: false, logLevel: 'silent', server: { middlewareMode: true, watch: null },
    define: { 'import.meta.env.PROD': 'true', 'import.meta.env.DEV': 'false', 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://fixture.invalid'), 'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('fixture') } });
  const originalFetch = globalThis.fetch;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const storage = new Map<string, string>([['school-timer-entry-number-v1', '17']]);
  Object.defineProperty(globalThis, 'window', { configurable: true, value: Object.assign(new EventTarget(), {
    localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) }, location: { hash: '#student-overview' },
  }) });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false } });
  const pending: { method: string; resolve: (response: Response) => void }[] = [];
  globalThis.fetch = async (_url, init) => {
    assert.equal(new Headers(init?.headers).get('X-Storage-Projection'), '1');
    return new Promise<Response>(resolve => pending.push({ method: init?.method ?? 'GET', resolve }));
  };
  const at = (second: number) => `2026-09-08T02:00:0${second}.000001Z`;
  const patch = (value: Record<string, unknown>, revision: number, complete: boolean) => {
    const encoded = splitStorageState(value);
    return { ...encoded, complete, historyStudents: encoded.wallets.map(row => row.student_number), deletedKeys: [],
      revisions: Object.fromEntries([...encoded.resources.map(row => [row.resource_key, revision]), ...encoded.wallets.map(row => [`wallet:${row.student_number}`, revision])]) };
  };
  try {
    const client = await server.ssrLoadModule('/src/lib/storageCommandClient.ts') as typeof import('./storageCommandClient.js');
    const settings = await server.ssrLoadModule('/src/lib/supabaseSettings.ts') as typeof import('./supabaseSettings.js');
    const full = settings.loadSharedSettingsRow();
    const letters = client.executeStorageCommand({ requestId: 'fixture-letter', action: 'student.letter', payload: {} });
    const profile = client.executeStorageCommand({ requestId: 'fixture-profile', action: 'student.profile', payload: {} });
    pending[2].resolve(Response.json({ value: {}, updatedAt: at(3), result: 'profile result', storagePatch: patch({ profile: 'new' }, 3, false) }));
    assert.deepEqual((await profile).value, { profile: 'new' });
    pending[1].resolve(Response.json({ value: {}, updatedAt: at(2), result: 'letter result', storagePatch: patch({ studentLife: { letters: [{ id: 'letter', content: 'new' }] } }, 2, false) }));
    assert.deepEqual((await letters).value, { profile: 'new', studentLife: { letters: [{ id: 'letter', content: 'new' }] } });
    const original = { profile: 'old', studentLife: { letters: [{ id: 'letter', content: 'old' }], books: [{ id: 'book' }] } };
    pending[0].resolve(Response.json({ id: 'school-timer-main', value: original, updated_at: at(1), scope: 'student', storagePatch: patch(original, 1, true) }));
    assert.deepEqual((await full)?.value, { profile: 'new', studentLife: { letters: [{ id: 'letter', content: 'new' }], books: [{ id: 'book' }] } });
    let writes = 0;
    let receipts = 0;
    globalThis.fetch = async (_url, init) => {
      assert.equal(new Headers(init?.headers).get('X-Storage-Projection'), '1');
      if (init?.method === 'POST') { writes += 1; return Response.json({ value: {}, updatedAt: at(4), result: null, storagePatch: { resources: [] } }); }
      receipts += 1; return Response.json({ status: 'unknown' });
    };
    await assert.rejects(client.executeStorageCommand({ requestId: 'fixture-invalid-patch', action: 'student.letter', payload: {} }), /STORAGE_CONFIRMATION_REQUIRED/);
    assert.equal(writes, 1); assert.equal(receipts, 3);
    const order = await server.ssrLoadModule('/src/lib/storageResponseOrder.ts') as typeof import('./storageResponseOrder.js');
    assert.deepEqual(order.readLatestStorageProjection(order.captureStorageResponseContext())?.value, { profile: 'new', studentLife: { letters: [{ id: 'letter', content: 'new' }], books: [{ id: 'book' }] } });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow); else Reflect.deleteProperty(globalThis, 'window');
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator); else Reflect.deleteProperty(globalThis, 'navigator');
    await server.close();
  }
});

test('short PostgreSQL timezone offsets preserve microseconds for late responses', () => {
  assert.equal(compareStorageTimestamps('2026-09-08 02:00:00.123457+00', '2026-09-08 02:00:00.123456+00'), 1);
  assert.equal(compareStorageTimestamps('2026-09-08 11:00:00.123456+09', '2026-09-08T02:00:00.123456Z'), 0);
  const order = new StorageResponseOrder();
  const context = order.capture('17');
  const latest = projection(500, '2026-09-08 02:00:00.123457+00');
  order.accept(context, latest, '17');
  assert.deepEqual(order.accept(context, projection(400, '2026-09-08 02:00:00.123456+00'), '17'), latest);
});
