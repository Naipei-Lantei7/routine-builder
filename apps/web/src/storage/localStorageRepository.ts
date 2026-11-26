import {
  addDays,
  type AppState,
  AppStateSchema,
  createEmptyState,
  DateKeySchema,
  toDateKey,
} from '@routine-builder/domain'
import { migrate } from './migrations'
import type { LoadResult, RoutineRepository } from './repository'

export const STORAGE_KEY = 'routine-builder:v1'
export const BACKUP_KEY_PREFIX = 'routine-builder:corrupt:'

// Completions older than this are dropped on load.
export const COMPLETION_RETENTION_DAYS = 400
// Fired-reminder keys older than this are dropped on load.
export const FIRED_REMINDER_RETENTION_DAYS = 2

export interface LocalStorageRepositoryOptions {
  storage?: Storage
  now?: () => Date
  // Where `storage` events are listened for. Defaults to `window`.
  eventTarget?: Pick<Window, 'addEventListener' | 'removeEventListener'>
}

export function createLocalStorageRepository(
  options: LocalStorageRepositoryOptions = {},
): RoutineRepository {
  const storage = options.storage ?? window.localStorage
  const now = options.now ?? (() => new Date())
  const eventTarget = options.eventTarget ?? window

  function load(): LoadResult {
    let raw: string | null
    try {
      raw = storage.getItem(STORAGE_KEY)
    } catch {
      return { status: 'unavailable', state: createEmptyState() }
    }
    if (raw === null) {
      return { status: 'empty', state: createEmptyState() }
    }

    const result = parse(raw)
    if (!result.ok) {
      return {
        status: 'recovered',
        state: createEmptyState(),
        backupKey: backup(raw),
        reason: result.reason,
      }
    }
    return { status: 'ok', state: pruneState(result.state, now()) }
  }

  // Keep the unreadable value under a separate key so a bug never silently
  // destroys user data. The main key is left as is until the next save.
  function backup(raw: string): string | null {
    const key = `${BACKUP_KEY_PREFIX}${now().toISOString()}`
    try {
      storage.setItem(key, raw)
      return key
    } catch {
      return null
    }
  }

  function save(state: AppState): void {
    const valid = AppStateSchema.parse(state)
    storage.setItem(STORAGE_KEY, JSON.stringify(valid))
  }

  function subscribe(listener: (state: AppState) => void): () => void {
    function onStorage(event: StorageEvent) {
      if (event.storageArea !== storage) return
      // key is null when another tab calls storage.clear()
      if (event.key !== STORAGE_KEY && event.key !== null) return
      listener(load().state)
    }
    eventTarget.addEventListener('storage', onStorage)
    return () => eventTarget.removeEventListener('storage', onStorage)
  }

  return { load, save, subscribe }
}

type ParseResult = { ok: true; state: AppState } | { ok: false; reason: string }

function parse(raw: string): ParseResult {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return { ok: false, reason: 'Stored data is not valid JSON' }
  }

  try {
    data = migrate(data)
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  }

  const result = AppStateSchema.safeParse(data)
  if (!result.success) {
    const issue = result.error.issues[0]
    const path = issue.path.join('.') || '(root)'
    return { ok: false, reason: `Stored data is invalid at ${path}: ${issue.message}` }
  }
  return { ok: true, state: result.data }
}

// Drops completions and fired-reminder keys that are too old to matter.
export function pruneState(state: AppState, now: Date): AppState {
  const today = toDateKey(now)
  const completionCutoff = addDays(today, -COMPLETION_RETENTION_DAYS)
  const reminderCutoff = addDays(today, -FIRED_REMINDER_RETENTION_DAYS)

  return {
    ...state,
    // Date keys are zero-padded, so string comparison is date order.
    completions: state.completions.filter((c) => c.date >= completionCutoff),
    firedReminders: state.firedReminders.filter((key) => {
      const date = key.split(':').at(-1) ?? ''
      return DateKeySchema.safeParse(date).success && date >= reminderCutoff
    }),
  }
}
