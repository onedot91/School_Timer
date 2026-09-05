import { LibraryCompetitionInputError } from './libraryCompetitionTypes.js'

export const COMPETITION_MINUTE = 60_000
const HOUR = 60 * COMPETITION_MINUTE
export const COMPETITION_DAY = 24 * HOUR
const KST_OFFSET = 9 * HOUR

export function parseCompetitionTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value ? value : null
}

export function getLibraryCompetitionMonth(iso: string): string {
  const timestamp = Date.parse(iso)
  if (!Number.isFinite(timestamp)) throw new LibraryCompetitionInputError('invalid-time')
  return new Date(timestamp + KST_OFFSET).toISOString().slice(0, 7)
}

export function competitionMonthBounds(seasonId: string): { readonly start: number; readonly end: number } {
  const start = Date.parse(`${seasonId}-01T00:00:00+09:00`)
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(seasonId) || !Number.isFinite(start)) throw new LibraryCompetitionInputError('invalid-time')
  const next = new Date(start + KST_OFFSET)
  next.setUTCMonth(next.getUTCMonth() + 1)
  return { start, end: next.getTime() - KST_OFFSET }
}

export function competitionDayStart(at: number): number {
  return Math.floor((at + KST_OFFSET) / COMPETITION_DAY) * COMPETITION_DAY - KST_OFFSET
}

export function isCompetitionWeekday(at: number): boolean {
  const day = new Date(at + KST_OFFSET).getUTCDay()
  return day !== 0 && day !== 6
}

export function addCompetitionBusinessMinutes(at: number, minutes: number): number {
  let cursor = at
  let remaining = minutes * COMPETITION_MINUTE
  while (true) {
    const day = competitionDayStart(cursor)
    const opening = day + 8 * HOUR
    const closing = day + 16 * HOUR
    if (!isCompetitionWeekday(cursor) || cursor >= closing) {
      cursor = day + COMPETITION_DAY
      continue
    }
    cursor = Math.max(cursor, opening)
    const available = closing - cursor
    if (remaining < available) return cursor + remaining
    remaining -= available
    cursor = day + COMPETITION_DAY
  }
}
