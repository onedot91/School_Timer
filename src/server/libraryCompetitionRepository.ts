import type { StudentBook } from '../lib/studentLife.js';
import type { LibraryCompetitionStanding } from '../lib/libraryCompetition.js';
import { parseCompetitionHistoryResponse } from '../lib/libraryCompetitionResponse.js';

export type CompetitionConfiguration = { readonly url: string; readonly key: string };
export type CompetitionRow = { readonly id: 'school-timer-main'; readonly value: Record<string, unknown>; readonly updated_at: string };
export type CompetitionArchive = { readonly seasonId: string; readonly archivedAt: string; readonly standings: readonly LibraryCompetitionStanding[]; readonly books: readonly StudentBook[] };
export class LibraryCompetitionError extends Error {
  readonly name = 'LibraryCompetitionError';
  constructor(readonly code: string, readonly status: number = 502) { super(code); }
}
export const competitionRecord = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : {};
const headers = (configuration: CompetitionConfiguration) => ({ apikey: configuration.key, Authorization: `Bearer ${configuration.key}`, 'Content-Type': 'application/json' });

export async function loadCompetitionRow(configuration: CompetitionConfiguration): Promise<CompetitionRow | null> {
  const response = await fetch(`${configuration.url}/rest/v1/app_settings?id=eq.school-timer-main&select=id,value,updated_at`, { headers: headers(configuration), signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new LibraryCompetitionError('LIBRARY_COMPETITION_READ_FAILED');
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new LibraryCompetitionError('LIBRARY_COMPETITION_INVALID_RESPONSE');
  if (payload.length === 0) return null;
  const row = competitionRecord(payload[0]);
  if (row.id !== 'school-timer-main' || typeof row.updated_at !== 'string' || !Number.isFinite(Date.parse(row.updated_at)) || row.value === null || typeof row.value !== 'object' || Array.isArray(row.value)) throw new LibraryCompetitionError('LIBRARY_COMPETITION_INVALID_RESPONSE');
  return { id: 'school-timer-main', value: competitionRecord(row.value), updated_at: row.updated_at };
}

export async function commitCompetition(configuration: CompetitionConfiguration, mutation: {
  readonly current: CompetitionRow | null;
  readonly value: Record<string, unknown>;
  readonly updatedAt: string;
  readonly archive?: CompetitionArchive;
}): Promise<boolean> {
  if (Buffer.byteLength(JSON.stringify(mutation.value), 'utf8') > 1_048_576) throw new LibraryCompetitionError('LIBRARY_COMPETITION_TOO_LARGE', 400);
  const response = await fetch(`${configuration.url}/rest/v1/rpc/library_competition_commit`, {
    method: 'POST', headers: headers(configuration), signal: AbortSignal.timeout(8000),
    body: JSON.stringify({ p_expected_updated_at: mutation.current?.updated_at ?? null, p_value: mutation.value, p_updated_at: mutation.updatedAt, p_archive: mutation.archive ?? null }),
  });
  if (!response.ok) {
    if (response.status === 404) throw new LibraryCompetitionError('LIBRARY_COMPETITION_UNAVAILABLE', 503);
    throw new LibraryCompetitionError('LIBRARY_COMPETITION_SAVE_FAILED');
  }
  const payload = competitionRecord(await response.json());
  if (typeof payload.saved !== 'boolean') throw new LibraryCompetitionError('LIBRARY_COMPETITION_INVALID_RESPONSE');
  return payload.saved;
}

export async function loadCompetitionHistory(configuration: CompetitionConfiguration, month?: string) {
  const query = new URLSearchParams({ settings_id: 'eq.school-timer-main', select: month ? 'season_id,archived_at,standings,books' : 'season_id,archived_at', order: 'season_id.desc' });
  if (month) query.set('season_id', `eq.${month}`);
  const response = await fetch(`${configuration.url}/rest/v1/library_competition_archives?${query}`, { headers: headers(configuration), signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new LibraryCompetitionError(response.status === 404 ? 'LIBRARY_COMPETITION_UNAVAILABLE' : 'LIBRARY_COMPETITION_READ_FAILED', response.status === 404 ? 503 : 502);
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new LibraryCompetitionError('LIBRARY_COMPETITION_INVALID_RESPONSE');
  const rows = payload.map(competitionRecord);
  if (rows.some(row => typeof row.season_id !== 'string' || typeof row.archived_at !== 'string')) throw new LibraryCompetitionError('LIBRARY_COMPETITION_INVALID_RESPONSE');
  const selected = month ? rows.find(row => row.season_id === month) : undefined;
  const parsed = parseCompetitionHistoryResponse({ months: rows.map(row => ({ seasonId: row.season_id, archivedAt: row.archived_at })), archive: selected ? { seasonId: selected.season_id, archivedAt: selected.archived_at, standings: selected.standings, books: selected.books } : null });
  if (!parsed) throw new LibraryCompetitionError('LIBRARY_COMPETITION_INVALID_RESPONSE');
  return { ok: true, ...parsed };
}
