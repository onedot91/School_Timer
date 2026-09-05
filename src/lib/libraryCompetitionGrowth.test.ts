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

test('Given many response opportunities When projected minute-by-minute Then natural increments remain one hour apart', () => {
  const state = create('rolling-hour', 100)
  const progress = new Map(projectLibraryCompetition(state, START).map(row => [row.schoolId, { count: row.count, lastChange: Number.NEGATIVE_INFINITY }]))
  for (let minute = 1; minute <= 8 * 60; minute += 1) {
    const at = Date.parse(START) + minute * 60_000
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
