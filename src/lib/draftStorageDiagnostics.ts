import { getSaveFailureScopeFeature, type SaveFailureDiagnostics } from './saveFailure.js';
import { reportSaveFailure } from './saveFailureClient.js';
import type { StudentSaveDraft } from './studentSaveDraft.js';

export interface DraftStorageAttempt {
  readonly storageBackend: NonNullable<SaveFailureDiagnostics['storageBackend']>;
  readonly storageOperation: NonNullable<SaveFailureDiagnostics['storageOperation']>;
  readonly startedAt: number;
}

const causes: Readonly<Record<string, string>> = {
  QuotaExceededError: 'LOCAL_DRAFT_QUOTA_EXCEEDED',
  SecurityError: 'LOCAL_DRAFT_ACCESS_DENIED',
  InvalidStateError: 'LOCAL_DRAFT_CONNECTION_CLOSED',
  AbortError: 'LOCAL_DRAFT_ABORTED',
  VersionError: 'LOCAL_DRAFT_VERSION_MISMATCH',
  DataCloneError: 'LOCAL_DRAFT_SERIALIZATION_FAILED',
  DRAFT_DATABASE_BLOCKED: 'LOCAL_DRAFT_DATABASE_BLOCKED',
  DRAFT_DATABASE_TIMEOUT: 'LOCAL_DRAFT_DATABASE_TIMEOUT',
  DRAFT_DATABASE_UNAVAILABLE: 'LOCAL_DRAFT_DATABASE_UNAVAILABLE',
  DRAFT_DATABASE_ABORTED: 'LOCAL_DRAFT_ABORTED',
};

export const createDraftStorageReporter = () => {
  const lastReported = new Map<string, number>();
  return (draft: StudentSaveDraft, attempt: DraftStorageAttempt, error: unknown): void => {
    const nativeError = error instanceof Error || (typeof DOMException !== 'undefined' && error instanceof DOMException) ? error : null;
    const causeCode = error === 'cas-conflict' ? 'LOCAL_DRAFT_CAS_CONFLICT'
      : nativeError ? (Object.hasOwn(causes, nativeError.name) ? causes[nativeError.name]
        : Object.hasOwn(causes, nativeError.message) ? causes[nativeError.message] : 'LOCAL_DRAFT_STORAGE_ERROR')
        : 'LOCAL_DRAFT_STORAGE_UNAVAILABLE';
    const feature = getSaveFailureScopeFeature(draft.scope.feature);
    const bucket = JSON.stringify([draft.scope.studentNumber, feature, attempt.storageBackend, attempt.storageOperation, causeCode]);
    const now = Date.now();
    if (now - (lastReported.get(bucket) ?? -Infinity) < 60_000) return;
    lastReported.set(bucket, now);
    if (lastReported.size > 100) {
      const oldest = lastReported.keys().next().value;
      if (oldest !== undefined) lastReported.delete(oldest);
    }
    reportSaveFailure(feature, causeCode === 'LOCAL_DRAFT_CAS_CONFLICT' ? 'conflict' : 'storage', draft.scope.studentNumber, {
      errorCode: attempt.storageOperation === 'confirm' ? 'LOCAL_DRAFT_CONFIRM_FAILED' : 'LOCAL_DRAFT_SAVE_FAILED',
      causeCode, errorName: nativeError?.name, requestId: draft.requestId, stage: 'draft',
      storageBackend: attempt.storageBackend, storageOperation: attempt.storageOperation,
      elapsedMs: Math.min(600_000, Math.max(0, now - attempt.startedAt)),
    });
  };
};
