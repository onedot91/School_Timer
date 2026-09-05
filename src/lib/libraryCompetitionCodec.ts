import { LIBRARY_COMPETITION_OUR_SCHOOL_ID, LIBRARY_COMPETITION_SCHOOLS } from './libraryCompetitionTypes.js'
import type { LibraryCompetitionAdjustment, LibraryCompetitionCount, LibraryCompetitionPlacement, LibraryCompetitionState } from './libraryCompetitionTypes.js'
import { getLibraryCompetitionMonth, parseCompetitionTimestamp } from './libraryCompetitionTime.js'

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function boundedId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 200 && value.trim() === value
}

export function parseLibraryCompetitionCounts(value: unknown): readonly LibraryCompetitionCount[] | null {
  if (!Array.isArray(value) || value.length > 16) return null
  const counts: LibraryCompetitionCount[] = []
  for (const entry of value) {
    if (!record(entry) || typeof entry.schoolId !== 'string' || entry.schoolId === LIBRARY_COMPETITION_OUR_SCHOOL_ID
      || !LIBRARY_COMPETITION_SCHOOLS.some(school => school.schoolId === entry.schoolId)
      || counts.some(count => count.schoolId === entry.schoolId)
      || typeof entry.count !== 'number' || !Number.isInteger(entry.count) || entry.count < 0 || entry.count > 100) return null
    counts.push({ schoolId: entry.schoolId, count: entry.count })
  }
  return counts
}

export function parseLibraryCompetitionAdjustment(value: unknown): LibraryCompetitionAdjustment | null {
  if (!record(value) || !boundedId(value.id) || !parseCompetitionTimestamp(value.at)
    || typeof value.at !== 'string' || typeof value.paused !== 'boolean'
    || (value.speed !== 0.5 && value.speed !== 1 && value.speed !== 1.5)) return null
  const counts = parseLibraryCompetitionCounts(value.counts)
  return counts ? { id: value.id, at: value.at, speed: value.speed, paused: value.paused, counts } : null
}

export function parseLibraryCompetitionState(value: unknown): LibraryCompetitionState | null {
  if (!record(value) || value.version !== 1 || !boundedId(value.seed)
    || typeof value.seasonId !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value.seasonId)
    || typeof value.startedAt !== 'string' || !parseCompetitionTimestamp(value.startedAt)
    || getLibraryCompetitionMonth(value.startedAt) !== value.seasonId
    || typeof value.revision !== 'number' || !Number.isSafeInteger(value.revision) || value.revision < 0
    || !Array.isArray(value.placements) || value.placements.length > 100
    || !Array.isArray(value.adjustments) || value.adjustments.length > 2048) return null
  const placements: LibraryCompetitionPlacement[] = []
  for (const item of value.placements) {
    if (!record(item) || !boundedId(item.bookId) || typeof item.at !== 'string' || !parseCompetitionTimestamp(item.at)
      || item.at < value.startedAt || getLibraryCompetitionMonth(item.at) !== value.seasonId
      || placements.some(placement => placement.bookId === item.bookId)
      || item.at < (placements.at(-1)?.at ?? value.startedAt)) return null
    placements.push({ bookId: item.bookId, at: item.at })
  }
  const adjustments: LibraryCompetitionAdjustment[] = []
  for (const item of value.adjustments) {
    const adjustment = parseLibraryCompetitionAdjustment(item)
    if (!adjustment || adjustment.at < (adjustments.at(-1)?.at ?? value.startedAt)
      || getLibraryCompetitionMonth(adjustment.at) !== value.seasonId
      || adjustments.some(previous => previous.id === adjustment.id)) return null
    adjustments.push(adjustment)
  }
  return { version: 1, seasonId: value.seasonId, seed: value.seed, startedAt: value.startedAt, revision: value.revision, placements, adjustments }
}
