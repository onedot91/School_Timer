import assert from 'node:assert/strict'
import test from 'node:test'
import { adjustLibraryCompetition, createLibraryCompetition, projectLibraryCompetition } from './libraryCompetition.js'
import { createLibraryCompetitionEvents } from './libraryCompetitionEvents.js'
import { createLibraryCompetitionProfiles } from './libraryCompetitionProfiles.js'

const START = '2026-09-01T00:00:00.000Z'
const END = '2026-09-30T06:59:59.999Z'
const create = (seed: string, count: number) => createLibraryCompetition({ seasonId: '2026-09', seed, startedAt: START, bookIds: Array.from({ length: count }, (_, index) => `book-${index}`) })

test('Given a single book When seeded reactions are generated Then only a delayed subset reacts', () => {
  let observedResponses = 0
  for (let seed = 0; seed < 48; seed += 1) {
    const state = create(`subset-${seed}`, 1)
    const events = createLibraryCompetitionEvents(state, createLibraryCompetitionProfiles(state), Date.parse(END))
    const responses = events.filter(event => event.kind === 'growth' && event.id.includes(':response:'))
    assert.ok(responses.length < 16)
    for (const event of responses) assert.ok(event.at - Date.parse(START) >= 45 * 60_000 && event.at - Date.parse(START) <= 180 * 60_000)
    observedResponses += responses.length
  }
  assert.ok(observedResponses > 48)
})

test('Given a classroom burst When delayed responses arrive Then rivals keep pace without erasing the initial lead', () => {
  for (let seed = 0; seed < 48; seed += 1) {
    const state = create(`burst-${seed}`, 29)
    const early = projectLibraryCompetition(state, '2026-09-01T00:44:00.000Z')
    assert.deepEqual(early.filter(row => !row.isOurSchool).map(row => [row.schoolId, row.count, row.reachedAt]), projectLibraryCompetition(create(`burst-${seed}`, 0), '2026-09-01T00:44:00.000Z').filter(row => !row.isOurSchool).map(row => [row.schoolId, row.count, row.reachedAt]))
    const rows = projectLibraryCompetition(state, '2026-09-01T03:01:00.000Z')
    assert.equal(rows.find(row => row.isOurSchool)?.count, 29)
    assert.ok(Math.max(...rows.filter(row => !row.isOurSchool).map(row => row.count)) >= 22)
    assert.ok(rows.filter(row => !row.isOurSchool && row.count >= 10).length >= 5)
    assert.ok(rows.every(row => row.count <= 31))
    assert.deepEqual(rows, projectLibraryCompetition(state, '2026-09-01T03:01:00.000Z'))
  }
})

test('Given no book responses When passive growth occurs Then increments remain one hour apart', () => {
  const initial = create('rolling-hour', 100)
  const paused = adjustLibraryCompetition(initial, { id: 'pause', at: START, speed: 1, paused: true, counts: [] })
  const state = adjustLibraryCompetition(paused, { id: 'resume', at: '2026-09-02T00:00:00.000Z', speed: 1, paused: false, counts: [] })
  const start = Date.parse('2026-09-02T00:00:00.000Z')
  const progress = new Map(projectLibraryCompetition(state, new Date(start).toISOString()).map(row => [row.schoolId, { count: row.count, lastChange: Number.NEGATIVE_INFINITY }]))
  for (let minute = 1; minute <= 7 * 60; minute += 1) {
    const at = start + minute * 60_000
    for (const row of projectLibraryCompetition(state, new Date(at).toISOString()).filter(item => !item.isOurSchool)) {
      const previous = progress.get(row.schoolId)
      assert.ok(previous)
      if (row.count === previous.count) continue
      assert.equal(row.count - previous.count, 1)
      assert.ok(at - previous.lastChange >= 60 * 60_000)
      progress.set(row.schoolId, { count: row.count, lastChange: at })
    }
  }
})

test('Given each seeded school-day When passive growth opportunities are generated Then there is at most one during weekday class hours', () => {
  const state = create('passive-hours', 0)
  const events = createLibraryCompetitionEvents(state, createLibraryCompetitionProfiles(state), Date.parse(END))
  const schoolDays = new Set<string>()
  for (const event of events) {
    if (event.kind !== 'growth') continue
    const local = new Date(event.at + 9 * 60 * 60_000)
    assert.ok(local.getUTCDay() >= 1 && local.getUTCDay() <= 5)
    assert.ok(local.getUTCHours() >= 8 && local.getUTCHours() < 16)
    const key = `${event.schoolId}:${local.toISOString().slice(0, 10)}`
    assert.equal(schoolDays.has(key), false)
    schoolDays.add(key)
  }
  assert.ok(schoolDays.size > 0)
})

test('Given responses due during a pause When resumed after their deadline Then those opportunities never reappear', () => {
  const initial = create('due-pause', 100)
  const paused = adjustLibraryCompetition(initial, { id: 'pause', at: '2026-09-01T00:40:00.000Z', speed: 1, paused: true, counts: [] })
  const resumed = adjustLibraryCompetition(paused, { id: 'resume', at: '2026-09-01T03:01:00.000Z', speed: 1, paused: false, counts: [] })
  assert.deepEqual(projectLibraryCompetition(resumed, '2026-09-01T03:01:00.000Z'), projectLibraryCompetition(paused, '2026-09-01T03:01:00.000Z'))
})

test('Given a same-count teacher save When standings are tied Then the existing arrival time is retained', () => {
  const initial = adjustLibraryCompetition(create('same-count', 0), { id: 'first', at: START, speed: 1, paused: true, counts: [{ schoolId: 'school-17', count: 50 }] })
  const saved = adjustLibraryCompetition(initial, { id: 'again', at: '2026-09-02T00:00:00.000Z', speed: 1, paused: true, counts: [{ schoolId: 'school-17', count: 50 }] })
  assert.equal(projectLibraryCompetition(saved, END).find(row => row.schoolId === 'school-17')?.reachedAt, START)
})

test('Given simultaneous classroom registrations When schools report activity Then separate school sessions batch books with quiet gaps', () => {
  for (let seed = 0; seed < 24; seed += 1) {
    const state = create(`sessions-${seed}`, 29)
    const profiles = createLibraryCompetitionProfiles(state)
    const events = createLibraryCompetitionEvents(state, profiles, Date.parse('2026-09-01T03:01:00.000Z'))
    const schedules = new Set<string>()
    for (const profile of profiles.filter(profile => profile.role === 'leader')) {
      const responses = events.filter(event => event.kind === 'growth' && event.source === 'response' && event.schoolId === profile.schoolId)
      const times = [...new Set(responses.map(event => event.at))].sort((a, b) => a - b)
      assert.ok(responses.length >= 15)
      assert.equal(times.length, 2)
      assert.ok((times[1] ?? 0) - (times[0] ?? 0) >= 30 * 60_000)
      schedules.add(times.join(','))
    }
    assert.equal(schedules.size, 2)
    const later = projectLibraryCompetition(state, '2026-09-02T03:01:00.000Z')
    assert.deepEqual(projectLibraryCompetition(state, '2026-09-02T03:01:00.000Z'), later)
  }
})
