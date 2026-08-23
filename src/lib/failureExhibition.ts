export const FAILURE_STAMP_OPTIONS = [
  { id: 'me-too', label: '나도 그런 적 있어' },
  { id: 'brave', label: '다시 해 보려는 게 멋져' },
  { id: 'cheer', label: '다음엔 잘될 거야' },
] as const;

export type FailureStampId = (typeof FAILURE_STAMP_OPTIONS)[number]['id'];

const FAILURE_PROFILE_IMAGES = [
  '/failure-profiles/thumbs/01-bear.png',
  '/failure-profiles/thumbs/02-rabbit.png',
  '/failure-profiles/thumbs/03-cat.png',
  '/failure-profiles/thumbs/04-dog.png',
  '/failure-profiles/thumbs/05-fox.png',
  '/failure-profiles/thumbs/06-raccoon.png',
  '/failure-profiles/thumbs/07-panda.png',
  '/failure-profiles/thumbs/08-otter.png',
  '/failure-profiles/thumbs/09-penguin.png',
  '/failure-profiles/thumbs/10-chick.png',
  '/failure-profiles/thumbs/11-owl.png',
  '/failure-profiles/thumbs/12-frog.png',
  '/failure-profiles/thumbs/13-turtle.png',
  '/failure-profiles/thumbs/14-elephant.png',
  '/failure-profiles/thumbs/15-giraffe.png',
  '/failure-profiles/thumbs/16-lion.png',
  '/failure-profiles/thumbs/17-hippo.png',
  '/failure-profiles/thumbs/18-koala.png',
  '/failure-profiles/thumbs/19-squirrel.png',
  '/failure-profiles/thumbs/20-hamster.png',
  '/failure-profiles/thumbs/21-seal.png',
  '/failure-profiles/thumbs/22-whale.png',
  '/failure-profiles/thumbs/23-hedgehog.png',
] as const;

const PROFILE_DAY_MS = 24 * 60 * 60 * 1000;

const getKoreanProfileDateKey = (): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const getProfileDateOffset = (dateKey: string): number => {
  const timestamp = Date.parse(`${dateKey}T00:00:00Z`);
  if (!Number.isFinite(timestamp)) return 0;
  const dayNumber = Math.floor(timestamp / PROFILE_DAY_MS);
  return ((dayNumber % FAILURE_PROFILE_IMAGES.length) + FAILURE_PROFILE_IMAGES.length)
    % FAILURE_PROFILE_IMAGES.length;
};

const DAILY_FAILURE_PROFILE_RING = [
  7, 19, 2, 14, 22, 5, 11, 17, 1, 9, 16, 4, 20, 8, 13, 23, 6, 15, 10, 3, 18, 12, 21,
].map((profileNumber) => FAILURE_PROFILE_IMAGES[profileNumber - 1]);

export const getFailureProfileImage = (
  studentNumber: number,
  dateKey = getKoreanProfileDateKey(),
): string => {
  const studentIndex = Number.isInteger(studentNumber)
    && studentNumber >= 1
    && studentNumber <= FAILURE_PROFILE_IMAGES.length
    ? studentNumber - 1
    : 0;
  const profileIndex = (studentIndex + getProfileDateOffset(dateKey)) % DAILY_FAILURE_PROFILE_RING.length;
  return DAILY_FAILURE_PROFILE_RING[profileIndex] ?? FAILURE_PROFILE_IMAGES[0];
};

export interface FailureStoryStamp {
  readonly studentNumber: number;
  readonly stampId: FailureStampId;
}

export interface FailureStory {
  readonly id: string;
  readonly studentNumber: number;
  readonly failure: string;
  readonly lesson: string;
  readonly stamps: readonly FailureStoryStamp[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

const MAX_STUDENT_NUMBER = 23;
const MAX_FAILURE_STORIES = 300;
const MAX_STORY_LENGTH = 400;
export const FAILURE_RELAY_VISIBLE_COUNT = 5;

const isStudentNumber = (value: unknown): value is number => (
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_STUDENT_NUMBER
);

const isFailureStampId = (value: unknown): value is FailureStampId => (
  FAILURE_STAMP_OPTIONS.some((option) => option.id === value)
);

const normalizeStamps = (value: unknown): readonly FailureStoryStamp[] => {
  if (!Array.isArray(value)) return [];
  const byStudent = new Map<number, FailureStoryStamp>();
  value.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const stamp = entry as Partial<FailureStoryStamp>;
    if (!isStudentNumber(stamp.studentNumber) || !isFailureStampId(stamp.stampId)) return;
    if (!byStudent.has(stamp.studentNumber)) byStudent.set(stamp.studentNumber, {
      studentNumber: stamp.studentNumber,
      stampId: stamp.stampId,
    });
  });
  return [...byStudent.values()];
};

const normalizeFailureStory = (value: unknown): FailureStory | null => {
  if (!value || typeof value !== 'object') return null;
  const story = value as Partial<FailureStory>;
  const failure = typeof story.failure === 'string' ? story.failure.trim().slice(0, MAX_STORY_LENGTH) : '';
  const lesson = typeof story.lesson === 'string' ? story.lesson.trim().slice(0, MAX_STORY_LENGTH) : '';
  if (typeof story.id !== 'string' || story.id.length === 0 || !isStudentNumber(story.studentNumber)) return null;
  if (failure.length === 0 || lesson.length === 0 || typeof story.createdAt !== 'string') return null;
  return {
    id: story.id.slice(0, 80),
    studentNumber: story.studentNumber,
    failure,
    lesson,
    stamps: normalizeStamps(story.stamps),
    createdAt: story.createdAt,
    updatedAt: typeof story.updatedAt === 'string' ? story.updatedAt : story.createdAt,
  };
};

export const normalizeFailureStories = (value: unknown): readonly FailureStory[] => (
  (Array.isArray(value) ? value : [])
    .map(normalizeFailureStory)
    .filter((story): story is FailureStory => story !== null)
    .slice(-MAX_FAILURE_STORIES)
);

export const createFailureStory = (
  stories: readonly FailureStory[],
  input: Omit<FailureStory, 'stamps'>,
): readonly FailureStory[] => {
  if (stories.some((story) => story.id === input.id)) return stories;
  const story = normalizeFailureStory({ ...input, stamps: [] });
  return story ? [...stories, story].slice(-MAX_FAILURE_STORIES) : stories;
};

export const updateFailureStory = (
  stories: readonly FailureStory[],
  storyId: string,
  studentNumber: number,
  failure: string,
  lesson: string,
  updatedAt: string,
): readonly FailureStory[] => {
  const nextFailure = failure.trim().slice(0, MAX_STORY_LENGTH);
  const nextLesson = lesson.trim().slice(0, MAX_STORY_LENGTH);
  if (nextFailure.length === 0 || nextLesson.length === 0) return stories;
  return stories.map((story) => story.id === storyId && story.studentNumber === studentNumber
    ? { ...story, failure: nextFailure, lesson: nextLesson, updatedAt }
    : story);
};

export const deleteFailureStory = (
  stories: readonly FailureStory[],
  storyId: string,
  studentNumber: number,
): readonly FailureStory[] => (
  stories.filter((story) => story.id !== storyId || story.studentNumber !== studentNumber)
);

export const toggleFailureStamp = (
  stories: readonly FailureStory[],
  storyId: string,
  studentNumber: number,
  stampId: FailureStampId,
): readonly FailureStory[] => stories.map((story) => {
  if (story.id !== storyId || story.studentNumber === studentNumber) return story;
  const current = story.stamps.find((stamp) => stamp.studentNumber === studentNumber);
  const withoutCurrent = story.stamps.filter((stamp) => stamp.studentNumber !== studentNumber);
  return {
    ...story,
    stamps: current?.stampId === stampId
      ? withoutCurrent
      : [...withoutCurrent, { studentNumber, stampId }],
  };
});

export const getFailureStoriesNewestFirst = (stories: readonly FailureStory[]): readonly FailureStory[] => (
  [...stories].sort((left, right) => right.createdAt.localeCompare(left.createdAt))
);

export const getFailureRelayWindow = (
  stories: readonly FailureStory[],
  requestedOffset: number,
  visibleCount = FAILURE_RELAY_VISIBLE_COUNT,
): readonly FailureStory[] => {
  if (stories.length === 0) return [];
  const normalizedVisibleCount = Math.max(1, Math.trunc(visibleCount));
  const count = Math.min(stories.length, normalizedVisibleCount);
  const remainder = Math.trunc(requestedOffset) % stories.length;
  const offset = remainder < 0 ? remainder + stories.length : remainder;
  const tail = stories.slice(offset, offset + count);
  const head = stories.slice(0, count - tail.length);
  return [...tail, ...head];
};

export const getSelectedFailureStamp = (
  story: FailureStory,
  studentNumber: number,
): FailureStampId | null => (
  story.stamps.find((stamp) => stamp.studentNumber === studentNumber)?.stampId ?? null
);
