import { normalizeStudentLifeState } from './studentLife.js';

export function isLibraryLocalRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function preserveLibraryLocalFields(saved: string | null, incoming: Record<string, unknown>): Record<string, unknown> {
  if (saved === null) return incoming;
  const previous: unknown = JSON.parse(saved);
  if (!isLibraryLocalRecord(previous)) return incoming;
  const protectedFields = Object.fromEntries(['libraryCompetition', 'libraryCompetitionArchives', 'libraryCompetitionUpdatedAt']
    .filter(key => Object.hasOwn(previous, key)).map(key => [key, previous[key]]));
  return { ...incoming, ...protectedFields,
    ...(Object.hasOwn(previous, 'libraryCompetition') ? { studentLife: {
      ...normalizeStudentLifeState(incoming.studentLife), books: normalizeStudentLifeState(previous.studentLife).books,
    } } : {}),
  };
}
