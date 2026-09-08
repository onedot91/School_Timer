import { beginSaveProgress } from './saveProgress.js';
import { loadStudentEconomyReceipt, retryStudentEconomyRequest, StudentEconomyRequestError, type StudentEconomyApiAction, type StudentEconomyUpdateResult } from './studentEconomyClient.js';
import { executeStorageCommand, loadStorageCommandReceipt, StorageCommandError } from './storageCommandClient.js';
import { createStudentSaveDraftStore, type StudentSaveDraftScope } from './studentSaveDraft.js';
import { getStorageAvailability } from './storageAvailability.js';
import { canonicalStorageJson } from './storageV2Codec.js';

const drafts = createStudentSaveDraftStore();
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

export const hasUnconfirmedStudentStorageDraft = (studentNumber: number, action: string, entityId = action): boolean => {
  const scope = scopeFor(studentNumber, action, entityId), pending = drafts.load(scope), rejected = drafts.load(rejectedScopeFor(scope));
  return pending !== null && rejected?.draft.payload !== pending.draft.requestId && !isPaused(scope, pending.draft.requestId);
};

export const loadStudentStorageFormDraft = (studentNumber: number, action: string, entityId = action): Record<string, unknown> => {
  const scope = scopeFor(studentNumber, action, entityId);
  const pending = drafts.load(scope), form = drafts.load(formScopeFor(scope)), rejected = drafts.load(rejectedScopeFor(scope));
  const payload = pending && rejected?.draft.payload !== pending.draft.requestId && !isPaused(scope, pending.draft.requestId)
    ? pending.draft.payload
    : form?.draft.payload ?? pending?.draft.payload ?? null;
  return payload !== null && typeof payload === 'object' && !Array.isArray(payload) ? Object.fromEntries(Object.entries(payload)) : {};
};

/** Editable input is separate from the immutable intent of an unconfirmed request. */
export const saveStudentStorageFormDraft = (studentNumber: number, action: string, payload: unknown, entityId = action) => {
  const scope = formScopeFor(scopeFor(studentNumber, action, entityId));
  removeCurrent(scope);
  drafts.save(scope, payload);
};

export const clearStudentStorageFormDraft = (studentNumber: number, action: string, entityId = action) => {
  removeCurrent(formScopeFor(scopeFor(studentNumber, action, entityId)));
};

/** Only an explicit user submission enters this function; no background mutation replay occurs. */
export const executeStudentStorageCommand = async (
  studentNumber: number, action: string, payload: unknown, entityId = action,
) => {
  const finishProgress = beginSaveProgress();
  try {
    const scope = scopeFor(studentNumber, action, entityId), rejectedScope = rejectedScopeFor(scope);
    const rejected = drafts.load(rejectedScope), prior = drafts.load(scope);
    if (prior && isPaused(scope, prior.draft.requestId) && canonicalStorageJson(prior.draft.payload) !== canonicalStorageJson(payload)) {
      drafts.remove(scope, prior.draft.requestId);
      removeCurrent(pausedScopeFor(scope));
    }
    if (rejected && prior && rejected.draft.payload === prior.draft.requestId) {
      drafts.remove(scope, prior.draft.requestId);
      drafts.remove(rejectedScope, rejected.draft.requestId);
    }
    const saved = drafts.save(scope, payload);
    if (saved.status === 'invalid') throw new Error('STUDENT_COMMAND_INVALID');
    if ((saved.status === 'existing' || saved.status === 'payload_changed') && !isPaused(scope, saved.draft.requestId)) {
      const confirmed = await loadStorageCommandReceipt(saved.draft.requestId);
      if (confirmed) {
        drafts.confirm(scope, saved.draft.requestId);
        if (saved.status === 'payload_changed') return await executeStudentStorageCommand(studentNumber, action, payload, entityId);
        clearStudentStorageFormDraft(studentNumber, action, entityId);
        return confirmed;
      }
    }
    if (saved.status === 'payload_changed') throw new Error('SAVE_DRAFT_PENDING');
    try {
      removeCurrent(pausedScopeFor(scope));
      const response = await executeStorageCommand({ requestId: saved.draft.requestId, action, payload: saved.draft.payload });
      drafts.confirm(scope, saved.draft.requestId);
      clearStudentStorageFormDraft(studentNumber, action, entityId);
      return response;
    } catch (error) {
      if (getStorageAvailability(error)) {
        drafts.save(pausedScopeFor(scope), saved.draft.requestId);
      } else if (error instanceof StorageCommandError && !error.uncertainWrite && [400, 403, 404, 422].includes(error.status)) {
        drafts.save(rejectedScope, saved.draft.requestId);
      }
      throw error;
    }
  } finally {
    finishProgress();
  }
};

const ECONOMY_DRAFT_ACTION = 'student.economy';
export const hasUnconfirmedStudentEconomyDraft = (studentNumber: number) => hasUnconfirmedStudentStorageDraft(studentNumber, ECONOMY_DRAFT_ACTION);

export const confirmStudentEconomyDraft = async (studentNumber: number): Promise<StudentEconomyUpdateResult | null> => {
  const scope = scopeFor(studentNumber, ECONOMY_DRAFT_ACTION), pending = drafts.load(scope);
  if (!pending) return null;
  try {
    const paused = isPaused(scope, pending.draft.requestId);
    removeCurrent(pausedScopeFor(scope));
    const result = await (paused ? null : loadStudentEconomyReceipt(studentNumber, pending.draft.requestId))
      ?? await retryStudentEconomyRequest({ studentNumber, requestId: pending.draft.requestId, action: pending.draft.payload });
    drafts.confirm(scope, pending.draft.requestId);
    return result;
  } catch (error) {
    if (getStorageAvailability(error)) {
      drafts.save(pausedScopeFor(scope), pending.draft.requestId);
    } else if (error instanceof StudentEconomyRequestError && [400, 403, 404, 422, 426].includes(error.status)) {
      drafts.save(rejectedScopeFor(scope), pending.draft.requestId);
    }
    throw error;
  }
};

export const executeStudentEconomyWithDraft = async (studentNumber: number, action: StudentEconomyApiAction): Promise<StudentEconomyUpdateResult> => {
  const scope = scopeFor(studentNumber, ECONOMY_DRAFT_ACTION), prior = drafts.load(scope), rejected = drafts.load(rejectedScopeFor(scope));
  if (prior && isPaused(scope, prior.draft.requestId) && canonicalStorageJson(prior.draft.payload) !== canonicalStorageJson(action)) {
    drafts.remove(scope, prior.draft.requestId);
    removeCurrent(pausedScopeFor(scope));
  }
  if (prior && rejected?.draft.payload === prior.draft.requestId) {
    drafts.remove(scope, prior.draft.requestId);
    removeCurrent(rejectedScopeFor(scope));
  }
  const saved = drafts.save(scope, action);
  if (saved.status === 'invalid') throw new Error('STUDENT_COMMAND_INVALID');
  if (saved.status === 'payload_changed') {
    const confirmed = await loadStudentEconomyReceipt(studentNumber, saved.draft.requestId);
    if (!confirmed) throw new Error('SAVE_DRAFT_PENDING');
    drafts.confirm(scope, saved.draft.requestId);
    return executeStudentEconomyWithDraft(studentNumber, action);
  }
  const result = await confirmStudentEconomyDraft(studentNumber);
  if (!result) throw new Error('STUDENT_ECONOMY_CONFIRMATION_REQUIRED');
  return result;
};
