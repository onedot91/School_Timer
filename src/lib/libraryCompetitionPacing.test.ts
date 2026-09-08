import assert from 'node:assert/strict'
import test from 'node:test'
import { createLibraryCompetition, appendLibraryCompetitionPlacement, adjustLibraryCompetition, projectLibraryCompetition } from './libraryCompetition.js'
import type { LibraryCompetitionSpeed, LibraryCompetitionState } from './libraryCompetition.js'
import { createLibraryCompetitionProfiles } from './libraryCompetitionProfiles.js'
import { COMPETITION_DAY, isCompetitionWeekday } from './libraryCompetitionTime.js'

const START = '2026-09-01T00:00:00.000Z'
const END = '2026-09-30T06:59:59.999Z'
const create = (seed: string) => createLibraryCompetition({ seasonId: '2026-09', seed, startedAt: START, bookIds: [] })
function schedule(seed: string, speed: LibraryCompetitionSpeed, count = 10): LibraryCompetitionState {
  let state = adjustLibraryCompetition(create(seed), { id: 'speed', at: START, speed, paused: false, counts: [] })
  let day = Date.parse(START)
  for (let index = 0; index < count; index += 1) {
    while (!isCompetitionWeekday(day)) day += COMPETITION_DAY
    state = appendLibraryCompetitionPlacement(state, { bookId: `paced-${index}`, at: new Date(day).toISOString() })
    day += COMPETITION_DAY
  }
  return state
}

test('Given multiple seeded seasons When slowly filled Then natural ceilings and monotonic scores hold', () => {
  for (let seed = 0; seed < 24; seed += 1) {
    const state = schedule(`cap-${seed}`, 1)
    const profiles = createLibraryCompetitionProfiles(state)
    const previous = new Map<string, number>()
    for (let day = Date.parse(START); day <= Date.parse(END); day += COMPETITION_DAY) {
      const rows = projectLibraryCompetition(state, new Date(day).toISOString())
      const ownCount = rows.find(row => row.isOurSchool)?.count ?? 0
      for (const row of rows.filter(item => !item.isOurSchool)) {
        const profile = profiles.find(item => item.schoolId === row.schoolId)
        assert.ok(profile)
        assert.ok(row.count >= (previous.get(row.schoolId) ?? 0))
        assert.ok(row.count <= Math.min(100, Math.ceil(ownCount * profile.capRatio) + profile.capOffset))
        previous.set(row.schoolId, row.count)
      }
    }
  }
})

test('Given equal final book counts When timing differs Then ranks vary rather than using a fixed score threshold', () => {
  let varied = 0
  for (let seed = 0; seed < 24; seed += 1) {
    const steady = schedule(`pace-${seed}`, 1)
    let burst = create(`pace-${seed}`)
    for (let index = 0; index < 10; index += 1) burst = appendLibraryCompetitionPlacement(burst, { bookId: `paced-${index}`, at: END })
    const steadyRows = projectLibraryCompetition(steady, END)
    const burstRows = projectLibraryCompetition(burst, END)
    assert.equal(steadyRows.find(row => row.isOurSchool)?.count, 10)
    assert.equal(burstRows.find(row => row.isOurSchool)?.count, 10)
    if (steadyRows.find(row => row.isOurSchool)?.rank !== burstRows.find(row => row.isOurSchool)?.rank) varied += 1
  }
  assert.ok(varied > 0)
})

test('Given common seeds When speed is faster Then aggregate rival growth responds without increasing caps', () => {
  const totals = new Map<LibraryCompetitionSpeed, number>()
  for (const speed of [0.5, 1, 1.5] as const) {
    let total = 0
    for (let seed = 0; seed < 24; seed += 1) {
      const state = schedule(`speed-${seed}`, speed)
      total += projectLibraryCompetition(state, '2026-09-14T06:59:59.000Z').filter(row => !row.isOurSchool).reduce((sum, row) => sum + row.count, 0)
    }
    totals.set(speed, total)
  }
  assert.ok((totals.get(0.5) ?? 0) < (totals.get(1) ?? 0))
  assert.ok((totals.get(1) ?? 0) < (totals.get(1.5) ?? 0))
})

test('Given a future teacher speed change When viewing earlier history Then past results do not change', () => {
  const state = schedule('historical', 1)
  const changed = adjustLibraryCompetition(state, { id: 'later', at: '2026-09-25T00:00:00.000Z', speed: 1.5, paused: false, counts: [] })
  assert.deepEqual(projectLibraryCompetition(state, '2026-09-21T00:00:00.000Z'), projectLibraryCompetition(changed, '2026-09-21T00:00:00.000Z'))
})

test('Given enough books When leaders grow to one hundred Then neither side has a special absolute cap', () => {
  const initial = createLibraryCompetition({ seasonId: '2026-09', seed: 'hundred', startedAt: START, bookIds: Array.from({ length: 99 }, (_, index) => `initial-${index}`) })
  const leader = createLibraryCompetitionProfiles(initial).find(profile => profile.role === 'leader')
  assert.ok(leader)
  const state = adjustLibraryCompetition(initial, { id: 'head-start', at: START, speed: 1, paused: false, counts: [{ schoolId: leader.schoolId, count: 98 }] })
  const rows = projectLibraryCompetition(state, END)
  assert.equal(rows.find(row => row.schoolId === leader.schoolId)?.count, 100)
  assert.ok(rows.every(row => row.count <= 100))
})

test('Given no teacher adjustment When rivals compete with modest progress Then either our school or an opponent can lead', () => {
  const steady = projectLibraryCompetition(schedule('natural-win-loss', 1, 8), END)
  const burst = createLibraryCompetition({ seasonId: '2026-09', seed: 'natural-win-loss', startedAt: END, bookIds: Array.from({ length: 8 }, (_, index) => `burst-${index}`) })
  assert.equal(steady[0]?.isOurSchool, false)
  assert.equal(projectLibraryCompetition(burst, END)[0]?.isOurSchool, true)
})

test('Given ten or twenty books per weekday When bursts continue Then the field keeps pace without identical scores', () => {
  for (const daily of [10, 20]) {
    for (let seed = 0; seed < 32; seed += 1) {
      let state = create(`rapid-${seed}`)
      for (let day = 0; day < 4; day += 1) {
        for (let book = 0; book < daily; book += 1) {
          state = appendLibraryCompetitionPlacement(state, { bookId: `${day}-${book}`,
            at: new Date(Date.parse(START) + day * COMPETITION_DAY + book * 60_000).toISOString() })
        }
      }
      const rows = projectLibraryCompetition(state, '2026-09-04T06:59:00.000Z')
      const own = rows.find(row => row.isOurSchool)
      assert.ok(own)
      assert.equal(own.count, daily * 4)
      const rivals = rows.filter(row => !row.isOurSchool)
      const average = rivals.reduce((sum, row) => sum + row.count, 0) / rivals.length
      assert.ok(average >= own.count * 0.75, `Rivals lag behind at ${daily} daily books: ${seed}`)
      assert.ok(Math.max(...rivals.map(row => row.count)) >= own.count * 0.85)
      assert.ok(rivals.every(row => row.count >= own.count * 0.4 && row.count <= own.count + 2))
      assert.ok(new Set(rivals.map(row => row.count)).size >= 5)
    }
  }
})
