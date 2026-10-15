import { StorageRepositoryError } from './storageV2Repository.js';
import { StorageScopeError } from './storageScope.js';

const actions = new Set([
  'student.auction.bid', 'student.baseball.complete', 'student.baseball.save', 'student.emotion.save',
  'student.failure.create', 'student.failure.stamp', 'student.letter.read', 'student.letter.send',
  'student.pet.feed', 'student.pet.move', 'student.pet.name', 'student.pet.select', 'student.sudoku.complete', 'student.sudoku.save',
  'teacher.auction.finalize', 'teacher.auction.remove', 'teacher.auction.weekly-close',
  'teacher.currency.adjust', 'teacher.currency.deduct', 'teacher.currency.reset', 'teacher.currency.set',
  'teacher.donation.reset', 'teacher.mail.delete', 'teacher.mail.read', 'teacher.mail.send', 'teacher.role.result',
  'teacher.settings.patch', 'teacher.writing.cancel', 'teacher.writing.publish', 'teacher.writing.reward',
]);

interface FailureContext {
  readonly route: '/api/student-economy' | '/api/shared-settings';
  readonly stage: 'receipt' | 'command' | 'confirmation';
  readonly startedAt: number;
  readonly action?: unknown;
}

export const logStorageFailure = (error: unknown, context: FailureContext): void => {
  const trusted = error instanceof StorageRepositoryError || error instanceof StorageScopeError;
  const status = trusted ? error.status : 502;
  if (status < 500 && !(status === 400 && trusted && error.code === 'STORAGE_SCOPE_VIOLATION')) return;
  const code = trusted
    && /^STORAGE_(?:DATABASE_HTTP_[45][0-9]{2}|DATABASE_NETWORK|DATABASE_TIMEOUT|INVALID_RESPONSE|SERIALIZATION_RETRY|MAINTENANCE|NOT_ACTIVE|BALANCE_MISMATCH|LEDGER_IMMUTABLE|INVALID_MUTATION|SCOPE_VIOLATION)$/.test(error.code)
    ? error.code : 'STORAGE_REQUEST_FAILED';
  console.error('Storage request failed.', {
    route: context.route, stage: context.stage, status, code,
    ...(typeof context.action === 'string' && actions.has(context.action) ? { action: context.action } : {}),
    elapsedMs: Math.max(0, Date.now() - context.startedAt),
  });
};
