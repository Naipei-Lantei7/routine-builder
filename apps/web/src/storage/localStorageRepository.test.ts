import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyState, type AppState, type Routine } from '@routine-builder/domain'
import {
  BACKUP_KEY_PREFIX,
  STORAGE_KEY,
  createLocalStorageRepository,
  pruneState,
} from './localStorageRepository'

const NOW = new Date(2026, 10, 26, 9, 0) // Thu 26 Nov 2026, 09:00 local

const routine: Routine = {
  id: '0b6e3c8d-2f4a-4c1b-8e9d-7a5f3b2c1d00',
  name: 'Weekday morning',
  days: [1, 2, 3, 4, 5],
  activities: [
    {
      id: '6f1c2a52-5c1e-4b7a-9f3e-2d8b1a0c4e11',
      title: 'Stretch',
      time: '07:15',
      reminderMinutesBefore: 5,
    },
  ],
  enabled: true,
  createdAt: '2026-11-26T07:00:00.000Z',
  updatedAt: '2026-11-26T07:00:00.000Z',
}

function stateWith(overrides: Partial<AppState> = {}): AppState {
  return { ...createEmptyState(), routines: [routine], ...overrides }
}

function createRepo() {
  return createLocalStorageRepository({ storage: localStorage, now: () => NOW })
}

beforeEach(() => {
  localStorage.clear()
})

describe('localStorage repository: load and save', () => {
  it('returns empty state on first visit', () => {
    expect(createRepo().load()).toEqual({ status: 'empty', state: createEmptyState() })
  })

  it('round-trips saved state', () => {
    const repo = createRepo()
    repo.save(stateWith())
    expect(repo.load()).toEqual({ status: 'ok', state: stateWith() })
  })

  it('stores everything under a single versioned key', () => {
    createRepo().save(stateWith())
    expect(localStorage.length).toBe(1)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toMatchObject({ version: 1 })
  })

  it('refuses to save invalid state and leaves stored data untouched', () => {
    const repo = createRepo()
    repo.save(stateWith())
    const invalid = stateWith({ routines: [{ ...routine, name: '' }] })
    expect(() => repo.save(invalid)).toThrow()
    expect(repo.load().state).toEqual(stateWith())
  })
})

describe('localStorage repository: invalid stored data', () => {
  it.each([
    ['not JSON', '{oops', 'not valid JSON'],
    ['an unknown version', JSON.stringify({ version: 99 }), 'newer than this app'],
    [
      'a schema violation',
      JSON.stringify({ ...stateWith(), routines: [{ ...routine, days: [] }] }),
      'routines.0.days',
    ],
  ])('backs up %s and starts empty', (_, raw, reason) => {
    localStorage.setItem(STORAGE_KEY, raw)

    const result = createRepo().load()

    expect(result.status).toBe('recovered')
    expect(result.state).toEqual(createEmptyState())
    if (result.status !== 'recovered') return
    expect(result.reason).toContain(reason)
    expect(result.backupKey).toBe(`${BACKUP_KEY_PREFIX}${NOW.toISOString()}`)
    expect(localStorage.getItem(result.backupKey!)).toBe(raw)
    // The original is not overwritten by loading.
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw)
  })

  it('still recovers when the backup cannot be written', () => {
    localStorage.setItem(STORAGE_KEY, '{oops')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })

    const result = createRepo().load()

    expect(result).toMatchObject({ status: 'recovered', backupKey: null })
  })
})

describe('localStorage repository: unavailable storage', () => {
  it('returns empty state when storage access throws', () => {
    const blocked = {
      getItem: () => {
        throw new DOMException('Access denied', 'SecurityError')
      },
    } as unknown as Storage
    const repo = createLocalStorageRepository({ storage: blocked, now: () => NOW })

    expect(repo.load()).toEqual({ status: 'unavailable', state: createEmptyState() })
  })
})

describe('localStorage repository: other tabs', () => {
  function dispatchStorageEvent(key: string | null) {
    window.dispatchEvent(new StorageEvent('storage', { key, storageArea: localStorage }))
  }

  it('notifies subscribers when another tab saves', () => {
    const repo = createRepo()
    const listener = vi.fn()
    repo.subscribe(listener)

    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateWith()))
    dispatchStorageEvent(STORAGE_KEY)

    expect(listener).toHaveBeenCalledWith(stateWith())
  })

  it('notifies with empty state when another tab clears storage', () => {
    const repo = createRepo()
    const listener = vi.fn()
    repo.subscribe(listener)

    dispatchStorageEvent(null)

    expect(listener).toHaveBeenCalledWith(createEmptyState())
  })

  it('ignores changes to other keys', () => {
    const repo = createRepo()
    const listener = vi.fn()
    repo.subscribe(listener)

    dispatchStorageEvent('something-else')

    expect(listener).not.toHaveBeenCalled()
  })

  it('stops notifying after unsubscribe', () => {
    const repo = createRepo()
    const listener = vi.fn()
    const unsubscribe = repo.subscribe(listener)

    unsubscribe()
    dispatchStorageEvent(STORAGE_KEY)

    expect(listener).not.toHaveBeenCalled()
  })
})

describe('pruneState', () => {
  const completion = (date: string) => ({
    routineId: routine.id,
    activityId: routine.activities[0].id,
    date,
    completedAt: '2026-01-01T00:00:00.000Z',
  })

  it('drops completions older than 400 days', () => {
    const state = stateWith({
      completions: [completion('2025-10-21'), completion('2025-10-22'), completion('2026-11-26')],
    })
    expect(pruneState(state, NOW).completions.map((c) => c.date)).toEqual([
      '2025-10-22',
      '2026-11-26',
    ])
  })

  it('drops fired-reminder keys older than 2 days and malformed keys', () => {
    const key = (date: string) => `${routine.id}:${routine.activities[0].id}:${date}`
    const state = stateWith({
      firedReminders: [key('2026-11-23'), key('2026-11-24'), key('2026-11-26'), 'garbage'],
    })
    expect(pruneState(state, NOW).firedReminders).toEqual([key('2026-11-24'), key('2026-11-26')])
  })

  it('is applied on load', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(stateWith({ completions: [completion('2020-01-01')] })),
    )
    expect(createRepo().load().state.completions).toEqual([])
  })
})
