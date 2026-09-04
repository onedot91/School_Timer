import { getKoreanLocalDateKey } from './studentEmotion.js';

export const TODAY_FRIEND_REWARD = 15;
export const TODAY_FRIEND_STUDENT_COUNT = 23;
export const TODAY_FRIEND_GENRES = [
  'interview',
  'commonality',
  'recommendation',
  'compliment',
  'emotion',
] as const;
const TODAY_FRIEND_WEEKDAYS = [1, 2, 3, 4, 5] as const;

export type TodayFriendGenre = typeof TODAY_FRIEND_GENRES[number];
export type TodayFriendRelationKind = 'pair' | 'cycle';
export type TodayFriendSubmissionStatus = 'draft' | 'submitted' | 'revision_requested' | 'approved';
export type TodayFriendRewardStatus = 'pending' | 'paid';

export const getTodayFriendPreviewGenre = (
  missionGenre: TodayFriendGenre,
  selectedGenre: TodayFriendGenre,
): TodayFriendGenre | null => selectedGenre === missionGenre ? null : selectedGenre;

export type TodayFriendPayload =
  | { readonly kind: 'interview'; readonly answer: string }
  | { readonly kind: 'commonality'; readonly commonality: string }
  | { readonly kind: 'recommendation'; readonly category: 'movie' | 'book' | 'music' | 'food'; readonly title: string; readonly reason: string; readonly letterId: string | null }
  | { readonly kind: 'compliment'; readonly compliment: string; readonly reason?: string; readonly message?: string }
  | { readonly kind: 'emotion'; readonly emotion: string; readonly reason: string; readonly declinedToExplain: boolean };

export type TodayFriendRecommendationLetter = {
  readonly id: string;
  readonly recipient: number;
  readonly title: string;
  readonly content: string;
};

const TODAY_FRIEND_RECOMMENDATION_CATEGORY_LABELS = {
  movie: '영화',
  book: '책',
  music: '음악',
  food: '음식',
} as const satisfies Readonly<Record<Extract<TodayFriendPayload, { kind: 'recommendation' }>['category'], string>>;

export const createTodayFriendRecommendationLetter = (input: {
  readonly dateKey: string;
  readonly studentNumber: number;
  readonly partnerNumber: number;
  readonly revision: number;
  readonly payload: Extract<TodayFriendPayload, { kind: 'recommendation' }>;
}): TodayFriendRecommendationLetter => {
  const categoryLabel = TODAY_FRIEND_RECOMMENDATION_CATEGORY_LABELS[input.payload.category];
  return {
    id: `today-friend-recommendation-${input.dateKey}-${input.studentNumber}-r${input.revision}`,
    recipient: input.partnerNumber,
    title: `[오늘의 친구] ${categoryLabel} 추천`,
    content: `추천할 것\n${input.payload.title}\n\n추천하는 이유\n${input.payload.reason}`,
  };
};

export const createTodayFriendRecommendationDelivery = (input: Parameters<typeof createTodayFriendRecommendationLetter>[0]) => {
  const letter = createTodayFriendRecommendationLetter(input);
  return {
    letter,
    payload: { ...input.payload, letterId: letter.id },
  } as const;
};

export interface TodayFriendWeekDay {
  readonly dateKey: string;
  readonly weekday: 1 | 2 | 3 | 4 | 5;
  readonly genre: TodayFriendGenre;
}

export interface TodayFriendWeek {
  readonly weekKey: string;
  readonly days: readonly TodayFriendWeekDay[];
}

export interface TodayFriendPartnerAssignment {
  readonly studentNumber: number;
  readonly partnerNumber: number;
  readonly groupId: string;
  readonly relationKind: TodayFriendRelationKind;
}

export interface TodayFriendSubmission {
  readonly id: string;
  readonly dateKey: string;
  readonly studentNumber: number;
  readonly partnerNumber: number;
  readonly genre: TodayFriendGenre;
  readonly payload: TodayFriendPayload;
  readonly status: TodayFriendSubmissionStatus;
  readonly revision: number;
  readonly teacherFeedback: string | null;
  readonly submittedAt: string | null;
  readonly reviewedAt: string | null;
  readonly rewardStatus: TodayFriendRewardStatus;
}

export class TodayFriendDomainError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'TodayFriendDomainError';
    this.code = code;
  }
}

const assertNever = (value: never): never => {
  throw new TodayFriendDomainError(`UNSUPPORTED_VARIANT_${String(value)}`);
};

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export const getTodayFriendDateKey = getKoreanLocalDateKey;

const getStableHash = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const createSeededRandom = (seedValue: string) => {
  let seed = getStableHash(seedValue) || 1;
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
};

const shuffle = <Value>(values: readonly Value[], seedValue: string): readonly Value[] => {
  const shuffled = [...values];
  const random = createSeededRandom(seedValue);
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = shuffled[index];
    const replacement = shuffled[swapIndex];
    if (current === undefined || replacement === undefined) continue;
    shuffled[index] = replacement;
    shuffled[swapIndex] = current;
  }
  return shuffled;
};

const formatDateKey = (date: Date): string => [
  date.getUTCFullYear(),
  String(date.getUTCMonth() + 1).padStart(2, '0'),
  String(date.getUTCDate()).padStart(2, '0'),
].join('-');

const getMondayForIsoWeek = (weekKey: string): Date => {
  const match = /^(\d{4})-(\d{2})$/.exec(weekKey);
  if (!match) throw new TodayFriendDomainError('INVALID_WEEK_KEY');
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (!Number.isInteger(week) || week < 1 || week > 53) throw new TodayFriendDomainError('INVALID_WEEK_KEY');
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const januaryFourthWeekday = januaryFourth.getUTCDay() || 7;
  return new Date(januaryFourth.getTime() + ((week - 1) * 7 - januaryFourthWeekday + 1) * DAY_IN_MILLISECONDS);
};

export const createTodayFriendWeek = (weekKey: string, shuffleSeed: string = weekKey): TodayFriendWeek => {
  const monday = getMondayForIsoWeek(weekKey);
  const genres = shuffle(TODAY_FRIEND_GENRES, shuffleSeed);
  return {
    weekKey,
    days: genres.map((genre, index) => ({
      dateKey: formatDateKey(new Date(monday.getTime() + index * DAY_IN_MILLISECONDS)),
      weekday: TODAY_FRIEND_WEEKDAYS[index] ?? 1,
      genre,
    })),
  };
};

export const createTodayFriendTextPayload = (
  genre: TodayFriendGenre,
  text: string,
): TodayFriendPayload => {
  switch (genre) {
    case 'interview':
      return { kind: genre, answer: text };
    case 'commonality':
      return { kind: genre, commonality: text };
    case 'recommendation':
      return { kind: genre, category: 'book', title: text, reason: '', letterId: null };
    case 'compliment':
      return { kind: genre, compliment: text };
    case 'emotion':
      return { kind: genre, emotion: text, reason: '', declinedToExplain: false };
    default:
      return assertNever(genre);
  }
};

export const createTodayFriendPartnerAssignments = (
  studentNumbers: readonly number[],
  seedValue: string,
): readonly TodayFriendPartnerAssignment[] => {
  const uniqueStudents = [...new Set(studentNumbers)].filter((number) => (
    Number.isInteger(number) && number >= 1 && number <= TODAY_FRIEND_STUDENT_COUNT
  ));
  if (uniqueStudents.length !== studentNumbers.length || uniqueStudents.length < 2) {
    throw new TodayFriendDomainError('INVALID_STUDENT_ROSTER');
  }
  const shuffled = shuffle(uniqueStudents, seedValue);
  const cycleSize = shuffled.length % 2 === 0 ? 0 : 3;
  if (cycleSize > shuffled.length) throw new TodayFriendDomainError('INVALID_STUDENT_ROSTER');
  const pairCount = shuffled.length - cycleSize;
  const assignments: TodayFriendPartnerAssignment[] = [];
  for (let index = 0; index < pairCount; index += 2) {
    const first = shuffled[index];
    const second = shuffled[index + 1];
    if (first === undefined || second === undefined) throw new TodayFriendDomainError('INVALID_STUDENT_ROSTER');
    const groupId = `${seedValue}-pair-${index / 2 + 1}`;
    assignments.push(
      { studentNumber: first, partnerNumber: second, groupId, relationKind: 'pair' },
      { studentNumber: second, partnerNumber: first, groupId, relationKind: 'pair' },
    );
  }
  if (cycleSize === 3) {
    const cycle = shuffled.slice(-3);
    cycle.forEach((studentNumber, index) => {
      const partnerNumber = cycle[(index + 1) % cycle.length];
      if (partnerNumber === undefined) throw new TodayFriendDomainError('INVALID_STUDENT_ROSTER');
      assignments.push({ studentNumber, partnerNumber, groupId: `${seedValue}-cycle`, relationKind: 'cycle' });
    });
  }
  return assignments.sort((first, second) => first.studentNumber - second.studentNumber);
};

export const createDailyTodayFriendPartnerAssignments = (
  studentNumbers: readonly number[],
  dateKey: string,
): readonly TodayFriendPartnerAssignment[] => {
  const students = [...new Set(studentNumbers)]
    .filter((number) => Number.isInteger(number) && number >= 1 && number <= TODAY_FRIEND_STUDENT_COUNT)
    .sort((first, second) => first - second);
  if (students.length !== studentNumbers.length || students.length < 2) {
    throw new TodayFriendDomainError('INVALID_STUDENT_ROSTER');
  }

  const date = new Date(`${dateKey}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || formatDateKey(date) !== dateKey) {
    throw new TodayFriendDomainError('INVALID_DATE_KEY');
  }

  const weekdayIndex = (date.getUTCDay() + 6) % 7;
  const weekdayNumber = Math.floor((Math.floor(date.getTime() / DAY_IN_MILLISECONDS) - weekdayIndex) / 7) * 5 + Math.min(weekdayIndex, 4);
  const offset = ((weekdayNumber % (students.length - 1)) + students.length - 1) % (students.length - 1) + 1;
  const groupId = `${dateKey}-daily-offset-${offset}`;

  return students.map((studentNumber, index) => {
    const partnerNumber = students[(index + offset) % students.length];
    if (partnerNumber === undefined) throw new TodayFriendDomainError('INVALID_STUDENT_ROSTER');
    return { studentNumber, partnerNumber, groupId, relationKind: 'cycle' };
  });
};

export const createTodayFriendSubmission = (input: {
  readonly dateKey: string;
  readonly studentNumber: number;
  readonly partnerNumber: number;
  readonly genre: TodayFriendGenre;
  readonly payload: TodayFriendPayload;
}): TodayFriendSubmission => {
  if (input.genre !== input.payload.kind || input.studentNumber === input.partnerNumber) {
    throw new TodayFriendDomainError('INVALID_SUBMISSION');
  }
  return {
    id: `today-friend-${input.dateKey}-${input.studentNumber}`,
    ...input,
    status: 'draft',
    revision: 1,
    teacherFeedback: null,
    submittedAt: null,
    reviewedAt: null,
    rewardStatus: 'pending',
  };
};

export const submitTodayFriendSubmission = (
  submission: TodayFriendSubmission,
  submittedAt: string,
): TodayFriendSubmission => {
  if (submission.status !== 'draft' && submission.status !== 'revision_requested') {
    throw new TodayFriendDomainError('SUBMISSION_NOT_EDITABLE');
  }
  return {
    ...submission,
    status: 'submitted',
    revision: submission.status === 'revision_requested' ? submission.revision + 1 : submission.revision,
    teacherFeedback: null,
    submittedAt,
    reviewedAt: null,
  };
};

export const requestTodayFriendRevision = (
  submission: TodayFriendSubmission,
  teacherFeedback: string,
  reviewedAt: string,
): TodayFriendSubmission => {
  if (submission.status !== 'submitted' || teacherFeedback.trim().length === 0) {
    throw new TodayFriendDomainError('INVALID_REVISION_REQUEST');
  }
  return { ...submission, status: 'revision_requested', teacherFeedback: teacherFeedback.trim(), reviewedAt };
};

export const approveTodayFriendSubmission = (
  submission: TodayFriendSubmission,
  balance: number,
  reviewedAt: string,
): { readonly submission: TodayFriendSubmission; readonly awarded: boolean; readonly balance: number } => {
  if (submission.status === 'approved') return { submission, awarded: false, balance };
  if (submission.status !== 'submitted') throw new TodayFriendDomainError('SUBMISSION_NOT_REVIEWABLE');
  return {
    submission: { ...submission, status: 'approved', reviewedAt, rewardStatus: 'paid' },
    awarded: true,
    balance: balance + TODAY_FRIEND_REWARD,
  };
};

export const getTodayFriendNumber = (
  studentNumber: number,
  dateKey: string = getTodayFriendDateKey(),
): number => {
  return createDailyTodayFriendPartnerAssignments(
    Array.from({ length: TODAY_FRIEND_STUDENT_COUNT }, (_, index) => index + 1),
    dateKey,
  ).find((assignment) => assignment.studentNumber === studentNumber)?.partnerNumber ?? studentNumber;
};
