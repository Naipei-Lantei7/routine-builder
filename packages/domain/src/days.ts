import type { Weekday } from './schema'

export const WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7]

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
  7: 'Sun',
}

export const WEEKDAY_LONG: Record<Weekday, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
}

/** Human summary of a set of days, e.g. "Every day", "Weekdays", "Mon, Wed, Fri". */
export function formatDays(days: readonly Weekday[]): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b)
  const key = sorted.join(',')
  if (key === '1,2,3,4,5,6,7') return 'Every day'
  if (key === '1,2,3,4,5') return 'Weekdays'
  if (key === '6,7') return 'Weekends'
  return sorted.map((day) => WEEKDAY_SHORT[day]).join(', ')
}
