import { createFeatureInputDraftStore, type FeatureDraftStorage } from './featureInputDraft.js';
const CLASSWORD_QUIZ_ANSWERS_KEY = 'school-timer:classword-quiz-answers:v1';
const MAX_ANSWER_LENGTH = 20;

export type ClasswordQuizAnswerIdentity = {
  readonly dateKey: string;
  readonly studentNumber: number;
  readonly questionId: string;
};

const getIdentityKey = ({ dateKey, studentNumber, questionId }: ClasswordQuizAnswerIdentity): string => (
  `${dateKey}:${studentNumber}:${questionId}`
);

const readAnswers = (storage: FeatureDraftStorage | null): Readonly<Record<string, string>> => {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(CLASSWORD_QUIZ_ANSWERS_KEY) ?? '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => (
      typeof entry[1] === 'string'
      && entry[1].trim().length > 0
      && entry[1].length <= MAX_ANSWER_LENGTH
    )));
  } catch {
    return {};
  }
};

const answers = createFeatureInputDraftStore<string>((value) => typeof value === 'string' && value.length <= MAX_ANSWER_LENGTH ? value : null);
const inputs = createFeatureInputDraftStore<string>((value) => typeof value === 'string' && value.length <= MAX_ANSWER_LENGTH ? value : null);
const scopeFor = (identity: ClasswordQuizAnswerIdentity, feature: string) => ({ studentNumber: identity.studentNumber, feature, entityId: JSON.stringify([identity.dateKey, identity.questionId]) });
export const loadSavedClasswordQuizAnswer = (storage: FeatureDraftStorage | null, identity: ClasswordQuizAnswerIdentity): string => (
  answers.load(storage, scopeFor(identity, 'classword-quiz-answer'), () => readAnswers(storage)[getIdentityKey(identity)] ?? null)?.value ?? ''
);
export const readyClasswordQuizInput = async (storage: FeatureDraftStorage | null, identity: ClasswordQuizAnswerIdentity): Promise<string> => (
  (await inputs.ready(storage, scopeFor(identity, 'classword-quiz-input'), () => null))?.value ?? ''
);
export const saveClasswordQuizInput = (storage: FeatureDraftStorage | null, identity: ClasswordQuizAnswerIdentity, answer: string): boolean => (
  inputs.save(storage, scopeFor(identity, 'classword-quiz-input'), answer)
);
export const saveClasswordQuizAnswer = (storage: FeatureDraftStorage | null, identity: ClasswordQuizAnswerIdentity, answer: string): void => {
  const normalized = answer.trim();
  if (!normalized || normalized.length > MAX_ANSWER_LENGTH) return;
  answers.save(storage, scopeFor(identity, 'classword-quiz-answer'), normalized);
};

export const settleClasswordQuizInput = (storage: FeatureDraftStorage | null, identity: ClasswordQuizAnswerIdentity) => inputs.settled(storage, scopeFor(identity, 'classword-quiz-input'));
