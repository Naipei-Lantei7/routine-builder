import { NO_REMINDER } from '../../domain/routineDraft'

export const REMINDER_OPTIONS: { value: string; label: string }[] = [
  { value: NO_REMINDER, label: 'No reminder' },
  { value: '0', label: 'At start time' },
  { value: '5', label: '5 min before' },
  { value: '10', label: '10 min before' },
  { value: '15', label: '15 min before' },
  { value: '30', label: '30 min before' },
  { value: '60', label: '1 hour before' },
]
