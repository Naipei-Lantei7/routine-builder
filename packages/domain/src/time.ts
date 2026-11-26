import type { DateKey, TimeOfDay, Weekday } from './schema'

/** Converts "HH:mm" to minutes since local midnight. */
export function toMinutes(time: TimeOfDay): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/** ISO weekday of a date in local time: 1 = Monday ... 7 = Sunday. */
export function isoWeekday(date: Date): Weekday {
  const day = date.getDay() // 0 = Sunday
  return day === 0 ? 7 : day
}

/** Local calendar date of `date` as "YYYY-MM-DD". */
export function toDateKey(date: Date): DateKey {
  const y = String(date.getFullYear()).padStart(4, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Midnight at the start of a local date key. */
export function fromDateKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Returns the date key `days` days after `key` (negative to go back). */
export function addDays(key: DateKey, days: number): DateKey {
  const date = fromDateKey(key)
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

/**
 * The instant when wall-clock `time` happens on local date `key`.
 * Built from local components, so it follows the user's current time zone
 * and daylight-saving rules.
 */
export function atLocalTime(key: DateKey, time: TimeOfDay): Date {
  const [y, m, d] = key.split('-').map(Number)
  const [hours, minutes] = time.split(':').map(Number)
  return new Date(y, m - 1, d, hours, minutes)
}
