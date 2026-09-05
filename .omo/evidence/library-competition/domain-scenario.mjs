import assert from 'node:assert/strict'
import { createLibraryCompetition, appendLibraryCompetitionPlacement, adjustLibraryCompetition, projectLibraryCompetition } from '../../../src/lib/libraryCompetition.ts'
import { COMPETITION_DAY, isCompetitionWeekday } from '../../../src/lib/libraryCompetitionTime.ts'

const start = '2026-09-01T00:00:00.000Z'
const end = '2026-09-30T06:59:59.999Z'
const blank = () => createLibraryCompetition({ seasonId: '2026-09', seed: 'domain-surface', startedAt: start, bookIds: [] })
const scenarios = []
let steady = blank()
let cursor = Date.parse(start)
for (let index = 0; index < 10; index += 1) {
  while (!isCompetitionWeekday(cursor)) cursor += COMPETITION_DAY
  steady = appendLibraryCompetitionPlacement(steady, { bookId: `synthetic-${index}`, at: new Date(cursor).toISOString() })
  cursor += COMPETITION_DAY
}
let burst = blank()
for (let index = 0; index < 10; index += 1) burst = appendLibraryCompetitionPlacement(burst, { bookId: `synthetic-${index}`, at: end })
const paused = adjustLibraryCompetition(blank(), { id: 'pause', at: start, speed: 1, paused: true, counts: [] })
const resume = adjustLibraryCompetition(paused, { id: 'resume', at: end, speed: 1, paused: false, counts: [] })
for (const [name, state] of [['idle', blank()], ['steady', steady], ['burst', burst], ['paused', paused], ['resume', resume]]) {
  const initial = projectLibraryCompetition(state, start)
  const final = projectLibraryCompetition(state, end)
  assert.equal(final.length, 17)
  assert.ok(final.every(row => Number.isInteger(row.count) && row.count >= 0 && row.count <= 100))
  scenarios.push({ name, initial, final })
}
const pausedRows = projectLibraryCompetition(paused, end)
assert.deepEqual(pausedRows, projectLibraryCompetition(resume, end))
assert.deepEqual(pausedRows, projectLibraryCompetition(paused, start))
assert.equal(projectLibraryCompetition(steady, end).find(row => row.isOurSchool)?.count, 10)
assert.equal(projectLibraryCompetition(burst, end).find(row => row.isOurSchool)?.count, 10)
assert.ok(projectLibraryCompetition(blank(), end).some(row => row.count > (projectLibraryCompetition(blank(), start).find(initial => initial.schoolId === row.schoolId)?.count ?? 0)))
console.log(JSON.stringify({ verdict: 'PASS', invocation: 'node --import tsx .omo/evidence/library-competition/domain-scenario.mjs', scenarios, checks: ['17 rows per scenario', 'integer 0..100 bounds', 'idle growth without registrations', 'same confirmed count for steady and burst', 'paused growth frozen', 'resume has no catch-up'], cleanup: 'Pure synchronous domain driver; no server, browser, temporary state, or network resources created.' }, null, 2))
