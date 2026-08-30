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

const readAnswers = (storage: Storage): Readonly<Record<string, string>> => {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(CLASSWORD_QUIZ_ANSWERS_KEY) ?? '{}');
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

export const loadSavedClasswordQuizAnswer = (
  storage: Storage,
  identity: ClasswordQuizAnswerIdentity,
): string => readAnswers(storage)[getIdentityKey(identity)] ?? '';

export const saveClasswordQuizAnswer = (
  storage: Storage,
  identity: ClasswordQuizAnswerIdentity,
  answer: string,
): void => {
  const normalizedAnswer = answer.trim();
  if (!normalizedAnswer || normalizedAnswer.length > MAX_ANSWER_LENGTH) return;
  try {
    storage.setItem(CLASSWORD_QUIZ_ANSWERS_KEY, JSON.stringify({
      ...readAnswers(storage),
      [getIdentityKey(identity)]: normalizedAnswer,
    }));
  } catch {}
};
