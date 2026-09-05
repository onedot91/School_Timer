import { LIBRARY_COMPETITION_OUR_SCHOOL_ID, LIBRARY_COMPETITION_SCHOOLS } from './libraryCompetition.js';
import type { LibraryCompetitionStanding } from './libraryCompetition.js';
import { parseCompetitionTimestamp } from './libraryCompetitionTime.js';
import { isLibraryLocalRecord } from './libraryCompetitionLocalSnapshot.js';
import { normalizeStudentLifeState, type StudentBook } from './studentLife.js';

export type LibraryCompetitionLocalArchive = {
  readonly seasonId: string;
  readonly archivedAt: string;
  readonly standings: readonly LibraryCompetitionStanding[];
  readonly books: readonly StudentBook[];
};

export function parseLibraryLocalArchives(value: unknown): readonly LibraryCompetitionLocalArchive[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const archives: LibraryCompetitionLocalArchive[] = [];
  for (const item of value) {
    if (!isLibraryLocalRecord(item) || typeof item.seasonId !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(item.seasonId)
      || typeof item.archivedAt !== 'string' || !parseCompetitionTimestamp(item.archivedAt)
      || archives.some(archive => archive.seasonId === item.seasonId)
      || !Array.isArray(item.books) || item.books.length > 100 || !Array.isArray(item.standings) || item.standings.length !== 17) return null;
    const standings: LibraryCompetitionStanding[] = [];
    for (const row of item.standings) {
      if (!isLibraryLocalRecord(row)) return null;
      const school = LIBRARY_COMPETITION_SCHOOLS.find(school => school.schoolId === row.schoolId);
      if (!school || standings.some(previous => previous.schoolId === school.schoolId)
        || row.schoolName !== school.schoolName || row.region !== school.region || row.rank !== standings.length + 1
        || typeof row.count !== 'number' || !Number.isInteger(row.count) || row.count < 0 || row.count > 100
        || typeof row.reachedAt !== 'string' || !parseCompetitionTimestamp(row.reachedAt)
        || row.isOurSchool !== (row.schoolId === LIBRARY_COMPETITION_OUR_SCHOOL_ID)) return null;
      standings.push({ ...school, count: row.count, reachedAt: row.reachedAt, rank: standings.length + 1,
        isOurSchool: school.schoolId === LIBRARY_COMPETITION_OUR_SCHOOL_ID });
    }
    const books = normalizeStudentLifeState({ books: item.books }).books;
    if (books.length !== item.books.length || books.some(book => book.librarySlot === undefined)
      || new Set(books.map(book => book.id)).size !== books.length) return null;
    archives.push({ seasonId: item.seasonId, archivedAt: item.archivedAt, standings, books });
  }
  return archives;
}
