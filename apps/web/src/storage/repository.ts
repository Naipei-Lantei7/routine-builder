import type { AppState } from '@routine-builder/domain'

export type LoadResult =
  // Nothing stored yet: first visit.
  | { status: 'empty'; state: AppState }
  // Stored data loaded and validated.
  | { status: 'ok'; state: AppState }
  // Stored data could not be read. It was copied to `backupKey` (when
  // possible) and the app starts with empty state.
  | { status: 'recovered'; state: AppState; backupKey: string | null; reason: string }
  // Storage itself cannot be accessed (e.g. blocked by browser settings).
  | { status: 'unavailable'; state: AppState }

// Where the app's state lives. The MVP stores it in localStorage; a later
// implementation can talk to the API without the UI changing.
export interface RoutineRepository {
  load(): LoadResult
  // Validates and persists the whole state. Throws if `state` is invalid.
  save(state: AppState): void
  // Called when another tab changes the stored state. Returns an unsubscribe function.
  subscribe(listener: (state: AppState) => void): () => void
}
