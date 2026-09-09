import { featurePayloadHash, featureRetryAfterMs } from './featureReceipt.js';
import { deferSaveRecoveryUntil, getSaveRecoveryDelay, notifySaveRecovery, registerSaveRecoveryAdapter, serializeStudentSave, markSaveRefreshPending } from './saveRecovery.js';
import { deferSaveFailure, reportSaveFailure, withSaveFailureReporting } from './saveFailureClient.js';
import { applyLibraryPlacementCommand, parseLibraryPlacementCommand, type LibraryPlacementCommand } from './canvasLibraryPlacement.js';
import { appDataMode, type AppDataMode } from './dataMode.js';
import { createBrowserRequestId } from './requestId.js';
import { normalizeBookReflection, normalizeStudentLifeState, type StudentBook } from './studentLife.js';
import { loadLibraryLocalSnapshot, storeLibraryLocalSnapshot } from './libraryCompetitionLocalStore.js';
import { libraryCompetitionClient, LibraryCompetitionClientError } from './libraryCompetitionClient.js';
import { invalidateSharedSettingsCache, isSupabaseSettingsEnabled } from './supabaseSettings.js';
import type { LibraryBookDraft, LibraryPlacedBook } from './canvasLibraryWorld.js';
import { acceptStorageProjection, captureStorageResponseContext, isStorageResponseContextCurrent, StorageResponseActorChangedError } from './storageResponseOrder.js';
import { parseStorageProjectionPatch } from './storageProjectionPatch.js';
import { getStorageAvailability, publishStorageAvailability } from './storageAvailability.js';
import { createStudentSaveDraftStore, type StudentSaveDraft } from './studentSaveDraft.js';

export type CanvasLibraryPlacementErrorCode =
  | 'INVALID_LIBRARY_COMMAND'
  | 'LIBRARY_BOOK_FORBIDDEN'
  | 'LIBRARY_SLOT_OCCUPIED'
  | 'LIBRARY_FULL'
  | 'LIBRARY_SEASON_CHANGED'
  | 'LIBRARY_BOOK_ALREADY_PLACED'
  | 'SHARED_SETTINGS_CONFLICT'
  | 'LIBRARY_SAVE_FAILED'
  | 'READ_ONLY_DATA_MODE'
  | 'LIBRARY_NETWORK_FAILED'
  | 'INVALID_LIBRARY_RESPONSE'
  | 'LIBRARY_STORAGE_MAINTENANCE'
  | 'LIBRARY_STORAGE_UPDATE_REQUIRED'
  | 'LIBRARY_LOCAL_SAVE_FAILED'
  | 'LIBRARY_CONFIRMED_REFRESH_PENDING'
  | 'LIBRARY_LEGACY_CONFIRMATION_REQUIRED';

export type CanvasLibraryPlacementResult =
  | {
    readonly ok: true;
    readonly book: StudentBook;
    readonly placedBook: LibraryPlacedBook;
    readonly updatedAt: string;
    readonly value: Record<string, unknown> | null;
    readonly refreshPending?: boolean;
  }
  | {
    readonly ok: false;
    readonly error: {
      readonly code: CanvasLibraryPlacementErrorCode;
      readonly retryable: boolean;
      readonly status?: number;
      readonly retryAfterMs?: number;
    };
  };

const ERROR_MESSAGES: Record<CanvasLibraryPlacementErrorCode, string> = {
  INVALID_LIBRARY_COMMAND: '책 정보를 다시 확인해 주세요.',
  LIBRARY_BOOK_FORBIDDEN: '내가 읽은 책만 옮길 수 있어요.',
  LIBRARY_SLOT_OCCUPIED: '다른 책이 먼저 꽂혔어요. 새로고침한 뒤 다른 자리를 골라 주세요.',
  LIBRARY_FULL: '도서관의 100자리가 모두 찼어요.',
  LIBRARY_SEASON_CHANGED: '새 달이 시작됐어요. 책 정보는 보관했으니 새 책장에서 자리를 다시 골라 주세요.',
  LIBRARY_BOOK_ALREADY_PLACED: '이 책은 이미 다른 자리에 꽂혀 있어요.',
  SHARED_SETTINGS_CONFLICT: '도서관이 바뀌었어요. 새로고침한 뒤 다시 시도해 주세요.',
  LIBRARY_SAVE_FAILED: '책을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.',
  READ_ONLY_DATA_MODE: '읽기 전용 모드에서는 책을 꽂을 수 없어요.',
  LIBRARY_NETWORK_FAILED: '연결이 불안정해요. 같은 책으로 다시 시도해 주세요.',
  INVALID_LIBRARY_RESPONSE: '도서관 응답을 확인하지 못했어요. 새로고침해 주세요.',
  LIBRARY_STORAGE_MAINTENANCE: '저장 점검 중이에요. 책은 보관했어요.',
  LIBRARY_STORAGE_UPDATE_REQUIRED: '화면을 새로고침해 주세요. 책은 보관했어요.',
  LIBRARY_LOCAL_SAVE_FAILED: '이 기기에 책을 저장하지 못했어요. 저장 공간을 확인해 주세요.',
  LIBRARY_CONFIRMED_REFRESH_PENDING: '저장됨 · 화면 갱신 중',
  LIBRARY_LEGACY_CONFIRMATION_REQUIRED: '이전 책의 저장 여부를 확인해야 해요. 작성한 내용은 보관했어요.',
};

export class CanvasLibraryPlacementExpectedError extends Error {
  readonly code: CanvasLibraryPlacementErrorCode;
  readonly retryable: boolean;
  readonly status?: number;
  readonly retryAfterMs?: number;

  constructor(error: { readonly code: CanvasLibraryPlacementErrorCode; readonly retryable: boolean; readonly status?: number; readonly retryAfterMs?: number }) {
    super(ERROR_MESSAGES[error.code]);
    this.name = 'CanvasLibraryPlacementExpectedError';
    this.code = error.code;
    this.retryable = error.retryable;
    this.retryAfterMs = error.retryAfterMs;
    this.status = error.status ?? (['LIBRARY_SLOT_OCCUPIED', 'LIBRARY_FULL', 'LIBRARY_BOOK_FORBIDDEN', 'LIBRARY_SEASON_CHANGED', 'LIBRARY_BOOK_ALREADY_PLACED', 'SHARED_SETTINGS_CONFLICT', 'LIBRARY_CONFIRMED_REFRESH_PENDING', 'LIBRARY_LEGACY_CONFIRMATION_REQUIRED'].includes(error.code) ? 409 : undefined);
  }
}

export interface CanvasLibraryClientDependencies {
  readonly dataMode: AppDataMode;
  readonly isSharedConfigured: boolean;
  readonly createRequestId: () => string;
  readonly now: () => string;
  readonly requestTimeoutMs: number;
  readonly fetcher: typeof fetch;
  readonly loadLocalSnapshot: () => Record<string, unknown>;
  readonly storeLocalSnapshot: (snapshot: Record<string, unknown>) => boolean;
  readonly invalidateSharedCache: () => void;
  readonly withLocalLock: <T>(action: () => Promise<T> | T) => Promise<T>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

const SERVER_ERROR_CODES = new Set<CanvasLibraryPlacementErrorCode>([
  'INVALID_LIBRARY_COMMAND',
  'LIBRARY_BOOK_FORBIDDEN',
  'LIBRARY_SLOT_OCCUPIED',
  'LIBRARY_FULL',
  'LIBRARY_SEASON_CHANGED',
  'LIBRARY_BOOK_ALREADY_PLACED',
  'SHARED_SETTINGS_CONFLICT',
  'LIBRARY_SAVE_FAILED',
]);

const nonRetryableCodes = new Set<CanvasLibraryPlacementErrorCode>([
  'INVALID_LIBRARY_COMMAND',
  'LIBRARY_BOOK_FORBIDDEN',
  'LIBRARY_FULL',
  'LIBRARY_BOOK_ALREADY_PLACED',
  'READ_ONLY_DATA_MODE',
  'LIBRARY_LEGACY_CONFIRMATION_REQUIRED',
]);

const failure = (code: CanvasLibraryPlacementErrorCode, status?: number, retryAfterMs?: number): CanvasLibraryPlacementResult => ({
  ok: false,
  error: { code, retryable: !nonRetryableCodes.has(code), ...(status === undefined ? {} : { status }), ...(retryAfterMs === undefined ? {} : { retryAfterMs }) },
});

const toPlacedBook = (book: StudentBook): LibraryPlacedBook | null => (
  book.librarySlot === undefined
    ? null
    : {
      bookId: book.id,
      studentNumber: book.studentNumber,
      title: book.title,
      author: book.author,
      pageCount: book.pageCount,
      ...(book.reflection === undefined ? {} : { reflection: book.reflection }),
      slotId: book.librarySlot,
    }
);

const parseSuccess = (
  value: unknown,
  command: LibraryPlacementCommand,
  studentNumber: number,
): CanvasLibraryPlacementResult | null => {
  if (!isRecord(value) || typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt))) return null;
  if (!isRecord(value.value) || !isRecord(value.book)) return null;
  const normalized = normalizeStudentLifeState({ books: [value.book] }).books;
  if (normalized.length !== 1) return null;
  const book = normalized[0];
  if (!book || book.librarySlot !== command.slotId || book.studentNumber !== studentNumber) return null;
  if (command.book.kind === 'new') {
    if (
      book.id !== `library:${studentNumber}:${command.requestId}`
      || book.title !== command.book.title
      || book.author !== command.book.author
      || book.pageCount !== command.book.pageCount
      || book.reflection !== command.book.reflection
    ) return null;
  } else if (book.id !== command.book.bookId) return null;
  const authoritativeBook = normalizeStudentLifeState(value.value.studentLife).books.find((candidate) => candidate.id === book.id);
  if (
    !authoritativeBook
    || authoritativeBook.studentNumber !== book.studentNumber
    || authoritativeBook.title !== book.title
    || authoritativeBook.author !== book.author
    || authoritativeBook.pageCount !== book.pageCount
    || authoritativeBook.reflection !== book.reflection
    || authoritativeBook.createdAt !== book.createdAt
    || authoritativeBook.colorIndex !== book.colorIndex
    || authoritativeBook.librarySlot !== book.librarySlot
  ) return null;
  const placedBook = toPlacedBook(authoritativeBook);
  if (!placedBook) return null;
  return { ok: true, book: authoritativeBook, placedBook, updatedAt: value.updatedAt, value: value.value };
};

const parseServerError = (value: unknown): CanvasLibraryPlacementErrorCode | null => {
  if (!isRecord(value) || typeof value.error !== 'string') return null;
  for (const code of SERVER_ERROR_CODES) if (code === value.error) return code;
  return null;
};

const draftKey = (draft: LibraryBookDraft) => JSON.stringify([
  draft.bookId ?? null,
  draft.studentNumber,
  draft.title.trim(),
  draft.author.trim(),
  draft.pageCount,
  draft.reflection?.trim() ?? null,
]);

const makeCommand = (
  draft: LibraryBookDraft,
  slotId: number,
  requestId: string,
): LibraryPlacementCommand => ({
  action: 'placeLibraryBook',
  requestId,
  slotId,
  book: draft.bookId
    ? { kind: 'existing', bookId: draft.bookId }
    : { kind: 'new', title: draft.title.trim(), author: draft.author.trim(), pageCount: draft.pageCount,
      ...(draft.reflection === undefined ? {} : { reflection: normalizeBookReflection(draft.reflection) ?? draft.reflection }) },
});

export const createCanvasLibraryClient = (dependencies: CanvasLibraryClientDependencies) => {
  const pendingDrafts = createStudentSaveDraftStore({ createRequestId: dependencies.createRequestId });

  const readReceipt = async (command: LibraryPlacementCommand, actor: number): Promise<CanvasLibraryPlacementResult | null> => {
    const context = captureStorageResponseContext();
    const query = new URLSearchParams({ requestId: command.requestId, receiptOnly: '1', studentNumber: String(actor) });
    const response = await dependencies.fetcher(`/api/shared-settings?${query}`, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(Math.min(12_000, dependencies.requestTimeoutMs)) });
    let receipt: unknown;
    try { receipt = await response.json(); } catch (error) { if (response.ok) throw error; }
    if (!isStorageResponseContextCurrent(context)) throw new StorageResponseActorChangedError();
    if (!response.ok) {
      const retryAfterMs = featureRetryAfterMs(response);
      if (retryAfterMs && (response.status === 429 || response.status >= 500)) deferSaveRecoveryUntil(actor, command.requestId, retryAfterMs);
      throw new CanvasLibraryPlacementExpectedError({ code: 'LIBRARY_SAVE_FAILED', retryable: response.status >= 500 || response.status === 429, status: response.status, retryAfterMs });
    }
    if (!isRecord(receipt)) throw new Error('LIBRARY_CONFIRMATION_REQUIRED');
    if (receipt.status === 'unknown') return null;
    if (receipt.status !== 'committed' || receipt.action !== 'placeLibraryBook'
      || receipt.payloadHash !== await featurePayloadHash('placeLibraryBook', command)
      || typeof receipt.committedAt !== 'string' || !Number.isFinite(Date.parse(receipt.committedAt))) throw new CanvasLibraryPlacementExpectedError({ code: 'INVALID_LIBRARY_RESPONSE', retryable: false });
    dependencies.invalidateSharedCache();
    query.delete('receiptOnly');
    try {
      const refresh = await dependencies.fetcher(`/api/shared-settings?${query}`, { credentials: 'same-origin', cache: 'no-store', headers: { 'X-Storage-Projection': '1' }, signal: AbortSignal.timeout(Math.min(12_000, dependencies.requestTimeoutMs)) });
      const current: unknown = await refresh.json();
      if (!isStorageResponseContextCurrent(context)) throw new StorageResponseActorChangedError();
      if (!refresh.ok || !isRecord(current) || !isRecord(current.value)) throw new Error('LIBRARY_REFRESH_PENDING');
      const storedBook = normalizeStudentLifeState(current.value.studentLife).books.find(book => book.id === (command.book.kind === 'existing' ? command.book.bookId : `library:${actor}:${command.requestId}`));
      const parsed = parseSuccess({ ...current, book: storedBook }, command, actor);
      if (!parsed) throw new Error('LIBRARY_REFRESH_PENDING');
      if (parsed.ok && parsed.value !== null && 'storagePatch' in current) {
        const accepted = acceptStorageProjection(context, { value: parsed.value, updatedAt: parsed.updatedAt, scope: 'student', storagePatch: parseStorageProjectionPatch(current.storagePatch) });
        return { ...parsed, value: accepted.value, updatedAt: accepted.updatedAt };
      }
      return parsed;
    } catch (error) {
      if (!isStorageResponseContextCurrent(context) || error instanceof StorageResponseActorChangedError) throw new StorageResponseActorChangedError();
      const book = isRecord(receipt.result) ? receipt.result.book : null;
      const confirmed = parseSuccess({ updatedAt: receipt.committedAt, book, value: { studentLife: { books: [book] } } }, command, actor);
      if (!confirmed?.ok) { markSaveRefreshPending(actor); throw new CanvasLibraryPlacementExpectedError({ code: 'LIBRARY_CONFIRMED_REFRESH_PENDING', retryable: true }); }
      markSaveRefreshPending(actor);
      return { ...confirmed, value: null, refreshPending: true };
    }
  };
  const readLegacyReceipt = async (draft: StudentSaveDraft): Promise<CanvasLibraryPlacementResult | null> => {
    if (!isRecord(draft.payload)) return null;
    const context = captureStorageResponseContext();
    const query = new URLSearchParams({ requestId: draft.requestId, receiptOnly: '1', studentNumber: String(draft.scope.studentNumber) });
    const response = await dependencies.fetcher(`/api/shared-settings?${query}`, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(Math.min(12_000, dependencies.requestTimeoutMs)) });
    let receipt: unknown;
    try { receipt = await response.json(); } catch (error) { if (response.ok) throw error; }
    if (!isStorageResponseContextCurrent(context)) throw new StorageResponseActorChangedError();
    if (!response.ok) {
      const retryAfterMs = featureRetryAfterMs(response);
      if (retryAfterMs && (response.status === 429 || response.status >= 500)) deferSaveRecoveryUntil(draft.scope.studentNumber, draft.requestId, retryAfterMs);
      throw new CanvasLibraryPlacementExpectedError({ code: 'LIBRARY_SAVE_FAILED', retryable: response.status >= 500 || response.status === 429, status: response.status, retryAfterMs });
    }
    if (isRecord(receipt) && receipt.status === 'unknown') return null;
    if (!isRecord(receipt) || receipt.status !== 'committed' || receipt.action !== 'placeLibraryBook') throw new CanvasLibraryPlacementExpectedError({ code: 'LIBRARY_LEGACY_CONFIRMATION_REQUIRED', retryable: false });
    let book = normalizeStudentLifeState({ books: [isRecord(receipt.result) ? receipt.result.book : null] }).books[0];
    if (!book) {
      query.delete('receiptOnly');
      const refresh = await dependencies.fetcher(`/api/shared-settings?${query}`, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(Math.min(12_000, dependencies.requestTimeoutMs)) });
      const current: unknown = await refresh.json();
      if (!isStorageResponseContextCurrent(context)) throw new StorageResponseActorChangedError();
      const bookId = isRecord(draft.payload.book) && draft.payload.book.kind === 'existing' ? draft.payload.book.bookId : `library:${draft.scope.studentNumber}:${draft.requestId}`;
      book = isRecord(current) && isRecord(current.value) ? normalizeStudentLifeState(current.value.studentLife).books.find(entry => entry.id === bookId) : undefined;
    }
    // Old requests omitted the selected slot. Recover it only from a matching committed book, never from a new selection.
    const parsed = parseLibraryPlacementCommand({ action: 'placeLibraryBook', requestId: draft.requestId, slotId: book?.librarySlot, book: draft.payload.book,
      ...(typeof draft.payload.seasonId === 'string' ? { seasonId: draft.payload.seasonId } : {}) });
    if (!parsed.ok) throw new CanvasLibraryPlacementExpectedError({ code: 'LIBRARY_LEGACY_CONFIRMATION_REQUIRED', retryable: false });
    return readReceipt(parsed.command, draft.scope.studentNumber);
  };
  const placeBook = async (draft: LibraryBookDraft, slotId: number, seasonId?: string): Promise<CanvasLibraryPlacementResult> => {
    if (dependencies.dataMode === 'readonly') return failure('READ_ONLY_DATA_MODE');
    const originalContext = captureStorageResponseContext();
    const key = `${seasonId ?? 'legacy'}:${draftKey(draft)}`;
    const scope = { studentNumber: draft.studentNumber, feature: 'library-placement', entityId: key };
    await pendingDrafts.ready();
    const existing = pendingDrafts.load(scope);
    const pending = await pendingDrafts.saveDurable(scope, { book: makeCommand(draft, slotId, '').book, slotId, seasonId: seasonId ?? null, expectedStudentNumber: draft.studentNumber });
    if (pending.status === 'invalid' || !isRecord(pending.draft.payload)) return failure('INVALID_LIBRARY_COMMAND');
    const requestId = pending.draft.requestId;
    const payload = pending.draft.payload;
    if (existing && (typeof payload.slotId !== 'number' || payload.expectedStudentNumber !== draft.studentNumber) && dependencies.dataMode !== 'mock' && dependencies.isSharedConfigured) {
      try {
        const confirmed = await readLegacyReceipt(pending.draft);
        if (confirmed?.ok) { await pendingDrafts.confirmDurable(scope, requestId); dependencies.invalidateSharedCache(); return confirmed; }
        return failure('LIBRARY_LEGACY_CONFIRMATION_REQUIRED');
      } catch (error) {
        if (error instanceof StorageResponseActorChangedError) throw error;
        return failure('LIBRARY_LEGACY_CONFIRMATION_REQUIRED');
      }
    }
    const parsedCommand = parseLibraryPlacementCommand({ action: 'placeLibraryBook', requestId, book: payload.book,
      slotId: typeof payload.slotId === 'number' ? payload.slotId : slotId,
      ...(typeof payload.seasonId === 'string' ? { seasonId: payload.seasonId } : {}) });
    if (!parsedCommand.ok) return failure('INVALID_LIBRARY_COMMAND');
    const command = parsedCommand.command;
    if (!isStorageResponseContextCurrent(originalContext)) throw new StorageResponseActorChangedError();
    if (existing && dependencies.dataMode !== 'mock' && dependencies.isSharedConfigured) {
      try {
        const confirmed = await readReceipt(command, draft.studentNumber);
        if (confirmed?.ok) { await pendingDrafts.confirmDurable(scope, requestId); dependencies.invalidateSharedCache(); return confirmed; }
      } catch (error) {
        if (error instanceof StorageResponseActorChangedError) throw error;
        if (error instanceof CanvasLibraryPlacementExpectedError) return failure(error.code, error.status, error.retryAfterMs);
        // The original command remains intact; user retry may send only that same request.
      }
    }

    if (dependencies.dataMode !== 'mock' && dependencies.isSharedConfigured) {
      const delay = getSaveRecoveryDelay(draft.studentNumber, requestId);
      if (delay > 0) return failure('LIBRARY_SAVE_FAILED', 429, delay);
      const responseContext = captureStorageResponseContext();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), dependencies.requestTimeoutMs);
      try {
        const response = await dependencies.fetcher('/api/shared-settings', {
          method: 'PUT',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json', 'X-Storage-Projection': '1' },
          body: JSON.stringify({ ...command, expectedStudentNumber: payload.expectedStudentNumber, protocolVersion: 2 }),
          signal: controller.signal,
        });
        if (!isStorageResponseContextCurrent(responseContext)) throw new StorageResponseActorChangedError();
        const retryAfterMs = featureRetryAfterMs(response);
        if (!response.ok && retryAfterMs && (response.status === 429 || response.status >= 500)) deferSaveRecoveryUntil(draft.studentNumber, requestId, retryAfterMs);
        let body: unknown;
        try {
          body = await response.json();
        } catch {
          if (!isStorageResponseContextCurrent(responseContext)) throw new StorageResponseActorChangedError();
          return failure('INVALID_LIBRARY_RESPONSE', response.ok ? undefined : response.status, featureRetryAfterMs(response));
        }
        if (!isStorageResponseContextCurrent(responseContext)) throw new StorageResponseActorChangedError();
        if (!response.ok) {
          const error = { code: isRecord(body) ? body.error : undefined, status: response.status };
          const availability = getStorageAvailability(error);
          if (availability && publishStorageAvailability(error, responseContext)) return failure(availability === 'maintenance' ? 'LIBRARY_STORAGE_MAINTENANCE' : 'LIBRARY_STORAGE_UPDATE_REQUIRED');
          const code = parseServerError(body) ?? 'INVALID_LIBRARY_RESPONSE';
          if (response.status < 500 && ['LIBRARY_SLOT_OCCUPIED', 'LIBRARY_FULL', 'LIBRARY_BOOK_FORBIDDEN', 'LIBRARY_SEASON_CHANGED', 'INVALID_LIBRARY_COMMAND'].includes(code)) await pendingDrafts.confirmDurable(scope, requestId);
          return failure(code, response.status, featureRetryAfterMs(response));
        }
        const parsed = parseSuccess(body, command, draft.studentNumber);
        if (!parsed) return failure('INVALID_LIBRARY_RESPONSE');
        if (parsed.ok && parsed.value !== null && isRecord(body) && 'storagePatch' in body) {
          let storagePatch;
          try { storagePatch = parseStorageProjectionPatch(body.storagePatch); }
          catch { return failure('INVALID_LIBRARY_RESPONSE'); }
          const accepted = acceptStorageProjection(responseContext, { value: parsed.value, updatedAt: parsed.updatedAt, scope: 'student', storagePatch });
          await pendingDrafts.confirmDurable(scope, requestId);
          dependencies.invalidateSharedCache();
          return { ...parsed, value: accepted.value, updatedAt: accepted.updatedAt };
        }
        await pendingDrafts.confirmDurable(scope, requestId);
        dependencies.invalidateSharedCache();
        return parsed;
      } catch (error) {
        if (!isStorageResponseContextCurrent(responseContext) || error instanceof StorageResponseActorChangedError) throw new StorageResponseActorChangedError();
        if (error instanceof Error) {
          try { const confirmed = await readReceipt(command, draft.studentNumber);
            if (confirmed?.ok) { await pendingDrafts.confirmDurable(scope, requestId); dependencies.invalidateSharedCache(); return confirmed; }
          } catch (confirmationError) {
            if (confirmationError instanceof StorageResponseActorChangedError) throw confirmationError;
            if (confirmationError instanceof CanvasLibraryPlacementExpectedError) return failure(confirmationError.code, confirmationError.status, confirmationError.retryAfterMs);
          }
          return failure('LIBRARY_NETWORK_FAILED');
        }
        throw error;
      } finally {
        clearTimeout(timeoutId);
      }
    }

    return dependencies.withLocalLock(async () => {
      const snapshot = dependencies.loadLocalSnapshot();
      const result = applyLibraryPlacementCommand(snapshot, draft.studentNumber, command, dependencies.now());
      if (result.ok === false) return failure(result.error.code);
      if (!dependencies.storeLocalSnapshot(result.value)) return failure('LIBRARY_LOCAL_SAVE_FAILED');
      const placedBook = toPlacedBook(result.book);
      if (!placedBook) return failure('INVALID_LIBRARY_RESPONSE');
      await pendingDrafts.confirmDurable(scope, requestId);
      return {
        ok: true,
        book: result.book,
        placedBook,
        updatedAt: dependencies.now(),
        value: result.value,
      };
    });
  };

  return {
    placeBook: (draft: LibraryBookDraft, slotId: number, seasonId?: string) => {
      const context = captureStorageResponseContext();
      if (dependencies.dataMode === 'production' && context.actor !== null && context.actor !== String(draft.studentNumber)) return Promise.reject(new StorageResponseActorChangedError());
      return serializeStudentSave(draft.studentNumber, () => {
        if (!isStorageResponseContextCurrent(context)) throw new StorageResponseActorChangedError();
        return placeBook(draft, slotId, seasonId);
      }).finally(notifySaveRecovery);
    },
    list: async (actor: number) => {
      await pendingDrafts.ready();
      return pendingDrafts.list(actor).flatMap((entry) => {
        if (entry.scope.feature !== 'library-placement' || !isRecord(entry.payload) || typeof entry.payload.slotId !== 'number' || entry.payload.expectedStudentNumber !== actor) return [];
        const parsed = parseLibraryPlacementCommand({ action: 'placeLibraryBook', requestId: entry.requestId, slotId: entry.payload.slotId, book: entry.payload.book,
          ...(typeof entry.payload.seasonId === 'string' ? { seasonId: entry.payload.seasonId } : {}) });
        return parsed.ok ? [{ draft: entry, command: parsed.command }] : [];
      });
    },
    readReceipt,
    readLegacyReceipt,
    listLegacy: async (actor: number) => { await pendingDrafts.ready(); return pendingDrafts.list(actor).filter(entry => entry.scope.feature === 'library-placement' && isRecord(entry.payload) && (typeof entry.payload.slotId !== 'number' || entry.payload.expectedStudentNumber !== actor)); },
    pendingForDraft: (draft: LibraryBookDraft, seasonId?: string) => pendingDrafts.load({ studentNumber: draft.studentNumber, feature: 'library-placement', entityId: `${seasonId ?? 'legacy'}:${draftKey(draft)}` }),
    confirm: pendingDrafts.confirmDurable,
  };
};

const withBrowserLocalLock: CanvasLibraryClientDependencies['withLocalLock'] = async (action) => {
  if (typeof navigator === 'undefined' || !navigator.locks) return action();
  return navigator.locks.request('school-timer-canvas-library:place', action);
};

const defaultClient = createCanvasLibraryClient({
  dataMode: appDataMode,
  isSharedConfigured: isSupabaseSettingsEnabled,
  createRequestId: createBrowserRequestId,
  now: () => new Date().toISOString(),
  requestTimeoutMs: 45_000,
  fetcher: (input, init) => fetch(input, init),
  loadLocalSnapshot: loadLibraryLocalSnapshot,
  storeLocalSnapshot: storeLibraryLocalSnapshot,
  invalidateSharedCache: invalidateSharedSettingsCache,
  withLocalLock: withBrowserLocalLock,
});

const placeCanvasLibraryBookWithoutReporting = async (draft: LibraryBookDraft, slotId: number, seasonId?: string): Promise<CanvasLibraryPlacementResult> => {
  if (appDataMode !== 'readonly' && (appDataMode === 'mock' || !isSupabaseSettingsEnabled)) {
    try {
      const latest = await libraryCompetitionClient.read('enter');
      if (latest.rolledOver || (latest.competition.state && latest.competition.state.seasonId !== seasonId)) return failure('LIBRARY_SEASON_CHANGED');
    } catch (error) {
      if (error instanceof LibraryCompetitionClientError) return failure('LIBRARY_LOCAL_SAVE_FAILED');
      throw error;
    }
  }
  return defaultClient.placeBook(draft, slotId, seasonId);
};

export const placeCanvasLibraryBook = async (draft: LibraryBookDraft, slotId: number, seasonId?: string): Promise<CanvasLibraryPlacementResult> => {
  const result = await withSaveFailureReporting('library', () => placeCanvasLibraryBookWithoutReporting(draft, slotId, seasonId), draft.studentNumber);
  if (result.ok === false) {
    const code = result.error.code;
    const pending = defaultClient.pendingForDraft(draft, seasonId);
    if (appDataMode === 'production' && seasonId && pending && ['LIBRARY_NETWORK_FAILED', 'LIBRARY_SAVE_FAILED', 'INVALID_LIBRARY_RESPONSE'].includes(code)
      && deferSaveFailure('library', new CanvasLibraryPlacementExpectedError(result.error), draft.studentNumber, { requestId: pending.draft.requestId, stage: 'write', retryCount: 0 })) return result;
    if (code === 'LIBRARY_LOCAL_SAVE_FAILED') reportSaveFailure('library', 'storage', draft.studentNumber, { errorCode: code });
    else if (code === 'LIBRARY_SAVE_FAILED') reportSaveFailure('library', 'server', draft.studentNumber, { errorCode: code });
    else if (code === 'LIBRARY_NETWORK_FAILED') reportSaveFailure('library', 'network', draft.studentNumber, { errorCode: code });
    else if (code === 'SHARED_SETTINGS_CONFLICT') reportSaveFailure('library', 'conflict', draft.studentNumber, { errorCode: code });
    else if (code === 'INVALID_LIBRARY_RESPONSE') reportSaveFailure('library', 'response', draft.studentNumber, { errorCode: code });
  }
  return result;
};

const pendingPlacementFor = async (actor: number, id: string) => {
  const context = captureStorageResponseContext();
  if (context.actor !== null && context.actor !== String(actor)) throw new StorageResponseActorChangedError();
  const pending = (await defaultClient.list(actor)).find(entry => entry.draft.requestId === id);
  const legacy = pending ? undefined : (await defaultClient.listLegacy(actor)).find(entry => entry.requestId === id);
  if (!isStorageResponseContextCurrent(context)) throw new StorageResponseActorChangedError();
  return pending ?? (legacy ? { draft: legacy, command: null } : undefined);
};
registerSaveRecoveryAdapter({
  id: 'library-placement',
  list: async (actor) => appDataMode !== 'production' ? [] : [...(await defaultClient.list(actor)).map(({ draft, command }) => ({
    id: draft.requestId, actor, feature: 'library', createdAt: draft.createdAt,
    mode: command.seasonId ? 'automatic' as const : 'confirm-only' as const, contextKey: command.seasonId,
  })), ...(await defaultClient.listLegacy(actor)).map(draft => ({ id: draft.requestId, actor, feature: 'library', createdAt: draft.createdAt, mode: 'confirm-only' as const }))],
  eligible: entry => entry.actor > 0 && entry.contextKey === new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }).slice(0, 7),
  confirm: async (entry) => {
    const stored = await pendingPlacementFor(entry.actor, entry.id);
    if (!stored) return true;
    const receipt = stored.command ? await defaultClient.readReceipt(stored.command, entry.actor) : await defaultClient.readLegacyReceipt(stored.draft);
    if (!receipt?.ok) return false;
    await defaultClient.confirm(stored.draft.scope, entry.id);
    return true;
  },
  retry: async (entry) => {
    const stored = await pendingPlacementFor(entry.actor, entry.id);
    if (!stored) return;
    const { command } = stored;
    if (!command) throw new CanvasLibraryPlacementExpectedError({ code: 'LIBRARY_LEGACY_CONFIRMATION_REQUIRED', retryable: false });
    let draft: LibraryBookDraft;
    if (command.book.kind === 'new') draft = { studentNumber: entry.actor, ...command.book };
    else {
      const latest = await libraryCompetitionClient.read('enter');
      const book = normalizeStudentLifeState(latest.value?.studentLife).books.find(book => book.id === (command.book.kind === 'existing' ? command.book.bookId : ''));
      if (!book) throw new Error('LIBRARY_BOOK_FORBIDDEN');
      draft = { studentNumber: entry.actor, bookId: book.id, title: book.title, author: book.author, pageCount: book.pageCount, ...(book.reflection ? { reflection: book.reflection } : {}) };
    }
    const result = await defaultClient.placeBook(draft, command.slotId, command.seasonId);
    if (result.ok === false) throw new CanvasLibraryPlacementExpectedError(result.error);
  },
});
