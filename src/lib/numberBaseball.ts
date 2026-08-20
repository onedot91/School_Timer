export const NUMBER_BASEBALL_MAX_ATTEMPTS = 9;
export const NUMBER_BASEBALL_REWARD_TIERS = [
  { startAttempt: 1, endAttempt: 5, reward: 15 },
  { startAttempt: 6, endAttempt: 7, reward: 10 },
  { startAttempt: 8, endAttempt: 9, reward: 5 },
] as const;
export const NUMBER_BASEBALL_REWARDS = NUMBER_BASEBALL_REWARD_TIERS.map(({ reward }) => reward);
export const STUDENT_NUMBER_BASEBALL_STORAGE_KEY = 'school-timer-student-number-baseball-v1';

export type NumberBaseballGuess = readonly [number, number, number];

export type NumberBaseballResult = {
  readonly strikes: number;
  readonly balls: number;
  readonly outs: number;
};

export type NumberBaseballResultDisplay = {
  readonly kind: 'strike' | 'ball' | 'out';
  readonly value: string;
};

export type NumberBaseballAttempt = {
  readonly guess: NumberBaseballGuess;
  readonly createdAt: string;
};

export type NumberBaseballProgressEntry = {
  readonly gameId: string;
  readonly attempts: readonly NumberBaseballAttempt[];
  readonly completedAt: string | null;
};

export type StudentNumberBaseballProgress = Record<string, NumberBaseballProgressEntry>;
export type NumberBaseballStatus = 'incomplete' | 'inProgress' | 'completed' | 'exhausted';

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

const isGuess = (value: unknown): value is NumberBaseballGuess => (
  Array.isArray(value)
  && value.length === 3
  && value.every((digit) => typeof digit === 'number' && Number.isInteger(digit) && digit >= 1 && digit <= 9)
  && new Set(value).size === 3
);

const createSeed = (value: string) => {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const createRandom = (initialSeed: number) => {
  let seed = initialSeed;
  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

export const getNumberBaseballProgressKey = (studentNumber: number, dateKey: string) => (
  `${studentNumber}:${dateKey}`
);

export const getNumberBaseballGameId = (studentNumber: number, dateKey: string) => (
  `number-baseball-v1-${studentNumber}-${dateKey}`
);

export const createNumberBaseballAnswer = (
  studentNumber: number,
  dateKey: string,
): NumberBaseballGuess => {
  const random = createRandom(createSeed(`${studentNumber}:${dateKey}:number-baseball-v1`));
  const digits = Array.from({ length: 9 }, (_, index) => index + 1);
  for (let index = digits.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = digits[index] ?? 1;
    digits[index] = digits[swapIndex] ?? 1;
    digits[swapIndex] = current;
  }
  return [digits[0] ?? 1, digits[1] ?? 2, digits[2] ?? 3];
};

export const evaluateNumberBaseballGuess = (
  answer: NumberBaseballGuess,
  guess: NumberBaseballGuess,
): NumberBaseballResult => {
  const strikes = guess.filter((digit, index) => digit === answer[index]).length;
  const balls = guess.filter((digit, index) => digit !== answer[index] && answer.includes(digit)).length;
  return { strikes, balls, outs: 3 - strikes - balls };
};

export const getNumberBaseballOutDigits = (
  answer: NumberBaseballGuess,
  attempts: readonly NumberBaseballAttempt[],
) => Array.from(new Set(attempts.flatMap(({ guess }) => (
  evaluateNumberBaseballGuess(answer, guess).outs === 3 ? guess : []
))));

export const getNumberBaseballResultDisplays = (
  result: NumberBaseballResult,
): readonly NumberBaseballResultDisplay[] => {
  if (result.strikes === 0 && result.balls === 0) {
    return [{ kind: 'out', value: 'OUT' }];
  }
  const displays: NumberBaseballResultDisplay[] = [];
  if (result.strikes > 0) displays.push({ kind: 'strike', value: `${result.strikes}S` });
  if (result.balls > 0) displays.push({ kind: 'ball', value: `${result.balls}B` });
  return displays;
};

export const getNumberBaseballReward = (attemptCount: number) => {
  if (!Number.isInteger(attemptCount) || attemptCount < 1) return null;
  return NUMBER_BASEBALL_REWARD_TIERS.find(({ startAttempt, endAttempt }) => (
    attemptCount >= startAttempt && attemptCount <= endAttempt
  ))?.reward ?? null;
};

export const createNumberBaseballProgressEntry = (gameId: string): NumberBaseballProgressEntry => ({
  gameId,
  attempts: [],
  completedAt: null,
});

export const getNumberBaseballStatus = (
  entry: NumberBaseballProgressEntry,
  answer: NumberBaseballGuess,
): NumberBaseballStatus => {
  if (entry.attempts.some((attempt) => evaluateNumberBaseballGuess(answer, attempt.guess).strikes === 3)) {
    return 'completed';
  }
  if (entry.attempts.length >= NUMBER_BASEBALL_MAX_ATTEMPTS) return 'exhausted';
  return 'inProgress';
};

export const appendNumberBaseballAttempt = (
  entry: NumberBaseballProgressEntry,
  answer: NumberBaseballGuess,
  guess: NumberBaseballGuess,
  createdAt = new Date().toISOString(),
): NumberBaseballProgressEntry | null => {
  if (getNumberBaseballStatus(entry, answer) === 'completed' || entry.attempts.length >= NUMBER_BASEBALL_MAX_ATTEMPTS) {
    return null;
  }
  const attempts = [...entry.attempts, { guess, createdAt }];
  const completedAt = evaluateNumberBaseballGuess(answer, guess).strikes === 3 ? createdAt : null;
  return { ...entry, attempts, completedAt };
};

export const normalizeStudentNumberBaseballProgress = (value: unknown): StudentNumberBaseballProgress => {
  if (!isRecord(value)) return {};
  return Object.entries(value).reduce<StudentNumberBaseballProgress>((progress, [key, rawEntry]) => {
    const match = /^(\d{1,2}):(\d{4}-\d{2}-\d{2})$/.exec(key);
    if (!match || !isRecord(rawEntry)) return progress;
    const studentNumber = Number(match[1]);
    const dateKey = match[2] ?? '';
    if (studentNumber < 1 || studentNumber > 23) return progress;
    const gameId = getNumberBaseballGameId(studentNumber, dateKey);
    if (rawEntry.gameId !== gameId || !Array.isArray(rawEntry.attempts)) return progress;
    const answer = createNumberBaseballAnswer(studentNumber, dateKey);
    const attempts: NumberBaseballAttempt[] = [];
    for (const rawAttempt of rawEntry.attempts) {
      if (attempts.length >= NUMBER_BASEBALL_MAX_ATTEMPTS || !isRecord(rawAttempt) || !isGuess(rawAttempt.guess)) continue;
      if (attempts.some((attempt) => evaluateNumberBaseballGuess(answer, attempt.guess).strikes === 3)) break;
      attempts.push({
        guess: [rawAttempt.guess[0], rawAttempt.guess[1], rawAttempt.guess[2]],
        createdAt: typeof rawAttempt.createdAt === 'string' ? rawAttempt.createdAt.slice(0, 64) : '',
      });
    }
    const solved = attempts.some((attempt) => evaluateNumberBaseballGuess(answer, attempt.guess).strikes === 3);
    progress[key] = {
      gameId,
      attempts,
      completedAt: solved && typeof rawEntry.completedAt === 'string' && rawEntry.completedAt
        ? rawEntry.completedAt.slice(0, 64)
        : null,
    };
    return progress;
  }, {});
};

export const getStudentNumberBaseballProgressFromSettings = (value: unknown) => (
  isRecord(value) ? normalizeStudentNumberBaseballProgress(value.studentNumberBaseball) : {}
);

export const loadStoredStudentNumberBaseballProgress = () => {
  if (typeof window === 'undefined') return {};
  try {
    const stored = window.localStorage.getItem(STUDENT_NUMBER_BASEBALL_STORAGE_KEY);
    return stored ? normalizeStudentNumberBaseballProgress(JSON.parse(stored)) : {};
  } catch (error) {
    if (error instanceof Error) return {};
    throw error;
  }
};

export const storeStudentNumberBaseballProgress = (progress: StudentNumberBaseballProgress) => {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(
      STUDENT_NUMBER_BASEBALL_STORAGE_KEY,
      JSON.stringify(normalizeStudentNumberBaseballProgress(progress)),
    );
    return true;
  } catch (error) {
    if (error instanceof Error) return false;
    throw error;
  }
};
