import { createStudentSaveDraftStore } from './studentSaveDraft.js';
import { executeStorageCommand, loadStorageCommandReceipt, StorageCommandError, type StorageCommand } from './storageCommandClient.js';
import { isStorageRecord } from './teacherStorageCommand.js';
import { getStorageAvailability } from './storageAvailability.js';
import { storageAvailabilityMessage } from './storageAvailabilityCopy.js';
import { collectSaveFailureDiagnostics } from './saveFailureDiagnostics.js';
import { classifySaveFailure } from './saveFailure.js';

export const teacherSettingsSaveErrorMessage = (error: unknown): string => {
  const availability = storageAvailabilityMessage(error);
  if (availability) return availability;
  const diagnostics = collectSaveFailureDiagnostics(error);
  const code = error instanceof StorageCommandError && error.serverCode === 'TEACHER_SETTING_CONFLICT'
    ? error.serverCode : diagnostics?.causeCode ?? diagnostics?.errorCode ?? classifySaveFailure(error) ?? 'unknown';
  const details = [code, ...(diagnostics?.httpStatus ? [`HTTP ${diagnostics.httpStatus}`] : [])].join(' · ');
  return `설정 저장 확인 불가 (${details}). 변경 내용은 보관했습니다. 저장 다시 확인을 눌러 주세요.`;
};

export const teacherStorageDrafts = createStudentSaveDraftStore();
export const teacherCommandScope = (command: Pick<StorageCommand, 'action' | 'payload'>) => {
  const payload = isStorageRecord(command.payload) ? command.payload : {};
  return { studentNumber: 0, feature: command.action, entityId: JSON.stringify([
    payload.studentNumber ?? payload.studentNumbers ?? null, payload.itemId ?? null, payload.dateKey ?? null,
  ]) };
};
export const isTeacherStorageCommandPaused = (command: Pick<StorageCommand, 'action' | 'payload'>): boolean => {
  const scope = teacherCommandScope(command), pending = teacherStorageDrafts.load(scope);
  return !!pending && teacherStorageDrafts.load({ ...scope, feature: `${scope.feature}.paused` })?.draft.payload === pending.draft.requestId;
};

/** Only invoked by a teacher action; persisted requests are never replayed on reconnect. */
export const executeTeacherStorageCommand = async (command: StorageCommand) => {
  const scope = teacherCommandScope(command);
  const pausedScope = { ...scope, feature: `${scope.feature}.paused` };
  let saved = teacherStorageDrafts.save(scope, command.payload);
  if (saved.status === 'invalid') throw new StorageCommandError('INVALID_TEACHER_COMMAND', 400);
  if (saved.status === 'payload_changed') {
    const paused = teacherStorageDrafts.load(pausedScope)?.draft.payload === saved.draft.requestId;
    const confirmed = paused ? null : await loadStorageCommandReceipt(saved.draft.requestId);
    if (!paused && !confirmed) throw new StorageCommandError('STORAGE_PREVIOUS_CONFIRMATION_REQUIRED', 409, true);
    teacherStorageDrafts.confirm(scope, saved.draft.requestId);
    saved = teacherStorageDrafts.save(scope, command.payload);
    if (saved.status === 'invalid' || saved.status === 'payload_changed') {
      throw new StorageCommandError('STORAGE_PREVIOUS_CONFIRMATION_REQUIRED', 409, true);
    }
  }
  const request = { ...command, requestId: saved.draft.requestId, payload: saved.draft.payload };
  const previousPause = teacherStorageDrafts.load(pausedScope);
  if (previousPause) teacherStorageDrafts.remove(pausedScope, previousPause.draft.requestId);
  try {
    const result = await executeStorageCommand(request);
    teacherStorageDrafts.confirm(scope, request.requestId);
    return result;
  } catch (error) {
    if (getStorageAvailability(error)) {
      teacherStorageDrafts.save(pausedScope, request.requestId);
    } else if (error instanceof StorageCommandError && error.status < 500 && !error.uncertainWrite) {
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
