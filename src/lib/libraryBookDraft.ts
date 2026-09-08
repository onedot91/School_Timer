import type { LibraryBookDraft } from './canvasLibraryWorld.js';
import { setDraftReloadCheck, removeDraftReloadCheck } from './draftReloadSafety.js';
import { isStorageRecord } from './storageV2Codec.js';

export interface LibraryInputDraft {
  readonly title: string;
  readonly author: string;
  readonly reflection: string;
  readonly carried: LibraryBookDraft | null;
}
const memory = new Map<number, LibraryInputDraft>();
const durable = new Set<number>();
const keyFor = (studentNumber: number) => `school-timer-library-input-v1:${studentNumber}`;
const storage = (): Storage | null => { try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; } };
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
export const loadLibraryBookDraft = (studentNumber: number): LibraryInputDraft | null => {
  if (memory.has(studentNumber) && !durable.has(studentNumber)) return memory.get(studentNumber) ?? null;
  try {
    const destination = storage();
    const raw = destination?.getItem(keyFor(studentNumber));
    if (raw) {
      const loaded = parse(JSON.parse(raw), studentNumber);
      if (loaded) { memory.set(studentNumber, loaded); durable.add(studentNumber); return loaded; }
    } else if (destination && durable.has(studentNumber)) {
      memory.delete(studentNumber); durable.delete(studentNumber); removeDraftReloadCheck(keyFor(studentNumber));
    }
  } catch { return memory.get(studentNumber) ?? null; }
  return memory.get(studentNumber) ?? null;
};
export const saveLibraryBookDraft = (studentNumber: number, input: LibraryInputDraft): boolean => {
  if (!Number.isInteger(studentNumber) || studentNumber < 1 || studentNumber > 23 || !parse(input, studentNumber)) return false;
  const key = keyFor(studentNumber);
  if (!input.title && !input.author && !input.reflection && !input.carried) {
    memory.delete(studentNumber);
    durable.delete(studentNumber);
    removeDraftReloadCheck(key);
    try { storage()?.removeItem(key); return true; } catch { return false; }
  }
  memory.set(studentNumber, input);
  durable.delete(studentNumber);
  const serialized = JSON.stringify(input);
  setDraftReloadCheck(key, studentNumber, () => storage()?.getItem(key) === serialized);
  try { const destination = storage(); destination?.setItem(key, serialized); if (destination) durable.add(studentNumber); return destination !== null; } catch { return false; }
};
