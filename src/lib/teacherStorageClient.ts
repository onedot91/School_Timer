import { announceSaveRecovered, markSaveRefreshPending, notifySaveRecovery, registerSaveRecoveryAdapter, requestSaveRecovery, serializeStudentSave } from './saveRecovery.js';
import { createStudentSaveDraftStore } from './studentSaveDraft.js';
import { executeStorageCommand, loadStorageCommandReceipt, StorageCommandError, type StorageCommand } from './storageCommandClient.js';
import { captureStorageResponseContext, isStorageResponseContextCurrent, StorageResponseActorChangedError } from './storageResponseOrder.js';
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
  if (code === 'TEACHER_SETTING_CONFLICT') return `다른 저장 내용과 겹칩니다 (${details}). 내 변경 저장을 누르면 수정한 항목을 덮어씁니다.`;
  return `설정 저장 확인 불가 (${details}). 변경 내용은 보관했습니다. 저장 다시 확인을 눌러 주세요.`;
};

const teacherWirePayload = (value: unknown): unknown => JSON.parse(JSON.stringify(value ?? null));

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
const executeTeacherCommand = async (command: StorageCommand) => {
  const scope = teacherCommandScope(command);
  const payload = teacherWirePayload(command.payload);
  const pausedScope = { ...scope, feature: `${scope.feature}.paused` };
  const context = captureStorageResponseContext();
  let saved = await teacherStorageDrafts.saveDurable(scope, payload);
  if (!isStorageResponseContextCurrent(context)) throw new StorageResponseActorChangedError();
  if (saved.status === 'invalid') throw new StorageCommandError('INVALID_TEACHER_COMMAND', 400);
  if (saved.status === 'payload_changed') {
    const paused = teacherStorageDrafts.load(pausedScope)?.draft.payload === saved.draft.requestId;
    const confirmed = paused ? null : await loadStorageCommandReceipt(saved.draft.requestId, { ...command, requestId: saved.draft.requestId, payload: saved.draft.payload }, context);
    if (!paused && !confirmed) throw new StorageCommandError('STORAGE_PREVIOUS_CONFIRMATION_REQUIRED', 409, true);
    await teacherStorageDrafts.confirmDurable(scope, saved.draft.requestId);
    saved = await teacherStorageDrafts.saveDurable(scope, payload);
    if (!isStorageResponseContextCurrent(context)) throw new StorageResponseActorChangedError();
    if (saved.status === 'invalid' || saved.status === 'payload_changed') {
      throw new StorageCommandError('STORAGE_PREVIOUS_CONFIRMATION_REQUIRED', 409, true);
    }
  }
  const request = { ...command, requestId: saved.draft.requestId, payload: saved.draft.payload };
  const previousPause = teacherStorageDrafts.load(pausedScope);
  if (previousPause) await teacherStorageDrafts.confirmDurable(pausedScope, previousPause.draft.requestId);
  if (!isStorageResponseContextCurrent(context)) throw new StorageResponseActorChangedError();
  try {
    const result = await executeStorageCommand(request);
    await teacherStorageDrafts.confirmDurable(scope, request.requestId);
    if (!isStorageResponseContextCurrent(context)) throw new StorageResponseActorChangedError();
    return result;
  } catch (error) {
    if (getStorageAvailability(error)) {
      await teacherStorageDrafts.saveDurable(pausedScope, request.requestId);
    } else if (error instanceof StorageCommandError && error.status < 500 && !error.uncertainWrite) {
      await teacherStorageDrafts.confirmDurable(scope, request.requestId);
    }
    throw error;
  }
};

export const executeTeacherStorageCommand = (command: StorageCommand) => serializeStudentSave(0, () => executeTeacherCommand(command)).finally(() => notifySaveRecovery());

export const recheckTeacherSaveResults = async (): Promise<void> => {
  await requestSaveRecovery(0);
  try {
    await serializeStudentSave(0, async () => {
      const scope = teacherCommandScope({ action: 'teacher.settings.patch', payload: {} });
      const pending = teacherStorageDrafts.load(scope);
      if (!pending) return;
      const result = await executeStorageCommand({ requestId: pending.draft.requestId, action: 'teacher.settings.patch', payload: pending.draft.payload });
      await teacherStorageDrafts.confirmDurable(scope, pending.draft.requestId);
      if (result.refreshPending) markSaveRefreshPending(0);
      announceSaveRecovered(0);
    });
  } finally { await requestSaveRecovery(0); }
};

registerSaveRecoveryAdapter({
  id: 'teacher-storage',
  list: async actor => {
    if (actor !== 0) return [];
    await teacherStorageDrafts.ready();
    return teacherStorageDrafts.list(0)
      .filter(draft => draft.scope.feature.startsWith('teacher.') && !/\.(editor|paused|context|rejected)$/.test(draft.scope.feature))
      .map(draft => ({ id: draft.requestId, actor: 0, feature: draft.scope.feature, createdAt: draft.createdAt, mode: 'confirm-only' }));
  },
  eligible: () => false,
  retry: async () => undefined,
  confirm: request => serializeStudentSave(0, async () => {
    const draft = teacherStorageDrafts.list(0).find(candidate => candidate.requestId === request.id);
    if (!draft) return true;
    if (draft.scope.feature === 'teacher.todayFriend.review') {
      if (!isStorageRecord(draft.payload) || typeof draft.payload.submissionId !== 'string') return false;
      const context = captureStorageResponseContext();
      const query = new URLSearchParams({ reviewSubmissionId: draft.payload.submissionId });
      const response = await fetch(`/api/today-friend?${query}`, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(12_000) });
      if (!isStorageResponseContextCurrent(context)) throw new StorageResponseActorChangedError();
      if (!response.ok) throw new StorageCommandError('TODAY_FRIEND_CONFIRMATION_UNAVAILABLE', response.status);
      const value: unknown = await response.json();
      if (!isStorageResponseContextCurrent(context)) throw new StorageResponseActorChangedError();
      if (!isStorageRecord(value) || value.submissionId !== draft.payload.submissionId || value.approved !== true) return false;
      return teacherStorageDrafts.confirmDurable(draft.scope, draft.requestId);
    }
    const command = { requestId: draft.requestId, action: draft.scope.feature, payload: draft.payload };
    const confirmed = await loadStorageCommandReceipt(draft.requestId, command);
    if (!confirmed) return false;
    if (confirmed.refreshPending) markSaveRefreshPending(0);
    return teacherStorageDrafts.confirmDurable(draft.scope, draft.requestId);
  }),
});

const editorScope = { studentNumber: 0, feature: 'teacher.settings.editor', entityId: 'classroom' };
export const saveTeacherSettingsEditor = (changes: readonly import('./teacherStorageCommand.js').TeacherSettingChange[]) => {
  return teacherStorageDrafts.replace(editorScope, teacherWirePayload({ changes }));
};
export const getTeacherSettingsEditorRequestId = (): string | undefined => teacherStorageDrafts.load(editorScope)?.draft.requestId;
export const confirmTeacherSettingsEditor = async (requestId: string | undefined): Promise<void> => {
  if (requestId) await teacherStorageDrafts.confirmDurable(editorScope, requestId);
};
export const loadTeacherSettingsEditor = (): import('./teacherStorageCommand.js').TeacherSettingChange[] => {
  const saved = teacherStorageDrafts.load(editorScope)?.draft.payload;
  if (!isStorageRecord(saved) || !Array.isArray(saved.changes)) return [];
  return saved.changes.flatMap(change => isStorageRecord(change) && typeof change.field === 'string'
    && 'before' in change && 'after' in change
    ? [{ field: change.field, before: change.before, after: change.after }] : []);
};
