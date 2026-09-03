import { isClasswordDateKey } from './classword.js';

export type ClasswordQuizExample = {
  readonly register: 'written' | 'spoken';
  readonly prefix: string;
  readonly suffix: string;
};

export type ClasswordQuizPrompt = {
  readonly id: string;
  readonly initialHint: string;
  readonly meaning: string;
  readonly examples: readonly [ClasswordQuizExample, ClasswordQuizExample];
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
  readonly rewardAmount: number | null;
};

export type ClasswordQuizTeacherSummary = {
  readonly dateKey: string;
  readonly question: ClasswordQuizPrompt;
  readonly answer: string;
  readonly source: 'automatic' | 'teacher';
  readonly correctStudentNumbers: readonly number[];
};

export type ClasswordQuizDefinition = ClasswordQuizPrompt & {
  readonly answer: string;
};

export type ClasswordQuizTeacherInput = {
  readonly dateKey: string;
  readonly initialHint: string;
  readonly meaning: string;
  readonly writtenExample: string;
  readonly spokenExample: string;
  readonly answer: string;
};

const CLASSWORD_QUIZ_QUESTIONS: readonly ClasswordQuizDefinition[] = [
  {
    id: 'saving-resources',
    initialHint: 'ㅈㅇ',
    meaning: '물건이나 돈, 에너지를 아껴서 쓰는 일',
    examples: [
      { register: 'written', prefix: '우리는 물과 전기를 ', suffix: '하여 환경을 지켜야 한다.' },
      { register: 'spoken', prefix: '물을 ', suffix: '하려고 양치할 때 컵을 썼어.' },
    ],
    answer: '절약',
  },
  {
    id: 'caring-for-others',
    initialHint: 'ㅂㄹ',
    meaning: '다른 사람의 마음과 형편을 생각하고 도와주는 마음이나 행동',
    examples: [
      { register: 'written', prefix: '서로를 ', suffix: '하는 태도는 공동체를 따뜻하게 만든다.' },
      { register: 'spoken', prefix: '친구가 지나가게 길을 비켜 주는 ', suffix: '를 보였어.' },
    ],
    answer: '배려',
  },
  {
    id: 'finishing-your-duty',
    initialHint: 'ㅊㅇ',
    meaning: '맡은 일을 끝까지 해내려는 태도',
    examples: [
      { register: 'written', prefix: '맡은 일을 끝까지 해내는 것은 ', suffix: ' 있는 태도이다.' },
      { register: 'spoken', prefix: '내가 맡은 화분에 물을 주며 ', suffix: '을 다했어.' },
    ],
    answer: '책임',
  },
  {
    id: 'working-together',
    initialHint: 'ㅎㄷ',
    meaning: '여러 사람이 힘과 마음을 모아 함께 일함',
    examples: [
      { register: 'written', prefix: '구성원들은 목표를 이루기 위해 서로 ', suffix: '하였다.' },
      { register: 'spoken', prefix: '모둠 친구들과 ', suffix: '해서 교실을 깨끗이 치웠어.' },
    ],
    answer: '협동',
  },
  {
    id: 'looking-carefully',
    initialHint: 'ㄱㅊ',
    meaning: '사물이나 현상을 자세히 살펴봄',
    examples: [
      { register: 'written', prefix: '강낭콩의 성장 과정을 매일 ', suffix: '하여 기록하였다.' },
      { register: 'spoken', prefix: '강낭콩이 어떻게 자라는지 자세히 ', suffix: '해 봤어.' },
    ],
    answer: '관찰',
  },
  {
    id: 'putting-into-action',
    initialHint: 'ㅅㅊ',
    meaning: '생각하거나 계획한 것을 실제 행동으로 옮김',
    examples: [
      { register: 'written', prefix: '환경 보호는 작은 약속을 ', suffix: '하는 데서 시작된다.' },
      { register: 'spoken', prefix: '쓰레기를 줄이겠다는 약속을 오늘부터 ', suffix: '했어.' },
    ],
    answer: '실천',
  },
  {
    id: 'showing-respect',
    initialHint: 'ㅈㅈ',
    meaning: '다른 사람을 소중하게 여기고 의견이나 권리를 인정함',
    examples: [
      { register: 'written', prefix: '다른 사람의 의견과 권리를 ', suffix: '해야 한다.' },
      { register: 'spoken', prefix: '친구 말을 끝까지 들으며 서로를 ', suffix: '했어.' },
    ],
    answer: '존중',
  },
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isValidStudentNumber = (value: unknown): value is number => (
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 23
);

export const toClasswordQuizPrompt = ({ id, initialHint, meaning, examples }: ClasswordQuizDefinition): ClasswordQuizPrompt => ({
  id,
  initialHint,
  meaning,
  examples,
});

export const getDailyClasswordQuiz = (dateKey: string): ClasswordQuizPrompt => {
  if (!isClasswordDateKey(dateKey)) throw new Error('CLASSWORD_QUIZ_INVALID_DATE');
  const dayNumber = Math.floor(Date.parse(`${dateKey}T00:00:00.000Z`) / 86_400_000);
  const question = CLASSWORD_QUIZ_QUESTIONS[Math.abs(dayNumber) % CLASSWORD_QUIZ_QUESTIONS.length];
  if (!question) throw new Error('CLASSWORD_QUIZ_NOT_FOUND');
  return toClasswordQuizPrompt(question);
};

export const getDailyClasswordQuizDefinition = (dateKey: string): ClasswordQuizDefinition => {
  const prompt = getDailyClasswordQuiz(dateKey);
  const question = CLASSWORD_QUIZ_QUESTIONS.find((candidate) => candidate.id === prompt.id);
  if (!question) throw new Error('CLASSWORD_QUIZ_NOT_FOUND');
  return question;
};

export const getDailyClasswordQuizAnswer = (dateKey: string): string => {
  return getDailyClasswordQuizDefinition(dateKey).answer;
};

export const isClasswordQuizAnswerCorrect = (dateKey: string, input: string): boolean => {
  return input.normalize('NFC').trim().replace(/\s+/g, '') === getDailyClasswordQuizAnswer(dateKey);
};

const normalizeAnswer = (value: string): string => value.normalize('NFC').trim().replace(/\s+/g, '');

export const isClasswordQuizDefinitionAnswerCorrect = (
  question: ClasswordQuizDefinition,
  input: string,
): boolean => normalizeAnswer(input) === normalizeAnswer(question.answer);

const splitExample = (
  example: string,
  answer: string,
  register: ClasswordQuizExample['register'],
): ClasswordQuizExample => {
  const index = example.indexOf(answer);
  if (index < 0) throw new Error('CLASSWORD_QUIZ_EXAMPLE_REQUIRES_ANSWER');
  return {
    register,
    prefix: example.slice(0, index),
    suffix: example.slice(index + answer.length),
  };
};

export const buildTeacherClasswordQuiz = (
  input: ClasswordQuizTeacherInput,
  id: string,
): ClasswordQuizDefinition => {
  if (!isClasswordDateKey(input.dateKey)) throw new Error('CLASSWORD_QUIZ_INVALID_DATE');
  const initialHint = input.initialHint.normalize('NFC').trim();
  const answer = input.answer.normalize('NFC').trim();
  const meaning = input.meaning.normalize('NFC').trim();
  const writtenExample = input.writtenExample.normalize('NFC').trim();
  const spokenExample = input.spokenExample.normalize('NFC').trim();
  if (!/^[ㄱ-ㅎ]{1,8}$/.test(initialHint)) throw new Error('CLASSWORD_QUIZ_INVALID_INITIAL');
  if (!answer || [...answer].length > 20) throw new Error('CLASSWORD_QUIZ_INVALID_ANSWER');
  if (!meaning || [...meaning].length > 120) throw new Error('CLASSWORD_QUIZ_INVALID_MEANING');
  if ([...writtenExample].length > 160 || [...spokenExample].length > 160) {
    throw new Error('CLASSWORD_QUIZ_INVALID_EXAMPLE');
  }
  return {
    id,
    initialHint,
    meaning,
    examples: [
      splitExample(writtenExample, answer, 'written'),
      splitExample(spokenExample, answer, 'spoken'),
    ],
    answer,
  };
};

const parseExample = (value: unknown, register: ClasswordQuizExample['register']): ClasswordQuizExample => {
  if (
    !isRecord(value)
    || value.register !== register
    || typeof value.prefix !== 'string'
    || typeof value.suffix !== 'string'
  ) throw new Error('CLASSWORD_QUIZ_INVALID_RESPONSE');
  return { register, prefix: value.prefix, suffix: value.suffix };
};

const parsePrompt = (value: unknown): ClasswordQuizPrompt => {
  if (
    !isRecord(value)
    || typeof value.id !== 'string'
    || typeof value.initialHint !== 'string'
    || typeof value.meaning !== 'string'
    || !Array.isArray(value.examples)
    || value.examples.length !== 2
  ) throw new Error('CLASSWORD_QUIZ_INVALID_RESPONSE');
  return {
    id: value.id,
    initialHint: value.initialHint,
    meaning: value.meaning,
    examples: [
      parseExample(value.examples[0], 'written'),
      parseExample(value.examples[1], 'spoken'),
    ],
  };
};

export const parseClasswordQuizStudentState = (value: unknown): ClasswordQuizStudentState => {
  if (
    !isRecord(value)
    || !isClasswordDateKey(value.dateKey)
    || typeof value.completed !== 'boolean'
    || (value.completedAt !== null && typeof value.completedAt !== 'string')
    || (value.rewardAmount !== null && (
      typeof value.rewardAmount !== 'number'
      || !Number.isInteger(value.rewardAmount)
      || value.rewardAmount < 1
      || value.rewardAmount > 10
    ))
  ) throw new Error('CLASSWORD_QUIZ_INVALID_RESPONSE');
  return {
    dateKey: value.dateKey,
    question: parsePrompt(value.question),
    completed: value.completed,
    completedAt: typeof value.completedAt === 'string' ? value.completedAt : null,
    rewardAmount: typeof value.rewardAmount === 'number' ? value.rewardAmount : null,
  };
};

export const parseClasswordQuizTeacherSummary = (value: unknown): ClasswordQuizTeacherSummary => {
  if (
    !isRecord(value)
    || !isClasswordDateKey(value.dateKey)
    || typeof value.answer !== 'string'
    || (value.source !== 'automatic' && value.source !== 'teacher')
    || !Array.isArray(value.correctStudentNumbers)
    || !value.correctStudentNumbers.every(isValidStudentNumber)
  ) throw new Error('CLASSWORD_QUIZ_INVALID_RESPONSE');
  return {
    dateKey: value.dateKey,
    question: parsePrompt(value.question),
    answer: value.answer,
    source: value.source,
    correctStudentNumbers: [...new Set(value.correctStudentNumbers)].sort((left, right) => left - right),
  };
};
