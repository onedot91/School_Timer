import assert from 'node:assert/strict'
import test from 'node:test'
import { appendLibraryCompetitionPlacement, adjustLibraryCompetition, createLibraryCompetition, projectLibraryCompetition, LIBRARY_COMPETITION_OUR_SCHOOL_ID } from './libraryCompetition.js'
import type { LibraryCompetitionState } from './libraryCompetition.js'

const START = '2026-09-01T00:00:00.000Z'
const create = (seed = 'classroom', count = 0) => createLibraryCompetition({ seasonId: '2026-09', seed, startedAt: START, bookIds: Array.from({ length: count }, (_, index) => `book-${index}`) })
const rivals = (state: LibraryCompetitionState, at: string) => projectLibraryCompetition(state, at).filter(row => !row.isOurSchool)
const own = (state: LibraryCompetitionState, at: string) => projectLibraryCompetition(state, at).find(row => row.isOurSchool)

test('Given a fresh season When projected Then seventeen schools start low and our confirmed books count', () => {
  const state = create('initial', 24)
  const rows = projectLibraryCompetition(state, START)
  assert.equal(rows.length, 17)
  assert.equal(own(state, START)?.count, 24)
  assert.ok(rows.filter(row => !row.isOurSchool).every(row => row.count <= 3))
  assert.equal(rows.filter(row => row.isOurSchool).length, 1)
  assert.equal(new Set(rows.map(row => row.region)).size, 17)
})

test('Given shared state When projected by twenty-three clients Then every result is identical', () => {
  const state = create('common-seed', 17)
  const rows = Array.from({ length: 23 }, () => projectLibraryCompetition(state, '2026-09-07T02:00:00.000Z'))
  for (const result of rows) assert.deepEqual(result, rows[0])
})

test('Given no registrations When business days elapse Then passive growth is bounded but present', () => {
  const state = create('idle')
  const initial = rivals(state, START)
  const final = rivals(state, '2026-09-30T06:59:59.000Z')
  assert.ok(final.some(row => row.count > (initial.find(first => first.schoolId === row.schoolId)?.count ?? 0)))
  assert.ok(final.every(row => row.count <= 6))
})

test('Given placement bursts When less than forty-five business minutes elapsed Then no placement response appears', () => {
  const empty = create('delay')
  const burst = create('delay', 100)
  assert.deepEqual(rivals(empty, '2026-09-01T00:44:59.999Z').map(row => [row.schoolId, row.count, row.reachedAt]), rivals(burst, '2026-09-01T00:44:59.999Z').map(row => [row.schoolId, row.count, row.reachedAt]))
})

test('Given a fresh hundred-book burst When three business hours pass Then hourly growth cannot jump to catch up', () => {
  const state = create('burst', 100)
  const initial = rivals(state, START)
  const later = rivals(state, '2026-09-01T03:00:00.000Z')
  assert.ok(later.every(row => row.count - (initial.find(first => first.schoolId === row.schoolId)?.count ?? 0) <= 4))
})

test('Given a weekday closing When night and weekend pass Then rival scores freeze', () => {
  const state = create('weekend', 30)
  assert.deepEqual(projectLibraryCompetition(state, '2026-09-04T07:00:00.000Z'), projectLibraryCompetition(state, '2026-09-06T22:59:59.999Z'))
})

test('Given no opportunity backlog When registration resumes late Then previously capped growth is discarded', () => {
  const state = create('discard')
  const late = appendLibraryCompetitionPlacement(state, { bookId: 'late', at: '2026-09-25T03:00:00.000Z' })
  const before = rivals(state, '2026-09-25T03:00:00.000Z')
  const after = rivals(late, '2026-09-25T03:00:00.000Z')
  assert.deepEqual(after.map(row => [row.schoolId, row.count]), before.map(row => [row.schoolId, row.count]))
})

test('Given a registered book When duplicate request replays Then neither count nor revision changes', () => {
  const state = create('replay')
  const placed = appendLibraryCompetitionPlacement(state, { bookId: 'saved', at: START })
  assert.strictEqual(appendLibraryCompetitionPlacement(placed, { bookId: 'saved', at: START }), placed)
  assert.equal(own(placed, START)?.count, 1)
  assert.equal(placed.revision, 1)
})

test('Given a hundred confirmed books When another placement is appended Then it is rejected', () => {
  assert.throws(() => appendLibraryCompetitionPlacement(create('full', 100), { bookId: 'extra', at: START }))
})

test('Given teacher manual overrides When projected Then lower and hundred-book values bypass natural caps', () => {
  const state = adjustLibraryCompetition(create(), { id: 'manual', at: START, speed: 1, paused: true, counts: [{ schoolId: 'school-01', count: 100 }, { schoolId: 'school-02', count: 0 }] })
  const rows = projectLibraryCompetition(state, '2026-09-30T06:00:00.000Z')
  assert.equal(rows.find(row => row.schoolId === 'school-01')?.count, 100)
  assert.equal(rows.find(row => row.schoolId === 'school-02')?.count, 0)
  assert.equal(own(state, START)?.count, 0)
})

test('Given rivals paused When own school places Then our count grows and opponents stay fixed', () => {
  const paused = adjustLibraryCompetition(create('paused'), { id: 'pause', at: START, speed: 1, paused: true, counts: [] })
  const placed = appendLibraryCompetitionPlacement(paused, { bookId: 'during-pause', at: '2026-09-02T01:00:00.000Z' })
  assert.equal(own(placed, '2026-09-30T01:00:00.000Z')?.count, 1)
  assert.deepEqual(rivals(placed, START).map(row => [row.schoolId, row.count]), rivals(placed, '2026-09-30T01:00:00.000Z').map(row => [row.schoolId, row.count]))
})

test('Given a pause spanning a month When resumed at final minute Then no deferred growth is applied', () => {
  const paused = adjustLibraryCompetition(create('resume', 40), { id: 'pause', at: START, speed: 1, paused: true, counts: [] })
  const at = '2026-09-30T06:59:59.000Z'
  const resumed = adjustLibraryCompetition(paused, { id: 'resume', at, speed: 1, paused: false, counts: [] })
  assert.deepEqual(projectLibraryCompetition(resumed, at), projectLibraryCompetition(paused, at))
})

test('Given equal hundred-book scores When rankings are sorted Then earlier arrival beats school ID and our win is not guaranteed', () => {
  const base = adjustLibraryCompetition(create('ties', 99), { id: 'leader', at: START, speed: 1, paused: true, counts: [{ schoolId: 'school-17', count: 100 }] })
  const final = appendLibraryCompetitionPlacement(base, { bookId: 'last', at: '2026-09-02T00:00:00.000Z' })
  assert.equal(projectLibraryCompetition(final, '2026-09-02T01:00:00.000Z')[0]?.schoolId, 'school-17')
  assert.equal(projectLibraryCompetition(create('own-win', 100), START)[0]?.schoolId, LIBRARY_COMPETITION_OUR_SCHOOL_ID)
})

test('Given invalid teacher values When adjusting Then own-school changes and out-of-range scores reject', () => {
  for (const count of [-1, 101, 2.5, Number.NaN]) assert.throws(() => adjustLibraryCompetition(create(), { id: 'bad', at: START, speed: 1, paused: false, counts: [{ schoolId: 'school-01', count }] }))
  assert.throws(() => adjustLibraryCompetition(create(), { id: 'own', at: START, speed: 1, paused: false, counts: [{ schoolId: 'school-03', count: 77 }] }))
})
