import { createContext, useContext } from 'react'
import type { AppState } from '@routine-builder/domain'
import type { LoadResult } from '../storage/repository'

export interface AppStateValue {
  state: AppState
  // How the initial load went; the UI shows a notice for recovered/unavailable.
  loadStatus: LoadResult['status']
  // Backup key when stored data could not be read, otherwise null.
  backupKey: string | null
  // Set when the last save failed (e.g. storage full or blocked).
  saveError: string | null
  // Applies a change and saves it.
  update: (updater: (state: AppState) => AppState) => void
}

export const AppStateContext = createContext<AppStateValue | null>(null)

export function useAppState(): AppStateValue {
  const value = useContext(AppStateContext)
  if (!value) throw new Error('useAppState must be used inside <AppStateProvider>')
  return value
}
