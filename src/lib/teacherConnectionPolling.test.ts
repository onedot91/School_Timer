import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const fixture = (kind: 'settings' | 'alerts', changes = false) => {
  const source = readFileSync(new URL(kind === 'settings' ? '../pages/TimerPage.tsx' : '../components/teacher/TeacherSaveFailureWarning.tsx', import.meta.url), 'utf8');
  const marker = kind === 'settings' ? '    const syncSharedSettingsFromRemote = async () => {' : '    let disposed = false;';
  const start = source.lastIndexOf('  useEffect(() => {', source.indexOf(marker));
  const end = source.indexOf('  }, []);', start) + '  }, []);'.length;
  assert.ok(start >= 0 && end > start);
  let now = 0;
  let fail = true;
  let calls = 0;
  let metadataCalls = 0;
  let applied = 0;
  let pause = false;
  let finishRead: (() => void) | undefined;
  let cleanup: (() => void) | undefined;
  let tick: (() => Promise<void> | void) | undefined;
  const events = new Map<string, () => void>();
  const document = { visibilityState: 'visible',
    addEventListener: (key: string, callback: () => void) => events.set(key, callback),
    removeEventListener: (key: string) => events.delete(key) };
  const navigator = { onLine: true };
  const refreshRef = { current: async (_afterMutation?: boolean) => {} };
  const ref = (current: unknown = false) => ({ current });
  const read = async () => {
    calls++;
    if (pause) await new Promise<void>(resolve => { finishRead = resolve; });
    if (fail) throw new Error('UNAVAILABLE');
  };
  const refs = Object.fromEntries([
    'teacherSettingsErrorRef', 'teacherSettingsSavingRef', 'isSharedSettingsSavePendingRef',
    'hasUnsavedWeeklySubjectsRef', 'hasUnsavedSubjectCatalogRef', 'hasUnsavedAuctionItemsRef',
    'isEditingNoticeRef', 'isEditingSubjectCatalogRef', 'isEditingAuctionItemRef', 'isEditingBookstoreRef',
    'teacherRefreshPendingRef', 'teacherSettingsBaseRef', 'latestTeacherSnapshotRef',
  ].map(name => [name, ref()]));
  const warnings: boolean[] = [];
  runInNewContext(ts.transpile(source.slice(start, end), { target: ts.ScriptTarget.ES2022 }), {
    ...refs, document, navigator, Date: { now: () => now }, console: { error() {} },
    window: { ...document, setInterval: (callback: () => void) => { tick = callback; return 1; }, clearInterval: () => { tick = undefined; } },
    useEffect: (callback: () => () => void) => { cleanup = callback(); },
    isSupabaseSettingsEnabled: true, sharedSettingsHydratedRef: ref(true), awardPresentationRef: ref(null),
    lastSharedSettingsUpdatedAtRef: ref('unchanged'), getSaveRefreshVersion: () => 0,
    isSaveRefreshVersionCurrent: () => true, createTeacherSettingsChanges: () => [],
    canLoadTeacherSettingsChanges: () => changes,
    loadSharedSettingsUpdatedAt: async () => { metadataCalls++; await read(); return 'unchanged'; },
    loadSharedSettingsRow: async () => {
      assert.ok(changes, 'unchanged metadata must not load a snapshot');
      await read(); return { value: {}, updated_at: 'unchanged' };
    },
    normalizeSharedSchoolTimerSettings: (value: unknown) => value, isStorageRecord: () => true,
    teacherSettingsPersistedBaseRef: ref({}), applySharedSettingsSnapshot: () => { applied++; },
    setTeacherRefreshPending: () => {}, markSaveRefreshComplete: () => {},
    refreshRef, mutationVersion: ref(0), SAVE_FAILURE_POLL_MS: 5000, SAVE_FAILURE_CHANGE_EVENT: 'save-alert-change',
    loadSaveFailureAlerts: async () => { await read(); return { alerts: [], hasMore: false }; },
    setAlerts() {}, setHasMore() {}, setUnavailable: (value: boolean) => warnings.push(value),
  });
  const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
  return {
    document, navigator, warnings, refreshRef, events,
    calls: () => calls,
    metadataCalls: () => metadataCalls, applied: () => applied,
    recover: () => { fail = false; },
    pause: () => { pause = true; },
    finish: async () => { pause = false; finishRead?.(); await flush(); },
    event: async (name: string) => { events.get(name)?.(); await flush(); },
    tick: async (at: number) => { now = at; await tick?.(); await flush(); },
    stop: () => cleanup?.(), flush,
  };
};

test('teacher manifests poll once and apply revision changes even when the timestamp is unchanged', async () => {
  const screen = fixture('settings', true);
  screen.recover();
  await screen.tick(5000);
  assert.equal(screen.calls(), 1);
  assert.equal(screen.metadataCalls(), 0);
  assert.equal(screen.applied(), 1);
  screen.stop();
});

for (const kind of ['settings', 'alerts'] as const) {
  test(`${kind}: failed background reads back off and recover without overlapping interval requests`, async () => {
    const screen = fixture(kind);
    await screen.flush();
    for (let time = 5000; time <= 60_000; time += 5000) await screen.tick(time);
    assert.equal(screen.calls(), 4, 'at most four failed reads in the first minute');
    screen.recover();
    await screen.tick(80_000);
    assert.equal(screen.calls(), 5);
    await screen.tick(85_000);
    assert.equal(screen.calls(), 6, 'successful reads restore the normal interval');
    if (kind === 'alerts') assert.equal(screen.warnings.at(-1), false);
    screen.stop();
    assert.equal(screen.events.size, 0);
    await screen.tick(90_000);
    assert.equal(screen.calls(), 6);
  });

  test(`${kind}: hidden and offline screens stop reads and refresh on becoming visible`, async () => {
    const screen = fixture(kind);
    screen.recover();
    await screen.flush();
    screen.document.visibilityState = 'hidden';
    await screen.tick(60_000);
    const before = screen.calls();
    screen.document.visibilityState = 'visible';
    screen.navigator.onLine = false;
    await screen.tick(65_000);
    assert.equal(screen.calls(), before);
    screen.navigator.onLine = true;
    await screen.event('visibilitychange');
    assert.equal(screen.calls(), before + 1);
    screen.stop();
  });
}

test('explicit alert retry bypasses background backoff', async () => {
  const screen = fixture('alerts');
  await screen.flush();
  screen.recover();
  await screen.refreshRef.current();
  assert.equal(screen.calls(), 2);
  assert.equal(screen.warnings.at(-1), false);
  screen.stop();
});

test('느린 교사 조회는 완료 후 5초를 기다리고 포커스가 즉시 재조회를 만들지 않는다', async () => {
  const screen = fixture('settings');
  screen.recover();
  screen.pause();
  const pending = screen.tick(5000);
  await screen.tick(9900);
  assert.equal(screen.calls(), 1);
  await screen.finish();
  await pending;
  await screen.tick(10_000);
  await screen.event('focus');
  assert.equal(screen.calls(), 1);
  await screen.tick(14_900);
  assert.equal(screen.calls(), 2);
  screen.stop();
});
