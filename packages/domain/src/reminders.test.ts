import { describe, expect, it } from 'vitest'
import { getDueReminders, markRemindersFired, reminderKey, reminderMessage } from './reminders'
import type { Activity, AppState, Routine } from './schema'

// Thu 26 Nov 2026. Tests run with TZ=America/New_York (see vitest.config.ts).
const at = (day: number, hours: number, minutes = 0) => new Date(2026, 10, day, hours, minutes)

const stretch: Activity = {
  id: '22222222-2222-4222-8222-222222222222',
  title: 'Stretch',
  time: '07:15',
  reminderMinutesBefore: 5,
}

function routine(activities: Activity[], extra: Partial<Routine> = {}): Routine {
  return {
    id: '0b6e3c8d-2f4a-4c1b-8e9d-7a5f3b2c1d00',
    name: 'Morning',
    days: [1, 2, 3, 4, 5, 6, 7],
    enabled: true,
    activities,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...extra,
  }
}

function state(routines: Routine[], extra: Partial<AppState> = {}): AppState {
  return { version: 1, routines, completions: [], firedReminders: [], ...extra }
}

const titles = (s: AppState, now: Date) => getDueReminders(s, now).map((r) => r.activity.title)

describe('getDueReminders: timing', () => {
  const s = state([routine([stretch])])

  it('is not due before the reminder time', () => {
    expect(titles(s, at(26, 7, 9))).toEqual([])
  })

  it('is due at the reminder time and within the 5-minute grace window', () => {
    expect(titles(s, at(26, 7, 10))).toEqual(['Stretch'])
    expect(titles(s, at(26, 7, 15))).toEqual(['Stretch'])
  })

  it('is missed after the grace window, so no late burst of notifications', () => {
    expect(titles(s, at(26, 7, 16))).toEqual([])
  })

  it('supports reminders at the start time', () => {
    const atStart = state([routine([{ ...stretch, reminderMinutesBefore: 0 }])])
    expect(titles(atStart, at(26, 7, 14))).toEqual([])
    expect(titles(atStart, at(26, 7, 15))).toEqual(['Stretch'])
  })

  it('describes the reminder with its key, date and times', () => {
    const [due] = getDueReminders(s, at(26, 7, 11))
    expect(due).toMatchObject({
      key: reminderKey('0b6e3c8d-2f4a-4c1b-8e9d-7a5f3b2c1d00', stretch.id, '2026-11-26'),
      routineName: 'Morning',
      date: '2026-11-26',
      start: at(26, 7, 15),
      remindAt: at(26, 7, 10),
    })
  })
})

describe('getDueReminders: what is skipped', () => {
  it('skips activities with no reminder', () => {
    const s = state([routine([{ ...stretch, reminderMinutesBefore: null }])])
    expect(titles(s, at(26, 7, 12))).toEqual([])
  })

  it('skips reminders already shown', () => {
    const r = routine([stretch])
    const s = state([r], { firedReminders: [reminderKey(r.id, stretch.id, '2026-11-26')] })
    expect(titles(s, at(26, 7, 12))).toEqual([])
  })

  it('skips activities already done that day', () => {
    const r = routine([stretch])
    const s = state([r], {
      completions: [
        {
          routineId: r.id,
          activityId: stretch.id,
          date: '2026-11-26',
          completedAt: '2026-11-26T12:00:00.000Z',
        },
      ],
    })
    expect(titles(s, at(26, 7, 12))).toEqual([])
  })

  it('skips routines that are off or do not run that day', () => {
    expect(titles(state([routine([stretch], { enabled: false })]), at(26, 7, 12))).toEqual([])
    expect(titles(state([routine([stretch], { days: [6, 7] })]), at(26, 7, 12))).toEqual([])
  })
})

describe('getDueReminders: around midnight', () => {
  const late: Activity = {
    ...stretch,
    title: 'Night shift',
    time: '00:05',
    reminderMinutesBefore: 10,
  }

  it('fires the evening before for an activity just after midnight', () => {
    // Thursday 23:55, for Friday's 00:05 activity.
    const [due] = getDueReminders(state([routine([late])]), at(26, 23, 55))
    expect(due).toMatchObject({ date: '2026-11-27', start: at(27, 0, 5) })
  })

  it('uses the activity day, not the reminder day, to decide if the routine runs', () => {
    // Runs Fridays only (5): still reminded on Thursday night.
    const fridays = state([routine([late], { days: [5] })])
    expect(titles(fridays, at(26, 23, 55))).toEqual(['Night shift'])

    // Runs Thursdays only (4): no reminder Thursday night for Friday's activity.
    const thursdays = state([routine([late], { days: [4] })])
    expect(titles(thursdays, at(26, 23, 55))).toEqual([])
  })
})

describe('getDueReminders: daylight saving (America/New_York)', () => {
  it('reminds at the right wall-clock time on the day clocks go forward', () => {
    // Sun 8 Mar 2026, 02:00 → 03:00. Activity at 07:15, reminder 07:10.
    const s = state([routine([stretch])])
    expect(titles(s, new Date(2026, 2, 8, 7, 9))).toEqual([])
    expect(titles(s, new Date(2026, 2, 8, 7, 10))).toEqual(['Stretch'])
  })

  it('reminds across the skipped hour', () => {
    // Activity at 03:30, reminder 60 min before: 02:30 does not exist that day,
    // so the reminder instant is one real hour before 03:30, i.e. 01:30 EST.
    const early = state([routine([{ ...stretch, time: '03:30', reminderMinutesBefore: 60 }])])
    expect(titles(early, new Date(2026, 2, 8, 1, 29))).toEqual([])
    expect(titles(early, new Date(2026, 2, 8, 1, 30))).toEqual(['Stretch'])
  })
})

describe('getDueReminders: ordering', () => {
  it('returns reminders in the order they became due, not the order they were added', () => {
    // At 07:12: "Second" became due at 07:10 (07:20 - 10), "First" at 07:08 (07:15 - 7).
    const second: Activity = {
      ...stretch,
      id: '33333333-3333-4333-8333-333333333333',
      title: 'Second',
      time: '07:20',
      reminderMinutesBefore: 10,
    }
    const first: Activity = { ...stretch, title: 'First', reminderMinutesBefore: 7 }
    expect(titles(state([routine([second, first])]), at(26, 7, 12))).toEqual(['First', 'Second'])
  })
})

describe('markRemindersFired', () => {
  it('adds new keys and ignores ones already recorded', () => {
    const s = state([], { firedReminders: ['a'] })
    expect(markRemindersFired(s, ['a', 'b']).firedReminders).toEqual(['a', 'b'])
  })

  it('returns the same state when nothing is new', () => {
    const s = state([], { firedReminders: ['a'] })
    expect(markRemindersFired(s, ['a'])).toBe(s)
  })
})

describe('reminderMessage', () => {
  const [due] = getDueReminders(state([routine([stretch])]), at(26, 7, 10))

  it('says how long until the activity starts', () => {
    expect(reminderMessage(due, at(26, 7, 10))).toEqual({
      title: 'Stretch in 5 min',
      body: 'Morning · 07:15',
    })
  })

  it('rounds partial minutes up', () => {
    const now = new Date(at(26, 7, 13).getTime() + 30_000) // 07:13:30, 1.5 min to go
    expect(reminderMessage(due, now).title).toBe('Stretch in 2 min')
  })

  it('says "starts now" at the start time', () => {
    expect(reminderMessage(due, at(26, 7, 15)).title).toBe('Stretch starts now')
  })

  it('uses hours for long lead times', () => {
    const hour = getDueReminders(
      state([routine([{ ...stretch, reminderMinutesBefore: 60 }])]),
      at(26, 6, 15),
    )[0]
    expect(reminderMessage(hour, at(26, 6, 15)).title).toBe('Stretch in 1 h')
  })
})
