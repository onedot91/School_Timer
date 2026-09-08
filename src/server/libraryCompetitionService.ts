import { randomUUID } from 'node:crypto';
import { adjustLibraryCompetition, createLibraryCompetition, getLibraryCompetitionMonth, parseLibraryCompetitionState, projectLibraryCompetition, parseLibraryCompetitionCounts } from '../lib/libraryCompetition.js';
import { commitCompetition, competitionRecord, LibraryCompetitionError, loadCompetitionRow, type CompetitionConfiguration, type CompetitionRow, type CompetitionArchive } from './libraryCompetitionRepository.js';
import { getStorageReceipt } from './storageV2Repository.js';

export const competitionTimestamp = (row: CompetitionRow | null): string => new Date(Math.max(Date.now(), row ? Date.parse(row.updated_at) + 1 : 0)).toISOString();

export function competitionView(row: CompetitionRow | null, at = new Date(Math.max(Date.now(), row ? Date.parse(row.updated_at) : 0)).toISOString()) {
  const state = parseLibraryCompetitionState(row?.value.libraryCompetition);
  return { state, standings: state ? projectLibraryCompetition(state, at) : [], serverAt: at };
}

export async function ensureCompetition(configuration: CompetitionConfiguration, initialize: boolean) {
  let rolledOver = false;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const row = await loadCompetitionRow(configuration);
    const state = parseLibraryCompetitionState(row?.value.libraryCompetition);
    if (row?.value.libraryCompetition && !state) throw new LibraryCompetitionError('LIBRARY_COMPETITION_INVALID_STATE');
    const at = competitionTimestamp(row);
    const month = getLibraryCompetitionMonth(at);
    if ((!state && !initialize) || state?.seasonId === month) return { row, rolledOver };
    const life = competitionRecord(row?.value.studentLife);
    const books = Array.isArray(life.books) ? life.books : [];
    const placed = books.filter(book => Object.hasOwn(competitionRecord(book), 'librarySlot'));
    const bookIds = placed.map(book => competitionRecord(book).id).filter((id): id is string => typeof id === 'string');
    const initial = createLibraryCompetition({ seasonId: month, seed: randomUUID(), startedAt: at, bookIds: state ? [] : bookIds });
    const previousSettings = state?.adjustments.at(-1);
    const configured = previousSettings ? adjustLibraryCompetition(initial, { id: randomUUID(), at, speed: previousSettings.speed, paused: previousSettings.paused, counts: [] }) : initial;
    const next = { ...configured, revision: state ? state.revision + 1 : 0 };
    let archive: CompetitionArchive | undefined;
    if (state) {
      const [year = 0, monthNumber = 0] = state.seasonId.split('-').map(Number);
      const end = new Date(Date.UTC(year, monthNumber, 1) - 9 * 3_600_000 - 1).toISOString();
      archive = { seasonId: state.seasonId, archivedAt: at, standings: projectLibraryCompetition(state, end), books: placed };
    }
    const value = { ...row?.value, libraryCompetition: next, studentLife: { ...life, books: state ? books.filter(book => !Object.hasOwn(competitionRecord(book), 'librarySlot')) : books } };
    try {
      if (await commitCompetition(configuration, { current: row, value, updatedAt: at, archive })) {
        return { row: await loadCompetitionRow(configuration), rolledOver: Boolean(state) };
      }
    } catch (error) {
      if (!(error instanceof TypeError) && !(error instanceof DOMException && error.name === 'TimeoutError')) throw error;
      // A lost response can follow a committed transaction; re-read instead of replaying its archive.
      rolledOver = Boolean(state);
    }
    if (attempt < 4) await new Promise<void>(resolve => setTimeout(resolve, 20 * 2 ** attempt + Math.floor(Math.random() * 31)));
  }
  throw new LibraryCompetitionError('SHARED_SETTINGS_CONFLICT', 409);
}

export async function updateCompetitionSettings(configuration: CompetitionConfiguration, body: Record<string, unknown>) {
  const counts = parseLibraryCompetitionCounts(body.counts);
  if (!Number.isInteger(body.expectedRevision) || typeof body.expectedRevision !== 'number' || body.expectedRevision < 0 || (body.speed !== 0.5 && body.speed !== 1 && body.speed !== 1.5) || typeof body.paused !== 'boolean' || !counts) throw new LibraryCompetitionError('LIBRARY_COMPETITION_INVALID', 400);
  const payload = { expectedRevision: body.expectedRevision, speed: body.speed, paused: body.paused, counts };
  if (typeof body.requestId === 'string') {
    const receipt = await getStorageReceipt(configuration, 'teacher', body.requestId, { action: 'libraryCompetitionSettings', payload });
    if (receipt.found) return { row: await loadCompetitionRow(configuration), rolledOver: false };
  }
  const ensured = await ensureCompetition(configuration, false);
  const row = ensured.row;
  const state = parseLibraryCompetitionState(row?.value.libraryCompetition);
  if (!row || !state) throw new LibraryCompetitionError('LIBRARY_COMPETITION_NOT_STARTED', 409);
  if (state.revision !== body.expectedRevision || ensured.rolledOver) throw new LibraryCompetitionError('LIBRARY_COMPETITION_CONFLICT', 409);
  const at = competitionTimestamp(row);
  const next = adjustLibraryCompetition(state, { id: randomUUID(), at, speed: body.speed, paused: body.paused, counts });
  const value = { ...row.value, libraryCompetition: next };
  if (!await commitCompetition(configuration, { current: row, value, updatedAt: at,
    actorKey: 'teacher', requestId: typeof body.requestId === 'string' ? body.requestId : undefined,
    action: 'libraryCompetitionSettings', payload,
  })) throw new LibraryCompetitionError('LIBRARY_COMPETITION_CONFLICT', 409);
  return { row: await loadCompetitionRow(configuration), rolledOver: false };
}

export const isCompetitionCommand = (body: unknown): boolean => {
  const action = competitionRecord(body).action;
  return action === 'libraryCompetition' || action === 'libraryCompetitionSettings' || action === 'libraryCompetitionHistory';
};
