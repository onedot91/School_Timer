import { isClasswordDateKey } from './classword';

export type ClasswordQuizPrompt = {
  readonly id: string;
  readonly initialHint: string;
  readonly meaning: string;
  readonly example: string;
};

export type ClasswordQuizCompletion = {
  readonly dateKey: string;
  readonly questionId: string;
  readonly studentNumber: number;
  readonly completedAt: string;
};

export type ClasswordQuizStudentState = {
  readonly dateKey: string;
  readonly question: ClasswordQuizPrompt;
  readonly completed: boolean;
  readonly completedAt: string | null;
};

export type ClasswordQuizTeacherSummary = {
  readonly dateKey: string;
  readonly question: ClasswordQuizPrompt;
  readonly correctStudentNumbers: readonly number[];
};

type ClasswordQuizQuestion = ClasswordQuizPrompt & {
  readonly answer: string;
};

const CLASSWORD_QUIZ_QUESTIONS: readonly ClasswordQuizQuestion[] = [
  {
    id: 'saving-resources',
    initialHint: 'ㅈㅇ',
    meaning: '물건이나 돈, 에너지를 아껴서 쓰는 일',
    example: '물을 □□하려고 양치할 때 컵을 사용했다.',
    answer: '절약',
  },
  {
    id: 'caring-for-others',
    initialHint: 'ㅂㄹ',
    meaning: '다른 사람의 마음과 형편을 생각하고 도와주는 마음이나 행동',
    example: '친구가 편히 지나가도록 길을 비켜 주는 □□를 보였다.',
    answer: '배려',
  },
  {
    id: 'finishing-your-duty',
    initialHint: 'ㅊㅇ',
    meaning: '맡은 일을 끝까지 해내려는 태도',
    example: '내가 맡은 화분에 물을 주며 □□을 다했다.',
    answer: '책임',
  },
  {
    id: 'working-together',
    initialHint: 'ㅎㄷ',
    meaning: '여러 사람이 힘과 마음을 모아 함께 일함',
    example: '모둠 친구들과 □□하여 교실을 깨끗이 정리했다.',
    answer: '협동',
  },
  {
    id: 'looking-carefully',
    initialHint: 'ㄱㅊ',
    meaning: '사물이나 현상을 자세히 살펴봄',
    example: '강낭콩이 자라는 모습을 매일 □□하여 기록했다.',
    answer: '관찰',
  },
  {
    id: 'putting-into-action',
    initialHint: 'ㅅㅊ',
    meaning: '생각하거나 계획한 것을 실제 행동으로 옮김',
    example: '쓰레기를 줄이겠다는 약속을 오늘부터 □□했다.',
    answer: '실천',
  },
  {
    id: 'showing-respect',
    initialHint: 'ㅈㅈ',
    meaning: '다른 사람을 소중하게 여기고 의견이나 권리를 인정함',
    example: '친구의 생각을 끝까지 들으며 서로를 □□했다.',
    answer: '존중',
  },
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isValidStudentNumber = (value: unknown): value is number => (
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 23
);

const toPrompt = ({ id, initialHint, meaning, example }: ClasswordQuizQuestion): ClasswordQuizPrompt => ({
  id,
  initialHint,
  meaning,
  example,
});

export const getDailyClasswordQuiz = (dateKey: string): ClasswordQuizPrompt => {
  if (!isClasswordDateKey(dateKey)) throw new Error('CLASSWORD_QUIZ_INVALID_DATE');
  const dayNumber = Math.floor(Date.parse(`${dateKey}T00:00:00.000Z`) / 86_400_000);
  const question = CLASSWORD_QUIZ_QUESTIONS[Math.abs(dayNumber) % CLASSWORD_QUIZ_QUESTIONS.length];
  if (!question) throw new Error('CLASSWORD_QUIZ_NOT_FOUND');
  return toPrompt(question);
};

export const isClasswordQuizAnswerCorrect = (dateKey: string, input: string): boolean => {
  const prompt = getDailyClasswordQuiz(dateKey);
  const question = CLASSWORD_QUIZ_QUESTIONS.find((candidate) => candidate.id === prompt.id);
  if (!question) return false;
  return input.normalize('NFC').trim().replace(/\s+/g, '') === question.answer;
};

const parsePrompt = (value: unknown): ClasswordQuizPrompt => {
  if (
    !isRecord(value)
    || typeof value.id !== 'string'
    || typeof value.initialHint !== 'string'
    || typeof value.meaning !== 'string'
    || typeof value.example !== 'string'
  ) throw new Error('CLASSWORD_QUIZ_INVALID_RESPONSE');
  return {
    id: value.id,
    initialHint: value.initialHint,
    meaning: value.meaning,
    example: value.example,
  };
};

export const parseClasswordQuizStudentState = (value: unknown): ClasswordQuizStudentState => {
  if (
    !isRecord(value)
    || !isClasswordDateKey(value.dateKey)
    || typeof value.completed !== 'boolean'
    || (value.completedAt !== null && typeof value.completedAt !== 'string')
  ) throw new Error('CLASSWORD_QUIZ_INVALID_RESPONSE');
  return {
    dateKey: value.dateKey,
    question: parsePrompt(value.question),
    completed: value.completed,
    completedAt: typeof value.completedAt === 'string' ? value.completedAt : null,
  };
};

export const parseClasswordQuizTeacherSummary = (value: unknown): ClasswordQuizTeacherSummary => {
  if (
    !isRecord(value)
    || !isClasswordDateKey(value.dateKey)
    || !Array.isArray(value.correctStudentNumbers)
    || !value.correctStudentNumbers.every(isValidStudentNumber)
  ) throw new Error('CLASSWORD_QUIZ_INVALID_RESPONSE');
  return {
    dateKey: value.dateKey,
    question: parsePrompt(value.question),
    correctStudentNumbers: [...new Set(value.correctStudentNumbers)].sort((left, right) => left - right),
  };
};
