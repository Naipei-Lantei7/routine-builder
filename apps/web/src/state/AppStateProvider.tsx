import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AppState } from '@routine-builder/domain'
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
  const listeners = useRef(new Set<(prev: AppState, next: AppState) => void>())

  useEffect(
    () =>
      repository.subscribe((next) => {
        stateRef.current = next
        setState(next)
      }),
    [repository],
  )

  const commit = useCallback(
    (updater: (state: AppState) => AppState): { prev: AppState; next: AppState } => {
      const prev = stateRef.current
      const next = updater(prev)
      stateRef.current = next
      setState(next)
      try {
        repository.save(next)
        setSaveError(null)
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : String(error))
      }
      return { prev, next }
    },
    [repository],
  )

  const update = useCallback(
    (updater: (state: AppState) => AppState) => {
      const { prev, next } = commit(updater)
      if (prev !== next) listeners.current.forEach((listener) => listener(prev, next))
    },
    [commit],
  )

  const replace = useCallback(
    (updater: (state: AppState) => AppState) => {
      commit(updater)
    },
    [commit],
  )

  const subscribe = useCallback((listener: (prev: AppState, next: AppState) => void) => {
    listeners.current.add(listener)
    return () => {
      listeners.current.delete(listener)
    }
  }, [])

  const refresh = useCallback(() => {
    const result = repository.load()
    // Unreadable or blocked storage: keep what this tab already has.
    if (result.status === 'ok' || result.status === 'empty') {
      stateRef.current = result.state
      setState(result.state)
    }
    return stateRef.current
  }, [repository])

  const value = useMemo<AppStateValue>(
    () => ({
      state,
      loadStatus: initial.status,
      backupKey: initial.status === 'recovered' ? initial.backupKey : null,
      saveError,
      update,
      refresh,
      replace,
      subscribe,
    }),
    [state, initial, saveError, update, refresh, replace, subscribe],
  )

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}
