import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';
import { WEEKLY_MISSION_TYPES } from './weeklyMission.js';

test('weekly settlement tracks pending work, reports failure and leaves incomplete missions quiet', async () => {
  const server = await createServer({ configFile: false, envDir: false, logLevel: 'silent', server: { middlewareMode: true, watch: null },
    define: { 'import.meta.env.PROD': 'true', 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://fixture.invalid'), 'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('fixture') } });
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const previousFetch = globalThis.fetch;
  const stored = new Map<string, string>([['school-timer-entry-number-v1', '3']]);
  Object.defineProperty(globalThis, 'window', { configurable: true, value: Object.assign(new EventTarget(), {
    localStorage: { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value) }, location: { hash: '#student-overview' },
  }) });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false } });
  try {
    const client = await server.ssrLoadModule('/src/lib/weeklyMissionClient.ts');
    const progress = await server.ssrLoadModule('/src/lib/saveProgress.ts');
    const reports = await server.ssrLoadModule('/src/lib/saveFailureClient.ts');
    const pending: { resolve: (response: Response) => void; reject: (error: Error) => void }[] = [];
    globalThis.fetch = async () => new Promise<Response>((resolve, reject) => pending.push({ resolve, reject }));
    const first = client.syncWeeklyMissions(3);
    const second = client.syncPersonalQuestionWeeklyMission(3);
    assert.equal(progress.getSaveProgress(), true);
    pending[0].resolve(Response.json({ missions: WEEKLY_MISSION_TYPES.map(missionType => ({ missionType, weekKey: '2026-37', completed: false, awarded: false, rewardAmount: 5, balance: 100 })) }));
    await first;
    assert.equal(progress.getSaveProgress(), true);
    assert.equal(stored.has(reports.SAVE_FAILURE_STORAGE_KEY), false);
    pending[1].reject(new TypeError('private fixture text'));
    await assert.rejects(second);
    assert.equal(progress.getSaveProgress(), false);
    const alerts = JSON.parse(stored.get(reports.SAVE_FAILURE_STORAGE_KEY) ?? '[]');
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].studentNumber, 3);
    assert.equal(alerts[0].code, 'network');
    assert.equal(alerts[0].diagnostics.endpoint, '/api/weekly-mission');
    assert.equal(JSON.stringify(alerts).includes('private fixture text'), false);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else Reflect.deleteProperty(globalThis, 'window');
    if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator); else Reflect.deleteProperty(globalThis, 'navigator');
    await server.close();
  }
});

test('mock and readonly weekly settlement never sends a write or starts progress', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('unexpected backend request'); };
  try {
    for (const mode of ['mock', 'readonly']) {
      const server = await createServer({ configFile: false, envDir: false, logLevel: 'silent', server: { middlewareMode: true, watch: null },
        define: { 'import.meta.env.PROD': 'false', 'import.meta.env.VITE_DATA_MODE': JSON.stringify(mode) } });
      try {
        const client = await server.ssrLoadModule('/src/lib/weeklyMissionClient.ts');
        const progress = await server.ssrLoadModule('/src/lib/saveProgress.ts');
        await assert.rejects(client.syncWeeklyMissions(3), /BACKEND_WRITE_DISABLED/);
        await assert.rejects(client.syncPersonalQuestionWeeklyMission(3), /BACKEND_WRITE_DISABLED/);
        assert.equal(progress.getSaveProgress(), false);
      } finally { await server.close(); }
    }
  } finally { globalThis.fetch = previousFetch; }
});

test('foreground bursts share one request and respect successful cooldown and Retry-After', async () => {
  const server = await createServer({ configFile: false, envDir: false, logLevel: 'silent', server: { middlewareMode: true, watch: null }, define: { 'import.meta.env.PROD': 'true' } });
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  let now = originalNow();
  Date.now = () => now;
  let calls = 0;
  let release: ((value: Response) => void) | undefined;
  globalThis.fetch = async () => { calls += 1; return new Promise<Response>(resolve => { release = resolve; }); };
  try {
    const client = await server.ssrLoadModule('/src/lib/weeklyMissionClient.ts');
    const first = client.syncWeeklyMissions(8);
    const duplicate = client.syncWeeklyMissions(8);
    assert.equal(calls, 1, 'focus and visibilitychange must share the in-flight request');
    assert.ok(release);
    release(Response.json({ missions: WEEKLY_MISSION_TYPES.map(missionType => ({ missionType, weekKey: '2026-37', completed: false, awarded: false, rewardAmount: 5, balance: 100 })) }));
    const [firstResult, duplicateResult] = await Promise.all([first, duplicate]);
    assert.deepEqual(duplicateResult, firstResult, 'shared parsed results retain the same mission state');
    await client.syncWeeklyMissions(8);
    assert.equal(calls, 1, 'immediate foreground events must not repeat a successful request');
    now += 60_000;
    globalThis.fetch = async () => { calls += 1; return Response.json({ error: 'TOO_MANY_REQUESTS' }, { status: 429, headers: { 'Retry-After': '30' } }); };
    await assert.rejects(client.syncWeeklyMissions(8));
    assert.equal(calls, 2);
    now += 10_000;
    await assert.rejects(client.syncWeeklyMissions(8));
    assert.equal(calls, 2, 'Retry-After blocks a new POST, not merely another alert');
    now += 20_001;
    await assert.rejects(client.syncWeeklyMissions(8));
    assert.equal(calls, 3);
  } finally { Date.now = originalNow; globalThis.fetch = originalFetch; await server.close(); }
});
