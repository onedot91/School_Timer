import type { LibraryCompetitionAdjustment, LibraryCompetitionSpeed, LibraryCompetitionState } from './libraryCompetitionTypes.js'
import type { LibraryCompetitionProfile } from './libraryCompetitionProfiles.js'
import { competitionRandom } from './libraryCompetitionProfiles.js'
import { COMPETITION_DAY, COMPETITION_MINUTE, addCompetitionBusinessMinutes, competitionDayStart, isCompetitionWeekday } from './libraryCompetitionTime.js'

export type LibraryCompetitionEvent =
  | { readonly kind: 'placement'; readonly at: number; readonly id: string; readonly order: 0 }
  | { readonly kind: 'adjustment'; readonly at: number; readonly id: string; readonly order: 1; readonly adjustment: LibraryCompetitionAdjustment }
  | { readonly kind: 'growth'; readonly at: number; readonly id: string; readonly order: 2; readonly schoolId: string; readonly source: 'response' | 'passive' | 'catchup' }

export function getLibraryCompetitionSettings(state: LibraryCompetitionState, at: string): { readonly speed: LibraryCompetitionSpeed; readonly paused: boolean } {
  for (let index = state.adjustments.length - 1; index >= 0; index -= 1) {
    const adjustment = state.adjustments[index]
    if (adjustment && adjustment.at <= at) return { speed: adjustment.speed, paused: adjustment.paused }
  }
  return { speed: 1, paused: false }
}

export function createLibraryCompetitionEvents(state: LibraryCompetitionState, profiles: readonly LibraryCompetitionProfile[], end: number): readonly LibraryCompetitionEvent[] {
  const events: LibraryCompetitionEvent[] = []
  const seed = `${state.seasonId}:${state.seed}`
  const firstPlacement = state.placements[0]
  const catchupStart = firstPlacement ? addCompetitionBusinessMinutes(Date.parse(firstPlacement.at), 45) : Infinity
  for (const [placementIndex, placement] of state.placements.entries()) {
    const at = Date.parse(placement.at)
    if (at > end) continue
    events.push({ kind: 'placement', at, id: placement.bookId, order: 0 })
    const settings = getLibraryCompetitionSettings(state, placement.at)
    if (settings.paused) continue
    for (const profile of profiles) {
      const key = `${seed}:${profile.schoolId}:response:${placementIndex}`
      if (competitionRandom(key) >= Math.min(1, profile.responseProbability * settings.speed)) continue
      const schoolDay = `${seed}:${profile.schoolId}:activity:${competitionDayStart(at)}`
      const interval = 30 + Math.floor(competitionRandom(`${schoolDay}:interval`) * 31)
      const phase = Math.floor(competitionRandom(`${schoolDay}:phase`) * interval)
      const ready = addCompetitionBusinessMinutes(at, 45)
      const minute = Math.floor(ready / COMPETITION_MINUTE)
      const wait = (phase - minute % interval + interval) % interval
      const skippedSession = competitionRandom(`${key}:session`) < 0.35 ? interval : 0
      const due = addCompetitionBusinessMinutes(ready, wait + skippedSession)
      if (due <= end) events.push({ kind: 'growth', at: due, id: key, schoolId: profile.schoolId, order: 2, source: 'response' })
    }
  }
  for (const [index, adjustment] of state.adjustments.entries()) {
    const at = Date.parse(adjustment.at)
    if (at <= end) events.push({ kind: 'adjustment', at, id: String(index).padStart(5, '0'), adjustment, order: 1 })
  }
  let businessDay = -1
  for (let day = competitionDayStart(Date.parse(state.startedAt)); day <= end; day += COMPETITION_DAY) {
    if (!isCompetitionWeekday(day)) continue
    businessDay += 1
    for (const profile of profiles) {
      if (profile.role === 'leader') {
        for (let slot = 0; slot < 4; slot += 1) {
          const key = `${seed}:${profile.schoolId}:catchup:${day}:${slot}`
          const at = day + (8 * 60 + slot * 120 + 45 + Math.floor(competitionRandom(`${key}:minute`) * 75)) * COMPETITION_MINUTE
          if (at < catchupStart || at > end) continue
          const settings = getLibraryCompetitionSettings(state, new Date(at).toISOString())
          if (!settings.paused && competitionRandom(key) < Math.min(1, 0.85 * settings.speed)) {
            events.push({ kind: 'growth', at, id: key, schoolId: profile.schoolId, order: 2, source: 'catchup' })
          }
        }
      }
      const key = `${seed}:${profile.schoolId}:passive:${day}`
      const at = day + (8 * 60 + Math.floor(competitionRandom(`${key}:minute`) * 480)) * COMPETITION_MINUTE
      if (at < Date.parse(state.startedAt) || at > end) continue
      const settings = getLibraryCompetitionSettings(state, new Date(at).toISOString())
      const supportInterval = Math.ceil(2 / settings.speed)
      const supportOffset = Math.floor(competitionRandom(`${seed}:${profile.schoolId}:support`) * supportInterval)
      const supported = profile.role !== 'leader' && businessDay % supportInterval === supportOffset
      if (!settings.paused && (supported || competitionRandom(key) < 0.65 * settings.speed)) {
        events.push({ kind: 'growth', at, id: key, schoolId: profile.schoolId, order: 2, source: 'passive' })
      }
    }
  }
  return events.sort((left, right) => left.at - right.at || left.order - right.order || left.id.localeCompare(right.id))
}
