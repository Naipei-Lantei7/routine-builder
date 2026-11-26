import type { AppState, Routine } from './schema'

/** Adds the routine, or replaces the one with the same id in place. */
export function upsertRoutine(state: AppState, routine: Routine): AppState {
  const exists = state.routines.some((r) => r.id === routine.id)
  return {
    ...state,
    routines: exists
      ? state.routines.map((r) => (r.id === routine.id ? routine : r))
      : [...state.routines, routine],
  }
}

/**
 * Removes a routine. Its completions are kept for history (RFC 0001,
 * section 5.3); views ignore completions whose routine no longer exists.
 */
export function deleteRoutine(state: AppState, id: string): AppState {
  return { ...state, routines: state.routines.filter((r) => r.id !== id) }
}

export function setRoutineEnabled(
  state: AppState,
  id: string,
  enabled: boolean,
  now: Date,
): AppState {
  return {
    ...state,
    routines: state.routines.map((r) =>
      r.id === id && r.enabled !== enabled ? { ...r, enabled, updatedAt: now.toISOString() } : r,
    ),
  }
}
