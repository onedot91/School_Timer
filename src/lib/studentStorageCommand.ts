import { beginSaveProgress } from './saveProgress.js';
import { loadStudentEconomyReceipt, retryStudentEconomyRequest, StudentEconomyRequestError, type StudentEconomyApiAction, type StudentEconomyUpdateResult } from './studentEconomyClient.js';
import { executeStorageCommand, loadStorageCommandReceipt, StorageCommandError } from './storageCommandClient.js';
import { createStudentSaveDraftStore, type StudentSaveDraftScope, type StudentSaveDraft } from './studentSaveDraft.js';
import { getStorageAvailability } from './storageAvailability.js';
import { canonicalStorageJson, isStorageRecord } from './storageV2Codec.js';
import { captureStudentEditRevisions, studentEditRevisionKey } from './studentEditRevision.js';
import { captureStorageResponseContext, isStorageResponseContextCurrent, StorageResponseActorChangedError, type StorageResponseContext } from './storageResponseOrder.js';
import { parseStorageProjectionPatch } from './storageProjectionPatch.js';
import { getKoreanLocalDateKey } from './studentEmotion.js';
import { getKoreanIsoWeekKey } from './weeklyMission.js';
import { registerSaveRecoveryAdapter, notifySaveRecovery, serializeStudentSave, markSaveRefreshPending, type RecoveryRequest } from './saveRecovery.js';

const drafts = createStudentSaveDraftStore();
export const readyStudentStorageDrafts = () => drafts.ready();
export const flushStudentStorageDrafts = () => drafts.flush();
export const subscribeStudentStorageDrafts = drafts.subscribe;
const scopeFor = (studentNumber: number, action: string, entityId = action): StudentSaveDraftScope => ({ studentNumber, feature: action, entityId });
const rejectedScopeFor = (scope: StudentSaveDraftScope) => ({ ...scope, feature: `${scope.feature}.rejected` });
const formScopeFor = (scope: StudentSaveDraftScope) => ({ ...scope, feature: `${scope.feature}.form` });
const pausedScopeFor = (scope: StudentSaveDraftScope) => ({ ...scope, feature: `${scope.feature}.paused` });
const isPaused = (scope: StudentSaveDraftScope, requestId: string) => drafts.load(pausedScopeFor(scope))?.draft.payload === requestId;
const removeCurrent = (scope: StudentSaveDraftScope) => {
  const current = drafts.load(scope);
  if (current) drafts.remove(scope, current.draft.requestId);
};

export const loadStudentStorageDraft = (studentNumber: number, action: string, entityId = action) => (
  drafts.load(scopeFor(studentNumber, action, entityId))?.draft ?? null
);
export const isRejectedStudentStorageDraft = (studentNumber: number, action: string, entityId = action, code?: string): boolean => {
  const scope = scopeFor(studentNumber, action, entityId), pending = drafts.load(scope);
  if (!pending || drafts.load(rejectedScopeFor(scope))?.draft.payload !== pending.draft.requestId) return false;
  const metadata = drafts.load(contextScope(scope))?.draft.payload;
  return code === undefined || (isStorageRecord(metadata) && metadata.rejectionCode === code);
};

export const hasUnconfirmedStudentStorageDraft = (studentNumber: number, action: string, entityId = action): boolean => {
  const scope = scopeFor(studentNumber, action, entityId), pending = drafts.load(scope), rejected = drafts.load(rejectedScopeFor(scope));
  return pending !== null && rejected?.draft.payload !== pending.draft.requestId && !isPaused(scope, pending.draft.requestId);
};

export const loadStudentStorageFormDraft = (studentNumber: number, action: string, entityId = action): Record<string, unknown> => {
  const scope = scopeFor(studentNumber, action, entityId);
  const pending = drafts.load(scope), form = drafts.load(formScopeFor(scope));
  const payload = form?.draft.payload ?? pending?.draft.payload ?? null;
  return payload !== null && typeof payload === 'object' && !Array.isArray(payload) ? Object.fromEntries(Object.entries(payload)) : {};
};
export const loadStudentStorageFormSnapshot = (studentNumber: number, action: string, entityId = action) => {
  const scope = scopeFor(studentNumber, action, entityId);
  return drafts.load(formScopeFor(scope)) ?? drafts.load(scope);
};

/** Editable input is separate from the immutable intent of an unconfirmed request. */
export const saveStudentStorageFormDraft = (studentNumber: number, action: string, payload: unknown, entityId = action) => {
  const scope = formScopeFor(scopeFor(studentNumber, action, entityId));
  const current = drafts.load(scope);
  const enriched = enrichPayload(studentNumber, action, payload, current?.draft.payload);
  return drafts.replace(scope, enriched);
};
export const rebaseStudentStorageFormDraft = (studentNumber: number, action: string, payload: Record<string, unknown>, expectedRevisions: Record<string, number>, entityId = action) => (
  drafts.replace(formScopeFor(scopeFor(studentNumber, action, entityId)), { ...payload, expectedRevisions })
);
export const saveStudentStorageFormDraftDurably = async (studentNumber: number, action: string, payload: unknown, entityId = action): Promise<boolean> => {
  const saved = saveStudentStorageFormDraft(studentNumber, action, payload, entityId);
  if (saved.status === 'invalid') return false;
  await drafts.flush();
  const current = drafts.load(formScopeFor(scopeFor(studentNumber, action, entityId)));
  return current?.draft.requestId === saved.draft.requestId && current.durable;
};
export const discardRejectedStudentStorageDraft = async (studentNumber: number, action: string, entityId = action, expectedPayload?: unknown): Promise<boolean> => {
  const context = captureStorageResponseContext();
  await drafts.ready();
  assertActor(studentNumber, context);
  const scope = scopeFor(studentNumber, action, entityId);
  const pending = drafts.load(scope), rejected = drafts.load(rejectedScopeFor(scope)), form = drafts.load(formScopeFor(scope));
  if (expectedPayload !== undefined && canonicalStorageJson(form?.draft.payload ?? pending?.draft.payload ?? {}) !== canonicalStorageJson(expectedPayload)) return false;
  if (pending && rejected?.draft.payload !== pending.draft.requestId) return false;
  if (pending && !await drafts.confirmDurable(scope, pending.draft.requestId)) return false;
  if (form && !await drafts.confirmDurable(formScopeFor(scope), form.draft.requestId)) return false;
  if (rejected) await drafts.confirmDurable(rejectedScopeFor(scope), rejected.draft.requestId);
  return true;
};

export const clearStudentStorageFormDraft = (studentNumber: number, action: string, entityId = action) => {
  removeCurrent(formScopeFor(scopeFor(studentNumber, action, entityId)));
};

const contextScope = (scope: StudentSaveDraftScope) => ({ ...scope, feature: `${scope.feature}.context` });
const enrichPayload = (studentNumber: number, action: string, payload: unknown, formPayload?: unknown): unknown => {
  if (!isStorageRecord(payload)) return payload;
  const base = isStorageRecord(formPayload) ? formPayload : {};
  const expectedRevisions = payload.expectedRevisions ?? base.expectedRevisions ?? captureStudentEditRevisions(studentNumber, action);
  return { ...payload, ...(expectedRevisions ? { expectedRevisions } : {}),
    ...(action === 'student.emotion.save' ? { dateKey: payload.dateKey ?? base.dateKey ?? getKoreanLocalDateKey() } : {}) };
};
const commandFor = (draft: StudentSaveDraft) => ({ requestId: draft.requestId, action: draft.scope.feature, payload: draft.payload,
  studentNumber: draft.scope.studentNumber });
export const loadStudentStorageAcknowledgement = (studentNumber: number, action: string, entityId = action) => {
  const metadata = drafts.load(contextScope(scopeFor(studentNumber, action, entityId)))?.draft.payload;
  if (!isStorageRecord(metadata) || typeof metadata.acknowledgedRequestId !== 'string' || !isStorageRecord(metadata.acknowledgedStoragePatch)) return null;
  try { return { requestId: metadata.acknowledgedRequestId, payload: metadata.acknowledgedPayload, storagePatch: parseStorageProjectionPatch(metadata.acknowledgedStoragePatch) }; }
  catch { return null; }
};
const acknowledge = async (draft: StudentSaveDraft, response: { refreshPending?: boolean; storagePatch?: import('./storageProjectionPatch.js').StorageProjectionPatch }) => {
  const metadata = drafts.load(contextScope(draft.scope))?.draft.payload;
  if (response.storagePatch && isStorageRecord(metadata) && metadata.requestId === draft.requestId) {
    drafts.replace(contextScope(draft.scope), { ...metadata, acknowledgedRequestId: draft.requestId, acknowledgedPayload: draft.payload, acknowledgedStoragePatch: response.storagePatch });
    await drafts.flush();
  }
  const cleared = await drafts.confirmDurable(draft.scope, draft.requestId);
  if (isStorageRecord(metadata) && metadata.requestId === draft.requestId && typeof metadata.formRequestId === 'string') {
    await drafts.confirmDurable(formScopeFor(draft.scope), metadata.formRequestId);
  }
  if (response.refreshPending) markSaveRefreshPending(draft.scope.studentNumber);
  return cleared;
};
const executeStudentCommand = async (studentNumber: number, action: string, input: unknown, entityId: string, context: StorageResponseContext): Promise<import('./storageCommandClient.js').StorageCommandResult> => {
  const finishProgress = beginSaveProgress();
  try {
    await drafts.ready();
    if (!isStorageResponseContextCurrent(context)) throw new StorageResponseActorChangedError();
    const scope = scopeFor(studentNumber, action, entityId), rejectedScope = rejectedScopeFor(scope);
    const form = drafts.load(formScopeFor(scope));
    const payload = enrichPayload(studentNumber, action, input, form?.draft.payload);
    const prior = drafts.load(scope), rejected = drafts.load(rejectedScope);
    if (prior && isPaused(scope, prior.draft.requestId) && canonicalStorageJson(prior.draft.payload) !== canonicalStorageJson(payload)) {
      const priorContext = drafts.load(contextScope(scope))?.draft.payload;
      if (isStorageRecord(priorContext) && priorContext.definitelyNotWritten === true) {
        if (!await drafts.confirmDurable(scope, prior.draft.requestId)) throw new Error('SAVE_DRAFT_PENDING');
        removeCurrent(pausedScopeFor(scope));
      }
    }
    if (prior && rejected?.draft.payload === prior.draft.requestId) {
      if (!await drafts.confirmDurable(scope, prior.draft.requestId)) throw new Error('SAVE_DRAFT_PENDING');
      await drafts.confirmDurable(rejectedScope, rejected.draft.requestId);
    }
    const saved = await drafts.saveDurable(scope, payload);
    if (saved.status === 'invalid') throw new Error('STUDENT_COMMAND_INVALID');
    if (!isStorageResponseContextCurrent(context)) throw new StorageResponseActorChangedError();
    const metadata = drafts.load(contextScope(scope))?.draft.payload;
    if (!isStorageRecord(metadata) || metadata.requestId !== saved.draft.requestId) {
      const formMatchesRequest = form && canonicalStorageJson(form.draft.payload) === canonicalStorageJson(saved.draft.payload);
      drafts.replace(contextScope(scope), { requestId: saved.draft.requestId, formRequestId: formMatchesRequest ? form.draft.requestId : null,
        dateKey: getKoreanLocalDateKey(), actor: context.actor });
      await drafts.flush();
    }
    if (!isStorageResponseContextCurrent(context)) throw new StorageResponseActorChangedError();
    if (saved.status === 'existing' || saved.status === 'payload_changed') {
      const confirmed = await loadStorageCommandReceipt(saved.draft.requestId, commandFor(saved.draft), context);
      if (confirmed) {
        const cleared = await acknowledge(saved.draft, confirmed);
        if (saved.status === 'payload_changed') {
          if (!cleared) throw new Error('SAVE_DRAFT_PENDING');
          return executeStudentCommand(studentNumber, action, input, entityId, context);
        }
        return confirmed;
      }
    }
    if (saved.status === 'payload_changed') throw new Error('SAVE_DRAFT_PENDING');
    try {
      removeCurrent(pausedScopeFor(scope));
      const response = await executeStorageCommand(commandFor(saved.draft), context, automaticActions.has(action) && eligibleDraft(saved.draft));
      await acknowledge(saved.draft, response);
      return response;
    } catch (error) {
      if (getStorageAvailability(error)) {
        drafts.replace(pausedScopeFor(scope), saved.draft.requestId);
        const currentMetadata = drafts.load(contextScope(scope))?.draft.payload;
        if (saved.status === 'saved' && isStorageRecord(currentMetadata)) {
          drafts.replace(contextScope(scope), { ...currentMetadata, definitelyNotWritten: true });
        }
      }
      else if (error instanceof StorageCommandError && !error.uncertainWrite && [400, 403, 404, 409, 422, 426].includes(error.status)) {
        drafts.replace(rejectedScope, saved.draft.requestId);
        const currentMetadata = drafts.load(contextScope(scope))?.draft.payload;
        if (isStorageRecord(currentMetadata)) drafts.replace(contextScope(scope), { ...currentMetadata, rejectionCode: error.serverCode });
      }
      notifySaveRecovery();
      throw error;
    }
  } finally { finishProgress(); }
};
export const executeStudentStorageCommand = (studentNumber: number, action: string, payload: unknown, entityId = action) => {
  const context = captureStorageResponseContext();
  return serializeStudentSave(studentNumber, () => {
    if (!isStorageResponseContextCurrent(context) || (context.actor !== null && context.actor !== String(studentNumber))) throw new StorageResponseActorChangedError();
    return executeStudentCommand(studentNumber, action, payload, entityId, context);
  });
};

const ECONOMY_DRAFT_ACTION = 'student.economy';
export const hasUnconfirmedStudentEconomyDraft = (studentNumber: number) => hasUnconfirmedStudentStorageDraft(studentNumber, ECONOMY_DRAFT_ACTION);

const assertActor = (studentNumber: number, context: StorageResponseContext) => {
  if (!isStorageResponseContextCurrent(context) || (context.actor !== null && context.actor !== String(studentNumber))) throw new StorageResponseActorChangedError();
};
const confirmEconomyDraft = async (studentNumber: number, context: StorageResponseContext): Promise<StudentEconomyUpdateResult | null> => {
  await drafts.ready();
  assertActor(studentNumber, context);
  const scope = scopeFor(studentNumber, ECONOMY_DRAFT_ACTION), pending = drafts.load(scope);
  if (!pending) return null;
  try {
    const confirmed = await loadStudentEconomyReceipt(studentNumber, pending.draft.requestId, pending.draft.payload, context);
    assertActor(studentNumber, context);
    // This path runs only after a student's explicit confirm/retry action.
    const result = confirmed ?? await retryStudentEconomyRequest({ studentNumber, requestId: pending.draft.requestId, action: pending.draft.payload });
    assertActor(studentNumber, context);
    await drafts.confirmDurable(scope, pending.draft.requestId);
    if (result.refreshPending) markSaveRefreshPending(studentNumber);
    return result;
  } catch (error) {
    if (getStorageAvailability(error)) drafts.replace(pausedScopeFor(scope), pending.draft.requestId);
    else if (error instanceof StudentEconomyRequestError && [400, 403, 404, 422, 426].includes(error.status)) {
      drafts.replace(rejectedScopeFor(scope), pending.draft.requestId);
    }
    notifySaveRecovery();
    throw error;
  }
};
export const confirmStudentEconomyDraft = (studentNumber: number): Promise<StudentEconomyUpdateResult | null> => {
  const context = captureStorageResponseContext();
  return serializeStudentSave(studentNumber, () => confirmEconomyDraft(studentNumber, context));
};
const executeEconomyWithDraft = async (studentNumber: number, action: StudentEconomyApiAction, context: StorageResponseContext): Promise<StudentEconomyUpdateResult> => {
  await drafts.ready();
  assertActor(studentNumber, context);
  const scope = scopeFor(studentNumber, ECONOMY_DRAFT_ACTION), prior = drafts.load(scope), rejected = drafts.load(rejectedScopeFor(scope));
  if (prior && rejected?.draft.payload === prior.draft.requestId) {
    if (!await drafts.confirmDurable(scope, prior.draft.requestId)) throw new Error('SAVE_DRAFT_PENDING');
    await drafts.confirmDurable(rejectedScopeFor(scope), rejected.draft.requestId);
  }
  const saved = await drafts.saveDurable(scope, action);
  if (saved.status === 'invalid') throw new Error('STUDENT_COMMAND_INVALID');
  assertActor(studentNumber, context);
  if (saved.status === 'payload_changed') {
    const confirmed = await loadStudentEconomyReceipt(studentNumber, saved.draft.requestId, saved.draft.payload, context);
    if (!confirmed || !await drafts.confirmDurable(scope, saved.draft.requestId)) throw new Error('SAVE_DRAFT_PENDING');
    if (confirmed.refreshPending) markSaveRefreshPending(studentNumber);
    return executeEconomyWithDraft(studentNumber, action, context);
  }
  const result = await confirmEconomyDraft(studentNumber, context);
  if (!result) throw new Error('STUDENT_ECONOMY_CONFIRMATION_REQUIRED');
  return result;
};
export const executeStudentEconomyWithDraft = (studentNumber: number, action: StudentEconomyApiAction): Promise<StudentEconomyUpdateResult> => {
  const context = captureStorageResponseContext();
  return serializeStudentSave(studentNumber, () => executeEconomyWithDraft(studentNumber, action, context));
};

const automaticActions = new Set(['student.letter.send', 'student.letter.read', 'student.failure.create', 'student.failure.stamp',
  'student.emotion.save', 'student.sudoku.save', 'student.sudoku.complete', 'student.baseball.save', 'student.baseball.complete',
  'student.pet.name', 'student.pet.select', 'student.pet.move']);
const findRecoveryDraft = (request: RecoveryRequest) => drafts.list(request.actor).find(draft => draft.requestId === request.id);
const eligibleDraft = (draft: StudentSaveDraft): boolean => {
  const metadata = drafts.load(contextScope(draft.scope))?.draft.payload;
  if (!isStorageRecord(metadata) || metadata.requestId !== draft.requestId || metadata.dateKey !== getKoreanLocalDateKey()) return false;
  if (metadata.actor !== captureStorageResponseContext().actor) return false;
  const payload = isStorageRecord(draft.payload) ? draft.payload : {};
  if (studentEditRevisionKey(draft.scope.studentNumber, draft.scope.feature) && !isStorageRecord(payload.expectedRevisions)) return false;
  if (draft.scope.feature.includes('.sudoku.') || draft.scope.feature.includes('.baseball.')) {
    if (typeof payload.key !== 'string' || !payload.key.includes(getKoreanIsoWeekKey())) return false;
  }
  return true;
};
registerSaveRecoveryAdapter({
  id: 'student-storage',
  list: async actor => {
    await drafts.ready();
    return drafts.list(actor).filter(draft => automaticActions.has(draft.scope.feature) || draft.scope.feature === 'student.auction.bid' || draft.scope.feature === ECONOMY_DRAFT_ACTION)
      .filter(draft => drafts.load(rejectedScopeFor(draft.scope))?.draft.payload !== draft.requestId)
      .map(draft => ({ id: draft.requestId, actor, feature: draft.scope.feature, createdAt: draft.createdAt,
        mode: automaticActions.has(draft.scope.feature) ? 'automatic' : 'confirm-only' }));
  },
  eligible: request => { const draft = findRecoveryDraft(request); return !!draft && eligibleDraft(draft); },
  confirm: async request => {
    const draft = findRecoveryDraft(request);
    if (!draft) return true;
    const result = draft.scope.feature === ECONOMY_DRAFT_ACTION
      ? await loadStudentEconomyReceipt(request.actor, draft.requestId, draft.payload)
      : await loadStorageCommandReceipt(draft.requestId, commandFor(draft));
    if (!result) return false;
    await acknowledge(draft, result);
    return true;
  },
  retry: async request => {
    const draft = findRecoveryDraft(request);
    if (!draft || !eligibleDraft(draft)) return;
    await executeStudentStorageCommand(request.actor, draft.scope.feature, draft.payload, draft.scope.entityId);
  },
});
