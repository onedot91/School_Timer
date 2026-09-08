import { CLASSWORD_INITIALS, type ClasswordInitial } from './classword';

export type ClasswordDraft = {
  readonly initial: ClasswordInitial | null;
  readonly word: string;
};

export const EMPTY_CLASSWORD_DRAFT: ClasswordDraft = { initial: null, word: '' };

const draftKey = (studentNumber: number, dateKey: string): string => (
  `school-timer-classword-draft-v1:${studentNumber}:${dateKey}`
);

export const loadClasswordDraft = (storage: Storage, studentNumber: number, dateKey: string): ClasswordDraft => {
  try {
    const value: unknown = JSON.parse(storage.getItem(draftKey(studentNumber, dateKey)) ?? 'null');
    if (!value || typeof value !== 'object') return EMPTY_CLASSWORD_DRAFT;
    const initial: unknown = Reflect.get(value, 'initial');
    const word: unknown = Reflect.get(value, 'word');
    const validInitial = CLASSWORD_INITIALS.find((candidate) => candidate === initial);
    if (!validInitial || typeof word !== 'string' || word.length > 32) return EMPTY_CLASSWORD_DRAFT;
    return { initial: validInitial, word };
  } catch { return EMPTY_CLASSWORD_DRAFT; }
};

export const storeClasswordDraft = (storage: Storage, studentNumber: number, dateKey: string, draft: ClasswordDraft): boolean => {
  try {
    const key = draftKey(studentNumber, dateKey);
    if (draft.initial === null) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(draft));
    return true;
  } catch { return false; }
};
