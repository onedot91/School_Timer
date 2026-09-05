import { LIBRARY_COMPETITION_SCHOOLS, parseLibraryCompetitionState, type LibraryCompetitionStanding } from './libraryCompetition.js';
import { normalizeStudentLifeState } from './studentLife.js';
import type { LibraryCompetitionHistoryResponse, LibraryCompetitionResponse } from './libraryCompetitionTransport.js';

export const isCompetitionRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);
const isTime = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const isMonth = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

const parseStandings = (value: unknown): readonly LibraryCompetitionStanding[] | null => {
  if (!Array.isArray(value) || value.length !== 17) return null;
  const rows: LibraryCompetitionStanding[] = [];
  for (const [index, item] of value.entries()) {
    if (!isCompetitionRecord(item)) return null;
    const school = LIBRARY_COMPETITION_SCHOOLS.find(candidate => candidate.schoolId === item.schoolId);
    if (!school || item.schoolName !== school.schoolName || item.region !== school.region
      || typeof item.count !== 'number' || !Number.isInteger(item.count) || item.count < 0 || item.count > 100
      || !isTime(item.reachedAt) || item.rank !== index + 1 || item.isOurSchool !== (school.schoolId === 'school-03')
      || rows.some(row => row.schoolId === school.schoolId)) return null;
    rows.push({ ...school, count: item.count, reachedAt: item.reachedAt, rank: index + 1, isOurSchool: school.schoolId === 'school-03' });
  }
  return rows;
};

export const parseCompetitionResponse = (value: unknown): LibraryCompetitionResponse | null => {
  if (!isCompetitionRecord(value) || !isCompetitionRecord(value.competition) || !isCompetitionRecord(value.value)
    || (value.updatedAt !== null && !isTime(value.updatedAt)) || typeof value.rolledOver !== 'boolean') return null;
  const competition = value.competition;
  const updatedAt = isTime(value.updatedAt) ? value.updatedAt : null;
  if (!isTime(competition.serverAt)) return null;
  const state = parseLibraryCompetitionState(competition.state);
  if (competition.state !== null && !state) return null;
  const standings = state ? parseStandings(competition.standings)
    : Array.isArray(competition.standings) && competition.standings.length === 0 ? [] : null;
  if (!standings) return null;
  return { competition: { state, standings, serverAt: competition.serverAt }, value: value.value, updatedAt, rolledOver: value.rolledOver };
};

export const parseCompetitionHistoryResponse = (value: unknown): LibraryCompetitionHistoryResponse | null => {
  if (!isCompetitionRecord(value) || !Array.isArray(value.months)) return null;
  const months: { seasonId: string; archivedAt: string }[] = [];
  for (const month of value.months) {
    if (!isCompetitionRecord(month) || !isMonth(month.seasonId) || !isTime(month.archivedAt)
      || months.some(candidate => candidate.seasonId === month.seasonId)) return null;
    months.push({ seasonId: month.seasonId, archivedAt: month.archivedAt });
  }
  if (value.archive === null) return { months, archive: null };
  const archive = value.archive;
  if (!isCompetitionRecord(archive) || !isMonth(archive.seasonId) || !isTime(archive.archivedAt) || !Array.isArray(archive.books)) return null;
  const standings = parseStandings(archive.standings);
  const books = normalizeStudentLifeState({ books: archive.books }).books;
  if (!standings || books.length !== archive.books.length || books.length > 100
    || books.some(book => book.librarySlot === undefined)) return null;
  return { months, archive: { seasonId: archive.seasonId, archivedAt: archive.archivedAt, standings, books } };
};
