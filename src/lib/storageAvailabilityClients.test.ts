import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

test('전용 저장 클라이언트는 운영 거절과 저장 미확인을 구분하고 자동 재전송하지 않는다', async (context) => {
  const server = await createServer({
    configFile: false, envDir: false, logLevel: 'silent', server: { middlewareMode: true, watch: null },
    define: { 'import.meta.env.PROD': 'true', 'import.meta.env.DEV': 'false', 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://fixture.invalid'), 'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('fixture') },
  });
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const originalFetch = globalThis.fetch;
  const values = new Map<string, string>([['school-timer-entry-number-v1', '0']]);
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: Object.assign(new EventTarget(), { localStorage: storage, location: { hash: '#teacher' } }) });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false } });
  try {
    const commands = await server.ssrLoadModule('/src/lib/storageCommandClient.ts') as typeof import('./storageCommandClient.js');
    const economy = await server.ssrLoadModule('/src/lib/studentEconomyClient.ts') as typeof import('./studentEconomyClient.js');
    const classword = await server.ssrLoadModule('/src/lib/classwordClient.ts') as typeof import('./classwordClient.js');
    const friend = await server.ssrLoadModule('/src/lib/todayFriendClient.ts') as typeof import('./todayFriendClient.js');
    const library = await server.ssrLoadModule('/src/lib/libraryCompetitionClient.ts') as typeof import('./libraryCompetitionClient.js');
    const availability = await server.ssrLoadModule('/src/lib/storageAvailability.ts') as typeof import('./storageAvailability.js');
    const failures = await server.ssrLoadModule('/src/lib/saveFailureClient.ts') as typeof import('./saveFailureClient.js');
    const calls: { method: string; url: string }[] = [];
    let response = () => Response.json({ error: 'STORAGE_MAINTENANCE' }, { status: 503 });
    globalThis.fetch = async (url, init) => {
      const method = init?.method ?? 'GET';
      calls.push({ method, url: String(url) });
      if (method === 'GET') return Response.json({ status: 'unknown', committed: false });
      return response();
    };
    const empty = { competition: { state: null, standings: [], serverAt: '2026-09-08T00:00:00Z' }, value: {}, updatedAt: null, rolledOver: false };
    const libraryClient = library.createLibraryCompetitionClient({ dataMode: 'production', isSharedConfigured: true,
      fetcher: (url, init) => fetch(url, init), localRead: () => empty, localHistory: () => ({ months: [], archive: null }),
      localSettings: () => empty, withLocalLock: async action => action(), invalidate: () => undefined });
    const saves = [
      () => commands.executeStorageCommand({ requestId: 'fixture-paused', action: 'teacher.settings', payload: {} }),
      () => economy.updateStudentEconomy({ studentNumber: 1, requestId: 'fixture-paused', action: { type: 'select_character', characterId: null } }),
      () => classword.resetTeacherClasswordQuiz('2026-09-08'),
      () => friend.updateTeacherTodayFriendPlan({ action: 'reassign_week', dateKey: '2026-09-08' }),
      () => libraryClient.settings({ expectedRevision: 0, speed: 1, paused: false, counts: [] }),
    ];
    for (const [code, status, kind] of [['STORAGE_MAINTENANCE', 503, 'maintenance'], ['LEGACY_CLIENT_UPDATE_REQUIRED', 409, 'update'], ['STORAGE_PROTOCOL_UPGRADE_REQUIRED', 426, 'update']] as const) {
      response = () => Response.json({ error: code }, { status });
      for (const save of saves) {
        calls.length = 0; availability.dismissStorageAvailabilityNotice();
        await assert.rejects(save, error => availability.getStorageAvailability(error) === kind);
        assert.equal(calls.length, 1);
        assert.notEqual(calls[0].method, 'GET');
        assert.deepEqual(availability.getStorageAvailabilityNotice(), { actor: 0, kind });
        assert.equal(values.get(failures.SAVE_FAILURE_STORAGE_KEY), undefined);
      }
    }
    for (const makeResponse of [() => Response.json({ error: 'UNKNOWN_FAILURE' }, { status: 503 }), () => Response.json(null)]) {
      response = makeResponse;
      for (const save of saves.slice(0, 3)) {
        calls.length = 0; availability.dismissStorageAvailabilityNotice();
        await assert.rejects(save, /CONFIRMATION_REQUIRED/);
        assert.equal(calls.filter(call => call.method !== 'GET').length, 1);
        assert.ok(calls.some(call => call.method === 'GET'));
        assert.equal(availability.getStorageAvailabilityNotice(), null);
      }
      for (const save of saves.slice(3)) {
        calls.length = 0;
        await assert.rejects(save);
        assert.equal(calls.length, 1);
        assert.equal(availability.getStorageAvailabilityNotice(), null);
      }
    }
    const alerts: unknown = JSON.parse(values.get(failures.SAVE_FAILURE_STORAGE_KEY) ?? '[]');
    assert.ok(Array.isArray(alerts) && alerts.length >= 5, 'actual final failures remain in the independent report queue');
    for (const save of saves.slice(0, 3)) {
      availability.dismissStorageAvailabilityNotice();
      let writes = 0;
      globalThis.fetch = async (_url, init) => {
        if (init?.method === 'POST') { writes += 1; throw new TypeError('fixture response lost'); }
        return Response.json({ error: 'STORAGE_MAINTENANCE' }, { status: 503 });
      };
      await assert.rejects(save, /CONFIRMATION_REQUIRED/);
      assert.equal(writes, 1);
      assert.equal(availability.getStorageAvailabilityNotice(), null, 'maintenance during confirmation does not prove the original write was rejected');
    }
    const beforeRecovery = values.get(failures.SAVE_FAILURE_STORAGE_KEY);
    const recoveredMethods: string[] = [];
    globalThis.fetch = async (_url, init) => {
      recoveredMethods.push(init?.method ?? 'GET');
      if (init?.method === 'POST') throw new TypeError('fixture response lost');
      return Response.json({ committed: true, result: { deleted: true } });
    };
    await saves[2]();
    assert.deepEqual(recoveredMethods, ['POST', 'GET']);
    assert.equal(values.get(failures.SAVE_FAILURE_STORAGE_KEY), beforeRecovery, 'confirmed recovery creates no final save alert');
    for (const save of saves) {
      availability.dismissStorageAvailabilityNotice();
      values.set('school-timer-entry-number-v1', '0');
      globalThis.fetch = async () => { values.set('school-timer-entry-number-v1', '4'); return Response.json({ error: 'STORAGE_MAINTENANCE' }, { status: 503 }); };
      await assert.rejects(save, /SESSION_CHANGED/);
      assert.equal(availability.getStorageAvailabilityNotice(), null);
    }
    context.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-09T00:00:00Z') });
    values.set('school-timer-entry-number-v1', '3');
    const retrySaves = [
      { send: () => classword.saveClasswordEntry({ studentNumber: 3, dateKey: '2026-09-09', initial: 'ㄱ', word: '가방' }, '물건'),
        receipt: (body: Record<string, unknown>) => classword.loadClasswordCommandReceipt(body, true) },
      { send: () => friend.submitStudentTodayFriendMission({ mission: { studentNumber: 3, dateKey: '2026-09-09', partnerNumber: 4, genre: 'interview', question: '시험 질문', submission: null },
          requestId: 'friend-first-retry-after-fixture', expectedRevision: 0, payload: { kind: 'interview', answer: '합성 답변' } }),
        receipt: (body: Record<string, unknown>) => friend.loadTodayFriendSubmissionReceipt(String(body.requestId), body) },
    ];
    for (const save of retrySaves) {
      const bodies: Record<string, unknown>[] = [];
      let reads = 0;
      globalThis.fetch = async (_url, init) => {
        if (init?.method === 'POST') {
          bodies.push(JSON.parse(String(init.body)));
          return Response.json({ error: 'RATE_LIMITED' }, { status: 429, headers: { 'Retry-After': '12' } });
        }
        reads += 1;
        return Response.json({ status: 'unknown' });
      };
      const limited = (error: unknown) => error instanceof Error && Reflect.get(error, 'status') === 429;
      await assert.rejects(save.send, limited);
      assert.equal(bodies.length, 1);
      assert.equal(bodies[0].expectedStudentNumber, 3, 'new submissions bind the original student even when another tab changes the cookie');
      await assert.rejects(save.send, limited);
      assert.equal(bodies.length, 1, 'the first foreground Retry-After blocks immediate retransmission');
      await save.receipt(bodies[0]);
      assert.equal(reads, 1, 'receipt reads remain available during the POST delay');
      context.mock.timers.tick(11_999);
      await assert.rejects(save.send, limited);
      assert.equal(bodies.length, 1);
      context.mock.timers.tick(1);
      await assert.rejects(save.send, limited);
      assert.equal(bodies.length, 2, 'the same request becomes eligible only after Retry-After');
      assert.deepEqual(bodies[1], bodies[0]);
    }
    const legacyWord = { protocolVersion: 2, action: 'save_entry', dateKey: '2026-09-09', initial: 'ㄴ', word: '나무' };
    storage.setItem('school-timer-classword-request-v2:3:save_entry', JSON.stringify({ requestId: 'legacy-word-no-target', fingerprint: JSON.stringify(legacyWord) }));
    const legacyCalls: { method: string; url: string }[] = [];
    globalThis.fetch = async (url, init) => { legacyCalls.push({ method: init?.method ?? 'GET', url: String(url) }); return Response.json({ status: 'unknown' }); };
    await assert.rejects(() => classword.saveClasswordEntry({ studentNumber: 3, dateKey: '2026-09-09', initial: 'ㄴ', word: '나무' }, '자연'), /LEGACY_CONFIRMATION_REQUIRED/);
    await assert.rejects(() => friend.submitStudentTodayFriendMission({ mission: { studentNumber: 3, dateKey: '2026-09-09', partnerNumber: 4, genre: 'interview', question: '시험 질문', submission: null },
      requestId: 'legacy-friend-no-target', expectedStudentNumber: null, expectedRevision: 0, payload: { kind: 'interview', answer: '이전 답변' } }), /LEGACY_CONFIRMATION_REQUIRED/);
    assert.equal(legacyCalls.length, 2);
    assert.ok(legacyCalls.every(call => call.method === 'GET' && new URL(call.url, 'https://fixture.invalid').searchParams.get('expectedStudentNumber') === '3'), 'legacy requests only inspect receipts for the original student');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow); else Reflect.deleteProperty(globalThis, 'window');
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator); else Reflect.deleteProperty(globalThis, 'navigator');
    await server.close();
  }
});
