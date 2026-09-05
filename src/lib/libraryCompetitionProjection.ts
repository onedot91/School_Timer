import { LIBRARY_COMPETITION_SCHOOLS, LIBRARY_COMPETITION_OUR_SCHOOL_ID, LibraryCompetitionInputError } from './libraryCompetitionTypes.js'
import type { LibraryCompetitionStanding, LibraryCompetitionState } from './libraryCompetitionTypes.js'
import { createLibraryCompetitionProfiles } from './libraryCompetitionProfiles.js'
import { createLibraryCompetitionEvents } from './libraryCompetitionEvents.js'
import { competitionMonthBounds, parseCompetitionTimestamp } from './libraryCompetitionTime.js'

type AccumulatedSchool = { count: number; reachedAt: string; lastGrowthAt: number }

export function projectLibraryCompetition(state: LibraryCompetitionState, at: string): readonly LibraryCompetitionStanding[] {
  if (!parseCompetitionTimestamp(at) || at < state.startedAt) throw new LibraryCompetitionInputError('invalid-time')
  const end = Math.min(Date.parse(at), competitionMonthBounds(state.seasonId).end - 1)
  const profiles = createLibraryCompetitionProfiles(state)
  const progress = new Map<string, AccumulatedSchool>(profiles.map(profile => [profile.schoolId, { count: profile.initial, reachedAt: state.startedAt, lastGrowthAt: Number.NEGATIVE_INFINITY }]))
  progress.set(LIBRARY_COMPETITION_OUR_SCHOOL_ID, { count: 0, reachedAt: state.startedAt, lastGrowthAt: Number.NEGATIVE_INFINITY })
  let ownCount = 0
  let paused = false
  for (const event of createLibraryCompetitionEvents(state, profiles, end)) {
    const eventTime = new Date(event.at).toISOString()
    switch (event.kind) {
      case 'placement':
        ownCount += 1
        progress.set(LIBRARY_COMPETITION_OUR_SCHOOL_ID, { count: ownCount, reachedAt: eventTime, lastGrowthAt: event.at })
        break
      case 'adjustment':
        paused = event.adjustment.paused
        for (const override of event.adjustment.counts) {
          const school = progress.get(override.schoolId)
          if (school && school.count !== override.count) {
            school.count = override.count
            school.reachedAt = eventTime
            school.lastGrowthAt = event.at
          }
        }
        break
      case 'growth': {
        if (paused) break
        const school = progress.get(event.schoolId)
        const profile = profiles.find(item => item.schoolId === event.schoolId)
        if (!school || !profile) break
        const cap = Math.min(100, Math.ceil(ownCount * profile.capRatio) + profile.capOffset)
        if (school.count >= cap || event.at - school.lastGrowthAt < 3_600_000) break
        school.count += 1
        school.reachedAt = eventTime
        school.lastGrowthAt = event.at
        break
      }
      default: {
        const exhaustive: never = event
        return exhaustive
      }
    }
  }
  return LIBRARY_COMPETITION_SCHOOLS.map(school => {
    const result = progress.get(school.schoolId)
    if (!result) throw new LibraryCompetitionInputError('invalid-state')
    return { ...school, count: result.count, reachedAt: result.reachedAt, rank: 0, isOurSchool: school.schoolId === LIBRARY_COMPETITION_OUR_SCHOOL_ID }
  }).sort((left, right) => right.count - left.count || left.reachedAt.localeCompare(right.reachedAt) || left.schoolId.localeCompare(right.schoolId))
    .map((row, index) => ({ ...row, rank: index + 1 }))
}
