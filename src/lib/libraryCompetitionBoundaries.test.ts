import assert from 'node:assert/strict'
import test from 'node:test'
import { adjustLibraryCompetition, appendLibraryCompetitionPlacement, createLibraryCompetition, getLibraryCompetitionMonth, parseLibraryCompetitionState, projectLibraryCompetition } from './libraryCompetition.js'
import { addCompetitionBusinessMinutes, competitionMonthBounds } from './libraryCompetitionTime.js'
import { createLibraryCompetitionProfiles } from './libraryCompetitionProfiles.js'

const START = '2026-09-01T00:00:00.000Z'
const create = (seed = 'boundary') => createLibraryCompetition({ seasonId: '2026-09', seed, startedAt: START, bookIds: [] })

test('Given KST midnight When a year changes Then seasons use Korean month boundaries', () => {
  assert.equal(getLibraryCompetitionMonth('2026-12-31T14:59:59.999Z'), '2026-12')
  assert.equal(getLibraryCompetitionMonth('2026-12-31T15:00:00.000Z'), '2027-01')
  assert.deepEqual(competitionMonthBounds('2026-12'), { start: Date.parse('2026-11-30T15:00:00.000Z'), end: Date.parse('2026-12-31T15:00:00.000Z') })
})

test('Given Friday at 15:30 KST When forty-five business minutes pass Then the due time is Monday 08:15', () => {
  assert.equal(new Date(addCompetitionBusinessMinutes(Date.parse('2026-09-04T06:30:00.000Z'), 45)).toISOString(), '2026-09-06T23:15:00.000Z')
})

test('Given Friday at 15:15 KST When exactly forty-five minutes pass Then growth moves to the next opening', () => {
  assert.equal(new Date(addCompetitionBusinessMinutes(Date.parse('2026-09-04T06:15:00.000Z'), 45)).toISOString(), '2026-09-06T23:00:00.000Z')
})

test('Given Sunday When a three-hour reaction is scheduled Then night and weekend time do not count', () => {
  assert.equal(new Date(addCompetitionBusinessMinutes(Date.parse('2026-09-06T05:00:00.000Z'), 180)).toISOString(), '2026-09-07T02:00:00.000Z')
})

test('Given a month with no visits When projected years later Then only that active month grows', () => {
  const state = create()
  assert.deepEqual(projectLibraryCompetition(state, '2030-01-01T00:00:00.000Z'), projectLibraryCompetition(state, '2026-09-30T14:59:59.999Z'))
})

test('Given malformed persisted input When parsed Then impossible timestamps and forged records reject', () => {
  const state = create()
  const invalid: readonly unknown[] = [null, [], {}, { ...state, version: 2 }, { ...state, seed: '' }, { ...state, revision: -1 }, { ...state, startedAt: '2026-09-31T00:00:00.000Z' }, { ...state, seasonId: '2026-13' }, { ...state, placements: [{ bookId: 'x', at: '2026-10-01T00:00:00.000Z' }] }, { ...state, placements: [{ bookId: 'x', at: START }, { bookId: 'x', at: START }] }, { ...state, adjustments: [{ id: 'bad', at: START, speed: 2, paused: false, counts: [] }] }]
  for (const value of invalid) assert.equal(parseLibraryCompetitionState(value), null)
  assert.deepEqual(parseLibraryCompetitionState(JSON.parse(JSON.stringify(state))), state)
})

test('Given an invalid teacher override When parsed Then duplicate schools and malformed values reject', () => {
  const base = { id: 'a', at: START, speed: 1, paused: false, counts: [] }
  for (const counts of [[{ schoolId: 'school-03', count: 1 }], [{ schoolId: 'school-99', count: 2 }], [{ schoolId: 'school-01', count: 1 }, { schoolId: 'school-01', count: 2 }], [{ schoolId: 'school-01', count: '3' }]]) {
    assert.equal(parseLibraryCompetitionState({ ...create(), adjustments: [{ ...base, counts }] }), null)
  }
})

test('Given an applied adjustment When its ID is retried Then it is idempotent but a changed body rejects', () => {
  const adjustment = { id: 'once', at: START, speed: 1, paused: true, counts: [] } as const
  const state = adjustLibraryCompetition(create(), adjustment)
  assert.strictEqual(adjustLibraryCompetition(state, adjustment), state)
  assert.throws(() => adjustLibraryCompetition(state, { ...adjustment, paused: false }))
})

test('Given confirmed chronological events When stale or next-season events arrive Then history remains unchanged', () => {
  const state = appendLibraryCompetitionPlacement(create(), { bookId: 'new', at: '2026-09-02T00:00:00.000Z' })
  assert.throws(() => appendLibraryCompetitionPlacement(state, { bookId: 'stale', at: START }))
  assert.throws(() => appendLibraryCompetitionPlacement(state, { bookId: 'next', at: '2026-10-01T00:00:00.000Z' }))
  assert.throws(() => adjustLibraryCompetition(state, { id: 'stale', at: START, speed: 1, paused: false, counts: [] }))
  assert.equal(state.placements.length, 1)
})

test('Given monthly shared seeds When roles are assigned Then four relaxed eight middle and four leaders rotate', () => {
  const september = createLibraryCompetitionProfiles(create())
  const october = createLibraryCompetitionProfiles({ seasonId: '2026-10', seed: 'boundary' })
  assert.equal(september.filter(row => row.role === 'relaxed').length, 4)
  assert.equal(september.filter(row => row.role === 'middle').length, 8)
  assert.equal(september.filter(row => row.role === 'leader').length, 4)
  assert.ok(september.some(row => october.find(next => next.schoolId === row.schoolId)?.role !== row.role))
  assert.deepEqual(september.filter(row => row.role === 'leader').map(row => row.responseProbability).sort(), [0.55, 0.65, 0.75, 0.85])
  for (const row of september) {
    switch (row.role) {
      case 'relaxed': assert.ok(row.initial <= 1 && row.responseProbability >= 0.15 && row.responseProbability <= 0.30 && row.capRatio >= 0.25 && row.capRatio <= 0.45); break
      case 'middle': assert.ok(row.initial <= 2 && row.responseProbability >= 0.35 && row.responseProbability <= 0.55 && row.capRatio >= 0.50 && row.capRatio <= 0.80); break
      case 'leader': assert.ok(row.initial >= 1 && row.initial <= 3 && row.capOffset >= 3 && row.capOffset <= 6); break
      default: { const exhaustive: never = row.role; assert.fail(exhaustive) }
    }
  }
})

test('Given equal scores reached together When sorted Then fixed school IDs break the tie', () => {
  const state = adjustLibraryCompetition(create(), { id: 'tie', at: START, speed: 1, paused: true, counts: [{ schoolId: 'school-17', count: 100 }, { schoolId: 'school-01', count: 100 }] })
  assert.deepEqual(projectLibraryCompetition(state, START).slice(0, 2).map(row => row.schoolId), ['school-01', 'school-17'])
})

test('Given equivalent placement times When IDs contain different student numbers Then competition randomness is unchanged', () => {
  const first = createLibraryCompetition({ seasonId: '2026-09', seed: 'no-student-seed', startedAt: START, bookIds: ['library:1:request-a', 'library:2:request-b', 'library:3:request-c'] })
  const other = createLibraryCompetition({ seasonId: '2026-09', seed: 'no-student-seed', startedAt: START, bookIds: ['library:23:request-a', 'library:22:request-b', 'library:21:request-c'] })
  assert.deepEqual(projectLibraryCompetition(first, '2026-09-01T06:00:00.000Z'), projectLibraryCompetition(other, '2026-09-01T06:00:00.000Z'))
})
