import { describe, expect, it } from 'vitest'
import type { Routine } from './schema'
import {
  addActivity,
  createEmptyDraft,
  draftToRoutine,
  moveActivity,
  removeActivity,
  sortActivitiesByTime,
  toDraft,
  toggleDay,
  updateActivity,
  type RoutineDraft,
} from './routineDraft'

const NOW = new Date('2026-11-26T09:00:00.000Z')
const ROUTINE_ID = '0b6e3c8d-2f4a-4c1b-8e9d-7a5f3b2c1d00'
const ids = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
]
const context = { now: NOW, newId: () => ROUTINE_ID }

function draftWith(...titlesAndTimes: [string, string][]): RoutineDraft {
  let draft: RoutineDraft = { ...createEmptyDraft(), name: 'Morning' }
  titlesAndTimes.forEach(([title, time], i) => {
    draft = addActivity(draft, ids[i])
    draft = updateActivity(draft, ids[i], { title, time })
  })
  return draft
}

const titles = (draft: RoutineDraft) => draft.activities.map((a) => a.title)

describe('toggleDay', () => {
  it('removes a selected day and adds an unselected one in order', () => {
    let draft: RoutineDraft = { ...createEmptyDraft(), days: [1, 5] }
    draft = toggleDay(draft, 5)
    expect(draft.days).toEqual([1])
    draft = toggleDay(draft, 3)
    expect(draft.days).toEqual([1, 3])
  })
})

describe('addActivity', () => {
  it('starts the first activity at 08:00 with a 5-minute reminder', () => {
    const draft = addActivity(createEmptyDraft(), ids[0])
    expect(draft.activities).toEqual([
      { id: ids[0], title: '', time: '08:00', duration: '', notes: '', reminder: '5' },
    ])
  })

  it('starts a new activity at the same time as the last one', () => {
    const draft = addActivity(draftWith(['Stretch', '07:15']), ids[1])
    expect(draft.activities[1].time).toBe('07:15')
  })
})

describe('updateActivity and removeActivity', () => {
  it('changes only the targeted activity', () => {
    const draft = updateActivity(draftWith(['A', '07:00'], ['B', '08:00']), ids[1], {
      title: 'Bee',
    })
    expect(titles(draft)).toEqual(['A', 'Bee'])
  })

  it('removes the targeted activity', () => {
    const draft = removeActivity(draftWith(['A', '07:00'], ['B', '08:00']), ids[0])
    expect(titles(draft)).toEqual(['B'])
  })
})

describe('moveActivity', () => {
  const draft = draftWith(['A', '07:00'], ['B', '08:00'], ['C', '09:00'])

  it('moves up and down', () => {
    expect(titles(moveActivity(draft, ids[1], -1))).toEqual(['B', 'A', 'C'])
    expect(titles(moveActivity(draft, ids[1], 1))).toEqual(['A', 'C', 'B'])
  })

  it('does nothing past either end or for an unknown id', () => {
    expect(moveActivity(draft, ids[0], -1)).toBe(draft)
    expect(moveActivity(draft, ids[2], 1)).toBe(draft)
    expect(moveActivity(draft, 'missing', 1)).toBe(draft)
  })
})

describe('sortActivitiesByTime', () => {
  it('sorts by time and keeps the order of equal times', () => {
    const draft = draftWith(['Late', '21:00'], ['Early 1', '06:30'], ['Early 2', '06:30'])
    expect(titles(sortActivitiesByTime(draft))).toEqual(['Early 1', 'Early 2', 'Late'])
  })

  it('puts activities with an invalid time last', () => {
    const draft = draftWith(['No time', ''], ['Morning', '07:00'])
    expect(titles(sortActivitiesByTime(draft))).toEqual(['Morning', 'No time'])
  })
})

describe('draftToRoutine', () => {
  it('builds a new routine with a fresh id and timestamps', () => {
    let draft = draftWith(['Stretch', '07:15'])
    draft = updateActivity(draft, ids[0], { duration: '10', notes: '  Hamstrings  ' })

    const result = draftToRoutine(draft, context)

    expect(result).toEqual({
      ok: true,
      routine: {
        id: ROUTINE_ID,
        name: 'Morning',
        days: [1, 2, 3, 4, 5, 6, 7],
        enabled: true,
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
        activities: [
          {
            id: ids[0],
            title: 'Stretch',
            time: '07:15',
            durationMinutes: 10,
            notes: 'Hamstrings',
            reminderMinutesBefore: 5,
          },
        ],
      },
    })
  })

  it('omits empty duration and notes, and maps "none" to a null reminder', () => {
    let draft = draftWith(['Stretch', '07:15'])
    draft = updateActivity(draft, ids[0], { reminder: 'none', notes: '   ' })

    const result = draftToRoutine(draft, context)

    expect(result.ok && result.routine.activities[0]).toEqual({
      id: ids[0],
      title: 'Stretch',
      time: '07:15',
      reminderMinutesBefore: null,
    })
  })

  it('round-trips an existing routine, keeping id and createdAt', () => {
    const existing: Routine = {
      id: ROUTINE_ID,
      name: 'Evening',
      days: [6, 7],
      enabled: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      activities: [{ id: ids[0], title: 'Read', time: '21:00', reminderMinutesBefore: 0 }],
    }

    const result = draftToRoutine(toDraft(existing), { now: NOW, newId: () => 'unused' })

    expect(result).toEqual({ ok: true, routine: { ...existing, updatedAt: NOW.toISOString() } })
  })

  it('reports friendly errors keyed by field path', () => {
    let draft: RoutineDraft = { ...draftWith(['', '07:00']), name: '  ', days: [] }
    draft = updateActivity(draft, ids[0], { duration: '1.5' })

    const result = draftToRoutine(draft, context)

    expect(result).toEqual({
      ok: false,
      errors: {
        name: 'Give the routine a name',
        days: 'Pick at least one day',
        'activities.0.title': 'Give the activity a title',
        'activities.0.durationMinutes': 'Duration must be a whole number of minutes',
      },
    })
  })

  it('rejects a missing time and a zero duration', () => {
    let draft = draftWith(['Stretch', ''])
    draft = updateActivity(draft, ids[0], { duration: '0' })

    const result = draftToRoutine(draft, context)

    expect(result.ok).toBe(false)
    expect(!result.ok && result.errors).toMatchObject({
      'activities.0.time': 'Enter a time',
      'activities.0.durationMinutes': 'Duration must be between 1 and 1440 minutes',
    })
  })
})
