import { LIBRARY_COMPETITION_OUR_SCHOOL_ID, LIBRARY_COMPETITION_SCHOOLS } from './libraryCompetitionTypes.js'
import type { LibraryCompetitionState } from './libraryCompetitionTypes.js'

export type LibraryCompetitionProfile = {
  readonly schoolId: string
  readonly role: 'relaxed' | 'middle' | 'leader'
  readonly initial: number
  readonly responseProbability: number
  readonly capRatio: number
  readonly capOffset: number
}

export function competitionRandom(key: string): number {
  let hash = 2166136261
  for (let index = 0; index < key.length; index += 1) hash = Math.imul(hash ^ key.charCodeAt(index), 16777619)
  hash ^= hash >>> 16
  hash = Math.imul(hash, 0x7feb352d)
  hash ^= hash >>> 15
  hash = Math.imul(hash, 0x846ca68b)
  hash ^= hash >>> 16
  return (hash >>> 0) / 4294967296
}

export function createLibraryCompetitionProfiles(state: Pick<LibraryCompetitionState, 'seasonId' | 'seed'>): readonly LibraryCompetitionProfile[] {
  const seed = `${state.seasonId}:${state.seed}`
  const schools = LIBRARY_COMPETITION_SCHOOLS.filter(school => school.schoolId !== LIBRARY_COMPETITION_OUR_SCHOOL_ID)
    .map(school => ({ schoolId: school.schoolId, order: competitionRandom(`${seed}:${school.schoolId}:role`) }))
    .sort((left, right) => left.order - right.order || left.schoolId.localeCompare(right.schoolId))
  return schools.map((school, index) => {
    const random = (key: string) => competitionRandom(`${seed}:${school.schoolId}:${key}`)
    if (index < 4) return { schoolId: school.schoolId, role: 'relaxed', initial: Math.floor(random('initial') * 2), responseProbability: (15 + Math.floor(random('response') * 16)) / 100, capRatio: (25 + Math.floor(random('cap') * 21)) / 100, capOffset: 1 }
    if (index < 12) return { schoolId: school.schoolId, role: 'middle', initial: Math.floor(random('initial') * 3), responseProbability: (35 + Math.floor(random('response') * 21)) / 100, capRatio: (50 + Math.floor(random('cap') * 31)) / 100, capOffset: 2 }
    return { schoolId: school.schoolId, role: 'leader', initial: 1 + Math.floor(random('initial') * 3), responseProbability: (55 + (index - 12) * 10) / 100, capRatio: 1, capOffset: 3 + Math.floor(random('cap') * 4) }
  })
}
