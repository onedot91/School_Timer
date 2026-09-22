import { StorageRepositoryError } from './storageV2Repository.js';

interface FailureContext {
  readonly route: '/api/student-economy' | '/api/shared-settings';
  readonly stage: 'receipt' | 'command' | 'confirmation';
  readonly startedAt: number;
}

export const logStorageFailure = (error: unknown, context: FailureContext): void => {
  const status = error instanceof StorageRepositoryError ? error.status : 502;
  if (status < 500) return;
  const code = error instanceof StorageRepositoryError
    && /^STORAGE_(?:DATABASE_HTTP_[45][0-9]{2}|DATABASE_NETWORK|DATABASE_TIMEOUT|INVALID_RESPONSE|SERIALIZATION_RETRY|MAINTENANCE|NOT_ACTIVE|BALANCE_MISMATCH|LEDGER_IMMUTABLE|INVALID_MUTATION)$/.test(error.code)
    ? error.code : 'STORAGE_REQUEST_FAILED';
  console.error('Storage request failed.', {
    route: context.route, stage: context.stage, status, code,
    elapsedMs: Math.max(0, Date.now() - context.startedAt),
  });
};
