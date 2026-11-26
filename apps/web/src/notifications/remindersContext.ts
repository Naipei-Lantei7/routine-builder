import { createContext, useContext } from 'react'
import type { PermissionState } from './notifier'

export interface InAppReminder {
  key: string
  title: string
  body: string
  // Element id of the activity's row on the Today page.
  targetId: string
}

export interface RemindersValue {
  permission: PermissionState
  // Reminders shown on the page because system notifications are unavailable.
  inApp: InAppReminder[]
  enable: () => Promise<void>
  dismiss: (key: string) => void
}

export const RemindersContext = createContext<RemindersValue | null>(null)

export function useReminders(): RemindersValue {
  const value = useContext(RemindersContext)
  if (!value) throw new Error('useReminders must be used inside <RemindersProvider>')
  return value
}
