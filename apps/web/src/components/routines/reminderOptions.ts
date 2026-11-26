import { NO_REMINDER } from '@routine-builder/domain'

export const REMINDER_OPTIONS: { value: string; label: string }[] = [
  { value: NO_REMINDER, label: 'No reminder' },
  { value: '0', label: 'At start time' },
  { value: '5', label: '5 min before' },
  { value: '10', label: '10 min before' },
  { value: '15', label: '15 min before' },
  { value: '30', label: '30 min before' },
  { value: '60', label: '1 hour before' },
]

// Short label for a saved reminder, e.g. "5 min before" or "At start time".
export function reminderLabel(minutesBefore: number): string {
  if (minutesBefore === 0) return 'At start time'
  if (minutesBefore % 60 === 0) {
    const hours = minutesBefore / 60
    return hours === 1 ? '1 hour before' : `${hours} hours before`
  }
  return `${minutesBefore} min before`
}
