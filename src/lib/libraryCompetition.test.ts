import assert from 'node:assert/strict'
import test from 'node:test'
import { createLibraryCompetition } from './libraryCompetition.js'

test('creates the first season with existing unique placed books', () => {
  // Given: existing confirmed books, including a repeated ID.
  const input = { seasonId: '2026-09', seed: 'classroom', startedAt: '2026-09-01T00:00:00.000Z', bookIds: ['a', 'b', 'a'] }
  // When: the first competition is created.
  const state = createLibraryCompetition(input)
  // Then: the existing books form exactly two confirmed placement events.
  assert.deepEqual(state, { version: 1, seasonId: '2026-09', seed: 'classroom', startedAt: input.startedAt, revision: 0, placements: [{ bookId: 'a', at: input.startedAt }, { bookId: 'b', at: input.startedAt }], adjustments: [] })
})
