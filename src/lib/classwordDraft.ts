import { CLASSWORD_INITIALS, type ClasswordInitial } from './classword';
import { createFeatureInputDraftStore, type FeatureDraftStorage } from './featureInputDraft.js';

export type ClasswordDraft = {
  readonly initial: ClasswordInitial | null;
  readonly word: string;
};
export const EMPTY_CLASSWORD_DRAFT: ClasswordDraft = { initial: null, word: '' };
const scopeFor = (studentNumber: number, dateKey: string) => ({ studentNumber, feature: 'classword-input', entityId: dateKey });
const legacyKey = (studentNumber: number, dateKey: string) => `school-timer-classword-draft-v1:${studentNumber}:${dateKey}`;
const store = createFeatureInputDraftStore<ClasswordDraft>((value) => {
  if (!value || typeof value !== 'object') return null;
  const initial: unknown = Reflect.get(value, 'initial');
  const word: unknown = Reflect.get(value, 'word');
  if (typeof word !== 'string' || word.length > 32) return null;
  if (initial === null && word === '') return EMPTY_CLASSWORD_DRAFT;
  const validInitial = CLASSWORD_INITIALS.find((candidate) => candidate === initial);
  return validInitial ? { initial: validInitial, word } : null;
});
const legacy = (storage: FeatureDraftStorage | null, studentNumber: number, dateKey: string) => () => JSON.parse(storage?.getItem(legacyKey(studentNumber, dateKey)) ?? 'null');
export const loadClasswordDraft = (storage: FeatureDraftStorage | null, studentNumber: number, dateKey: string): ClasswordDraft => (
  store.load(storage, scopeFor(studentNumber, dateKey), legacy(storage, studentNumber, dateKey))?.value ?? EMPTY_CLASSWORD_DRAFT
);
export const readyClasswordDraft = async (storage: FeatureDraftStorage | null, studentNumber: number, dateKey: string): Promise<ClasswordDraft> => (
  (await store.ready(storage, scopeFor(studentNumber, dateKey), legacy(storage, studentNumber, dateKey)))?.value ?? EMPTY_CLASSWORD_DRAFT
);
export const classwordDraftVersion = (storage: FeatureDraftStorage | null, studentNumber: number, dateKey: string): string | null => (
  store.load(storage, scopeFor(studentNumber, dateKey), legacy(storage, studentNumber, dateKey))?.version ?? null
);
export const confirmClasswordDraft = (storage: FeatureDraftStorage | null, studentNumber: number, dateKey: string, version: string) => (
  store.confirm(storage, scopeFor(studentNumber, dateKey), version)
);
export const storeClasswordDraft = (storage: FeatureDraftStorage | null, studentNumber: number, dateKey: string, draft: ClasswordDraft): boolean => (
  store.save(storage, scopeFor(studentNumber, dateKey), draft)
);

export const settleClasswordDraft = (storage: FeatureDraftStorage | null, studentNumber: number, dateKey: string) => store.settled(storage, scopeFor(studentNumber, dateKey));
