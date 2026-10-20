import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTeacherSettingsEditor, syncTeacherSettingsEditor, teacherStorageDrafts } from './teacherStorageClient.js';

const editorScope = { studentNumber: 0, feature: 'teacher.settings.editor', entityId: 'classroom' };

test('편집하지 않은 교사 탭은 다른 탭의 미저장 설정 초안을 빈 변경으로 덮지 않는다', () => {
  const otherTab = [{ field: 'scheduleNotice', before: '기존', after: '다른 탭 편집' }];
  const thisTab = [{ field: 'scheduleNotice', before: '기존', after: '이 탭 편집' }];
  // A draft adopted from another tab is present but was not written by this tab.
  teacherStorageDrafts.replace(editorScope, { changes: otherTab });
  syncTeacherSettingsEditor([]);
  assert.deepEqual(loadTeacherSettingsEditor(), otherTab);

  syncTeacherSettingsEditor(thisTab);
  assert.deepEqual(loadTeacherSettingsEditor(), thisTab);
  // This tab may clear the draft it wrote itself once its edits are saved.
  syncTeacherSettingsEditor([]);
  assert.deepEqual(loadTeacherSettingsEditor(), []);

  const current = teacherStorageDrafts.load(editorScope);
  if (current) teacherStorageDrafts.remove(editorScope, current.draft.requestId);
});
