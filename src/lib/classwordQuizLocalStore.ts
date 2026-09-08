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
import { claimClasswordQuizRewardInSettings, getRandomClasswordQuizRewardAmount } from './classwordQuizReward';
import { normalizeCurrencyBalances, normalizeCurrencyHistory } from './currency';
import { STUDENT_PET_STORAGE_KEY } from './studentPet';
import { assertClasswordParticipation, getClasswordDisplayDate } from './classwordSchedule';

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

const readRewardSnapshot = (storage: Storage): Record<string, unknown> => {
  const raw = storage.getItem(STUDENT_PET_STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isRecord(parsed)) return parsed;
  } catch {}
  throw new Error('CLASSWORD_REWARD_SAVE_FAILED');
};

const hasPaidReward = (storage: Storage, completion: LocalClasswordQuizCompletion): boolean => {
  const history = normalizeCurrencyHistory(readRewardSnapshot(storage).currencyHistory);
  return (history[String(completion.studentNumber)] ?? []).some((entry) => (
    entry.id === `weekly-mission-classword_quiz_correct-${completion.studentNumber}-${completion.dateKey}`
    && entry.delta === completion.rewardAmount
    && entry.delta > 0
  ));
};

const writeCompletions = (storage: Storage, completions: readonly LocalClasswordQuizCompletion[]): void => {
  try {
    storage.setItem(CLASSWORD_QUIZ_LOCAL_STORAGE_KEY, JSON.stringify(completions));
  } catch {
    throw new Error('CLASSWORD_REWARD_SAVE_FAILED');
  }
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
  requestedDate: string,
  studentNumber: number,
): ClasswordQuizStudentState => {
  const dateKey = getClasswordDisplayDate(requestedDate);
  const definition = getResolvedQuiz(storage, dateKey);
  const question = toClasswordQuizPrompt(definition);
  const completion = readCompletions(storage).find((candidate) => (
    candidate.dateKey === dateKey
    && candidate.questionId === question.id
    && candidate.studentNumber === studentNumber
  ));
  const completed = completion !== undefined && hasPaidReward(storage, completion);
  return {
    dateKey,
    question,
    completed,
    completedAt: completed ? completion.completedAt : null,
    rewardAmount: completed ? completion.rewardAmount : null,
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
      .filter((completion) => (
        completion.dateKey === dateKey
        && completion.questionId === question.id
        && hasPaidReward(storage, completion)
      ))
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
): {
  readonly correct: boolean;
  readonly state: ClasswordQuizStudentState;
  readonly rewardAmount: number;
  readonly awarded: boolean;
  readonly balance: number | null;
} => {
  assertClasswordParticipation(dateKey);
  const currentState = loadLocalClasswordQuizStudentState(storage, dateKey, studentNumber);
  const completions = readCompletions(storage);
  const existing = completions.find((completion) => (
    completion.dateKey === dateKey
    && completion.questionId === currentState.question.id
    && completion.studentNumber === studentNumber
  ));
  if (!existing && !isClasswordQuizDefinitionAnswerCorrect(getResolvedQuiz(storage, dateKey), answer)) {
    return { correct: false, state: currentState, rewardAmount: 0, awarded: false, balance: null };
  }
  const snapshot = readRewardSnapshot(storage);
  if (currentState.completed) {
    return {
      correct: true,
      state: currentState,
      rewardAmount: currentState.rewardAmount ?? 0,
      awarded: false,
      balance: normalizeCurrencyBalances(snapshot.currencyBalances)[String(studentNumber)],
    };
  }
  const priorReward = (normalizeCurrencyHistory(snapshot.currencyHistory)[String(studentNumber)] ?? [])
    .find((entry) => entry.id === `weekly-mission-classword_quiz_correct-${studentNumber}-${dateKey}`
      && entry.delta >= 1 && entry.delta <= 10);
  const rewardAmount = priorReward?.delta || existing?.rewardAmount || getRandomClasswordQuizRewardAmount(randomSource);
  // Keep the amount stable on retry; readers expose completion only after the wallet receipt exists.
  if (!existing || existing.rewardAmount !== rewardAmount) {
    const pending = {
      dateKey,
      questionId: currentState.question.id,
      studentNumber,
      completedAt: existing?.completedAt ?? new Date().toISOString(),
      rewardAmount,
    };
    writeCompletions(storage, existing
      ? completions.map((completion) => completion === existing ? pending : completion)
      : [...completions, pending]);
  }
  const reward = claimClasswordQuizRewardInSettings(snapshot, studentNumber, dateKey, rewardAmount);
  if (reward.awarded) {
    try {
      storage.setItem(STUDENT_PET_STORAGE_KEY, JSON.stringify(reward.value));
    } catch {
      throw new Error('CLASSWORD_REWARD_SAVE_FAILED');
    }
  }
  const state = loadLocalClasswordQuizStudentState(storage, dateKey, studentNumber);
  if (!state.completed) throw new Error('CLASSWORD_REWARD_PENDING');
  return { correct: true, state, rewardAmount, awarded: reward.awarded, balance: reward.balance };
};
