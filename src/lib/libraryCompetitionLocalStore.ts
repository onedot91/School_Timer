import { createLibraryCompetition, getLibraryCompetitionMonth, parseLibraryCompetitionState,
  projectLibraryCompetition, adjustLibraryCompetition, getLibraryCompetitionSettings } from './libraryCompetition.js';
import type { LibraryCompetitionCount, LibraryCompetitionSpeed, LibraryCompetitionState } from './libraryCompetition.js';
import { isLibraryLocalRecord } from './libraryCompetitionLocalSnapshot.js';
import { parseLibraryLocalArchives } from './libraryCompetitionLocalArchive.js';
import { normalizeStudentLifeState } from './studentLife.js';
import { STUDENT_PET_STORAGE_KEY, loadStoredStudentPetSnapshot } from './studentPet.js';

export class LibraryCompetitionLocalError extends Error {
  readonly name = 'LibraryCompetitionLocalError';
  constructor(readonly code: 'LIBRARY_COMPETITION_CONFLICT' | 'LIBRARY_COMPETITION_UNAVAILABLE' | 'LIBRARY_COMPETITION_INVALID') {
    super(code);
  }
}
type StoreOptions = {
  readonly storage: Pick<Storage, 'getItem' | 'setItem'>;
  readonly now: () => string;
  readonly createSeed: () => string;
  readonly initialSnapshot?: () => Record<string, unknown>;
};
type Settings = { readonly expectedRevision: number; readonly speed: LibraryCompetitionSpeed;
  readonly paused: boolean; readonly counts: readonly LibraryCompetitionCount[] };

export function createLibraryCompetitionLocalStore(options: StoreOptions) {
  const load = (): Record<string, unknown> => {
    try {
      const saved = options.storage.getItem(STUDENT_PET_STORAGE_KEY);
      if (!saved) return options.initialSnapshot?.() ?? {};
      const value: unknown = JSON.parse(saved);
      if (!isLibraryLocalRecord(value)) throw new LibraryCompetitionLocalError('LIBRARY_COMPETITION_INVALID');
      return { ...options.initialSnapshot?.(), ...value };
    } catch (error) {
      if (error instanceof LibraryCompetitionLocalError) throw error;
      if (error instanceof Error) throw new LibraryCompetitionLocalError('LIBRARY_COMPETITION_UNAVAILABLE');
      throw error;
    }
  };
  const store = (value: Record<string, unknown>): boolean => {
    try {
      const previous = load();
      options.storage.setItem(STUDENT_PET_STORAGE_KEY, JSON.stringify({ ...value,
        ...(value.libraryCompetitionArchives === undefined && previous.libraryCompetitionArchives !== undefined
          ? { libraryCompetitionArchives: previous.libraryCompetitionArchives } : {}),
      }));
      return true;
    } catch (error) {
      if (error instanceof Error) return false;
      throw error;
    }
  };
  const requireState = (value: Record<string, unknown>) => {
    if (value.libraryCompetition === undefined || value.libraryCompetition === null) return null;
    const state = parseLibraryCompetitionState(value.libraryCompetition);
    if (!state) throw new LibraryCompetitionLocalError('LIBRARY_COMPETITION_INVALID');
    return state;
  };
  const response = (value: Record<string, unknown>, state: LibraryCompetitionState | null, serverAt: string, rolledOver = false) => ({
    competition: { state, standings: state ? projectLibraryCompetition(state, serverAt) : [], serverAt },
    value, updatedAt: typeof value.libraryCompetitionUpdatedAt === 'string' ? value.libraryCompetitionUpdatedAt : serverAt, rolledOver,
  });
  const read = (intent: 'open' | 'enter' | 'readonly') => {
    const value = load();
    const state = requireState(value);
    const at = options.now();
    const month = getLibraryCompetitionMonth(at);
    const rolledOver = state !== null && state.seasonId < month;
    if (intent === 'readonly' || (state === null && intent === 'enter') || (state !== null && !rolledOver)) {
      return response(value, state, at);
    }
    const archives = parseLibraryLocalArchives(value.libraryCompetitionArchives);
    if (!archives) throw new LibraryCompetitionLocalError('LIBRARY_COMPETITION_INVALID');
    const studentLife = normalizeStudentLifeState(value.studentLife);
    const books = studentLife.books.filter(book => book.librarySlot !== undefined);
    const next = { ...createLibraryCompetition({ seasonId: month, seed: options.createSeed(), startedAt: at,
      bookIds: rolledOver ? [] : books.map(book => book.id) }), revision: state ? state.revision + 1 : 0,
      adjustments: state ? [{ id: `${month}:inherited-settings`, at, ...getLibraryCompetitionSettings(state, at), counts: [] }] : [],
    };
    const archive = state ? { seasonId: state.seasonId, archivedAt: at,
      standings: projectLibraryCompetition(state, at), books } : null;
    if (archive && archives.some(previous => previous.seasonId === archive.seasonId)) {
      throw new LibraryCompetitionLocalError('LIBRARY_COMPETITION_INVALID');
    }
    const updated = { ...value, libraryCompetition: next, libraryCompetitionUpdatedAt: at,
      libraryCompetitionArchives: archive ? [...archives, archive] : archives,
      studentLife: { ...studentLife, books: rolledOver ? studentLife.books.filter(book => book.librarySlot === undefined) : studentLife.books },
    };
    if (!store(updated)) throw new LibraryCompetitionLocalError('LIBRARY_COMPETITION_UNAVAILABLE');
    return response(updated, next, at, rolledOver);
  };
  const history = (month?: string) => {
    const archives = parseLibraryLocalArchives(load().libraryCompetitionArchives);
    if (!archives) throw new LibraryCompetitionLocalError('LIBRARY_COMPETITION_INVALID');
    return { months: archives.map(({ seasonId, archivedAt }) => ({ seasonId, archivedAt })).sort((a, b) => b.seasonId.localeCompare(a.seasonId)),
      archive: month === undefined ? null : archives.find(archive => archive.seasonId === month) ?? null };
  };
  const settings = (input: Settings) => {
    const current = read('enter');
    const state = current.competition?.state;
    if (!state) throw new LibraryCompetitionLocalError('LIBRARY_COMPETITION_UNAVAILABLE');
    if (current.rolledOver || state.revision !== input.expectedRevision) throw new LibraryCompetitionLocalError('LIBRARY_COMPETITION_CONFLICT');
    const at = options.now();
    const next = adjustLibraryCompetition(state, { id: `${state.seasonId}:${state.revision + 1}:${at}`, at,
      speed: input.speed, paused: input.paused, counts: input.counts });
    const updated = { ...current.value, libraryCompetition: next, libraryCompetitionUpdatedAt: at };
    if (!store(updated)) throw new LibraryCompetitionLocalError('LIBRARY_COMPETITION_UNAVAILABLE');
    return response(updated, next, at);
  };
  return { read, history, settings, load, store };
}

function browserStore() {
  if (typeof window === 'undefined') throw new LibraryCompetitionLocalError('LIBRARY_COMPETITION_UNAVAILABLE');
  return createLibraryCompetitionLocalStore({ storage: window.localStorage, now: () => new Date().toISOString(),
    createSeed: () => crypto.randomUUID(), initialSnapshot: () => ({ ...loadStoredStudentPetSnapshot() }) });
}
export const readLocalLibraryCompetition = (intent: 'open' | 'enter' | 'readonly') => browserStore().read(intent);
export const readLocalLibraryCompetitionHistory = (month?: string) => browserStore().history(month);
export const settingsLocalLibraryCompetition = (input: Settings) => browserStore().settings(input);
export const loadLibraryLocalSnapshot = (): Record<string, unknown> => {
  const stored = browserStore().load();
  return { ...loadStoredStudentPetSnapshot(), ...stored };
};
export const storeLibraryLocalSnapshot = (value: Record<string, unknown>): boolean => browserStore().store(value);
