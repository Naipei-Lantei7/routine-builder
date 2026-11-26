import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AppState } from '../domain/schema'
import type { RoutineRepository } from '../storage/repository'
import { AppStateContext, type AppStateValue } from './appStateContext'

interface Props {
  repository: RoutineRepository
  children: ReactNode
}

export function AppStateProvider({ repository, children }: Props) {
  const [initial] = useState(() => repository.load())
  const [state, setState] = useState<AppState>(initial.state)
  const [saveError, setSaveError] = useState<string | null>(null)

  // The latest state, so consecutive updates in one event build on each other
  // and saving stays outside React's state updater (which may run twice).
  const stateRef = useRef(state)

  useEffect(
    () =>
      repository.subscribe((next) => {
        stateRef.current = next
        setState(next)
      }),
    [repository],
  )

  const update = useCallback(
    (updater: (state: AppState) => AppState) => {
      const next = updater(stateRef.current)
      stateRef.current = next
      setState(next)
      try {
        repository.save(next)
        setSaveError(null)
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : String(error))
      }
    },
    [repository],
  )

  const value = useMemo<AppStateValue>(
    () => ({
      state,
      loadStatus: initial.status,
      backupKey: initial.status === 'recovered' ? initial.backupKey : null,
      saveError,
      update,
    }),
    [state, initial, saveError, update],
  )

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}
