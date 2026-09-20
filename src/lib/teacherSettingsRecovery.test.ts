import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { teacherSettingsSaveErrorMessage } from './teacherStorageClient.js';
import { StorageCommandError } from './storageCommandClient.js';
import { applyAcknowledgedTeacherChanges, createTeacherSettingsChanges, isStorageRecord } from './teacherStorageCommand.js';

const retryFixture = (conflict: boolean, execute: (command: { requestId: string; payload: { changes: ReturnType<typeof createTeacherSettingsChanges> } }) => Promise<unknown>) => {
  const source = readFileSync(new URL('../pages/TimerPage.tsx', import.meta.url), 'utf8');
  const start = source.indexOf('  const retryTeacherSettingsSave =');
  const end = source.indexOf('  const refreshTeacherSavedState =', start);
  assert.ok(start >= 0 && end > start);
  const screen = {
    teacherSettingsSavingRef: { current: false },
    sharedSettingsHydratedRef: { current: true },
    teacherSettingsBaseRef: { current: { scheduleNotice: 'old', isNoticeEnabled: true } },
    teacherSettingsPersistedBaseRef: { current: { scheduleNotice: 'old', isNoticeEnabled: true } },
    latestTeacherSnapshotRef: { current: { scheduleNotice: 'mine', isNoticeEnabled: true } },
    lastSharedSettingsUpdatedAtRef: { current: '' },
    skipNextSharedSettingsSaveRef: { current: true },
    hasUnsavedWeeklySubjectsRef: { current: true },
    hasUnsavedSubjectCatalogRef: { current: true },
    hasUnsavedAuctionItemsRef: { current: false },
    error: 'existing error', retrying: false, confirmedEditors: [] as string[],
  };
  const callback: unknown = runInNewContext(source.slice(start, end) + '\nretryTeacherSettingsSave;', {
    ...screen, crypto, StorageCommandError, teacherSettingsConflict: conflict,
    teacherCommandScope: () => ({}), teacherStorageDrafts: { load: () => null },
    loadSharedSettingsRow: async () => ({ value: { scheduleNotice: 'other', isNoticeEnabled: false }, updated_at: 'read-time' }),
    executeStorageCommand: execute, createTeacherSettingsChanges, applyAcknowledgedTeacherChanges, isStorageRecord,
    normalizeSharedSchoolTimerSettings: (value: unknown) => isStorageRecord(value) ? value : null,
    getTeacherSettingsEditorRequestId: () => 'submitted-editor',
    confirmTeacherSettingsEditor: async (id: string) => { screen.confirmedEditors.push(id); },
    applySharedSettingsSnapshot: (value: typeof screen.latestTeacherSnapshotRef.current) => { screen.latestTeacherSnapshotRef.current = value; },
    setIsTeacherSettingsRetrying: (value: boolean) => { screen.retrying = value; },
    setAuctionItemsSaveStatus: () => undefined,
    setTeacherSettingsSaveError: (value: string) => { screen.error = value; },
    setTeacherSettingsConflict: () => undefined, setTeacherSettingsSaveVersion: () => undefined, teacherSettingsSaveErrorMessage,
  });
  return { screen, retry: async () => { if (typeof callback !== 'function') throw new Error('Missing retry callback'); await callback(); } };
};

test('재접속 시 초안의 원래 충돌 기준을 보존하고 이미 저장된 초안만 정리한다', () => {
  const source = readFileSync(new URL('../pages/TimerPage.tsx', import.meta.url), 'utf8');
  const start = source.indexOf('const editorChanges = loadTeacherSettingsEditor();');
  const end = source.indexOf('if (pending || editorNeedsSave)', start);
  assert.ok(start >= 0 && end > start);
  for (const savedNotice of ['other', 'mine']) {
    const remoteSettings = { scheduleNotice: savedNotice, isNoticeEnabled: false };
    const base = { current: remoteSettings }, persisted = { current: remoteSettings };
    const applied: unknown[] = [], confirmed: string[] = [];
    const needsSave: unknown = runInNewContext(source.slice(start, end) + '\neditorNeedsSave;', {
      remoteSettings, teacherSettingsBaseRef: base, teacherSettingsPersistedBaseRef: persisted,
      loadTeacherSettingsEditor: () => [{ field: 'scheduleNotice', before: 'old', after: 'mine' }, { field: 'isNoticeEnabled', before: true, after: false }],
      createTeacherSettingsChanges, applyAcknowledgedTeacherChanges,
      normalizeSharedSchoolTimerSettings: (value: unknown) => value,
      applySharedSettingsSnapshot: (value: unknown) => { applied.push(value); },
      getTeacherSettingsEditorRequestId: () => 'restored-editor',
      confirmTeacherSettingsEditor: (id: string) => { confirmed.push(id); },
    });
    assert.equal(needsSave, savedNotice !== 'mine');
    if (savedNotice === 'other') {
      assert.equal(persisted.current.scheduleNotice, 'old');
      assert.equal(persisted.current.isNoticeEnabled, false);
      assert.deepEqual(applied, [{ scheduleNotice: 'mine', isNoticeEnabled: false }]);
      assert.deepEqual(confirmed, []);
    } else {
      assert.deepEqual(applied, []);
      assert.deepEqual(confirmed, ['restored-editor']);
    }
  }
});

test('설정 재확인은 실제 저장 응답까지 오류를 유지하고 저장 도중 추가 편집도 보존한다', async () => {
  let finish: ((value: unknown) => void) | undefined;
  let submitted: unknown;
  const fixture = retryFixture(true, command => {
    submitted = command.payload.changes;
    return new Promise(resolve => { finish = resolve; });
  });
  const retry = fixture.retry();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(submitted, [{ field: 'scheduleNotice', before: 'other', after: 'mine' }]);
  assert.equal(fixture.screen.error, 'existing error');
  assert.equal(fixture.screen.retrying, true);
  fixture.screen.latestTeacherSnapshotRef.current = { scheduleNotice: 'newer edit', isNoticeEnabled: true };
  finish?.({ value: { scheduleNotice: 'mine', isNoticeEnabled: false }, updatedAt: 'saved-time' });
  await retry;
  assert.equal(fixture.screen.error, '');
  assert.equal(fixture.screen.retrying, false);
  assert.equal(fixture.screen.hasUnsavedWeeklySubjectsRef.current, false);
  assert.equal(fixture.screen.hasUnsavedSubjectCatalogRef.current, false);
  assert.equal(fixture.screen.latestTeacherSnapshotRef.current.scheduleNotice, 'newer edit');
  assert.equal(fixture.screen.latestTeacherSnapshotRef.current.isNoticeEnabled, false);
  assert.equal(fixture.screen.teacherSettingsBaseRef.current.scheduleNotice, 'mine');
  assert.equal(fixture.screen.teacherSettingsPersistedBaseRef.current.scheduleNotice, 'mine');
  assert.deepEqual(fixture.screen.confirmedEditors, ['submitted-editor']);
});

test('일반 재확인은 충돌 기준을 바꾸지 않고 저장 실패 시 편집과 오류를 유지한다', async () => {
  const fixture = retryFixture(false, async command => {
    assert.deepEqual(command.payload.changes, [{ field: 'scheduleNotice', before: 'old', after: 'mine' }]);
    throw new StorageCommandError('TEACHER_SETTING_CONFLICT', 409);
  });
  await fixture.retry();
  assert.match(fixture.screen.error, /TEACHER_SETTING_CONFLICT/);
  assert.equal(fixture.screen.teacherSettingsSavingRef.current, false);
  assert.equal(fixture.screen.latestTeacherSnapshotRef.current.scheduleNotice, 'mine');
  assert.equal(fixture.screen.teacherSettingsPersistedBaseRef.current.scheduleNotice, 'old');
  assert.deepEqual(fixture.screen.confirmedEditors, []);
});

test('수동 설정 재확인은 기존 요청을 저장하고 확인된 초안을 정리한다', async context => {
  const { teacherStorageDrafts, teacherCommandScope, recheckTeacherSaveResults } = await import('./teacherStorageClient.js');
  const { getSaveRecoveryStatus } = await import('./saveRecovery.js');
  const payload = { changes: [{ field: 'scheduleNotice', before: 'old', after: 'new' }] };
  const scope = teacherCommandScope({ action: 'teacher.settings.patch', payload });
  const draft = await teacherStorageDrafts.saveDurable(scope, payload);
  assert.notEqual(draft.status, 'invalid');
  if (draft.status === 'invalid') return;
  const posts: Record<string, unknown>[] = [];
  context.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    if (init?.method !== 'POST') return Response.json({ status: 'unknown' });
    posts.push(JSON.parse(String(init.body)));
    return Response.json({ updatedAt: '2026-09-14T00:00:00Z', value: { scheduleNotice: 'new' }, result: { applied: true } });
  });
  await recheckTeacherSaveResults();
  assert.equal(posts.length, 1);
  assert.equal(posts[0].requestId, draft.draft.requestId);
  assert.deepEqual(posts[0].payload, payload);
  assert.equal(teacherStorageDrafts.load(scope), null);
  assert.equal(getSaveRecoveryStatus(0).pending, 0);
});

test('설정 충돌은 보관 요청을 지우거나 저장 성공으로 처리하지 않는다', async context => {
  const { teacherStorageDrafts, teacherCommandScope, recheckTeacherSaveResults } = await import('./teacherStorageClient.js');
  const { getSaveRecoveryStatus } = await import('./saveRecovery.js');
  const payload = { changes: [{ field: 'scheduleNotice', before: 'old', after: 'new' }] };
  const scope = teacherCommandScope({ action: 'teacher.settings.patch', payload });
  const saved = await teacherStorageDrafts.saveDurable(scope, payload);
  assert.notEqual(saved.status, 'invalid');
  if (saved.status === 'invalid') return;
  context.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => init?.method === 'POST'
    ? Response.json({ error: 'TEACHER_SETTING_CONFLICT' }, { status: 409 }) : Response.json({ status: 'unknown' }));
  await assert.rejects(recheckTeacherSaveResults(), /TEACHER_SETTING_CONFLICT/);
  assert.equal(getSaveRecoveryStatus(0).pending, 1);
  assert.equal(teacherStorageDrafts.load(scope)?.draft.requestId, saved.draft.requestId);
  await teacherStorageDrafts.confirmDurable(scope, saved.draft.requestId);
});

test('오늘의 친구 승인 확인은 공용 설정 영수증 대신 승인과 보상 상태를 조회한다', async context => {
  const { teacherStorageDrafts } = await import('./teacherStorageClient.js');
  const { runSaveRecoveryPass, getSaveRecoveryStatus } = await import('./saveRecovery.js');
  const scope = { studentNumber: 0, feature: 'teacher.todayFriend.review', entityId: 'synthetic-review' };
  const draft = await teacherStorageDrafts.saveDurable(scope, { submissionId: 'synthetic-review', expectedRevision: 1 });
  assert.notEqual(draft.status, 'invalid');
  let approved = false;
  context.mock.method(globalThis, 'fetch', async (url: unknown, init?: RequestInit) => {
    assert.equal(init?.method ?? 'GET', 'GET');
    assert.match(String(url), /^\/api\/today-friend\?reviewSubmissionId=synthetic-review$/);
    return Response.json({ submissionId: 'synthetic-review', approved });
  });
  await runSaveRecoveryPass(0);
  assert.deepEqual(getSaveRecoveryStatus(0).issues, [{ feature: 'todayFriend', reason: 'confirmation' }]);
  assert.ok(teacherStorageDrafts.load(scope));
  approved = true;
  await runSaveRecoveryPass(0);
  assert.equal(teacherStorageDrafts.load(scope), null);
  assert.equal(getSaveRecoveryStatus(0).pending, 0);
});

test('설정 오류는 허용된 코드와 상태를 표시하고 원문은 노출하지 않는다', () => {
  const conflict = teacherSettingsSaveErrorMessage(new StorageCommandError('TEACHER_SETTING_CONFLICT', 409));
  assert.match(conflict, /TEACHER_SETTING_CONFLICT · HTTP 409/);
  const uncertain = teacherSettingsSaveErrorMessage(new StorageCommandError('STORAGE_CONFIRMATION_REQUIRED', 502, true));
  assert.match(uncertain, /STORAGE_CONFIRMATION_REQUIRED · HTTP 502/);
  assert.doesNotMatch(uncertain, /저장되지 않았/);
  const sensitive = teacherSettingsSaveErrorMessage(new StorageCommandError('학생의 비공개 작성 내용', 500));
  assert.doesNotMatch(sensitive, /비공개 작성 내용/);
  assert.match(sensitive, /HTTP 500/);
  assert.match(teacherSettingsSaveErrorMessage(new TypeError('private network detail')), /network/);
});

test('저장 재확인 중 편집한 물품과 관계없는 원격 설정을 함께 보존한다', async () => {
  const base = { auctionItems: [{ id: 'item-a', name: '연필', isConfigured: true }], scheduleNotice: '기존' };
  let latest = { ...base, auctionItems: [{ ...base.auctionItems[0], name: '공책' }] };
  const remotePromise = Promise.resolve({ ...base, scheduleNotice: '원격 공지' });
  latest = { ...latest, auctionItems: [{ ...latest.auctionItems[0], name: '색연필' }] };
  const remote = await remotePromise;
  const changes = createTeacherSettingsChanges(base, latest);
  const preserved = applyAcknowledgedTeacherChanges(remote, changes);
  assert.deepEqual(preserved.auctionItems, latest.auctionItems);
  assert.equal(preserved.scheduleNotice, '원격 공지');

  const source = readFileSync(new URL('../pages/TimerPage.tsx', import.meta.url), 'utf8');
  const retry = source.slice(source.indexOf('const retryTeacherSettingsSave ='), source.indexOf('const resetClassDonation ='));
  assert.doesNotMatch(retry, /buildSharedSettingsSnapshot\(\)/);
  assert.match(retry, /await loadSharedSettingsRow\(\);[\s\S]*const submittedSnapshot = latestTeacherSnapshotRef.current;[\s\S]*createTeacherSettingsChanges\(teacherSettingsBaseRef.current, submittedSnapshot/);
  assert.match(retry, /if \(teacherSettingsSavingRef.current\) return/);
  assert.match(retry, /finally \{\s*teacherSettingsSavingRef.current = false/);
});

test('교사 설정 초안은 삭제가 막혀도 최신 편집으로 교체되고 이전 성공이 새 편집을 지우지 않는다', async () => {
  const { saveTeacherSettingsEditor, loadTeacherSettingsEditor, getTeacherSettingsEditorRequestId, confirmTeacherSettingsEditor, teacherStorageDrafts } = await import('./teacherStorageClient.js');
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: () => { throw new DOMException('storage unavailable', 'SecurityError'); },
  } } });
  try {
    const first = [{ field: 'scheduleNotice', before: '기존', after: '첫 번째 편집' }];
    const latest = [{ field: 'scheduleNotice', before: '기존', after: '응답 대기 중 새 편집' }];
    saveTeacherSettingsEditor(first);
    const submittedVersion = getTeacherSettingsEditorRequestId();
    saveTeacherSettingsEditor(latest);
    assert.notEqual(getTeacherSettingsEditorRequestId(), submittedVersion);
    await confirmTeacherSettingsEditor(submittedVersion);
    assert.deepEqual(loadTeacherSettingsEditor(), latest);
    assert.equal(teacherStorageDrafts.load({ studentNumber: 0, feature: 'teacher.settings.editor', entityId: 'classroom' })?.durable, true);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow); else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('교사 선택 필드 undefined는 실제 전송 JSON과 같은 초안으로 보관한다', async () => {
  const { saveTeacherSettingsEditor, loadTeacherSettingsEditor } = await import('./teacherStorageClient.js');
  saveTeacherSettingsEditor([{ field: 'randomDraw', before: null, after: { historyEntries: [{ number: 3, sourceEntryId: undefined }] } }]);
  assert.deepEqual(loadTeacherSettingsEditor(), [{ field: 'randomDraw', before: null, after: { historyEntries: [{ number: 3 }] } }]);
});

test('교사 거래 자동 복구는 같은 요청 영수증만 조회하고 재전송하지 않는다', async context => {
  const { teacherStorageDrafts, teacherCommandScope } = await import('./teacherStorageClient.js');
  const { runSaveRecoveryPass } = await import('./saveRecovery.js');
  const { canonicalStorageJson } = await import('./storageV2Codec.js');
  const action = 'teacher.currency.adjust';
  const payload = { studentNumbers: [7], delta: 3 };
  const scope = teacherCommandScope({ action, payload });
  const pending = await teacherStorageDrafts.saveDurable(scope, payload);
  assert.notEqual(pending.status, 'invalid');
  if (pending.status === 'invalid') return;
  let committed = false;
  const methods: string[] = [];
  context.mock.method(globalThis, 'fetch', async (url: unknown, init?: RequestInit) => {
    methods.push(init?.method ?? 'GET');
    assert.equal(init?.method ?? 'GET', 'GET');
    if (!committed) return Response.json({ status: 'unknown' });
    if (!String(url).includes('receiptOnly=1')) return Response.json({ error: 'DISPLAY_UNAVAILABLE' }, { status: 503 });
    const bytes = new TextEncoder().encode(canonicalStorageJson({ action, payload }));
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
    return Response.json({ status: 'committed', action, payloadHash: hash, committedAt: '2026-09-09T00:00:00Z', result: { applied: true } });
  });
  await runSaveRecoveryPass(0);
  assert.equal(teacherStorageDrafts.load(scope)?.draft.requestId, pending.draft.requestId);
  committed = true;
  await runSaveRecoveryPass(0);
  assert.equal(teacherStorageDrafts.load(scope), null);
  assert.deepEqual(methods, ['GET', 'GET', 'GET']);
});

test('수동 재확인은 고마 거래 미확인을 정확히 반환하고 거래를 재전송하지 않는다', async context => {
  const { teacherStorageDrafts, teacherCommandScope, recheckTeacherSaveResults } = await import('./teacherStorageClient.js');
  const scope = teacherCommandScope({ action: 'teacher.currency.adjust', payload: { studentNumbers: [7], amount: 3 } });
  const saved = await teacherStorageDrafts.saveDurable(scope, { studentNumbers: [7], amount: 3 });
  assert.notEqual(saved.status, 'invalid');
  if (saved.status === 'invalid') return;
  let reads = 0;
  context.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    assert.equal(init?.method ?? 'GET', 'GET');
    reads++;
    return Response.json({ status: 'unknown' });
  });
  try {
    const result = await recheckTeacherSaveResults();
    assert.equal(result.pending, 1);
    assert.equal(reads, 1);
    const { getSaveRecoveryStatus } = await import('./saveRecovery.js');
    assert.deepEqual(getSaveRecoveryStatus(0).issues, [{ feature: 'economy', reason: 'confirmation', transaction: {
      requestId: saved.draft.requestId, createdAt: saved.draft.createdAt, kind: 'adjust', studentNumbers: [7], amount: 3,
    } }]);
    assert.equal(teacherStorageDrafts.load(scope)?.draft.requestId, saved.draft.requestId);
  } finally { await teacherStorageDrafts.confirmDurable(scope, saved.draft.requestId); }
});
