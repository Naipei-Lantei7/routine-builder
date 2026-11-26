import { describe, expect, it } from 'vitest'
import {
  ActivitySchema,
  AppStateSchema,
  RoutineSchema,
  TimeOfDaySchema,
  createEmptyState,
  type Activity,
  type Routine,
} from './schema'

const activity: Activity = {
  id: '6f1c2a52-5c1e-4b7a-9f3e-2d8b1a0c4e11',
  title: 'Stretch',
  time: '07:15',
  durationMinutes: 10,
  reminderMinutesBefore: 5,
}

const routine: Routine = {
  id: '0b6e3c8d-2f4a-4c1b-8e9d-7a5f3b2c1d00',
  name: 'Weekday morning',
  days: [1, 2, 3, 4, 5],
  activities: [activity],
  enabled: true,
  createdAt: '2026-11-26T07:00:00.000Z',
  updatedAt: '2026-11-26T07:00:00.000Z',
}

describe('TimeOfDaySchema', () => {
  it.each(['00:00', '07:30', '12:05', '23:59'])('accepts %s', (time) => {
    expect(TimeOfDaySchema.safeParse(time).success).toBe(true)
  })

  it.each(['24:00', '7:30', '07:60', '07:3', '0730', ''])('rejects %s', (time) => {
    expect(TimeOfDaySchema.safeParse(time).success).toBe(false)
  })
})

describe('ActivitySchema', () => {
  it('accepts a valid activity', () => {
    expect(ActivitySchema.parse(activity)).toEqual(activity)
  })

  it('accepts no reminder as null', () => {
    expect(ActivitySchema.safeParse({ ...activity, reminderMinutesBefore: null }).success).toBe(
      true,
    )
  })

  it('rejects a missing reminder field', () => {
    const { reminderMinutesBefore: _, ...withoutReminder } = activity
    expect(ActivitySchema.safeParse(withoutReminder).success).toBe(false)
  })

  it('rejects a blank title', () => {
    expect(ActivitySchema.safeParse({ ...activity, title: '   ' }).success).toBe(false)
  })

  it('trims the title', () => {
    expect(ActivitySchema.parse({ ...activity, title: '  Stretch  ' }).title).toBe('Stretch')
  })

  it('rejects a zero or negative duration', () => {
    expect(ActivitySchema.safeParse({ ...activity, durationMinutes: 0 }).success).toBe(false)
  })
})

describe('RoutineSchema', () => {
  it('accepts a valid routine', () => {
    expect(RoutineSchema.parse(routine)).toEqual(routine)
  })

  it('requires at least one day', () => {
    expect(RoutineSchema.safeParse({ ...routine, days: [] }).success).toBe(false)
  })

  it('rejects repeated days', () => {
    expect(RoutineSchema.safeParse({ ...routine, days: [1, 1] }).success).toBe(false)
  })

  it.each([0, 8, 1.5])('rejects weekday %s', (day) => {
    expect(RoutineSchema.safeParse({ ...routine, days: [day] }).success).toBe(false)
  })

  it('allows a routine with no activities', () => {
    expect(RoutineSchema.safeParse({ ...routine, activities: [] }).success).toBe(true)
  })
})

describe('AppStateSchema', () => {
  it('accepts the empty state', () => {
    expect(AppStateSchema.safeParse(createEmptyState()).success).toBe(true)
  })

  it('rejects an unknown version', () => {
    expect(AppStateSchema.safeParse({ ...createEmptyState(), version: 2 }).success).toBe(false)
  })

  it('rejects a completion with an invalid date', () => {
    const state = {
      ...createEmptyState(),
      completions: [
        {
          routineId: routine.id,
          activityId: activity.id,
          date: '2026-13-01',
          completedAt: '2026-11-26T07:20:00.000Z',
        },
      ],
    }
    expect(AppStateSchema.safeParse(state).success).toBe(false)
  })
})
