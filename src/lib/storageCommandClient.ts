import { isReadOnlyDataMode } from './dataMode.js';
import { getSaveFailureFeature, withSaveFailureReporting } from './saveFailureClient.js';
import { invalidateSharedSettingsCache } from './supabaseSettings.js';
import { acceptStorageProjection, captureStorageResponseContext, isStorageResponseContextCurrent, StorageResponseActorChangedError, type StorageResponseContext } from './storageResponseOrder.js';
import { canonicalStorageJson } from './storageV2Codec.js';
import { publishStorageAvailability } from './storageAvailability.js';
import { parseStorageProjectionPatch, type StorageProjectionPatch } from './storageProjectionPatch.js';
import { deferSaveRecoveryUntil, getSaveRecoveryDelay } from './saveRecovery.js';

export interface StorageCommand {
  readonly requestId: string;
  readonly action: string;
  readonly payload: unknown;
  readonly studentNumber?: number;
}

export interface StorageCommandResult {
  readonly value: Record<string, unknown> | null;
  readonly updatedAt: string;
  readonly result: unknown;
  readonly storagePatch?: StorageProjectionPatch;
  readonly refreshPending?: boolean;
}

export class StorageCommandError extends Error {
  readonly name = 'StorageCommandError';
  readonly endpoint = '/api/shared-settings';
  readonly businessRejected: boolean;
  constructor(
    readonly serverCode: string,
    readonly status: number,
    readonly uncertainWrite = false,
    readonly retryAfterMs?: number,
  ) { super(serverCode); this.businessRejected = [400,403,404,422].includes(status); }
}

const record = (value: unknown): Record<string, unknown> | null => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value)) : null
);

const parseResult = (input: unknown): StorageCommandResult => {
  const row = record(input);
  const value = record(row?.value);
  if (!row || !value || typeof row.updatedAt !== 'string'
    || !Number.isFinite(Date.parse(row.updatedAt))) {
    throw new StorageCommandError('STORAGE_INVALID_RESPONSE', 502, true);
  }
  return { value, updatedAt: row.updatedAt, result: row.result,
    ...(row.storagePatch === undefined ? {} : { storagePatch: parseStorageProjectionPatch(row.storagePatch) }) };
};

const readResponse = async (response: Response): Promise<unknown> => {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const code = record(body)?.error;
    const retryAfter = response.headers.get('Retry-After');
    const seconds = retryAfter === null ? NaN : Number(retryAfter);
    const retryAfterMs = Number.isFinite(seconds) ? Math.max(0, seconds * 1000)
      : retryAfter === null ? undefined : Math.max(0, Date.parse(retryAfter) - Date.now());
    throw new StorageCommandError(typeof code === 'string' ? code : 'STORAGE_REQUEST_FAILED', response.status, false,
      Number.isFinite(retryAfterMs) ? retryAfterMs : undefined);
  }
  return body;
};

/** Read-only confirmation. A missing receipt never proves an in-flight write failed. */
export const loadStorageCommandReceipt = async (requestId: string, command?: StorageCommand, context = captureStorageResponseContext(), studentNumber = command?.studentNumber): Promise<StorageCommandResult | null> => {
  if (!isStorageResponseContextCurrent(context)) throw new StorageResponseActorChangedError();
  const query = new URLSearchParams({ requestId, receiptOnly: '1' });
  if (studentNumber !== undefined) query.set('studentNumber', String(studentNumber));
  const response = await fetch(`/api/shared-settings?${query}`, {
    credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(12_000),
    headers: { 'X-Storage-Projection': '1' },
  });
  const body = await readResponse(response);
  if (!isStorageResponseContextCurrent(context)) throw new StorageResponseActorChangedError();
  if (record(body)?.status === 'unknown') return null;
  if (command) {
    const bytes = new TextEncoder().encode(canonicalStorageJson({ action: command.action, payload: command.payload }));
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2,'0')).join('');
    if (record(body)?.action !== command.action || record(body)?.payloadHash !== hash) throw new StorageCommandError('STORAGE_REQUEST_REUSED',409);
  }
  // Older servers may return the full projection while this opt-in is rolling out.
  if (record(record(body)?.value)) return orderResult(context, parseResult(body));
  const receipt = record(body);
  if (receipt?.status !== 'committed' || typeof receipt.action !== 'string'
    || typeof receipt.payloadHash !== 'string' || typeof receipt.committedAt !== 'string'
    || !Number.isFinite(Date.parse(receipt.committedAt))) throw new StorageCommandError('STORAGE_INVALID_RESPONSE', 502, true);
  invalidateSharedSettingsCache();
  query.delete('receiptOnly');
  try {
    if (!isStorageResponseContextCurrent(context)) throw new StorageResponseActorChangedError();
    const refreshed = await fetch(`/api/shared-settings?${query}`, {
      credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(12_000), headers: { 'X-Storage-Projection': '1' },
    });
    return orderResult(context, parseResult(await readResponse(refreshed)));
  } catch (error) {
    if (!isStorageResponseContextCurrent(context) || error instanceof StorageResponseActorChangedError) throw new StorageResponseActorChangedError();
    return { value: null, updatedAt: receipt.committedAt, result: receipt.result, refreshPending: true };
  }
};

const orderResult = (context: StorageResponseContext, saved: StorageCommandResult): StorageCommandResult => {
  if (saved.value === null) return saved;
  const projection = acceptStorageProjection(context, { value: saved.value, updatedAt: saved.updatedAt, storagePatch: saved.storagePatch, ...(context.actor === null ? {} : { scope: context.actor === '0' ? 'full' : 'student' }) });
  return { result: saved.result, value: projection.value, updatedAt: projection.updatedAt, storagePatch: saved.storagePatch };
};

export const executeStorageCommand = async (command: StorageCommand, context = captureStorageResponseContext(), deferUntilRecovery = false): Promise<StorageCommandResult> => {
  if (isReadOnlyDataMode) throw new StorageCommandError('READ_ONLY_DATA_MODE', 403);
  if (!command.requestId || !command.action) throw new StorageCommandError('INVALID_STORAGE_COMMAND', 400);
  if (!isStorageResponseContextCurrent(context)) throw new StorageResponseActorChangedError();
  const outcome = await withSaveFailureReporting(getSaveFailureFeature(), async () => {
    try {
      const actor = command.studentNumber ?? Number(context.actor);
      const retryAfterMs = getSaveRecoveryDelay(actor, command.requestId);
      if (retryAfterMs > 0) throw new StorageCommandError('TOO_MANY_REQUESTS', 429, false, retryAfterMs);
      const response = await fetch('/api/shared-settings', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'X-Storage-Projection': '1' }, signal: AbortSignal.timeout(45_000),
        body: JSON.stringify({ protocolVersion: 2, ...command }),
      });
      return { saved: parseResult(await readResponse(response)) };
    } catch (error) {
      if (error instanceof StorageCommandError && error.retryAfterMs) {
        deferSaveRecoveryUntil(command.studentNumber ?? Number(context.actor), command.requestId, error.retryAfterMs);
      }
      if (!isStorageResponseContextCurrent(context)) throw new StorageResponseActorChangedError();
      if (publishStorageAvailability(error, context)) throw error;
      if (error instanceof StorageCommandError && error.status < 500) throw error;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const confirmed = await loadStorageCommandReceipt(command.requestId, command, context);
          if (confirmed) return { saved: confirmed, ordered: true };
        } catch (confirmationError) {
          if (confirmationError instanceof StorageResponseActorChangedError) throw confirmationError;
          if (!(confirmationError instanceof Error)) throw confirmationError;
        }
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 200 * 2 ** attempt));
      }
      throw new StorageCommandError('STORAGE_CONFIRMATION_REQUIRED', 502, true, getSaveRecoveryDelay(command.studentNumber ?? Number(context.actor), command.requestId) || undefined);
    }
  }, command.studentNumber, { requestId: command.requestId, deferUntilRecovery, stage: 'write', retryCount: 0 });
  if (!outcome.saved) throw new StorageCommandError('STORAGE_INVALID_RESPONSE', 502, true);
  const saved = 'ordered' in outcome && outcome.ordered ? outcome.saved : orderResult(context, outcome.saved);
  invalidateSharedSettingsCache();
  return saved;
};
