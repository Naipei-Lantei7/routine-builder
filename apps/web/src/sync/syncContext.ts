import { createContext, useContext } from 'react'

export type SyncStatus =
  // Signed out: everything stays on this device.
  | 'local'
  | 'syncing'
  | 'synced'
  // Changes are saved on this device and will be sent when back online.
  | 'offline'
  | 'error'

export interface SyncValue {
  status: SyncStatus
  // Changes waiting to be sent.
  pending: number
  lastSyncedAt: Date | null
  syncNow: () => Promise<void>
  // Sends pending changes if possible, signs out, and clears this device's copy.
  signOut: () => Promise<void>
}

export const SyncContext = createContext<SyncValue | null>(null)

export function useSync(): SyncValue {
  const value = useContext(SyncContext)
  if (!value) throw new Error('useSync must be used inside <SyncProvider>')
  return value
}
