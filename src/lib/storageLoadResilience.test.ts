import assert from 'node:assert/strict';
import test from 'node:test';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
import { canonicalStorageJson } from './storageV2Codec.js';

test('25개 동시 저장의 영수증 조회가 혼잡하면 대기 시간을 지키고 저장을 반복하지 않는다', async (t) => {
  const server = await createServer({ configFile: false, envDir: false, logLevel: 'silent',
    server: { middlewareMode: true, watch: null }, define: {
      'import.meta.env.PROD': 'true', 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://fake.invalid'),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('fake'),
    } });
  const values = new Map<string, string>([['school-timer-entry-number-v1', '0']]);
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: Object.assign(new EventTarget(), {
    localStorage: { getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) },
    location: { hash: '' },
  }) });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
  let posts = 0, receipts = 0, committed = false;
  const commands = Array.from({ length: 25 }, (_, index) => ({
    requestId: `load-fixture-${index}`, action: 'teacher.auction.finalize', payload: { itemId: `fixture-${index}` },
  }));
  const responseTime = '2026-10-01T00:00:00Z';
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input), 'https://fixture.invalid');
    assert.equal(url.hostname, 'fixture.invalid', '외부 요청은 허용하지 않는다');
    if (url.pathname === '/api/save-alerts') return Response.json({ ok: true });
    if (init?.method === 'POST') {
      posts++;
      return Response.json({ error: 'STORAGE_DATABASE_TIMEOUT' }, { status: 502 });
    }
    receipts++;
    await new Promise(resolve => setTimeout(resolve, 10));
    if (!committed) return Response.json({ error: 'BUSY' }, { status: 503, headers: { 'Retry-After': '30' } });
    const command = commands.find(item => item.requestId === url.searchParams.get('requestId'));
    assert.ok(command);
    if (url.searchParams.has('receiptOnly')) return Response.json({ status: 'committed', action: command.action,
      payloadHash: createHash('sha256').update(canonicalStorageJson({ action: command.action, payload: command.payload })).digest('hex'),
      committedAt: responseTime, result: { saved: true } });
    return Response.json({ value: { auctionAwards: { [command.payload.itemId]: { winner: 1, amount: 10 } } },
      updatedAt: responseTime, result: { saved: true } });
  });
  try {
    const client = await server.ssrLoadModule('/src/lib/storageCommandClient.ts') as typeof import('./storageCommandClient.js');
    const recovery = await server.ssrLoadModule('/src/lib/saveRecovery.ts') as typeof import('./saveRecovery.js');
    const started = performance.now();
    const outcomes = await Promise.allSettled(commands.map(command => client.executeStorageCommand(command)));
    const elapsedMs = Math.round(performance.now() - started);
    console.log(JSON.stringify({ scenario: '25-concurrent-receipts-busy', posts, receipts, elapsedMs }));
    assert.equal(posts, 25, '미확인 낙찰 저장을 다시 보내면 안 된다');
    assert.ok(outcomes.every(outcome => outcome.status === 'rejected'
      && outcome.reason instanceof client.StorageCommandError && outcome.reason.uncertainWrite));
    assert.equal(receipts, 25, '혼잡한 서버에 즉시 3회씩 확인 요청을 보내면 안 된다');
    for (const command of commands) assert.ok(recovery.getSaveRecoveryDelay(0, command.requestId) > 25_000);
    await assert.rejects(client.executeStorageCommand(commands[0]), /TOO_MANY_REQUESTS/);
    assert.equal(posts, 25, '수동 재시도도 서버의 대기 시간을 지킨다');

    committed = true;
    const saved = await client.loadStorageCommandReceipt(commands[0].requestId, commands[0]);
    assert.ok(saved?.value);
    assert.equal(posts, 25, '뒤늦게 확정된 낙찰은 조회만으로 확인한다');
  } finally {
    await server.close();
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow); else Reflect.deleteProperty(globalThis, 'window');
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator); else Reflect.deleteProperty(globalThis, 'navigator');
  }
});

test('학생 23명의 고마 거래도 영수증 서버가 혼잡하면 즉시 반복 조회하지 않는다', async (t) => {
  const server = await createServer({ configFile: false, envDir: false, logLevel: 'silent',
    server: { middlewareMode: true, watch: null }, define: { 'import.meta.env.PROD': 'true' } });
  let posts = 0, receipts = 0;
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    assert.ok(String(input).startsWith('/api/'), '외부 요청은 허용하지 않는다');
    if (init?.method === 'POST') {
      posts++;
      return Response.json({ error: 'TIMEOUT' }, { status: 502 });
    }
    receipts++;
    await new Promise(resolve => setTimeout(resolve, 10));
    return Response.json({ error: 'BUSY' }, { status: 503, headers: { 'Retry-After': '30' } });
  });
  try {
    const client = await server.ssrLoadModule('/src/lib/studentEconomyClient.ts') as typeof import('./studentEconomyClient.js');
    const recovery = await server.ssrLoadModule('/src/lib/saveRecovery.ts') as typeof import('./saveRecovery.js');
    const started = performance.now();
    const outcomes = await Promise.allSettled(Array.from({ length: 23 }, (_, index) => client.updateStudentEconomy({
      studentNumber: index + 1, action: { type: 'deposit', amount: 10 }, requestId: `economy-load-${index + 1}`,
    })));
    console.log(JSON.stringify({ scenario: '23-concurrent-economy-receipts-busy', posts, receipts,
      elapsedMs: Math.round(performance.now() - started) }));
    assert.equal(posts, 23);
    assert.ok(outcomes.every(outcome => outcome.status === 'rejected'
      && outcome.reason instanceof client.StudentEconomyRequestError
      && outcome.reason.code === 'STUDENT_ECONOMY_CONFIRMATION_REQUIRED'));
    assert.equal(receipts, 23);
    for (let actor = 1; actor <= 23; actor++) assert.ok(recovery.getSaveRecoveryDelay(actor, `economy-load-${actor}`) > 25_000);
    await assert.rejects(client.updateStudentEconomy({ studentNumber: 1, action: { type: 'deposit', amount: 10 },
      requestId: 'economy-load-1' }), /TOO_MANY_REQUESTS/);
    assert.equal(posts, 23, '고마 수동 재시도도 서버가 지정한 시간 전에 재저장하지 않는다');
  } finally { await server.close(); }
});

test('대기 헤더가 없는 장애와 조회 타임아웃도 반복하지 않고 날짜 형식 대기를 지킨다', async (t) => {
  const server = await createServer({ configFile: false, envDir: false, logLevel: 'silent',
    server: { middlewareMode: true, watch: null }, define: { 'import.meta.env.PROD': 'true' } });
  let receipts = 0;
  let unavailable = () => Response.json({ error: 'BUSY' }, { status: 503 });
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    assert.ok(String(input).startsWith('/api/'));
    if (init?.method === 'POST') return Response.json({ error: 'TIMEOUT' }, { status: 502 });
    receipts++;
    return unavailable();
  });
  try {
    const shared = await server.ssrLoadModule('/src/lib/storageCommandClient.ts') as typeof import('./storageCommandClient.js');
    const economy = await server.ssrLoadModule('/src/lib/studentEconomyClient.ts') as typeof import('./studentEconomyClient.js');
    const recovery = await server.ssrLoadModule('/src/lib/saveRecovery.ts') as typeof import('./saveRecovery.js');
    const cases = [
      () => Response.json({ error: 'BUSY' }, { status: 503 }),
      () => { throw new DOMException('fixture timeout', 'TimeoutError'); },
      () => Response.json({ error: 'BUSY' }, { status: 429, headers: { 'Retry-After': new Date(Date.now() + 30_000).toUTCString() } }),
    ];
    for (const [index, response] of cases.entries()) {
      unavailable = response;
      for (const feature of ['shared', 'economy']) {
        receipts = 0;
        const requestId = `load-${feature}-${index}`;
        await assert.rejects(feature === 'shared'
          ? shared.executeStorageCommand({ studentNumber: 1, requestId, action: 'student.auction.bid', payload: {} })
          : economy.updateStudentEconomy({ studentNumber: 1, requestId, action: { type: 'deposit', amount: 10 } }), /CONFIRMATION_REQUIRED/);
        assert.equal(receipts, 1);
        assert.ok(recovery.getSaveRecoveryDelay(1, requestId) > (index === 2 ? 25_000 : 4000));
      }
    }
  } finally { await server.close(); }
});
