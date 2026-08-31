import {
  getDailyClasswordQuiz,
  isClasswordQuizAnswerCorrect,
  type ClasswordQuizCompletion,
  type ClasswordQuizStudentState,
  type ClasswordQuizTeacherSummary,
} from './classwordQuiz';
import { getRandomClasswordQuizRewardAmount } from './classwordQuizReward';

const CLASSWORD_QUIZ_LOCAL_STORAGE_KEY = 'school-timer-classword-quiz-v1';

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

type LocalClasswordQuizCompletion = ClasswordQuizCompletion & {
  readonly rewardAmount: number;
};

const readCompletions = (storage: Storage): readonly LocalClasswordQuizCompletion[] => {
  const raw = storage.getItem(CLASSWORD_QUIZ_LOCAL_STORAGE_KEY);
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.flatMap((completion): readonly LocalClasswordQuizCompletion[] => {
      if (
        !isRecord(completion)
        || typeof completion.dateKey !== 'string'
        || typeof completion.questionId !== 'string'
        || typeof completion.studentNumber !== 'number'
        || !Number.isInteger(completion.studentNumber)
        || completion.studentNumber < 1
        || completion.studentNumber > 23
        || typeof completion.completedAt !== 'string'
      ) return [];
      return [{
        dateKey: completion.dateKey,
        questionId: completion.questionId,
        studentNumber: completion.studentNumber,
        completedAt: completion.completedAt,
        rewardAmount: typeof completion.rewardAmount === 'number'
          && Number.isInteger(completion.rewardAmount)
          && completion.rewardAmount >= 1
          && completion.rewardAmount <= 10
          ? completion.rewardAmount
          : 0,
      }];
    });
  } catch {
    return [];
  }
};

const writeCompletions = (storage: Storage, completions: readonly LocalClasswordQuizCompletion[]): void => {
  storage.setItem(CLASSWORD_QUIZ_LOCAL_STORAGE_KEY, JSON.stringify(completions));
};

export const loadLocalClasswordQuizStudentState = (
  storage: Storage,
  dateKey: string,
  studentNumber: number,
): ClasswordQuizStudentState => {
  const question = getDailyClasswordQuiz(dateKey);
  const completion = readCompletions(storage).find((candidate) => (
    candidate.dateKey === dateKey
    && candidate.questionId === question.id
    && candidate.studentNumber === studentNumber
  ));
  return {
    dateKey,
    question,
    completed: completion !== undefined,
    completedAt: completion?.completedAt ?? null,
    rewardAmount: completion && completion.rewardAmount > 0 ? completion.rewardAmount : null,
  };
};

export const loadLocalClasswordQuizTeacherSummary = (
  storage: Storage,
  dateKey: string,
): ClasswordQuizTeacherSummary => {
  const question = getDailyClasswordQuiz(dateKey);
  return {
    dateKey,
    question,
    correctStudentNumbers: readCompletions(storage)
      .filter((completion) => completion.dateKey === dateKey && completion.questionId === question.id)
      .map((completion) => completion.studentNumber)
      .sort((left, right) => left - right),
  };
};

export const submitLocalClasswordQuizAnswer = (
  storage: Storage,
  dateKey: string,
  studentNumber: number,
  answer: string,
  randomSource: () => number = Math.random,
): { readonly correct: boolean; readonly state: ClasswordQuizStudentState; readonly rewardAmount: number } => {
  const currentState = loadLocalClasswordQuizStudentState(storage, dateKey, studentNumber);
  const completions = readCompletions(storage);
  if (currentState.completed) {
    const existing = completions.find((completion) => (
      completion.dateKey === dateKey
      && completion.questionId === currentState.question.id
      && completion.studentNumber === studentNumber
    ));
    const rewardAmount = existing?.rewardAmount || getRandomClasswordQuizRewardAmount(randomSource);
    if (existing && existing.rewardAmount === 0) {
      writeCompletions(storage, completions.map((completion) => (
        completion === existing ? { ...completion, rewardAmount } : completion
      )));
    }
    return { correct: true, state: currentState, rewardAmount };
  }
  if (!isClasswordQuizAnswerCorrect(dateKey, answer)) {
    return { correct: false, state: currentState, rewardAmount: 0 };
  }
  const rewardAmount = getRandomClasswordQuizRewardAmount(randomSource);
  writeCompletions(storage, [...completions, {
    dateKey,
    questionId: currentState.question.id,
    studentNumber,
    completedAt: new Date().toISOString(),
    rewardAmount,
  }]);
  return {
    correct: true,
    state: loadLocalClasswordQuizStudentState(storage, dateKey, studentNumber),
    rewardAmount,
  };
};
