import { describe, expect, it } from 'vitest'
import { deleteRoutine, setActivityDone, setRoutineEnabled, upsertRoutine } from './appState'
import { createEmptyState, type AppState, type Routine } from './schema'

const routine = (id: string, name: string): Routine => ({
  id,
  name,
  days: [1],
  activities: [],
  enabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
})

const a = routine('11111111-1111-4111-8111-111111111111', 'A')
const b = routine('22222222-2222-4222-8222-222222222222', 'B')
const NOW = new Date('2026-11-26T09:00:00.000Z')

const stateWith = (...routines: Routine[]): AppState => ({ ...createEmptyState(), routines })

describe('upsertRoutine', () => {
  it('appends a new routine', () => {
    expect(upsertRoutine(stateWith(a), b).routines).toEqual([a, b])
  })

  it('replaces an existing routine in place', () => {
    const renamed = { ...a, name: 'A2' }
    expect(upsertRoutine(stateWith(a, b), renamed).routines).toEqual([renamed, b])
  })
})

describe('deleteRoutine', () => {
  it('removes the routine but keeps its completions', () => {
    const completion = {
      routineId: a.id,
      activityId: '33333333-3333-4333-8333-333333333333',
      date: '2026-11-26',
      completedAt: NOW.toISOString(),
    }
    const state = { ...stateWith(a, b), completions: [completion] }

    const next = deleteRoutine(state, a.id)

    expect(next.routines).toEqual([b])
    expect(next.completions).toEqual([completion])
  })
})

describe('setRoutineEnabled', () => {
  it('updates enabled and updatedAt', () => {
    const next = setRoutineEnabled(stateWith(a, b), a.id, false, NOW)
    expect(next.routines[0]).toEqual({ ...a, enabled: false, updatedAt: NOW.toISOString() })
    expect(next.routines[1]).toBe(b)
  })

  it('leaves the routine untouched when the value does not change', () => {
    const state = stateWith(a)
    expect(setRoutineEnabled(state, a.id, true, NOW).routines[0]).toBe(a)
  })
})

describe('setActivityDone', () => {
  const target = {
    routineId: a.id,
    activityId: '33333333-3333-4333-8333-333333333333',
    date: '2026-11-26',
  }

  it('adds a completion with the time it was completed', () => {
    const next = setActivityDone(stateWith(a), target, true, NOW)
    expect(next.completions).toEqual([{ ...target, completedAt: NOW.toISOString() }])
  })

  it('removes the completion when unticked', () => {
    const ticked = setActivityDone(stateWith(a), target, true, NOW)
    expect(setActivityDone(ticked, target, false, NOW).completions).toEqual([])
  })

  it('is idempotent and leaves other days alone', () => {
    const ticked = setActivityDone(stateWith(a), target, true, NOW)
    expect(setActivityDone(ticked, target, true, NOW)).toBe(ticked)

    const otherDay = setActivityDone(ticked, { ...target, date: '2026-11-25' }, true, NOW)
    const unticked = setActivityDone(otherDay, target, false, NOW)
    expect(unticked.completions.map((c) => c.date)).toEqual(['2026-11-25'])
  })
})
