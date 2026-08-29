export const FAILURE_STORY_TONES = [0, 1, 2, 3, 4, 5] as const;

export type FailureStoryTone = typeof FAILURE_STORY_TONES[number];

export interface FailureStoryToneSource {
  readonly id: string;
  readonly createdAt: string;
}

export const getFailureStoryTone = (storyId: string): FailureStoryTone => {
  let hash = 0;
  for (const character of storyId) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return FAILURE_STORY_TONES[hash % FAILURE_STORY_TONES.length] ?? 0;
};

export const createFailureStoryToneIndex = (
  sources: readonly FailureStoryToneSource[],
): ReadonlyMap<string, FailureStoryTone> => {
  const orderedSources = [...sources].sort((left, right) => (
    left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)
  ));
  const toneIndex = new Map<string, FailureStoryTone>();

  orderedSources.forEach((source) => {
    if (toneIndex.has(source.id)) return;
    const tone = FAILURE_STORY_TONES[toneIndex.size % FAILURE_STORY_TONES.length] ?? 0;
    toneIndex.set(source.id, tone);
  });

  return toneIndex;
};
