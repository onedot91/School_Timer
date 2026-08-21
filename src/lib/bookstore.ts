export type FeaturedWriting = {
  readonly id: string;
  readonly title: string;
  readonly author: string;
  readonly summary: string;
  readonly content: string;
  readonly isPublished: boolean;
};

export type BookstoreSettings = {
  readonly featuredWritings: readonly FeaturedWriting[];
};

const BOOKSTORE_SETTINGS_STORAGE_KEY = 'school-timer-bookstore-settings-v1';
const MAX_FEATURED_WRITINGS = 24;
const MAX_TITLE_LENGTH = 80;
const MAX_AUTHOR_LENGTH = 30;
const MAX_SUMMARY_LENGTH = 240;
const MAX_CONTENT_LENGTH = 10_000;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const normalizeText = (value: unknown, maximumLength: number): string => (
  typeof value === 'string' ? value.trim().slice(0, maximumLength) : ''
);

const parseFeaturedWriting = (value: unknown): FeaturedWriting | null => {
  if (!isRecord(value)) return null;
  const id = normalizeText(value.id, 80);
  if (!id) return null;

  return {
    id,
    title: normalizeText(value.title, MAX_TITLE_LENGTH),
    author: normalizeText(value.author, MAX_AUTHOR_LENGTH),
    summary: normalizeText(value.summary, MAX_SUMMARY_LENGTH),
    content: normalizeText(value.content, MAX_CONTENT_LENGTH),
    isPublished: value.isPublished === true,
  };
};

export const createEmptyFeaturedWriting = (id: string): FeaturedWriting => ({
  id,
  title: '',
  author: '',
  summary: '',
  content: '',
  isPublished: false,
});

export const normalizeBookstoreSettings = (value: unknown): BookstoreSettings => {
  const featuredWritings = isRecord(value) && Array.isArray(value.featuredWritings)
    ? value.featuredWritings
      .map(parseFeaturedWriting)
      .filter((writing): writing is FeaturedWriting => writing !== null)
      .slice(0, MAX_FEATURED_WRITINGS)
    : [];

  return { featuredWritings };
};

export const moveFeaturedWriting = (
  writings: readonly FeaturedWriting[],
  writingId: string,
  offset: -1 | 1,
): readonly FeaturedWriting[] => {
  const currentIndex = writings.findIndex((writing) => writing.id === writingId);
  const targetIndex = currentIndex + offset;
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= writings.length) return writings;

  return writings.map((writing, index) => {
    if (index === currentIndex) return writings[targetIndex] ?? writing;
    if (index === targetIndex) return writings[currentIndex] ?? writing;
    return writing;
  });
};

export const loadStoredBookstoreSettings = (): BookstoreSettings => {
  try {
    const stored = window.localStorage.getItem(BOOKSTORE_SETTINGS_STORAGE_KEY);
    return normalizeBookstoreSettings(stored ? JSON.parse(stored) : null);
  } catch (error) {
    if (error instanceof Error) return normalizeBookstoreSettings(null);
    throw error;
  }
};

export const storeBookstoreSettings = (settings: BookstoreSettings): void => {
  window.localStorage.setItem(
    BOOKSTORE_SETTINGS_STORAGE_KEY,
    JSON.stringify(normalizeBookstoreSettings(settings)),
  );
};
