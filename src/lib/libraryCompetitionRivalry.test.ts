import assert from 'node:assert/strict'
import test from 'node:test'
import { adjustLibraryCompetition, appendLibraryCompetitionPlacement, createLibraryCompetition, projectLibraryCompetition } from './libraryCompetition.js'
import { createLibraryCompetitionEvents } from './libraryCompetitionEvents.js'
import { createLibraryCompetitionProfiles } from './libraryCompetitionProfiles.js'
import { createLibraryCompetitionLocalStore } from './libraryCompetitionLocalStore.js'
import { COMPETITION_DAY, competitionDayStart, isCompetitionWeekday } from './libraryCompetitionTime.js'

const START = '2026-09-01T00:00:00.000Z'
const END = '2026-09-30T06:59:59.999Z'

test('Given regular registration across many seasons When rivals pursue Then only one or two can lead narrowly and our school also wins', () => {
  for (const daily of [1, 2, 4]) {
    const ranks = [0, 0, 0]
    for (let seed = 0; seed < 64; seed += 1) {
      let state = createLibraryCompetition({ seasonId: '2026-09', seed: `pursuit-${seed}`, startedAt: START, bookIds: [] })
      const previous = new Map<string, number>()
      for (let day = Date.parse(START), index = 0; index < 15; day += COMPETITION_DAY) {
        if (!isCompetitionWeekday(day)) continue
        for (let book = 0; book < daily; book += 1) {
          state = appendLibraryCompetitionPlacement(state, { bookId: `${index}-${book}`, at: new Date(day).toISOString() })
        }
        for (const at of [day, day + 7 * 3_600_000]) {
          const rows = projectLibraryCompetition(state, new Date(at).toISOString())
          const own = rows.find(row => row.isOurSchool)
          assert.ok(own)
          assert.ok(own.rank >= 1 && own.rank <= 3)
          assert.equal(own.count, (index + 1) * daily)
          for (const row of rows) {
            assert.ok(row.count <= own.count + 2)
            assert.ok(row.count >= (previous.get(row.schoolId) ?? 0), 'Rivals never lose books to make our school win')
            previous.set(row.schoolId, row.count)
          }
          if (at !== day) ranks[own.rank - 1] = (ranks[own.rank - 1] ?? 0) + 1
        }
        index += 1
      }
    }
    assert.ok(ranks.every(count => count > 0), 'All three leading positions must be attainable')
    if (daily <= 2) {
      const winShare = (ranks[0] ?? 0) / (64 * 15)
      assert.ok(winShare >= 0.1 && winShare <= 0.45, 'Routine progress should usually face competition, with meaningful first-place periods')
    }
  }
})

test('Given one saved book and a closed PC When reopening next weekday Then offline growth matches continuous observation without more writes', () => {
  let saved: string | null = JSON.stringify({ studentLife: { books: [{ id: 'qa-book', studentNumber: 23,
    title: 'QA', author: 'QA', pageCount: 10, createdAt: START, colorIndex: 0, librarySlot: 0 }] } })
  let writes = 0
  const storage = { getItem: (_key: string) => saved, setItem: (_key: string, value: string) => { saved = value; writes += 1 } }
  const createSeed = () => 'offline-rivalry'
  const initialStore = createLibraryCompetitionLocalStore({ storage, now: () => START, createSeed })
  const initial = initialStore.read('open')
  const state = initial.competition.state
  assert.ok(state)
  const bytesAfterSave = saved
  const nextMorning = '2026-09-02T00:00:00.000Z'
  for (let at = Date.parse(START); at <= Date.parse(nextMorning); at += 15 * 60_000) {
    projectLibraryCompetition(state, new Date(at).toISOString())
  }
  const reopened = createLibraryCompetitionLocalStore({ storage, now: () => nextMorning, createSeed }).read('open')
  assert.deepEqual(reopened.competition.standings, projectLibraryCompetition(state, nextMorning))
  assert.equal(reopened.competition.standings.find(row => row.isOurSchool)?.count, 1)
  assert.ok(reopened.competition.standings.some(row => !row.isOurSchool
    && row.count > (initial.competition.standings.find(previous => previous.schoolId === row.schoolId)?.count ?? 0)))
  assert.equal(saved, bytesAfterSave)
  assert.equal(writes, 1)
})

test('Given additional catch-up opportunities When generated Then only two rivals participate and all growth stays in business hours', () => {
  const state = createLibraryCompetition({ seasonId: '2026-09', seed: 'catchup-hours', startedAt: START, bookIds: ['first'] })
  const profiles = createLibraryCompetitionProfiles(state)
  const leaders = new Set(profiles.filter(profile => profile.role === 'leader').map(profile => profile.schoolId))
  assert.equal(leaders.size, 2)
  const opportunities = new Map<string, number>()
  const observedRivals = new Set<string>()
  for (const event of createLibraryCompetitionEvents(state, profiles, Date.parse(END))) {
    if (event.kind !== 'growth') continue
    const local = new Date(event.at + 9 * 3_600_000)
    assert.ok(local.getUTCDay() >= 1 && local.getUTCDay() <= 5)
    assert.ok(local.getUTCHours() >= 8 && local.getUTCHours() < 16)
    if (event.source === 'response') continue
    const key = `${event.source}:${event.schoolId}:${local.toISOString().slice(0, 10)}`
    const count = (opportunities.get(key) ?? 0) + 1
    opportunities.set(key, count)
    assert.ok(count <= (event.source === 'catchup' ? 4 : 1))
    if (event.source === 'catchup') {
      assert.ok(leaders.has(event.schoolId))
      observedRivals.add(event.schoolId)
      assert.ok(event.at >= Date.parse(START) + 45 * 60_000)
    }
  }
  assert.deepEqual(observedRivals, leaders)
})

test('Given a first placement in the future When viewing the past Then catch-up never changes earlier standings', () => {
  const empty = createLibraryCompetition({ seasonId: '2026-09', seed: 'future-catchup', startedAt: START, bookIds: [] })
  const future = appendLibraryCompetitionPlacement(empty, { bookId: 'later', at: '2026-09-15T00:00:00.000Z' })
  assert.deepEqual(projectLibraryCompetition(empty, '2026-09-14T06:59:59.999Z'), projectLibraryCompetition(future, '2026-09-14T06:59:59.999Z'))
})

test('Given lower schools across seeds and speed settings When full weekdays elapse Then each receives periodic growth without extra daily slots', () => {
  const opening = '2026-08-31T23:00:00.000Z'
  const weekdays: number[] = []
  for (let day = Date.parse(opening); day < Date.parse(END); day += COMPETITION_DAY) {
    if (isCompetitionWeekday(day)) weekdays.push(competitionDayStart(day))
  }
  for (const [speed, interval] of [[0.5, 6], [1, 3], [1.5, 2]] as const) {
    for (let seed = 0; seed < 24; seed += 1) {
      const state = adjustLibraryCompetition(createLibraryCompetition({ seasonId: '2026-09', seed: `support-${seed}`,
        startedAt: opening, bookIds: [] }), { id: 'speed', at: opening, speed, paused: false, counts: [] })
      const profiles = createLibraryCompetitionProfiles(state)
      const events = createLibraryCompetitionEvents(state, profiles, Date.parse(END))
      for (const school of profiles.filter(profile => profile.role !== 'leader')) {
        const days = events.filter(event => event.kind === 'growth' && event.source === 'passive' && event.schoolId === school.schoolId)
          .map(event => competitionDayStart(event.at))
        assert.equal(new Set(days).size, days.length, 'Support shares the existing single daily passive slot')
        for (let index = 0; index <= weekdays.length - interval; index += 1) {
          assert.ok(weekdays.slice(index, index + interval).some(day => days.includes(day)), `${school.schoolId} must receive a chance within ${interval} weekdays`)
        }
      }
    }
  }
})

test('Given uncapped lower schools When our saved books stay unchanged offline Then each grows within three weekdays without overtaking us', () => {
  for (let seed = 0; seed < 24; seed += 1) {
    const state = createLibraryCompetition({ seasonId: '2026-09', seed: `support-scores-${seed}`, startedAt: START,
      bookIds: Array.from({ length: 100 }, (_, index) => `saved-${index}`) })
    const lowerSchools = createLibraryCompetitionProfiles(state).filter(profile => profile.role !== 'leader')
    const history = []
    for (let at = Date.parse('2026-09-01T07:00:00.000Z'); at < Date.parse(END); at += COMPETITION_DAY) {
      if (isCompetitionWeekday(at)) history.push(projectLibraryCompetition(state, new Date(at).toISOString()))
    }
    for (let index = 3; index < history.length; index += 1) {
      const before = history[index - 3]
      const after = history[index]
      assert.ok(before && after)
      assert.equal(after.find(row => row.isOurSchool)?.count, 100)
      for (const school of lowerSchools) {
        const previous = before.find(row => row.schoolId === school.schoolId)
        const current = after.find(row => row.schoolId === school.schoolId)
        assert.ok(previous && current)
        const cap = Math.min(99, Math.ceil(100 * school.capRatio) + school.capOffset)
        assert.ok(current.count <= cap)
        assert.ok(current.count >= previous.count)
        if (previous.count < cap) assert.ok(current.count > previous.count, 'An uncapped lower school must not stall for three weekdays')
      }
    }
  }
})
