import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { teacherSettingsSaveErrorMessage } from './teacherStorageClient.js';
import { StorageCommandError } from './storageCommandClient.js';
import { applyAcknowledgedTeacherChanges, createTeacherSettingsChanges } from './teacherStorageCommand.js';

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
  assert.match(retry, /await loadSharedSettingsRow\(\);[\s\S]*createTeacherSettingsChanges\(teacherSettingsBaseRef.current, latestTeacherSnapshotRef.current\)/);
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
