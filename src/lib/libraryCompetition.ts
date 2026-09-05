import { parseLibraryCompetitionState } from './libraryCompetitionCodec.js'
import { LibraryCompetitionInputError } from './libraryCompetitionTypes.js'
import type { LibraryCompetitionState, LibraryCompetitionPlacement, LibraryCompetitionAdjustment } from './libraryCompetitionTypes.js'

export * from './libraryCompetitionTypes.js'
export { parseLibraryCompetitionState, parseLibraryCompetitionAdjustment, parseLibraryCompetitionCounts } from './libraryCompetitionCodec.js'
export { getLibraryCompetitionMonth, competitionMonthBounds } from './libraryCompetitionTime.js'
export { projectLibraryCompetition } from './libraryCompetitionProjection.js'
export { getLibraryCompetitionSettings } from './libraryCompetitionEvents.js'

export function createLibraryCompetition(input: {
  readonly seasonId: string
  readonly seed: string
  readonly startedAt: string
  readonly bookIds: readonly string[]
}): LibraryCompetitionState {
  const state = parseLibraryCompetitionState({ ...input, version: 1, revision: 0,
    placements: [...new Set(input.bookIds)].map(bookId => ({ bookId, at: input.startedAt })), adjustments: [] })
  if (!state) throw new LibraryCompetitionInputError('invalid-state')
  return state
}

export function appendLibraryCompetitionPlacement(state: LibraryCompetitionState, placement: LibraryCompetitionPlacement): LibraryCompetitionState {
  if (state.placements.some(item => item.bookId === placement.bookId)) return state
  if (state.placements.length >= 100) throw new LibraryCompetitionInputError('full')
  if (placement.at < latestEventTime(state)) throw new LibraryCompetitionInputError('invalid-event')
  const next = parseLibraryCompetitionState({ ...state, revision: state.revision + 1, placements: [...state.placements, placement] })
  if (!next) throw new LibraryCompetitionInputError('invalid-event')
  return next
}

export function adjustLibraryCompetition(state: LibraryCompetitionState, adjustment: LibraryCompetitionAdjustment): LibraryCompetitionState {
  const existing = state.adjustments.find(item => item.id === adjustment.id)
  if (existing) {
    if (JSON.stringify(existing) !== JSON.stringify(adjustment)) throw new LibraryCompetitionInputError('invalid-event')
    return state
  }
  if (adjustment.at < latestEventTime(state)) throw new LibraryCompetitionInputError('invalid-event')
  const next = parseLibraryCompetitionState({ ...state, revision: state.revision + 1, adjustments: [...state.adjustments, adjustment] })
  if (!next) throw new LibraryCompetitionInputError('invalid-event')
  return next
}

function latestEventTime(state: LibraryCompetitionState): string {
  return [state.startedAt, state.placements.at(-1)?.at ?? state.startedAt, state.adjustments.at(-1)?.at ?? state.startedAt].sort().at(-1) ?? state.startedAt
}
