import assert from 'node:assert/strict';
import test from 'node:test';
import sharedSettings from '../../api/shared-settings.js';
import { StudentReadQueue, StorageReadBusyError } from '../../src/server/storageReadPriority.js';
import { createDeviceSessionToken } from '../../src/server/deviceSession.js';
import { createStorageV2Fixture } from './storageV2Fixture.js';

test('student read admission stays bounded and releases the next reader after errors', async () => {
  const queue = new StudentReadQueue(1, 2);
  let rejectFirst: ((error: Error) => void) | undefined;
  const starts: number[] = [];
  const first = queue.run(() => new Promise<void>((_resolve, reject) => { starts.push(1); rejectFirst = reject; }));
  const failed = assert.rejects(first, /fixture failure/);
  const second = queue.run(async () => { starts.push(2); return 2; });
  const third = queue.run(async () => { starts.push(3); return 3; });
  await assert.rejects(queue.run(async () => 4), StorageReadBusyError);
  assert.deepEqual(starts, [1]);
  rejectFirst?.(new Error('fixture failure'));
  await failed;
  assert.deepEqual(await Promise.all([second, third]), [2, 3]);
  assert.deepEqual(starts, [1, 2, 3]);
});

test('expired queued reads never start later or occupy a released slot', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const queue = new StudentReadQueue(1, 2, 2000);
  let finish: (() => void) | undefined;
  const first = queue.run(() => new Promise<void>(resolve => { finish = resolve; }));
  let staleStarted = false;
  const expired = assert.rejects(queue.run(async () => { staleStarted = true; }), StorageReadBusyError);
  t.mock.timers.tick(2000);
  await expired;
  finish?.();
  await first;
  assert.equal(staleStarted, false);
  assert.equal(await queue.run(async () => 'ready'), 'ready');
});

test('signed teacher reads and writes proceed while 23 student reads saturate the queue', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-09T02:00:00Z') });
  const beforeEnv = { ...process.env }, beforeFetch = globalThis.fetch;
  const secret = 'teacher-priority-isolated-session-fixture';
  Object.assign(process.env, { SUPABASE_URL: 'https://priority-fixture.invalid', SUPABASE_SERVICE_ROLE_KEY: 'fixture',
    DEVICE_SESSION_SECRET: secret, STORAGE_PROTOCOL_VERSION: '2', STORAGE_COMBINED_COMMANDS: '1',
    STORAGE_PROGRESSIVE_READS: '0', STORAGE_TEACHER_PRIORITY: '1', STORAGE_REQUIRE_EDIT_REVISIONS: '0' });
  const fixture = createStorageV2Fixture({ scheduleNotice: 'synthetic',
    currencyBalances: Object.fromEntries(Array.from({ length: 23 }, (_, index) => [index + 1, 100])),
    currencyHistory: {}, studentEconomy: {}, studentEmotionHistory: {}, studentLife: { letters: [] } });
  let active = 0, peak = 0, teacherReads = 0;
  const releases: (() => void)[] = [];
  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith('/storage_load_scope')) {
      active += 1; peak = Math.max(peak, active);
      await new Promise<void>(resolve => { releases.push(resolve); });
      active -= 1;
    }
    if (path.endsWith('/storage_load_snapshot')) teacherReads += 1;
    return fixture.fetch(input, init);
  };
  const invoke = async (actor: number, body?: unknown) => {
    let status = 0, payload: unknown;
    const response = { setHeader() {}, status(code: number) { status = code; return this; }, json(value: unknown) { payload = value; } };
    const cookie = createDeviceSessionToken(actor ? { role: 'student', studentNumber: actor } : { role: 'teacher' }, secret);
    await sharedSettings({ method: body ? 'POST' : 'GET', body,
      headers: { cookie: `__Host-school-timer-device=${cookie}`, 'x-storage-projection': '1', 'sec-fetch-site': 'same-origin' } }, response);
    return { status, payload };
  };
  let draining = false;
  const students = Array.from({ length: 23 }, (_, index) => invoke(index + 1));
  try {
    assert.equal(active, 2);
    assert.equal((await invoke(0)).status, 200);
    assert.equal(teacherReads, 1);
    assert.equal(active, 2, 'teacher must finish while the admitted student reads remain unresolved');
    assert.equal((await invoke(1, { protocolVersion: 2, requestId: 'priority-student-emotion', action: 'student.emotion.save',
      payload: { dateKey: '2026-10-09', emotionId: 'happy', comment: '', selfMessage: '' } })).status, 200);
    assert.equal((await invoke(0, { protocolVersion: 2, requestId: 'priority-teacher-award', action: 'teacher.currency.adjust',
      payload: { studentNumbers: [2], amount: 6 } })).status, 200);
    draining = true;
    while (releases.length) { releases.shift()?.(); await new Promise(resolve => setImmediate(resolve)); }
    assert.ok((await Promise.all(students)).every(result => result.status === 200));
    assert.equal(peak, 2);
  } finally {
    if (!draining) {
      while (releases.length) { releases.shift()?.(); await new Promise(resolve => setImmediate(resolve)); }
      await Promise.allSettled(students);
    }
    globalThis.fetch = beforeFetch; process.env = beforeEnv;
  }
});
