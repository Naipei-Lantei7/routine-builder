import type { Activity, AppState, DateKey } from './schema'
import { atLocalTime, isoWeekday, toDateKey } from './time'

// How long an activity without a duration counts as "in progress" after it starts.
export const DEFAULT_ACTIVE_MINUTES = 15

// done:     ticked off today
// next:     the first not-done activity that has not ended yet (may be in progress)
// upcoming: not done, starts later
// overdue:  not done, and its window (duration, or 15 min) has passed
export type TodayStatus = 'done' | 'next' | 'upcoming' | 'overdue'

export interface TodayItem {
  routineId: string
  routineName: string
  activity: Activity
  date: DateKey
  start: Date
  end: Date
  status: TodayStatus
}

// Activities from every enabled routine that runs today, in time order, each
// with its status at `now`. Plan 001, section 5.5.
export function getTodaysActivities(
  state: Pick<AppState, 'routines' | 'completions'>,
  now: Date,
): TodayItem[] {
  const date = toDateKey(now)
  const weekday = isoWeekday(now)

  const done = new Set(
    state.completions
      .filter((c) => c.date === date)
      .map((c) => completionKey(c.routineId, c.activityId)),
  )

  const scheduled = state.routines
    .filter((routine) => routine.enabled && routine.days.includes(weekday))
    .flatMap((routine) =>
      routine.activities.map((activity, index) => ({ routine, activity, index })),
    )
    .sort(
      (a, b) =>
        a.activity.time.localeCompare(b.activity.time) ||
        a.routine.name.localeCompare(b.routine.name) ||
        a.index - b.index,
    )

  let nextAssigned = false
  return scheduled.map(({ routine, activity }) => {
    const start = atLocalTime(date, activity.time)
    const minutes = activity.durationMinutes ?? DEFAULT_ACTIVE_MINUTES
    const end = new Date(start.getTime() + minutes * 60_000)

    let status: TodayStatus
    if (done.has(completionKey(routine.id, activity.id))) {
      status = 'done'
    } else if (end <= now) {
      status = 'overdue'
    } else if (!nextAssigned) {
      status = 'next'
      nextAssigned = true
    } else {
      status = 'upcoming'
    }

    return {
      routineId: routine.id,
      routineName: routine.name,
      activity,
      date,
      start,
      end,
      status,
    }
  })
}

function completionKey(routineId: string, activityId: string): string {
  return `${routineId}:${activityId}`
}
