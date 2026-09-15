import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { applyAcknowledgedTeacherChanges, createTeacherSettingsChanges, isStorageRecord } from './teacherStorageCommand.js';
import { getSaveRecoveryStatus, getSaveRefreshVersion, isSaveRefreshVersionCurrent, markSaveRefreshComplete, markSaveRefreshPending } from './saveRecovery.js';
import { normalizeAuctionItems } from './currency.js';
import { transpileModule, ScriptTarget } from 'typescript';
import { StorageCommandError } from './storageCommandClient.js';

const source = readFileSync(new URL('../pages/TimerPage.tsx', import.meta.url), 'utf8');
const callbackStart = source.indexOf('  const refreshTeacherSavedState = ');
const callbackEnd = source.indexOf('  const teacherRecoveryRefreshRef = ', callbackStart);
assert.ok(callbackStart >= 0 && callbackEnd > callbackStart);
const callbackSource = source.slice(callbackStart, callbackEnd) + '\nrefreshTeacherSavedState;';

const fixture = () => {
  let resolveRead: ((value: { value: Record<string, unknown>; updated_at: string }) => void) | undefined;
  const read = new Promise<{ value: Record<string, unknown>; updated_at: string }>(resolve => { resolveRead = resolve; });
  const applied: unknown[] = [];
  const lastUpdatedAt = { current: '2026-09-09T00:00:00.000Z' };
  const pending = { current: true };
  const callback: unknown = runInNewContext(callbackSource, {
    getSaveRefreshVersion, isSaveRefreshVersionCurrent, markSaveRefreshComplete,
    teacherSettingsSavingRef: { current: false },
    sharedSettingsHydratedRef: { current: true },
    confirmTeacherSettingsEditor: async () => undefined,
    getTeacherSettingsEditorRequestId: () => undefined,
    setTeacherSettingsConflict: () => undefined,
    setTeacherSettingsSaveError: () => undefined,
    loadSharedSettingsRow: () => read,
    normalizeSharedSchoolTimerSettings: (value: unknown) => isStorageRecord(value) ? value : null,
    createTeacherSettingsChanges, applyAcknowledgedTeacherChanges, isStorageRecord,
    teacherSettingsPersistedBaseRef: { current: { scheduleNotice: 'before' } },
    teacherSettingsBaseRef: { current: { scheduleNotice: 'before' } },
    latestTeacherSnapshotRef: { current: { scheduleNotice: 'before' } },
    applySharedSettingsSnapshot: (value: unknown) => { applied.push(value); },
    teacherRefreshPendingRef: pending,
    lastSharedSettingsUpdatedAtRef: lastUpdatedAt,
    setTeacherRefreshPending: (value: boolean) => { pending.current = value; },
  });
  assert.equal(typeof callback, 'function');
  return { applied, pending, lastUpdatedAt,
    start: async () => { if (typeof callback !== 'function') throw new Error('Missing teacher callback'); await callback(); },
    finishRead: (updated_at: string) => resolveRead?.({ value: { scheduleNotice: 'saved' }, updated_at }),
  };
};

test('교사 실제 갱신 callback은 이전 조회 응답으로 나중에 확인된 저장 경고를 지우지 않는다', async () => {
  markSaveRefreshPending(0);
  const screen = fixture();
  const pendingRead = screen.start();
  markSaveRefreshPending(0);
  screen.finishRead('2026-09-09T00:00:01.000Z');
  await pendingRead;
  assert.deepEqual(screen.applied, []);
  assert.equal(screen.pending.current, true);
  assert.equal(screen.lastUpdatedAt.current, '2026-09-09T00:00:00.000Z');
  assert.equal(getSaveRecoveryStatus(0).refreshPending, true);
});

test('확인 이후 시작한 교사 조회는 영수증 시각보다 이른 resource updated_at도 최신 화면으로 수신한다', async () => {
  markSaveRefreshPending(0);
  const screen = fixture();
  const pendingRead = screen.start();
  // The resource snapshot timestamp can precede the receipt's transaction timestamp.
  screen.finishRead('2026-09-09T00:00:01.000Z');
  await pendingRead;
  assert.deepEqual(screen.applied, [{ scheduleNotice: 'saved' }]);
  assert.equal(screen.lastUpdatedAt.current, '2026-09-09T00:00:01.000Z');
  assert.equal(screen.pending.current, false);
  assert.equal(getSaveRecoveryStatus(0).refreshPending, false);
});

test('교사 polling은 두 비동기 조회 사이에도 저장 확인 세대를 검사한다', () => {
  const polling = source.slice(source.indexOf('    const syncSharedSettingsFromRemote ='), source.indexOf('    const intervalId = window.setInterval(syncSharedSettingsFromRemote'));
  assert.match(polling, /const refreshVersion = getSaveRefreshVersion\(0\);[\s\S]*await loadSharedSettingsUpdatedAt\(\)/);
  assert.match(polling, /await loadSharedSettingsUpdatedAt\(\);[\s\S]*!isSaveRefreshVersionCurrent\(0, refreshVersion\)[\s\S]*await loadSharedSettingsRow\(\)/);
  assert.match(polling, /await loadSharedSettingsRow\(\);[\s\S]*!isSaveRefreshVersionCurrent\(0, refreshVersion\)[\s\S]*applySharedSettingsSnapshot/);
  assert.match(polling, /markSaveRefreshComplete\(0, refreshVersion\)/);
  assert.doesNotMatch(source, /(?<!if \(saved.value\) )lastSharedSettingsUpdatedAtRef.current = saved.updatedAt;/);
});

test('초기 조회 실패 뒤 복구 조회는 기본 물품을 실제 등록 물품의 변경으로 취급하지 않는다', async () => {
  const defaults = normalizeAuctionItems(null);
  const remote = { auctionItems: [{ ...defaults[1], name: '회귀 검증 물품', isConfigured: true }] };
  const base = { current: {} as Record<string, unknown> };
  const persisted = { current: {} as Record<string, unknown> };
  const snapshot = { current: { auctionItems: defaults } as Record<string, unknown> };
  const hydrated = { current: false };
  const callback: unknown = runInNewContext(callbackSource, {
    getSaveRefreshVersion, isSaveRefreshVersionCurrent, markSaveRefreshComplete,
    teacherSettingsSavingRef: { current: false }, sharedSettingsHydratedRef: hydrated,
    loadSharedSettingsRow: async () => ({ value: remote, updated_at: 'synthetic-time' }),
    normalizeSharedSchoolTimerSettings: (value: unknown) => value,
    createTeacherSettingsChanges, applyAcknowledgedTeacherChanges, isStorageRecord,
    teacherSettingsBaseRef: base, teacherSettingsPersistedBaseRef: persisted, latestTeacherSnapshotRef: snapshot,
    applySharedSettingsSnapshot: (value: Record<string, unknown>) => { snapshot.current = value; base.current = value; },
    teacherStorageDrafts: { ready: async () => undefined },
    initializeTeacherSettingsRef: { current: (row: { value: Record<string, unknown> }) => {
      snapshot.current = row.value; base.current = row.value; persisted.current = row.value; hydrated.current = true;
    } },
    confirmTeacherSettingsEditor: async () => undefined, getTeacherSettingsEditorRequestId: () => undefined,
    setTeacherSettingsConflict: () => undefined, setTeacherSettingsSaveError: () => undefined,
    teacherRefreshPendingRef: { current: true }, lastSharedSettingsUpdatedAtRef: { current: null },
    setTeacherRefreshPending: () => undefined,
  });
  assert.equal(typeof callback, 'function');
  if (typeof callback !== 'function') return;
  await callback();
  assert.deepEqual(snapshot.current.auctionItems, remote.auctionItems);
  assert.equal(hydrated.current, true);
  assert.deepEqual(createTeacherSettingsChanges(base.current, snapshot.current, persisted.current), []);
});

const initializationFixture = (options: {
  editedItems?: ReturnType<typeof normalizeAuctionItems>;
  editorChanges?: ReturnType<typeof createTeacherSettingsChanges>;
  initialReadFailures?: number;
  initialChanges?: ReturnType<typeof createTeacherSettingsChanges>;
  initialDraftDeletionFails?: boolean;
  migratedEditorDurable?: boolean;
} = {}) => {
  const defaults = normalizeAuctionItems(null);
  const remote = {
    auctionItems: [{ ...defaults[1], name: '원격 등록 물품', isConfigured: true }],
    scheduleNotice: '원격 공지',
  };
  const base = { current: {} as Record<string, unknown> };
  const persisted = { current: {} as Record<string, unknown> };
  const snapshot = { current: { auctionItems: options.editedItems ?? defaults, scheduleNotice: '' } as Record<string, unknown> };
  const hydrated = { current: false };
  const commands: unknown[] = [];
  let error = '초기 조회 실패';
  let readFailures = options.initialReadFailures ?? 0;
  let initialize: unknown;
  let editorChanges = options.editorChanges ?? [];
  const drafts = new Map<string, { draft: { requestId: string; payload: unknown }; durable: boolean }>();
  if (options.initialChanges) drafts.set('teacher.settings.initial.editor', {
    draft: { requestId: 'stored-initial-draft', payload: { changes: options.initialChanges } }, durable: true,
  });
  const context = {
    initialTeacherSnapshotRef: { current: { auctionItems: defaults, scheduleNotice: '' } },
    initialTeacherStoredChangesRef: { current: null },
    latestTeacherSnapshotRef: snapshot, sharedSettingsHydratedRef: hydrated,
    teacherSettingsBaseRef: base, teacherSettingsPersistedBaseRef: persisted,
    teacherSettingsSavingRef: { current: false }, teacherSettingsConflict: false, StorageCommandError,
    lastSharedSettingsUpdatedAtRef: { current: null }, teacherRefreshPendingRef: { current: true },
    skipNextSharedSettingsSaveRef: { current: true },
    hasUnsavedWeeklySubjectsRef: { current: false }, hasUnsavedSubjectCatalogRef: { current: false },
    auctionItemsRef: { current: options.editedItems ?? defaults },
    createTeacherSettingsChanges, applyAcknowledgedTeacherChanges, isStorageRecord, normalizeAuctionItems,
    normalizeSharedSchoolTimerSettings: (value: unknown) => isStorageRecord(value)
      ? { ...value, auctionItems: normalizeAuctionItems(value.auctionItems) } : null,
    teacherStorageDrafts: {
      load: (scope: { feature: string }) => drafts.get(scope.feature) ?? null,
      ready: async () => undefined, flush: async () => undefined,
      replace: (scope: { feature: string }, payload: unknown) => {
        const draft = { draft: { requestId: 'new-initial-draft', payload }, durable: true };
        drafts.set(scope.feature, draft);
        return { status: 'saved', ...draft };
      },
      confirmDurable: async (scope: { feature: string }, requestId: string) => {
        if (options.initialDraftDeletionFails) return false;
        if (drafts.get(scope.feature)?.draft.requestId === requestId) drafts.delete(scope.feature);
        return true;
      },
    },
    teacherCommandScope: () => ({}), loadTeacherSettingsEditor: () => editorChanges,
    saveTeacherSettingsEditor: (changes: ReturnType<typeof createTeacherSettingsChanges>) => {
      editorChanges = changes;
      const draft = { draft: { requestId: 'migrated-editor', payload: { changes } }, durable: options.migratedEditorDurable ?? true };
      drafts.set('teacher.settings.editor', draft);
      return { status: 'saved', ...draft };
    },
    getTeacherSettingsEditorRequestId: () => 'synthetic-editor', confirmTeacherSettingsEditor: async () => undefined,
    isTeacherStorageCommandPaused: () => false,
    applySharedSettingsSnapshot: (value: Record<string, unknown>) => { base.current = value; snapshot.current = value; },
    setAuctionItems: (value: unknown) => { snapshot.current = { ...snapshot.current, auctionItems: value }; },
    setTeacherSettingsSaveError: (value: string) => { error = value; }, setTeacherSettingsConflict: () => undefined,
    setTeacherSettingsSaveVersion: () => undefined, setTeacherRefreshPending: () => undefined,
    setIsTeacherSettingsRetrying: () => undefined,
    getSaveRefreshVersion, isSaveRefreshVersionCurrent, markSaveRefreshComplete,
    loadSharedSettingsRow: async () => {
      if (readFailures-- > 0) throw new Error('synthetic read failure');
      return { value: remote, updated_at: 'synthetic-time' };
    },
    executeStorageCommand: async (command: unknown) => { commands.push(command); throw new Error('unexpected write'); },
    teacherSettingsSaveErrorMessage: () => '초기 조회 실패',
    initializeTeacherSettingsRef: { current: (row: unknown) => {
      if (typeof initialize !== 'function') throw new Error('Missing initializer');
      initialize(row);
    } },
  };
  const initialHelpersStart = source.indexOf('const initialTeacherSettingsEditorScope = ');
  const initialHelpersEnd = source.indexOf('const normalizeSharedSchoolTimerSettings = ', initialHelpersStart);
  const helpers: unknown = runInNewContext(transpileModule(source.slice(initialHelpersStart, initialHelpersEnd)
    + '\n({ initialTeacherSettingsEditorScope, loadInitialTeacherSettingsChanges, mergeInitialTeacherSettingsChanges });', {
    compilerOptions: { target: ScriptTarget.ES2022 },
  }).outputText, context);
  if (!isStorageRecord(helpers)) throw new Error('Missing initial draft helpers');
  Object.assign(context, helpers);
  const initializeStart = source.indexOf('  const initializeTeacherSettings = ');
  const initializeEnd = source.indexOf('  const initializeTeacherSettingsRef = ', initializeStart);
  const initializeCode = transpileModule(source.slice(initializeStart, initializeEnd) + '\ninitializeTeacherSettings;', {
    compilerOptions: { target: ScriptTarget.ES2022 },
  }).outputText;
  initialize = runInNewContext(initializeCode, context);
  const refresh: unknown = runInNewContext(callbackSource, context);
  const retryStart = source.indexOf('  const retryTeacherSettingsSave = ');
  const retry: unknown = runInNewContext(source.slice(retryStart, callbackStart) + '\nretryTeacherSettingsSave;', context);
  const initialEffectStart = source.lastIndexOf('  useEffect(() => {', source.indexOf('    void teacherStorageDrafts.ready()'));
  const initialEffectEnd = source.indexOf("  useEffect(() => {\n    localStorage.setItem('weeklySchedule'", initialEffectStart);
  return {
    remote, base, persisted, snapshot, hydrated, commands, drafts, getEditorChanges: () => editorChanges, getError: () => error,
    getInitialChanges: () => {
      const payload: unknown = JSON.parse(JSON.stringify(drafts.get('teacher.settings.initial.editor')?.draft.payload ?? null));
      if (!isStorageRecord(payload) || !Array.isArray(payload.changes)) return [];
      return payload.changes.flatMap(change => isStorageRecord(change) && typeof change.field === 'string'
        && 'before' in change && 'after' in change ? [{ field: change.field, before: change.before, after: change.after }] : []);
    },
    persistInitialEdits: async () => {
      const saveStart = source.indexOf('if (!isSupabaseSettingsEnabled) return;\n    if (!sharedSettingsHydratedRef.current)');
      const saveEnd = source.indexOf('    saveTeacherSettingsEditor(createTeacherSettingsChanges', saveStart);
      runInNewContext('(() => { ' + source.slice(saveStart, saveEnd) + ' })();', { ...context, isSupabaseSettingsEnabled: true });
      await new Promise(resolve => setImmediate(resolve));
    },
    initialize: () => context.initializeTeacherSettingsRef.current({ value: remote, updated_at: 'synthetic-time' }),
    initializeMissing: () => context.initializeTeacherSettingsRef.current(null),
    refresh: async () => { if (typeof refresh !== 'function') throw new Error('Missing refresh'); await refresh(); },
    retry: async () => { if (typeof retry !== 'function') throw new Error('Missing retry'); await retry(); },
    startInitialRead: async () => {
      runInNewContext(source.slice(initialEffectStart, initialEffectEnd), {
        ...context, isSupabaseSettingsEnabled: true,
        useEffect: (effect: () => unknown) => { effect(); },
        console: { error: () => undefined },
      });
      await new Promise(resolve => setImmediate(resolve));
    },
  };
};

test('실제 초기화와 복구 콜백은 최초 기본 화면을 저장하지 않고 정상 원격값으로 초기화한다', async () => {
  const screen = initializationFixture();
  await screen.refresh();
  assert.equal(screen.hydrated.current, true);
  assert.deepEqual({ ...screen.snapshot.current }, screen.remote);
  assert.deepEqual(createTeacherSettingsChanges(screen.base.current, screen.snapshot.current, screen.persisted.current), []);
  assert.deepEqual(screen.commands, []);
  assert.equal(screen.getError(), '');
});

test('최초 조회 실패 후 저장 재시도는 실제 초기화를 완료하고 기본값 PATCH를 보내지 않는다', async () => {
  const screen = initializationFixture();
  await screen.retry();
  assert.equal(screen.hydrated.current, true);
  assert.deepEqual({ ...screen.snapshot.current }, screen.remote);
  assert.deepEqual(screen.commands, []);
});

test('최초 조회 중 실제 수정한 물품만 원격 목록에 합치고 나머지 기본 칸은 추가하지 않는다', () => {
  const editedItems = normalizeAuctionItems(null).map((item, index) => index === 0
    ? { ...item, name: '조회 중 추가한 물품', isConfigured: true as const } : item);
  const screen = initializationFixture({ editedItems });
  screen.initialize();
  const items = normalizeAuctionItems(screen.snapshot.current.auctionItems);
  assert.equal(items.length, 2);
  assert.deepEqual(items.find(item => item.id === 'item-b'), screen.remote.auctionItems[0]);
  assert.deepEqual(items.find(item => item.id === 'item-a'), editedItems[0]);
  assert.equal(screen.snapshot.current.scheduleNotice, screen.remote.scheduleNotice);
  const changes = createTeacherSettingsChanges(screen.base.current, screen.snapshot.current, screen.persisted.current);
  assert.deepEqual(changes.map(change => change.field), ['auctionItems']);
  assert.deepEqual(changes[0].before, screen.remote.auctionItems);
});

test('초기화는 보관된 물품 초안의 변경과 원래 충돌 기준을 유지한다', () => {
  const original = [{ ...normalizeAuctionItems(null)[1], name: '초안 이전 이름', isConfigured: true }];
  const edited = [{ ...original[0], name: '보관된 수정 이름' }];
  const screen = initializationFixture({ editorChanges: [{ field: 'auctionItems', before: original, after: edited }] });
  screen.initialize();
  assert.deepEqual(screen.snapshot.current.auctionItems, edited);
  assert.deepEqual(screen.persisted.current.auctionItems, original);
  assert.match(screen.getError(), /보관된 설정 변경/);
  assert.deepEqual(screen.commands, []);
});

test('설정 행을 확인하지 못하면 초기화를 완료하거나 자동 저장을 열지 않는다', () => {
  const screen = initializationFixture();
  assert.throws(screen.initializeMissing, /SETTINGS_REFRESH_UNAVAILABLE/);
  assert.equal(screen.hydrated.current, false);
  const initialLoad = source.slice(source.indexOf('    void teacherStorageDrafts.ready()'), source.indexOf("    localStorage.setItem('weeklySchedule'"));
  assert.doesNotMatch(initialLoad, /sharedSettingsHydratedRef\.current = true/);
  assert.match(initialLoad, /\.catch\(\(error\) =>/);
});

test('실제 초기 GET 실패와 재시도 GET 실패 후에도 기본값 저장을 잠그고 다음 복구에서 등록 물품을 유지한다', async () => {
  const screen = initializationFixture({ initialReadFailures: 2 });
  await screen.startInitialRead();
  assert.equal(screen.hydrated.current, false);
  assert.match(screen.getError(), /설정을 불러오지 못했어요/);
  await screen.retry();
  assert.equal(screen.hydrated.current, false);
  assert.deepEqual(screen.commands, []);
  await screen.refresh();
  assert.equal(screen.hydrated.current, true);
  assert.deepEqual({ ...screen.snapshot.current }, screen.remote);
  assert.deepEqual(createTeacherSettingsChanges(screen.base.current, screen.snapshot.current, screen.persisted.current), []);
  assert.deepEqual(screen.commands, []);
});

test('초기 조회 중의 새 물품 편집과 다른 물품의 보관된 초안을 함께 유지한다', () => {
  const defaults = normalizeAuctionItems(null);
  const editedItems = defaults.map((item, index) => index === 0
    ? { ...item, name: '새로 입력한 물품', isConfigured: true as const } : item);
  const before = [{ ...defaults[1], name: '이전 물품', isConfigured: true }];
  const after = [{ ...before[0], name: '보관된 물품 수정' }];
  const screen = initializationFixture({ editedItems, editorChanges: [{ field: 'auctionItems', before, after }] });
  screen.initialize();
  const items = normalizeAuctionItems(screen.snapshot.current.auctionItems);
  assert.equal(items.length, 2);
  assert.deepEqual(items.find(item => item.id === 'item-a'), editedItems[0]);
  assert.deepEqual(items.find(item => item.id === 'item-b'), after[0]);
  assert.deepEqual(screen.persisted.current.auctionItems, before);
  assert.match(screen.getError(), /보관된 설정 변경/);
});

test('초기 조회 전 기본 화면은 초안으로 보관하지 않고 기존 저장 초안도 변경하지 않는다', async () => {
  const editorChanges = [{ field: 'scheduleNotice', before: '이전 공지', after: '보관된 공지' }];
  const screen = initializationFixture({ editorChanges });
  await screen.persistInitialEdits();
  assert.equal(screen.drafts.has('teacher.settings.initial.editor'), false);
  assert.deepEqual(screen.getEditorChanges(), editorChanges);
  assert.deepEqual(screen.commands, []);
});

test('최초 GET 장애 중 실제 편집을 보관하고 reload 후 원격 물품과 기존 초안을 함께 복원한다', async () => {
  const defaults = normalizeAuctionItems(null);
  const oldItem = [{ ...defaults[1], name: '보관 초안의 원래 물품', isConfigured: true }];
  const savedItem = [{ ...oldItem[0], name: '보관된 이름 편집' }];
  const editorChanges = [{ field: 'auctionItems', before: oldItem, after: savedItem }];
  const screen = initializationFixture({ initialReadFailures: 1, editorChanges });
  await screen.startInitialRead();
  screen.snapshot.current = {
    auctionItems: defaults.map((item, index) => index === 0 ? { ...item, name: '장애 중 추가한 물품', isConfigured: true } : item),
    scheduleNotice: '장애 중 입력한 공지',
  };
  await screen.persistInitialEdits();
  assert.equal(screen.hydrated.current, false);
  assert.deepEqual(screen.commands, []);
  assert.deepEqual(screen.getEditorChanges(), editorChanges);
  const initialChanges = screen.getInitialChanges();
  assert.deepEqual(initialChanges.map(change => change.field), ['scheduleNotice', 'auctionItems']);
  assert.deepEqual(initialChanges.find(change => change.field === 'auctionItems')?.before, defaults);

  const reloaded = initializationFixture({ initialChanges, editorChanges });
  await reloaded.refresh();
  const items = normalizeAuctionItems(reloaded.snapshot.current.auctionItems);
  assert.equal(items.length, 2);
  assert.equal(items.find(item => item.id === 'item-a')?.name, '장애 중 추가한 물품');
  assert.equal(items.find(item => item.id === 'item-b')?.name, '보관된 이름 편집');
  assert.equal(reloaded.snapshot.current.scheduleNotice, '장애 중 입력한 공지');
  assert.deepEqual(reloaded.persisted.current.auctionItems, oldItem);
  assert.deepEqual(reloaded.commands, []);
  assert.ok(reloaded.getEditorChanges().some(change => change.field === 'auctionItems'));
});

test('초기 조회 전 새 편집을 취소하면 이전 세션의 초안만 남긴다', async () => {
  const initialChanges = [{ field: 'scheduleNotice', before: '', after: '이전 세션 공지' }];
  const screen = initializationFixture({ initialChanges });
  screen.snapshot.current = { ...screen.snapshot.current, scheduleNotice: '이번 세션 편집' };
  await screen.persistInitialEdits();
  assert.equal(screen.getInitialChanges()[0].after, '이번 세션 편집');
  screen.snapshot.current = { ...screen.snapshot.current, scheduleNotice: '' };
  await screen.persistInitialEdits();
  assert.deepEqual(screen.getInitialChanges(), initialChanges);
  assert.deepEqual(screen.commands, []);
});

test('이전된 초기 초안 삭제가 실패해도 다음 접속의 더 최신 편집을 덮어쓰지 않는다', async () => {
  const defaults = normalizeAuctionItems(null);
  const earlyItems = defaults.map((item, index) => index === 1 ? { ...item, name: '초기 편집 A', isConfigured: true } : item);
  const initialChanges = [{ field: 'auctionItems', before: defaults, after: earlyItems }];
  const screen = initializationFixture({ initialChanges, initialDraftDeletionFails: true });
  await screen.refresh();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(screen.getInitialChanges(), []);
  const newerChanges = screen.getEditorChanges().map(change => change.field === 'auctionItems'
    ? { ...change, after: normalizeAuctionItems(change.after).map(item => ({ ...item, name: '나중 편집 B' })) } : change);
  const reloaded = initializationFixture({ initialChanges: screen.getInitialChanges(), editorChanges: newerChanges });
  await reloaded.refresh();
  assert.equal(normalizeAuctionItems(reloaded.snapshot.current.auctionItems)[0].name, '나중 편집 B');
  assert.deepEqual(reloaded.commands, []);
});

test('정상 초안의 영구 보관을 확인하지 못하면 초기 편집 원본을 지우지 않는다', async () => {
  const initialChanges = [{ field: 'scheduleNotice', before: '', after: '보존할 초기 편집' }];
  const screen = initializationFixture({ initialChanges, migratedEditorDurable: false });
  await screen.refresh();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(screen.getInitialChanges(), initialChanges);
  assert.equal(screen.drafts.get('teacher.settings.initial.editor')?.draft.requestId, 'stored-initial-draft');
  assert.deepEqual(screen.commands, []);
});
