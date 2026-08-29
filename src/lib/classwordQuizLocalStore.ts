import {
  getDailyClasswordQuiz,
  isClasswordQuizAnswerCorrect,
  type ClasswordQuizCompletion,
  type ClasswordQuizStudentState,
  type ClasswordQuizTeacherSummary,
} from './classwordQuiz';

const CLASSWORD_QUIZ_LOCAL_STORAGE_KEY = 'school-timer-classword-quiz-v1';

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const readCompletions = (storage: Storage): readonly ClasswordQuizCompletion[] => {
  const raw = storage.getItem(CLASSWORD_QUIZ_LOCAL_STORAGE_KEY);
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.flatMap((completion): readonly ClasswordQuizCompletion[] => {
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
      }];
    });
  } catch {
    return [];
  }
};

const writeCompletions = (storage: Storage, completions: readonly ClasswordQuizCompletion[]): void => {
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
): { readonly correct: boolean; readonly state: ClasswordQuizStudentState } => {
  const currentState = loadLocalClasswordQuizStudentState(storage, dateKey, studentNumber);
  if (currentState.completed) return { correct: true, state: currentState };
  if (!isClasswordQuizAnswerCorrect(dateKey, answer)) {
    return { correct: false, state: currentState };
  }
  const completions = readCompletions(storage);
  writeCompletions(storage, [...completions, {
    dateKey,
    questionId: currentState.question.id,
    studentNumber,
    completedAt: new Date().toISOString(),
  }]);
  return {
    correct: true,
    state: loadLocalClasswordQuizStudentState(storage, dateKey, studentNumber),
  };
};
