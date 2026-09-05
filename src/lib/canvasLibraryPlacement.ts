import { createBookStackMissionEntry } from './bookStackMission.js';
import { appendLibraryCompetitionPlacement, parseLibraryCompetitionState } from './libraryCompetition.js';
import {
  normalizeBookReflection,
  normalizeStudentLifeState,
  replaceStudentLifeBooksWithAuthoritative,
  type StudentBook,
  type StudentLifeState,
} from './studentLife.js';

export type LibraryPlacementCommand = {
  readonly action: 'placeLibraryBook';
  readonly requestId: string;
  readonly slotId: number;
  readonly seasonId?: string;
  readonly book:
    | { readonly kind: 'new'; readonly title: string; readonly author: string; readonly pageCount: number; readonly reflection?: string }
    | { readonly kind: 'existing'; readonly bookId: string };
};

export type LibraryPlacementErrorCode =
  | 'INVALID_LIBRARY_COMMAND'
  | 'LIBRARY_BOOK_FORBIDDEN'
  | 'LIBRARY_SLOT_OCCUPIED'
  | 'LIBRARY_FULL'
  | 'LIBRARY_SEASON_CHANGED'
  | 'LIBRARY_BOOK_ALREADY_PLACED';

export type LibraryPlacementError = {
  readonly status: 400 | 403 | 409;
  readonly code: LibraryPlacementErrorCode;
};

export type LibraryCommandParseResult =
  | { readonly ok: true; readonly command: LibraryPlacementCommand }
  | { readonly ok: false; readonly error: LibraryPlacementError };

export type LibraryPlacementResult =
  | {
    readonly ok: true;
    readonly book: StudentBook;
    readonly value: Record<string, unknown>;
    readonly studentLife: StudentLifeState;
    readonly applied: boolean;
    readonly awarded: boolean;
    readonly replayed: boolean;
  }
  | { readonly ok: false; readonly error: LibraryPlacementError };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIBRARY_CAPACITY = 100;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

const invalid = (): LibraryCommandParseResult => ({
  ok: false,
  error: { status: 400, code: 'INVALID_LIBRARY_COMMAND' },
});

const invalidPlacement = (): LibraryPlacementResult => ({
  ok: false,
  error: { status: 400, code: 'INVALID_LIBRARY_COMMAND' },
});

export const parseLibraryPlacementCommand = (value: unknown): LibraryCommandParseResult => {
  if (!isRecord(value) || !hasExactKeys(value, ['action', 'requestId', 'slotId', 'book', ...('seasonId' in value ? ['seasonId'] : [])])) return invalid();
  if ('seasonId' in value && (typeof value.seasonId !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value.seasonId))) return invalid();
  const season = typeof value.seasonId === 'string' ? { seasonId: value.seasonId } : {};
  if (value.action !== 'placeLibraryBook' || typeof value.requestId !== 'string' || !UUID_PATTERN.test(value.requestId)) return invalid();
  if (typeof value.slotId !== 'number' || !Number.isInteger(value.slotId) || value.slotId < 0 || value.slotId >= LIBRARY_CAPACITY) return invalid();
  if (!isRecord(value.book) || typeof value.book.kind !== 'string') return invalid();

  if (value.book.kind === 'new') {
    if (!hasExactKeys(value.book, ['kind', 'title', 'author', 'pageCount', ...('reflection' in value.book ? ['reflection'] : [])])) return invalid();
    if (typeof value.book.title !== 'string' || typeof value.book.author !== 'string') return invalid();
    const title = value.book.title.trim();
    const author = value.book.author.trim();
    if (title.length < 1 || title.length > 50 || author.length < 1 || author.length > 30) return invalid();
    const reflection = normalizeBookReflection(value.book.reflection);
    if ('reflection' in value.book && reflection === null) return invalid();
    if (typeof value.book.pageCount !== 'number' || !Number.isInteger(value.book.pageCount)
      || value.book.pageCount < (reflection === null ? 1 : 0) || value.book.pageCount > 5000) return invalid();
    return {
      ok: true,
      command: {
        action: 'placeLibraryBook',
        requestId: value.requestId,
        slotId: value.slotId,
        ...season,
        book: { kind: 'new', title, author, pageCount: value.book.pageCount, ...(reflection === null ? {} : { reflection }) },
      },
    };
  }

  if (value.book.kind === 'existing') {
    if (!hasExactKeys(value.book, ['kind', 'bookId']) || typeof value.book.bookId !== 'string') return invalid();
    const bookId = value.book.bookId.trim();
    if (bookId.length < 1 || bookId.length > 80) return invalid();
    return {
      ok: true,
      command: {
        action: 'placeLibraryBook',
        requestId: value.requestId,
        slotId: value.slotId,
        ...season,
        book: { kind: 'existing', bookId },
      },
    };
  }

  return invalid();
};

const placementError = (
  status: LibraryPlacementError['status'],
  code: LibraryPlacementErrorCode,
): LibraryPlacementResult => ({ ok: false, error: { status, code } });

const toSettingsRecord = (value: unknown): Record<string, unknown> => (
  isRecord(value) ? { ...value } : {}
);

const success = (
  value: Record<string, unknown>,
  studentLife: StudentLifeState,
  book: StudentBook,
  applied: boolean,
  awarded: boolean,
  replayed: boolean,
): LibraryPlacementResult => ({
  ok: true,
  value: { ...value, studentLife },
  studentLife,
  book,
  applied,
  awarded,
  replayed,
});

const applyPlacement = (
  value: unknown,
  studentNumber: unknown,
  rawCommand: unknown,
  serverTimestamp: string,
): LibraryPlacementResult => {
  const parsed = parseLibraryPlacementCommand(rawCommand);
  if (parsed.ok === false) return { ok: false, error: parsed.error };
  if (typeof studentNumber !== 'number' || !Number.isInteger(studentNumber) || studentNumber < 1 || studentNumber > 23) return invalidPlacement();
  if (typeof serverTimestamp !== 'string' || !Number.isFinite(Date.parse(serverTimestamp))) return invalidPlacement();

  const command = parsed.command;
  const current = toSettingsRecord(value);
  const competition = toSettingsRecord(current.libraryCompetition);
  if (typeof competition.seasonId === 'string' && command.seasonId !== competition.seasonId) {
    return placementError(409, 'LIBRARY_SEASON_CHANGED');
  }
  const studentLife = normalizeStudentLifeState(current.studentLife);

  if (command.book.kind === 'new') {
    const id = `library:${studentNumber}:${command.requestId}`;
    const existingBooks = studentLife.books.filter((book) => book.id === id);
    if (existingBooks.length > 0) {
      if (existingBooks.length !== 1) return placementError(400, 'INVALID_LIBRARY_COMMAND');
      const existing = existingBooks[0];
      const matches = existing.studentNumber === studentNumber
        && existing.title === command.book.title
        && existing.author === command.book.author
        && existing.pageCount === command.book.pageCount
        && existing.reflection === command.book.reflection
        && existing.librarySlot === command.slotId;
      return matches
        ? success(current, studentLife, existing, false, false, true)
        : placementError(400, 'INVALID_LIBRARY_COMMAND');
    }
  } else {
    const bookId = command.book.bookId;
    const existingBooks = studentLife.books.filter((book) => book.id === bookId);
    if (existingBooks.length !== 1 || existingBooks[0]?.studentNumber !== studentNumber) {
      return placementError(403, 'LIBRARY_BOOK_FORBIDDEN');
    }
    const existing = existingBooks[0];
    if (existing.librarySlot !== undefined) {
      return existing.librarySlot === command.slotId
        ? success(current, studentLife, existing, false, false, true)
        : placementError(409, 'LIBRARY_BOOK_ALREADY_PLACED');
    }
  }

  const placedCount = studentLife.books.filter((book) => book.librarySlot !== undefined).length;
  if (placedCount >= LIBRARY_CAPACITY) return placementError(409, 'LIBRARY_FULL');
  if (studentLife.books.some((book) => book.librarySlot === command.slotId)) {
    return placementError(409, 'LIBRARY_SLOT_OCCUPIED');
  }

  if (command.book.kind === 'new') {
    const id = `library:${studentNumber}:${command.requestId}`;
    const entry = createBookStackMissionEntry(current, {
      id,
      studentNumber,
      title: command.book.title,
      author: command.book.author,
      pageCount: command.book.pageCount,
      ...(command.book.reflection === undefined ? {} : { reflection: command.book.reflection }),
      createdAt: serverTimestamp,
      librarySlot: command.slotId,
    });
    const book = entry.studentLife.books.find((candidate) => candidate.id === id);
    if (!book) return invalidPlacement();
    return success(entry.value, entry.studentLife, book, true, entry.awarded, false);
  }

  if (command.book.kind !== 'existing') return invalidPlacement();
  const bookId = command.book.bookId;
  const books = studentLife.books.map((book) => (
    book.id === bookId ? { ...book, librarySlot: command.slotId } : book
  ));
  const placedLife = normalizeStudentLifeState({ ...studentLife, books });
  const book = placedLife.books.find((candidate) => candidate.id === bookId);
  if (!book) return placementError(403, 'LIBRARY_BOOK_FORBIDDEN');
  return success(current, placedLife, book, true, false, false);
};

export const applyLibraryPlacementCommand = (
  value: unknown,
  studentNumber: unknown,
  rawCommand: unknown,
  serverTimestamp: string,
): LibraryPlacementResult => {
  const result = applyPlacement(value, studentNumber, rawCommand, serverTimestamp);
  if (!result.ok || !result.applied) return result;
  const state = parseLibraryCompetitionState(result.value.libraryCompetition);
  return state ? { ...result, value: { ...result.value, libraryCompetition: appendLibraryCompetitionPlacement(state, { bookId: result.book.id, at: serverTimestamp }) } } : result;
};

export const replaceSnapshotBooksWithAuthoritative = (
  incomingValue: unknown,
  authoritativeValue: unknown,
): Record<string, unknown> => {
  const incoming = toSettingsRecord(incomingValue);
  const authoritative = toSettingsRecord(authoritativeValue);
  const { libraryCompetition: _incomingCompetition, ...unprotected } = incoming;
  return {
    ...unprotected,
    ...('libraryCompetition' in authoritative ? { libraryCompetition: authoritative.libraryCompetition } : {}),
    studentLife: replaceStudentLifeBooksWithAuthoritative(
      incoming.studentLife,
      authoritative.studentLife ?? {},
    ),
  };
};
