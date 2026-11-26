import { describe, expect, it } from 'vitest'
import { getTodaysActivities, type TodayItem } from './schedule'
import type { Activity, AppState, Completion, Routine } from './schema'

// Thu 26 Nov 2026. Tests run with TZ=America/New_York (see vitest.config.ts).
const at = (hours: number, minutes = 0) => new Date(2026, 10, 26, hours, minutes)

let nextId = 0
function id() {
  nextId += 1
  return `00000000-0000-4000-8000-${String(nextId).padStart(12, '0')}`
}

function activity(title: string, time: string, extra: Partial<Activity> = {}): Activity {
  return { id: id(), title, time, reminderMinutesBefore: null, ...extra }
}

function routine(name: string, activities: Activity[], extra: Partial<Routine> = {}): Routine {
  return {
    id: id(),
    name,
    days: [1, 2, 3, 4, 5, 6, 7],
    enabled: true,
    activities,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...extra,
  }
}

function state(routines: Routine[], completions: Completion[] = []): AppState {
  return { version: 1, routines, completions, firedReminders: [] }
}

function done(r: Routine, a: Activity, date = '2026-11-26'): Completion {
  return { routineId: r.id, activityId: a.id, date, completedAt: '2026-11-26T12:00:00.000Z' }
}

const summary = (items: TodayItem[]) => items.map((i) => `${i.activity.title}:${i.status}`)

describe('getTodaysActivities: which activities', () => {
  it('includes only enabled routines that run today', () => {
    const thursday = routine('Thursday', [activity('A', '09:00')], { days: [4] })
    const weekend = routine('Weekend', [activity('B', '09:00')], { days: [6, 7] })
    const off = routine('Off', [activity('C', '09:00')], { enabled: false })

    const items = getTodaysActivities(state([thursday, weekend, off]), at(8))

    expect(items.map((i) => i.activity.title)).toEqual(['A'])
  })

  it('merges routines and sorts by time, then routine name, then original order', () => {
    const b = routine('B routine', [activity('B 08:00', '08:00'), activity('B 07:00', '07:00')])
    const a = routine('A routine', [
      activity('A 08:00 first', '08:00'),
      activity('A 08:00 second', '08:00'),
    ])

    const items = getTodaysActivities(state([b, a]), at(6))

    expect(items.map((i) => i.activity.title)).toEqual([
      'B 07:00',
      'A 08:00 first',
      'A 08:00 second',
      'B 08:00',
    ])
  })

  it('tags each item with its routine, date and start and end times', () => {
    const r = routine('Morning', [activity('Stretch', '07:15', { durationMinutes: 10 })])

    const [item] = getTodaysActivities(state([r]), at(6))

    expect(item).toMatchObject({ routineId: r.id, routineName: 'Morning', date: '2026-11-26' })
    expect(item.start).toEqual(at(7, 15))
    expect(item.end).toEqual(at(7, 25))
  })

  it('returns nothing when no routine runs today', () => {
    expect(getTodaysActivities(state([]), at(8))).toEqual([])
  })
})

describe('getTodaysActivities: status', () => {
  const wake = activity('Wake', '07:00')
  const stretch = activity('Stretch', '07:15', { durationMinutes: 10 })
  const leave = activity('Leave', '08:00')
  const morning = routine('Morning', [wake, stretch, leave])

  it('marks the first upcoming activity as next', () => {
    expect(summary(getTodaysActivities(state([morning]), at(6)))).toEqual([
      'Wake:next',
      'Stretch:upcoming',
      'Leave:upcoming',
    ])
  })

  it('keeps an activity as next while it is in progress', () => {
    // Stretch runs 07:15-07:25.
    expect(summary(getTodaysActivities(state([morning]), at(7, 20)))).toEqual([
      'Wake:overdue',
      'Stretch:next',
      'Leave:upcoming',
    ])
  })

  it('uses a 15-minute window for activities without a duration', () => {
    expect(summary(getTodaysActivities(state([morning]), at(7, 14))).slice(0, 1)).toEqual([
      'Wake:next',
    ])
    expect(summary(getTodaysActivities(state([morning]), at(7, 15))).slice(0, 1)).toEqual([
      'Wake:overdue',
    ])
  })

  it('marks done activities and moves next to the first one not done', () => {
    const items = getTodaysActivities(state([morning], [done(morning, wake)]), at(6))
    expect(summary(items)).toEqual(['Wake:done', 'Stretch:next', 'Leave:upcoming'])
  })

  it('ignores completions from other days', () => {
    const items = getTodaysActivities(state([morning], [done(morning, wake, '2026-11-25')]), at(6))
    expect(items[0].status).toBe('next')
  })

  it('has no next activity once everything has passed', () => {
    expect(summary(getTodaysActivities(state([morning]), at(22)))).toEqual([
      'Wake:overdue',
      'Stretch:overdue',
      'Leave:overdue',
    ])
  })
})

describe('getTodaysActivities: daylight saving (America/New_York)', () => {
  it('runs in the pinned time zone', () => {
    // Guards the tests below: without the TZ pin they would pass trivially in UTC.
    expect(new Date(2026, 0, 15).getTimezoneOffset()).toBe(300) // EST, UTC-5
    expect(new Date(2026, 6, 15).getTimezoneOffset()).toBe(240) // EDT, UTC-4
  })

  it('uses wall-clock times on the day clocks go forward', () => {
    // Sun 8 Mar 2026: 02:00 jumps to 03:00, so the day is 23 hours long.
    const r = routine('Sunday', [activity('Run', '07:00')])
    const now = new Date(2026, 2, 8, 6, 30)

    const [item] = getTodaysActivities(state([r]), now)

    expect(item.start.getHours()).toBe(7)
    expect(item.start.getMinutes()).toBe(0)
    expect(item.start.getTime() - now.getTime()).toBe(30 * 60_000)
    expect(item.status).toBe('next')
  })

  it('uses wall-clock times on the day clocks go back', () => {
    // Sun 1 Nov 2026: 02:00 goes back to 01:00, so the day is 25 hours long.
    const r = routine('Sunday', [activity('Run', '07:00')])
    const now = new Date(2026, 10, 1, 6, 30)

    const [item] = getTodaysActivities(state([r]), now)

    expect(item.start.getHours()).toBe(7)
    expect(item.start.getTime() - now.getTime()).toBe(30 * 60_000)
  })
})
