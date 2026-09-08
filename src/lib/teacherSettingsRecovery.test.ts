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
