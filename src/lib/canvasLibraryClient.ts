import { applyLibraryPlacementCommand, type LibraryPlacementCommand } from './canvasLibraryPlacement.js';
import { appDataMode, type AppDataMode } from './dataMode.js';
import { createBrowserRequestId } from './requestId.js';
import { normalizeBookReflection, normalizeStudentLifeState, type StudentBook } from './studentLife.js';
import { loadLibraryLocalSnapshot, storeLibraryLocalSnapshot } from './libraryCompetitionLocalStore.js';
import { libraryCompetitionClient, LibraryCompetitionClientError } from './libraryCompetitionClient.js';
import { invalidateSharedSettingsCache, isSupabaseSettingsEnabled } from './supabaseSettings.js';
import type { LibraryBookDraft, LibraryPlacedBook } from './canvasLibraryWorld.js';

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
  | 'LIBRARY_LOCAL_SAVE_FAILED';

export type CanvasLibraryPlacementResult =
  | {
    readonly ok: true;
    readonly book: StudentBook;
    readonly placedBook: LibraryPlacedBook;
    readonly updatedAt: string;
    readonly value: Record<string, unknown>;
  }
  | {
    readonly ok: false;
    readonly error: {
      readonly code: CanvasLibraryPlacementErrorCode;
      readonly retryable: boolean;
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
  LIBRARY_LOCAL_SAVE_FAILED: '이 기기에 책을 저장하지 못했어요. 저장 공간을 확인해 주세요.',
};

export class CanvasLibraryPlacementExpectedError extends Error {
  readonly code: CanvasLibraryPlacementErrorCode;
  readonly retryable: boolean;

  constructor(error: { readonly code: CanvasLibraryPlacementErrorCode; readonly retryable: boolean }) {
    super(ERROR_MESSAGES[error.code]);
    this.name = 'CanvasLibraryPlacementExpectedError';
    this.code = error.code;
    this.retryable = error.retryable;
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
]);

const failure = (code: CanvasLibraryPlacementErrorCode): CanvasLibraryPlacementResult => ({
  ok: false,
  error: { code, retryable: !nonRetryableCodes.has(code) },
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
  const pendingRequestIds = new Map<string, string>();

  const placeBook = async (draft: LibraryBookDraft, slotId: number, seasonId?: string): Promise<CanvasLibraryPlacementResult> => {
    if (dependencies.dataMode === 'readonly') return failure('READ_ONLY_DATA_MODE');
    const key = `${seasonId ?? 'legacy'}:${draftKey(draft)}`;
    const requestId = pendingRequestIds.get(key) ?? dependencies.createRequestId();
    pendingRequestIds.set(key, requestId);
    const command = { ...makeCommand(draft, slotId, requestId), ...(seasonId ? { seasonId } : {}) };

    if (dependencies.dataMode !== 'mock' && dependencies.isSharedConfigured) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), dependencies.requestTimeoutMs);
      try {
        const response = await dependencies.fetcher('/api/shared-settings', {
          method: 'PUT',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(command),
          signal: controller.signal,
        });
        let body: unknown;
        try {
          body = await response.json();
        } catch {
          return failure('INVALID_LIBRARY_RESPONSE');
        }
        if (!response.ok) return failure(parseServerError(body) ?? 'INVALID_LIBRARY_RESPONSE');
        const parsed = parseSuccess(body, command, draft.studentNumber);
        if (!parsed) return failure('INVALID_LIBRARY_RESPONSE');
        pendingRequestIds.delete(key);
        dependencies.invalidateSharedCache();
        return parsed;
      } catch (error) {
        if (error instanceof Error) return failure('LIBRARY_NETWORK_FAILED');
        throw error;
      } finally {
        clearTimeout(timeoutId);
      }
    }

    return dependencies.withLocalLock(() => {
      const snapshot = dependencies.loadLocalSnapshot();
      const result = applyLibraryPlacementCommand(snapshot, draft.studentNumber, command, dependencies.now());
      if (result.ok === false) return failure(result.error.code);
      if (!dependencies.storeLocalSnapshot(result.value)) return failure('LIBRARY_LOCAL_SAVE_FAILED');
      const placedBook = toPlacedBook(result.book);
      if (!placedBook) return failure('INVALID_LIBRARY_RESPONSE');
      pendingRequestIds.delete(key);
      return {
        ok: true,
        book: result.book,
        placedBook,
        updatedAt: dependencies.now(),
        value: result.value,
      };
    });
  };

  return { placeBook };
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
  requestTimeoutMs: 10_000,
  fetcher: (input, init) => fetch(input, init),
  loadLocalSnapshot: loadLibraryLocalSnapshot,
  storeLocalSnapshot: storeLibraryLocalSnapshot,
  invalidateSharedCache: invalidateSharedSettingsCache,
  withLocalLock: withBrowserLocalLock,
});

export const placeCanvasLibraryBook = async (draft: LibraryBookDraft, slotId: number, seasonId?: string): Promise<CanvasLibraryPlacementResult> => {
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
