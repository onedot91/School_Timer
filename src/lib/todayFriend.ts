import { TEST_STUDENT_NUMBER } from './studentIdentity.js';
import { getKoreanLocalDateKey } from './studentEmotion.js';

export const TODAY_FRIEND_REWARD = 15;
export const TODAY_FRIEND_STUDENT_COUNT = 23;
export const isTodayFriendStudentNumber = (value: unknown): value is number => (
  typeof value === 'number'
  && Number.isInteger(value)
  && value >= 1
  && value <= TODAY_FRIEND_STUDENT_COUNT
  && value !== TEST_STUDENT_NUMBER
);
export const canViewTodayFriendMissionPage = (value: unknown): value is number => (
  isTodayFriendStudentNumber(value) || value === TEST_STUDENT_NUMBER
);
export const TODAY_FRIEND_STUDENT_NUMBERS = Array.from(
  { length: TODAY_FRIEND_STUDENT_COUNT },
  (_, index) => index + 1,
).filter((studentNumber) => studentNumber !== TEST_STUDENT_NUMBER);
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
export type TodayFriendSubmissionStatus = 'draft' | 'submitted' | 'approved';
export type TodayFriendRewardStatus = 'pending' | 'paid';

export const TODAY_FRIEND_GENRE_LABELS = {
  interview: '인터뷰하기',
  commonality: '공통점 찾기',
  recommendation: '추천하기',
  compliment: '칭찬하기',
  emotion: '감정 찾기',
} as const satisfies Readonly<Record<TodayFriendGenre, string>>;

export const getTodayFriendHeaderTitle = (genre: TodayFriendGenre | null): string => (
  genre ? `오늘의 친구 · ${TODAY_FRIEND_GENRE_LABELS[genre]}` : '오늘의 친구'
);

export const getTodayFriendPreviewGenre = (
  missionGenre: TodayFriendGenre,
  selectedGenre: TodayFriendGenre,
): TodayFriendGenre | null => selectedGenre === missionGenre ? null : selectedGenre;

export type TodayFriendPayload =
  | { readonly kind: 'interview'; readonly answer: string }
  | { readonly kind: 'commonality'; readonly commonality: string }
  | { readonly kind: 'recommendation'; readonly category: 'movie' | 'book' | 'music' | 'food'; readonly title: string; readonly reason: string; readonly letterId: string | null }
  | { readonly kind: 'compliment'; readonly compliment: string; readonly reason?: string; readonly message?: string; readonly letterId?: string | null }
  | { readonly kind: 'emotion'; readonly emotion: string; readonly reason: string; readonly declinedToExplain: boolean };

export const TODAY_FRIEND_COMMONALITY_COUNT = 3;
export type TodayFriendCommonalities = readonly [string, string, string];

const COMMONALITY_ITEM_SPLIT = /\n(?=\d+\.\s)/;

export const parseTodayFriendCommonalities = (value: string): TodayFriendCommonalities => {
  const trimmed = value.trim();
  if (!trimmed) return ['', '', ''];
  const parts = trimmed.split(COMMONALITY_ITEM_SPLIT).map((part) => part.replace(/^\d+\.\s+/, '').trim());
  if (parts.length >= 2) {
    return [parts[0] ?? '', parts[1] ?? '', parts[2] ?? ''];
  }
  return [trimmed, '', ''];
};

export const formatTodayFriendCommonalities = (items: readonly string[]): string => (
  items
    .slice(0, TODAY_FRIEND_COMMONALITY_COUNT)
    .map((item, index) => `${index + 1}. ${item.trim()}`)
    .join('\n')
);

export type TodayFriendMateLetter = {
  readonly id: string;
  readonly recipient: number;
  readonly title: string;
  readonly content: string;
};

const TODAY_FRIEND_RECOMMENDATION_CATEGORY_LABELS = {
  movie: { title: '영화', object: '영화를' },
  book: { title: '책', object: '책을' },
  music: { title: '음악', object: '음악을' },
  food: { title: '음식', object: '음식을' },
} as const satisfies Readonly<Record<
  Extract<TodayFriendPayload, { kind: 'recommendation' }>['category'],
  { readonly title: string; readonly object: string }
>>;

export const createTodayFriendRecommendationLetter = (input: {
  readonly dateKey: string;
  readonly studentNumber: number;
  readonly partnerNumber: number;
  readonly revision: number;
  readonly payload: Extract<TodayFriendPayload, { kind: 'recommendation' }>;
}): TodayFriendMateLetter => {
  const categoryCopy = TODAY_FRIEND_RECOMMENDATION_CATEGORY_LABELS[input.payload.category];
  return {
    id: `today-friend-recommendation-${input.dateKey}-${input.studentNumber}-r${input.revision}`,
    recipient: input.partnerNumber,
    title: `[오늘의 친구] ${categoryCopy.title} 추천`,
    content: `오늘의 친구인 너에게 ${categoryCopy.object} 추천하고 싶어.\n내가 추천할 것은 바로 이것이야.\n「${input.payload.title}」\n추천하는 이유는 이거야.\n“${input.payload.reason}”`,
  };
};

export const createTodayFriendRecommendationDelivery = (input: Parameters<typeof createTodayFriendRecommendationLetter>[0]) => {
  const letter = createTodayFriendRecommendationLetter(input);
  return {
    letter,
    payload: { ...input.payload, letterId: letter.id },
  } as const;
};

export const createTodayFriendComplimentLetter = (input: {
  readonly dateKey: string;
  readonly studentNumber: number;
  readonly partnerNumber: number;
  readonly revision: number;
  readonly payload: Extract<TodayFriendPayload, { kind: 'compliment' }>;
}): TodayFriendMateLetter => ({
  id: `today-friend-compliment-${input.dateKey}-${input.studentNumber}-r${input.revision}`,
  recipient: input.partnerNumber,
  title: '[오늘의 친구] 칭찬 편지',
  content: `나는 오늘의 친구인 너를 칭찬하고 싶어.\n네가 보여 준 멋진 행동은 이거야.\n“${input.payload.compliment}”\n그 행동이 좋았던 이유는 이거야.\n“${input.payload.reason ?? ''}”\n그리고 너에게 이렇게 말하고 싶어.\n“${input.payload.message ?? ''}”`,
});

export const createTodayFriendComplimentDelivery = (input: Parameters<typeof createTodayFriendComplimentLetter>[0]) => {
  const letter = createTodayFriendComplimentLetter(input);
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
  readonly storageRevision?: number;
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
  const uniqueStudents = [...new Set(studentNumbers)].filter(isTodayFriendStudentNumber);
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
    .filter(isTodayFriendStudentNumber)
    .sort((first, second) => first - second);
  if (students.length !== studentNumbers.length || students.length < 2) {
    throw new TodayFriendDomainError('INVALID_STUDENT_ROSTER');
  }

  const date = new Date(`${dateKey}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || formatDateKey(date) !== dateKey) {
    throw new TodayFriendDomainError('INVALID_DATE_KEY');
  }

  if (students.length !== TODAY_FRIEND_STUDENT_COUNT) {
    return createTodayFriendPartnerAssignments(students, `${dateKey}-daily-pairs`);
  }
  const weekdayIndex = (date.getUTCDay() + 6) % 7;
  const weekdayNumber = Math.floor((Math.floor(date.getTime() / DAY_IN_MILLISECONDS) - weekdayIndex) / 7) * 5 + Math.min(weekdayIndex, 4);
  const offset = ((weekdayNumber % students.length) + students.length) % students.length;
  const rotated = [...students.slice(offset), ...students.slice(0, offset)];
  const assignments: TodayFriendPartnerAssignment[] = [];
  const add = (from: number, to: number, groupId: string, relationKind: TodayFriendRelationKind) => {
    const studentNumber = rotated[from];
    const partnerNumber = rotated[to];
    if (studentNumber === undefined || partnerNumber === undefined) throw new TodayFriendDomainError('INVALID_STUDENT_ROSTER');
    assignments.push({ studentNumber, partnerNumber, groupId, relationKind });
  };
  for (let index = 2; index <= 11; index += 1) {
    const groupId = `${dateKey}-pair-${index - 1}`;
    add(index, 23 - index, groupId, 'pair');
    add(23 - index, index, groupId, 'pair');
  }
  // Alternating the cycle direction avoids repeated partners as the roster rotates.
  const cycle = weekdayNumber % 2 === 0 ? [0, 1, 22] : [0, 22, 1];
  cycle.forEach((from, index) => add(from, cycle[(index + 1) % 3], `${dateKey}-cycle`, 'cycle'));
  return assignments.sort((first, second) => first.studentNumber - second.studentNumber);
};

export const createTodayFriendSubmission = (input: {
  readonly dateKey: string;
  readonly studentNumber: number;
  readonly partnerNumber: number;
  readonly genre: TodayFriendGenre;
  readonly payload: TodayFriendPayload;
}): TodayFriendSubmission => {
  if (
    input.genre !== input.payload.kind
    || input.studentNumber === input.partnerNumber
    || !isTodayFriendStudentNumber(input.studentNumber)
    || !isTodayFriendStudentNumber(input.partnerNumber)
  ) {
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
  if (submission.status !== 'draft' && submission.status !== 'submitted') {
    throw new TodayFriendDomainError('SUBMISSION_NOT_EDITABLE');
  }
  return {
    ...submission,
    status: 'submitted',
    revision: submission.status === 'submitted' ? submission.revision + 1 : submission.revision,
    teacherFeedback: null,
    submittedAt,
    reviewedAt: null,
  };
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
    TODAY_FRIEND_STUDENT_NUMBERS,
    dateKey,
  ).find((assignment) => assignment.studentNumber === studentNumber)?.partnerNumber ?? studentNumber;
};

export const TODAY_FRIEND_PREVIEW_INTERVIEW_QUESTION = '요즘 가장 재미있게 한 일은 무엇인가요?';

export const getTodayFriendLayoutPreview = (studentNumber: number, dateKey: string) => {
  if (!canViewTodayFriendMissionPage(studentNumber)) return null;
  const rosterNumber = isTodayFriendStudentNumber(studentNumber)
    ? studentNumber
    : TODAY_FRIEND_STUDENT_NUMBERS[Number(dateKey.replaceAll('-', '')) % TODAY_FRIEND_STUDENT_NUMBERS.length] ?? 1;
  const partnerNumber = getTodayFriendNumber(rosterNumber, dateKey);
  if (!isTodayFriendStudentNumber(partnerNumber) || partnerNumber === studentNumber) return null;
  return {
    dateKey,
    studentNumber,
    partnerNumber,
    genre: TODAY_FRIEND_GENRES[0],
    question: TODAY_FRIEND_PREVIEW_INTERVIEW_QUESTION,
  } as const;
};
