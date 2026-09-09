import type { LibraryBookDraft } from './canvasLibraryWorld.js';
import { browserDraftStorage, createFeatureInputDraftStore } from './featureInputDraft.js';
import { isStorageRecord } from './storageV2Codec.js';

export interface LibraryInputDraft {
  readonly title: string;
  readonly author: string;
  readonly reflection: string;
  readonly carried: LibraryBookDraft | null;
}
const keyFor = (studentNumber: number) => `school-timer-library-input-v1:${studentNumber}`;
const parse = (value: unknown, studentNumber: number): LibraryInputDraft | null => {
  if (!isStorageRecord(value) || typeof value.title !== 'string' || typeof value.author !== 'string' || typeof value.reflection !== 'string') return null;
  if (value.title.length > 200 || value.author.length > 200 || value.reflection.length > 2000) return null;
  let carried: LibraryBookDraft | null = null;
  if (value.carried !== null) {
    const book = value.carried;
    if (!isStorageRecord(book) || book.studentNumber !== studentNumber || typeof book.title !== 'string' || typeof book.author !== 'string'
      || typeof book.pageCount !== 'number' || !Number.isInteger(book.pageCount) || book.pageCount < 0 || book.pageCount > 5000
      || (book.bookId !== undefined && typeof book.bookId !== 'string') || (book.reflection !== undefined && typeof book.reflection !== 'string')) return null;
    carried = { studentNumber, title: book.title, author: book.author, pageCount: book.pageCount,
      ...(typeof book.bookId === 'string' ? { bookId: book.bookId } : {}), ...(typeof book.reflection === 'string' ? { reflection: book.reflection } : {}) };
  }
  return { title: value.title, author: value.author, reflection: value.reflection, carried };
};
const inputStore = createFeatureInputDraftStore<LibraryInputDraft>((value, scope) => parse(value, scope.studentNumber));
const scopeFor = (studentNumber: number) => ({ studentNumber, feature: 'library-input', entityId: 'registration' });
const legacy = (studentNumber: number) => () => JSON.parse(browserDraftStorage()?.getItem(keyFor(studentNumber)) ?? 'null');
const nonempty = (value: LibraryInputDraft | null): LibraryInputDraft | null => (
  value && (value.title || value.author || value.reflection || value.carried) ? value : null
);
export const loadLibraryBookDraft = (studentNumber: number): LibraryInputDraft | null => (
  nonempty(inputStore.load(browserDraftStorage(), scopeFor(studentNumber), legacy(studentNumber))?.value ?? null)
);
export const readyLibraryBookDraft = async (studentNumber: number): Promise<LibraryInputDraft | null> => (
  nonempty((await inputStore.ready(browserDraftStorage(), scopeFor(studentNumber), legacy(studentNumber)))?.value ?? null)
);
export const libraryBookDraftVersion = (studentNumber: number): string | null => (
  inputStore.load(browserDraftStorage(), scopeFor(studentNumber), legacy(studentNumber))?.version ?? null
);
export const confirmLibraryBookDraft = (studentNumber: number, version: string): Promise<boolean> => (
  inputStore.confirm(browserDraftStorage(), scopeFor(studentNumber), version)
);
export const saveLibraryBookDraft = (studentNumber: number, input: LibraryInputDraft): boolean => (
  Number.isInteger(studentNumber) && studentNumber >= 1 && studentNumber <= 23
    && inputStore.save(browserDraftStorage(), scopeFor(studentNumber), input)
);

export const settleLibraryBookDraft = (studentNumber: number) => inputStore.settled(browserDraftStorage(), scopeFor(studentNumber));
