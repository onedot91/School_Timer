import { createStudentSaveDraftStore } from './studentSaveDraft.js';
import { executeStorageCommand, loadStorageCommandReceipt, StorageCommandError, type StorageCommand } from './storageCommandClient.js';
import { isStorageRecord } from './teacherStorageCommand.js';

export const teacherStorageDrafts = createStudentSaveDraftStore();
export const teacherCommandScope = (command: Pick<StorageCommand, 'action' | 'payload'>) => {
  const payload = isStorageRecord(command.payload) ? command.payload : {};
  return { studentNumber: 0, feature: command.action, entityId: JSON.stringify([
    payload.studentNumber ?? payload.studentNumbers ?? null, payload.itemId ?? null, payload.dateKey ?? null,
  ]) };
};

/** Only invoked by a teacher action; persisted requests are never replayed on reconnect. */
export const executeTeacherStorageCommand = async (command: StorageCommand) => {
  const scope = teacherCommandScope(command);
  let saved = teacherStorageDrafts.save(scope, command.payload);
  if (saved.status === 'invalid') throw new StorageCommandError('INVALID_TEACHER_COMMAND', 400);
  if (saved.status === 'payload_changed') {
    const confirmed = await loadStorageCommandReceipt(saved.draft.requestId);
    if (!confirmed) throw new StorageCommandError('STORAGE_PREVIOUS_CONFIRMATION_REQUIRED', 409, true);
    teacherStorageDrafts.confirm(scope, saved.draft.requestId);
    saved = teacherStorageDrafts.save(scope, command.payload);
    if (saved.status === 'invalid' || saved.status === 'payload_changed') {
      throw new StorageCommandError('STORAGE_PREVIOUS_CONFIRMATION_REQUIRED', 409, true);
    }
  }
  const request = { ...command, requestId: saved.draft.requestId, payload: saved.draft.payload };
  try {
    const result = await executeStorageCommand(request);
    teacherStorageDrafts.confirm(scope, request.requestId);
    return result;
  } catch (error) {
    if (error instanceof StorageCommandError && error.status < 500 && !error.uncertainWrite) {
      teacherStorageDrafts.remove(scope, request.requestId);
    }
    throw error;
  }
};

const editorScope = { studentNumber: 0, feature: 'teacher.settings.editor', entityId: 'classroom' };
export const saveTeacherSettingsEditor = (changes: readonly import('./teacherStorageCommand.js').TeacherSettingChange[]) => {
  const existing = teacherStorageDrafts.load(editorScope);
  if (existing) teacherStorageDrafts.remove(editorScope, existing.draft.requestId);
  if (changes.length > 0) teacherStorageDrafts.save(editorScope, { changes });
};
export const loadTeacherSettingsEditor = (): import('./teacherStorageCommand.js').TeacherSettingChange[] => {
  const saved = teacherStorageDrafts.load(editorScope)?.draft.payload;
  if (!isStorageRecord(saved) || !Array.isArray(saved.changes)) return [];
  return saved.changes.flatMap(change => isStorageRecord(change) && typeof change.field === 'string'
    && 'before' in change && 'after' in change
    ? [{ field: change.field, before: change.before, after: change.after }] : []);
};
