import { createHash } from 'node:crypto';
import type { LibraryCompetitionStanding } from '../lib/libraryCompetition.js';
import type { StudentBook } from '../lib/studentLife.js';
import { parseCompetitionHistoryResponse } from '../lib/libraryCompetitionResponse.js';
import { canonicalStorageJson } from '../lib/storageV2Codec.js';
import { commitScopedStorageMutation, loadScopedStorageSnapshot, StorageRepositoryError, type ScopedStorageSnapshot } from './storageV2Repository.js';
import { parseStorageScope, type StorageScope } from './storageScope.js';

export type CompetitionConfiguration = { readonly url: string; readonly key: string };
export type CompetitionRow = ScopedStorageSnapshot & { readonly id: 'school-timer-main'; readonly updated_at: string };
export type CompetitionArchive = { readonly seasonId: string; readonly archivedAt: string; readonly standings: readonly LibraryCompetitionStanding[]; readonly books: readonly unknown[] };
export class LibraryCompetitionError extends Error {
  readonly name = 'LibraryCompetitionError';
  constructor(readonly code: string, readonly status: number = 502) { super(code); }
}
export const competitionRecord = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : {};
const headers = (configuration: CompetitionConfiguration) => ({ apikey: configuration.key, Authorization: `Bearer ${configuration.key}`, 'Content-Type': 'application/json' });

export const libraryCompetitionStorageScope = (studentNumber?: number): StorageScope => parseStorageScope({
  resources: [{ path: '/libraryCompetition' }, { path: '/studentLife/books' }],
  writeResources: [{ path: '/libraryCompetition' }, { path: '/studentLife/books' }],
  wallets: studentNumber === undefined ? [] : [studentNumber],
  history: studentNumber === undefined ? [] : [studentNumber],
  writeWallets: studentNumber === undefined ? [] : [studentNumber],
  revisionKeys: ['scope:libraryCompetition:shared', 'collection:/studentLife/books'],
});

export async function loadCompetitionRow(configuration: CompetitionConfiguration, studentNumber?: number): Promise<CompetitionRow | null> {
  const snapshot = await loadScopedStorageSnapshot(configuration, libraryCompetitionStorageScope(studentNumber));
  return { ...snapshot, id: 'school-timer-main', updated_at: snapshot.updated_at };
}

export async function commitCompetition(configuration: CompetitionConfiguration, mutation: {
  readonly current: CompetitionRow | null;
  readonly value: Record<string, unknown>;
  readonly updatedAt: string;
  readonly archive?: CompetitionArchive;
  readonly actorKey?: string;
  readonly requestId?: string;
  readonly action?: string;
  readonly payload?: unknown;
  readonly result?: { readonly book: StudentBook };
}): Promise<boolean> {
  if (Buffer.byteLength(JSON.stringify(mutation.value), 'utf8') > 1_048_576) throw new LibraryCompetitionError('LIBRARY_COMPETITION_TOO_LARGE', 400);
  const snapshot = mutation.current ?? await loadScopedStorageSnapshot(configuration, libraryCompetitionStorageScope());
  const action = mutation.action ?? (mutation.archive ? 'libraryCompetitionRollover' : 'libraryCompetitionInitialize');
  const payload = mutation.payload ?? { previousSeason: competitionRecord(snapshot.value.libraryCompetition).seasonId ?? null,
    seasonId: competitionRecord(mutation.value.libraryCompetition).seasonId ?? null };
  const requestId = mutation.requestId ?? createHash('sha256').update(canonicalStorageJson({ action, payload })).digest('hex');
  const committed = await commitScopedStorageMutation(configuration, {
    snapshot, value: mutation.value,
    actorKey: mutation.actorKey ?? 'system:library', requestId, action, payload,
    result: { updatedAt: mutation.updatedAt, ...mutation.result },
    readKeys: ['scope:libraryCompetition:shared', 'collection:/studentLife/books'],
    ...(mutation.archive ? { archive: mutation.archive } : {}),
  }).catch((error: unknown) => {
    if (error instanceof StorageRepositoryError && error.code === 'STORAGE_DATABASE_HTTP_404') throw new LibraryCompetitionError('LIBRARY_COMPETITION_UNAVAILABLE', 503);
    throw error;
  });
  return committed.saved;
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
