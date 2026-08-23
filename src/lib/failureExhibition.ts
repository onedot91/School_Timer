export const FAILURE_STAMP_OPTIONS = [
  { id: 'me-too', label: '나도 그런 적 있어' },
  { id: 'brave', label: '다시 해 보려는 게 멋져' },
  { id: 'cheer', label: '다음엔 잘될 거야' },
] as const;

export type FailureStampId = (typeof FAILURE_STAMP_OPTIONS)[number]['id'];

export const FAILURE_PROFILE_IMAGES = [
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
  '/failure-profiles/thumbs/24-pig.png',
  '/failure-profiles/thumbs/25-cow.png',
  '/failure-profiles/thumbs/26-horse.png',
  '/failure-profiles/thumbs/27-zebra.png',
  '/failure-profiles/thumbs/28-deer.png',
  '/failure-profiles/thumbs/29-sheep.png',
  '/failure-profiles/thumbs/30-goat.png',
  '/failure-profiles/thumbs/31-alpaca.png',
  '/failure-profiles/thumbs/32-camel.png',
  '/failure-profiles/thumbs/33-monkey.png',
  '/failure-profiles/thumbs/34-gorilla.png',
  '/failure-profiles/thumbs/35-sloth.png',
  '/failure-profiles/thumbs/36-kangaroo.png',
  '/failure-profiles/thumbs/37-platypus.png',
  '/failure-profiles/thumbs/38-beaver.png',
  '/failure-profiles/thumbs/39-skunk.png',
  '/failure-profiles/thumbs/40-badger.png',
  '/failure-profiles/thumbs/41-mole.png',
  '/failure-profiles/thumbs/42-bat.png',
  '/failure-profiles/thumbs/43-parrot.png',
  '/failure-profiles/thumbs/44-flamingo.png',
  '/failure-profiles/thumbs/45-peacock.png',
  '/failure-profiles/thumbs/46-swan.png',
  '/failure-profiles/thumbs/47-crocodile.png',
  '/failure-profiles/thumbs/48-chameleon.png',
  '/failure-profiles/thumbs/49-octopus.png',
  '/failure-profiles/thumbs/50-dolphin.png',
] as const;

const FAILURE_PROFILE_NAMES = [
  '곰', '토끼', '고양이', '강아지', '여우', '너구리', '판다', '수달', '펭귄', '병아리',
  '부엉이', '개구리', '거북이', '코끼리', '기린', '사자', '하마', '코알라', '다람쥐', '햄스터',
  '물개', '고래', '고슴도치', '돼지', '소', '말', '얼룩말', '사슴', '양', '염소',
  '알파카', '낙타', '원숭이', '고릴라', '나무늘보', '캥거루', '오리너구리', '비버', '스컹크', '오소리',
  '두더지', '박쥐', '앵무새', '홍학', '공작', '백조', '악어', '카멜레온', '문어', '돌고래',
] as const;

const DEFAULT_FAILURE_PROFILE_RING = [
  7, 19, 2, 14, 22, 5, 11, 17, 1, 9, 16, 4, 20, 8, 13, 23, 6, 15, 10, 3, 18, 12, 21,
  24, 31, 38, 45, 27, 34, 41, 48, 25, 32, 39, 46, 28, 35, 42, 49, 26, 33, 40, 47, 29, 36,
  43, 50, 30, 37, 44,
].map((profileNumber) => FAILURE_PROFILE_IMAGES[profileNumber - 1]);

export type FailureProfileAssignments = Readonly<Record<string, string>>;

export const FAILURE_PROFILE_OPTIONS = FAILURE_PROFILE_IMAGES.map((imageSrc, index) => ({
  id: imageSrc,
  imageSrc,
  label: FAILURE_PROFILE_NAMES[index] ?? `동물 ${index + 1}`,
}));

const isFailureProfileImage = (value: unknown): value is string => (
  typeof value === 'string' && FAILURE_PROFILE_IMAGES.some((image) => image === value)
);

export const normalizeFailureProfileAssignments = (value: unknown): FailureProfileAssignments => {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const assignments: Record<string, string> = {};
  const used = new Set<string>();
  for (let studentNumber = 1; studentNumber <= 23; studentNumber += 1) {
    const studentKey = String(studentNumber);
    const requested = source[studentKey];
    const fallback = DEFAULT_FAILURE_PROFILE_RING[studentNumber - 1] ?? FAILURE_PROFILE_IMAGES[0];
    const preferred = isFailureProfileImage(requested) ? requested : fallback;
    const profile = !used.has(preferred)
      ? preferred
      : !used.has(fallback)
        ? fallback
        : FAILURE_PROFILE_IMAGES.find((image) => !used.has(image)) ?? FAILURE_PROFILE_IMAGES[0];
    assignments[studentKey] = profile;
    used.add(profile);
  }
  return assignments;
};

export const getFailureProfileImage = (
  studentNumber: number,
  assignments?: FailureProfileAssignments,
): string => {
  const studentIndex = Number.isInteger(studentNumber)
    && studentNumber >= 1
    && studentNumber <= 23
    ? studentNumber - 1
    : 0;
  const assigned = assignments?.[String(studentIndex + 1)];
  return isFailureProfileImage(assigned)
    ? assigned
    : DEFAULT_FAILURE_PROFILE_RING[studentIndex] ?? FAILURE_PROFILE_IMAGES[0];
};

export type SelectFailureProfileResult = {
  readonly assignments: FailureProfileAssignments;
  readonly applied: boolean;
  readonly reason: 'selected' | 'already_selected' | 'profile_in_use' | 'invalid_profile';
};

export const selectFailureProfile = (
  current: unknown,
  studentNumber: number,
  profileImage: string,
): SelectFailureProfileResult => {
  const assignments = normalizeFailureProfileAssignments(current);
  if (!Number.isInteger(studentNumber) || studentNumber < 1 || studentNumber > 23 || !isFailureProfileImage(profileImage)) {
    return { assignments, applied: false, reason: 'invalid_profile' };
  }
  const studentKey = String(studentNumber);
  if (assignments[studentKey] === profileImage) {
    return { assignments, applied: false, reason: 'already_selected' };
  }
  const isUsedByAnotherStudent = Object.entries(assignments).some(([key, image]) => (
    key !== studentKey && image === profileImage
  ));
  if (isUsedByAnotherStudent) {
    return { assignments, applied: false, reason: 'profile_in_use' };
  }
  return {
    assignments: { ...assignments, [studentKey]: profileImage },
    applied: true,
    reason: 'selected',
  };
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
