import {
  buildTeacherClasswordQuiz,
  getDailyClasswordQuizDefinition,
  isClasswordQuizDefinitionAnswerCorrect,
  toClasswordQuizPrompt,
  type ClasswordQuizDefinition,
  type ClasswordQuizCompletion,
  type ClasswordQuizStudentState,
  type ClasswordQuizTeacherInput,
  type ClasswordQuizTeacherSummary,
} from './classwordQuiz';
import { getRandomClasswordQuizRewardAmount } from './classwordQuizReward';

const CLASSWORD_QUIZ_LOCAL_STORAGE_KEY = 'school-timer-classword-quiz-v1';
const CLASSWORD_CUSTOM_QUIZ_LOCAL_STORAGE_KEY = 'school-timer-classword-custom-quizzes-v1';

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

const readCustomQuiz = (storage: Storage, dateKey: string): ClasswordQuizDefinition | null => {
  const raw = storage.getItem(CLASSWORD_CUSTOM_QUIZ_LOCAL_STORAGE_KEY);
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || !isRecord(value[dateKey])) return null;
    const quiz = value[dateKey];
    if (
      typeof quiz.id !== 'string'
      || typeof quiz.initialHint !== 'string'
      || typeof quiz.meaning !== 'string'
      || typeof quiz.answer !== 'string'
      || !Array.isArray(quiz.examples)
      || quiz.examples.length !== 2
    ) return null;
    const [written, spoken] = quiz.examples;
    if (!isRecord(written) || !isRecord(spoken)
      || written.register !== 'written' || spoken.register !== 'spoken'
      || typeof written.prefix !== 'string' || typeof written.suffix !== 'string'
      || typeof spoken.prefix !== 'string' || typeof spoken.suffix !== 'string') return null;
    return {
      id: quiz.id,
      initialHint: quiz.initialHint,
      meaning: quiz.meaning,
      answer: quiz.answer,
      examples: [
        { register: 'written', prefix: written.prefix, suffix: written.suffix },
        { register: 'spoken', prefix: spoken.prefix, suffix: spoken.suffix },
      ],
    };
  } catch {
    return null;
  }
};

const getResolvedQuiz = (storage: Storage, dateKey: string): ClasswordQuizDefinition => (
  readCustomQuiz(storage, dateKey) ?? getDailyClasswordQuizDefinition(dateKey)
);

export const saveLocalTeacherClasswordQuiz = (
  storage: Storage,
  input: ClasswordQuizTeacherInput,
): void => {
  const question = buildTeacherClasswordQuiz(input, `teacher-${input.dateKey}-${crypto.randomUUID()}`);
  let existing: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(storage.getItem(CLASSWORD_CUSTOM_QUIZ_LOCAL_STORAGE_KEY) ?? '{}');
    if (isRecord(parsed)) existing = parsed;
  } catch {}
  storage.setItem(CLASSWORD_CUSTOM_QUIZ_LOCAL_STORAGE_KEY, JSON.stringify({ ...existing, [input.dateKey]: question }));
};

export const deleteLocalTeacherClasswordQuiz = (storage: Storage, dateKey: string): void => {
  let existing: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(storage.getItem(CLASSWORD_CUSTOM_QUIZ_LOCAL_STORAGE_KEY) ?? '{}');
    if (isRecord(parsed)) existing = parsed;
  } catch {}
  const { [dateKey]: _removed, ...rest } = existing;
  storage.setItem(CLASSWORD_CUSTOM_QUIZ_LOCAL_STORAGE_KEY, JSON.stringify(rest));
};

export const loadLocalClasswordQuizStudentState = (
  storage: Storage,
  dateKey: string,
  studentNumber: number,
): ClasswordQuizStudentState => {
  const definition = getResolvedQuiz(storage, dateKey);
  const question = toClasswordQuizPrompt(definition);
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
  const definition = getResolvedQuiz(storage, dateKey);
  const question = toClasswordQuizPrompt(definition);
  return {
    dateKey,
    question,
    answer: definition.answer,
    source: readCustomQuiz(storage, dateKey) ? 'teacher' : 'automatic',
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
  if (!isClasswordQuizDefinitionAnswerCorrect(getResolvedQuiz(storage, dateKey), answer)) {
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
