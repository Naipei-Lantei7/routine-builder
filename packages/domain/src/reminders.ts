import type { Activity, AppState, DateKey } from './schema'
import { addDays, atLocalTime, fromDateKey, isoWeekday, toDateKey } from './time'

// A reminder this late is shown; anything later counts as missed (Plan 001, 5.6).
export const REMINDER_GRACE_MINUTES = 5

export interface DueReminder {
  // `${routineId}:${activityId}:${date}`, stored in firedReminders once shown.
  key: string
  routineId: string
  routineName: string
  activity: Activity
  // The day the activity happens (may be tomorrow for a reminder before midnight).
  date: DateKey
  start: Date
  remindAt: Date
}

export function reminderKey(routineId: string, activityId: string, date: DateKey): string {
  return `${routineId}:${activityId}:${date}`
}

// Reminders that should be shown at `now`: their time has come within the
// grace window, they have not been shown yet, and the activity is not done.
export function getDueReminders(
  state: Pick<AppState, 'routines' | 'completions' | 'firedReminders'>,
  now: Date,
  graceMinutes = REMINDER_GRACE_MINUTES,
): DueReminder[] {
  const fired = new Set(state.firedReminders)
  const today = toDateKey(now)
  const earliest = now.getTime() - graceMinutes * 60_000

  const due: DueReminder[] = []
  // Tomorrow too: an activity at 00:05 with a 10-minute reminder is due at 23:55 today.
  for (const date of [today, addDays(today, 1)]) {
    const weekday = isoWeekday(fromDateKey(date))
    const done = new Set(
      state.completions.filter((c) => c.date === date).map((c) => `${c.routineId}:${c.activityId}`),
    )

    for (const routine of state.routines) {
      if (!routine.enabled || !routine.days.includes(weekday)) continue

      for (const activity of routine.activities) {
        if (activity.reminderMinutesBefore === null) continue

        const key = reminderKey(routine.id, activity.id, date)
        if (fired.has(key) || done.has(`${routine.id}:${activity.id}`)) continue

        const start = atLocalTime(date, activity.time)
        const remindAt = new Date(start.getTime() - activity.reminderMinutesBefore * 60_000)
        if (remindAt.getTime() > now.getTime() || remindAt.getTime() < earliest) continue

        due.push({
          key,
          routineId: routine.id,
          routineName: routine.name,
          activity,
          date,
          start,
          remindAt,
        })
      }
    }
  }

  return due.sort((a, b) => a.remindAt.getTime() - b.remindAt.getTime())
}

// Records reminders as shown so reloads and other tabs do not repeat them.
export function markRemindersFired(state: AppState, keys: readonly string[]): AppState {
  const fresh = keys.filter((key) => !state.firedReminders.includes(key))
  if (fresh.length === 0) return state
  return { ...state, firedReminders: [...state.firedReminders, ...fresh] }
}

// Notification text, e.g. title "Stretch in 5 min", body "Morning · 07:15".
export function reminderMessage(reminder: DueReminder, now: Date): { title: string; body: string } {
  const minutes = Math.round((reminder.start.getTime() - now.getTime()) / 60_000)
  const when =
    minutes <= 0 ? 'now' : minutes < 60 ? `in ${minutes} min` : `in ${formatHours(minutes)}`
  return {
    title: `${reminder.activity.title} ${when === 'now' ? 'starts now' : when}`,
    body: `${reminder.routineName} · ${reminder.activity.time}`,
  }
}

function formatHours(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}
