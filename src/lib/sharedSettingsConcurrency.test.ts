import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { createServer } from 'vite';
import { STUDENT_MUTABLE_MAP_FIELDS } from './studentSettingsUpdate.js';

const record = (value: unknown): Record<string, unknown> => {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value));
  return Object.fromEntries(Object.entries(value));
};

const gate = () => {
  let release = () => {};
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
};

const withClient = async (t: TestContext, run: (
  client: typeof import('./supabaseSettings.js'),
  backend: {
    value: Record<string, unknown>;
    version: number;
    reads: number;
    writes: Record<string, unknown>[];
    conflicts: number;
    scope: 'full' | 'student';
    rejectNext: boolean;
    afterCommit?: () => Promise<void>;
    beforeCommit?: () => Promise<void>;
    invalidNextReceipt?: boolean;
    afterRead?: () => Promise<void>;
  },
) => Promise<void>) => {
  const server = await createServer({ configFile: false, envDir: false, logLevel: 'silent', server: { middlewareMode: true, watch: null }, define: {
    'import.meta.env.PROD': 'true', 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://fake.invalid'), 'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('fake'),
  } });
  const backend: Parameters<typeof run>[1] = {
    value: { currencyBalances: { 7: 100, 8: 237 }, currencyHistory: { 7: [], 8: [{ legacy: true }] }, auctionAwards: null,
      studentNumberBaseball: { '8:week': { legacy: true } } },
    version: 0, reads: 0, writes: [], conflicts: 0, scope: 'full', rejectNext: false,
  };
  const timestamp = () => new Date(Date.UTC(2026, 8, 7, 0, 0, backend.version)).toISOString();
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    assert.equal(String(input), '/api/shared-settings');
    if (init?.method !== 'PUT') {
      backend.reads++;
      const value = structuredClone(backend.value);
      if (backend.scope === 'student') {
        for (const field of STUDENT_MUTABLE_MAP_FIELDS) {
          if (value[field]) value[field] = { 7: record(value[field])['7'] };
        }
      }
      const updatedAt = timestamp();
      await backend.afterRead?.();
      return Response.json({ id: 'school-timer-main', scope: backend.scope, value, updated_at: updatedAt });
    }
    const body = record(JSON.parse(String(init.body)));
    backend.writes.push(body);
    if (backend.rejectNext) { backend.rejectNext = false; return Response.json({}, { status: 400 }); }
    if (body.expectedUpdatedAt !== timestamp()) {
      backend.conflicts++;
      return Response.json({}, { status: 409 });
    }
    await backend.beforeCommit?.();
    for (const [field, value] of Object.entries(record(body.value))) {
      backend.value[field] = STUDENT_MUTABLE_MAP_FIELDS.some((name) => name === field)
        ? { ...record(backend.value[field] ?? {}), ...record(value) }
        : value;
    }
    backend.version++;
    const updatedAt = timestamp();
    await backend.afterCommit?.();
    if (backend.invalidNextReceipt) { backend.invalidNextReceipt = false; return Response.json({}); }
    return Response.json({ updatedAt });
  });
  try {
    const client = await server.ssrLoadModule('/src/lib/supabaseSettings.ts') as typeof import('./supabaseSettings.js');
    await run(client, backend);
  } finally { await server.close(); }
};

test('같은 브라우저의 교사·학생 저장은 순서대로 최신 영수증을 사용하고 불필요한 충돌과 재조회를 만들지 않는다', async (t) => {
  await withClient(t, async (client, backend) => {
    const started = gate(); const receipt = gate();
    let teacherCalls = 0; let studentCalls = 0;
    backend.afterCommit = async () => { backend.afterCommit = undefined; started.release(); await receipt.promise; };
    const teacher = client.updateSharedSettings((current) => {
      teacherCalls++;
      return { ...record(current), auctionAwards: { item: { studentNumber: 7, amount: 10 } } };
    });
    await started.promise;
    const student = client.updateStudentSharedSettings(7, (current) => {
      studentCalls++;
      const value = record(current);
      return { ...value, currencyBalances: { ...record(value.currencyBalances), 7: 115 } };
    });
    await new Promise(setImmediate);
    const callsBeforeReceipt = studentCalls;
    receipt.release();
    await Promise.all([teacher, student]);
    assert.equal(callsBeforeReceipt, 0, '이전 저장이 끝나기 전에는 updater를 실행하지 않는다');
    assert.equal(teacherCalls, 1); assert.equal(studentCalls, 1);
    assert.equal(backend.reads, 1); assert.equal(backend.writes.length, 2); assert.equal(backend.conflicts, 0);
    assert.deepEqual(backend.value.currencyBalances, { 7: 115, 8: 237 });
    assert.deepEqual(backend.value.currencyHistory, { 7: [], 8: [{ legacy: true }] });
    assert.deepEqual(backend.value.auctionAwards, { item: { studentNumber: 7, amount: 10 } });
    assert.deepEqual(backend.writes[1].value, { currencyBalances: { 7: 115 } });
  });
});

test('학생 범위 GET에서 시작한 동시 저장도 앞선 보상과 다른 학생의 원본 기록을 보존한다', async (t) => {
  await withClient(t, async (client, backend) => {
    backend.scope = 'student';
    await Promise.all([
      client.updateStudentSharedSettings(7, (current) => {
        const value = record(current);
        const balances = record(value.currencyBalances);
        assert.equal(balances['8'], undefined);
        assert.equal(typeof balances['7'], 'number');
        return { ...value, currencyBalances: { 7: Number(balances['7']) + 15 } };
      }),
      client.updateStudentSharedSettings(7, (current) => {
        const value = record(current);
        assert.equal(record(value.currencyBalances)['7'], 115);
        return { ...value, studentNumberBaseball: { '7:week': { attempts: ['123'] } } };
      }),
    ]);
    assert.equal(backend.reads, 1); assert.equal(backend.writes.length, 2); assert.equal(backend.conflicts, 0);
    assert.deepEqual(backend.value.currencyBalances, { 7: 115, 8: 237 });
    assert.deepEqual(backend.value.currencyHistory, { 7: [], 8: [{ legacy: true }] });
    assert.deepEqual(backend.value.studentNumberBaseball, { '8:week': { legacy: true }, '7:week': { attempts: ['123'] } });
    assert.equal(backend.value.auctionAwards, null);
  });
});

test('저장 실패는 원래 호출만 거절하고 대기 중인 다음 저장과 updater를 재실행하지 않는다', async (t) => {
  await withClient(t, async (client, backend) => {
    backend.rejectNext = true;
    let failedCalls = 0; let nextCalls = 0;
    const results = await Promise.allSettled([
      client.updateSharedSettings((current) => { failedCalls++; return { ...record(current), failed: true }; }),
      client.updateSharedSettings((current) => { nextCalls++; return { ...record(current), saved: true }; }),
    ]);
    assert.equal(results[0].status, 'rejected');
    if (results[0].status === 'rejected') assert.match(String(results[0].reason), /SHARED_API_HTTP_400/);
    assert.equal(results[1].status, 'fulfilled');
    assert.equal(failedCalls, 1); assert.equal(nextCalls, 1);
    assert.equal(backend.value.failed, undefined); assert.equal(backend.value.saved, true);
    assert.equal(backend.reads, 1); assert.equal(backend.writes.length, 2); assert.equal(backend.conflicts, 0);
  });
});

test('저장 중 전용 API가 캐시를 무효화하면 늦은 영수증을 캐시하지 않고 대기 중인 저장이 다시 조회한다', async (t) => {
  await withClient(t, async (client, backend) => {
    const started = gate(); const receipt = gate();
    backend.afterCommit = async () => { backend.afterCommit = undefined; started.release(); await receipt.promise; };
    const first = client.updateStudentSharedSettings(7, (current) => ({ ...record(current), currencyBalances: { 7: 115 } }));
    await started.promise;
    const next = client.updateStudentSharedSettings(7, (current) => {
      const value = record(current);
      assert.equal(record(value.currencyBalances)['7'], 135);
      return { ...value, studentNumberBaseball: { '7:week': { attempts: ['123'] } } };
    });
    backend.value.currencyBalances = { 7: 135, 8: 237 };
    backend.version++;
    client.invalidateSharedSettingsCache();
    receipt.release();
    await Promise.all([first, next]);
    assert.equal(backend.reads, 2); assert.equal(backend.writes.length, 2); assert.equal(backend.conflicts, 0);
    assert.deepEqual(backend.value.currencyBalances, { 7: 135, 8: 237 });
    assert.deepEqual(backend.value.studentNumberBaseball, { '8:week': { legacy: true }, '7:week': { attempts: ['123'] } });
  });
});


test('동시에 필요한 설정 조회는 한 요청으로 합치고 완료 뒤에는 최신값을 다시 조회한다', async (t) => {
  await withClient(t, async (client, backend) => {
    const held = gate();
    backend.afterRead = () => held.promise;
    const reads = Array.from({ length: 8 }, () => client.loadSharedSettingsRow());
    assert.equal(backend.reads, 1);
    held.release();
    const rows = await Promise.all(reads);
    rows.forEach(row => assert.deepEqual(record(row?.value).currencyBalances, { 7: 100, 8: 237 }));
    backend.version++;
    await client.loadSharedSettingsRow();
    assert.equal(backend.reads, 2);
  });
});

test('조회 중 캐시 무효화 후의 요청은 이전 응답에 합쳐지지 않는다', async (t) => {
  await withClient(t, async (client, backend) => {
    const held = gate();
    backend.afterRead = async () => { backend.afterRead = undefined; await held.promise; };
    const stale = client.loadSharedSettingsRow();
    client.invalidateSharedSettingsCache();
    backend.value.currencyBalances = { 7: 120, 8: 237 }; backend.version++;
    const fresh = await client.loadSharedSettingsRow();
    assert.equal(backend.reads, 2);
    assert.equal(record(record(fresh?.value).currencyBalances)['7'], 120);
    held.release(); await stale;
    await client.updateStudentSharedSettings(7, current => ({ ...record(current), currencyBalances: { 7: 125 } }));
    assert.equal(backend.conflicts, 0);
  });
});

test('저장 완료 이후 조회는 저장 전 진행 중이던 조회와 합쳐지지 않는다', async (t) => {
  await withClient(t, async (client, backend) => {
    await client.loadSharedSettingsRow();
    const held = gate();
    backend.afterRead = async () => { backend.afterRead = undefined; await held.promise; };
    const stale = client.loadSharedSettingsRow();
    await client.updateStudentSharedSettings(7, current => ({ ...record(current), currencyBalances: { 7: 125 } }));
    const fresh = await client.loadSharedSettingsRow();
    assert.equal(record(record(fresh?.value).currencyBalances)['7'], 125);
    held.release(); await stale;
    await client.updateStudentSharedSettings(7, current => ({ ...record(current), currencyBalances: { 7: 130 } }));
    assert.equal(backend.conflicts, 0);
    assert.equal(backend.reads, 3);
  });
});


test('저장 응답이 손상되면 커밋 전 시작된 배경 조회와 별도로 저장 결과를 확인한다', async (t) => {
  await withClient(t, async (client, backend) => {
    await client.loadSharedSettingsRow();
    const saving = gate(); const commit = gate(); const oldRead = gate();
    backend.beforeCommit = async () => { backend.beforeCommit = undefined; saving.release(); await commit.promise; };
    backend.invalidNextReceipt = true;
    const save = client.updateStudentSharedSettings(7, current => ({ ...record(current), currencyBalances: { 7: 125 } }));
    await saving.promise;
    client.invalidateSharedSettingsCache();
    backend.afterRead = async () => { backend.afterRead = undefined; await oldRead.promise; };
    const background = client.loadSharedSettingsRow();
    commit.release();
    const unblock = setTimeout(oldRead.release, 1000);
    try {
      assert.equal(await save, new Date(Date.UTC(2026, 8, 7, 0, 0, 1)).toISOString());
      assert.equal(backend.reads, 3);
      assert.equal(backend.writes.length, 1);
      assert.equal(record(backend.value.currencyBalances)['7'], 125);
    } finally { clearTimeout(unblock); oldRead.release(); await background; }
  });
});
