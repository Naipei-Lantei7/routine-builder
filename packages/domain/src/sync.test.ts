import { describe, expect, it } from 'vitest'
import type { Completion, Routine } from './schema'
import { applySyncOps, diffForSync, SyncOpSchema, type SyncOp } from './sync'

const routine = (id: string, name: string, updatedAt = '2026-11-26T07:00:00.000Z'): Routine => ({
  id,
  name,
  days: [1, 2, 3, 4, 5],
  enabled: true,
  activities: [
    {
      id: '33333333-3333-4333-8333-333333333333',
      title: 'Stretch',
      time: '07:15',
      reminderMinutesBefore: 5,
    },
  ],
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt,
})

const A = routine('11111111-1111-4111-8111-111111111111', 'Morning')
const B = routine('22222222-2222-4222-8222-222222222222', 'Evening')

const done = (date: string): Completion => ({
  routineId: A.id,
  activityId: A.activities[0].id,
  date,
  completedAt: `${date}T07:20:00.000Z`,
})

describe('diffForSync', () => {
  it('finds nothing when nothing changed', () => {
    const state = { routines: [A], completions: [done('2026-11-26')] }
    expect(diffForSync(state, { ...state, routines: [{ ...A }] })).toEqual([])
  })

  it('puts new and changed routines, and deletes removed ones', () => {
    const renamed = { ...A, name: 'Early morning', updatedAt: '2026-11-26T08:00:00.000Z' }

    const ops = diffForSync(
      { routines: [A, B], completions: [] },
      { routines: [renamed], completions: [] },
    )

    expect(ops).toEqual([
      { type: 'putRoutine', routine: renamed },
      { type: 'deleteRoutine', routineId: B.id },
    ])
  })

  it('records ticking and unticking activities', () => {
    const ops = diffForSync(
      { routines: [A], completions: [done('2026-11-25')] },
      { routines: [A], completions: [done('2026-11-26')] },
    )

    expect(ops).toEqual([
      expect.objectContaining({ type: 'setCompletion', date: '2026-11-26', done: true }),
      expect.objectContaining({ type: 'setCompletion', date: '2026-11-25', done: false }),
    ])
  })

  it('produces operations the server accepts', () => {
    const ops = diffForSync(
      { routines: [B], completions: [] },
      { routines: [A], completions: [done('2026-11-26')] },
    )
    for (const op of ops) expect(SyncOpSchema.safeParse(op).success).toBe(true)
  })
})

describe('applySyncOps', () => {
  it('replays operations on top of another state', () => {
    const server = { routines: [A, B], completions: [] }
    const pending: SyncOp[] = [
      { type: 'deleteRoutine', routineId: B.id },
      { type: 'putRoutine', routine: { ...A, name: 'Renamed offline' } },
      {
        type: 'setCompletion',
        routineId: A.id,
        activityId: A.activities[0].id,
        date: '2026-11-26',
        done: true,
        completedAt: '2026-11-26T07:20:00.000Z',
      },
    ]

    const result = applySyncOps(server, pending)

    expect(result.routines.map((r) => r.name)).toEqual(['Renamed offline'])
    expect(result.completions).toEqual([done('2026-11-26')])
  })

  it('round-trips with diffForSync', () => {
    const prev = { routines: [A, B], completions: [done('2026-11-25')] }
    const next = { routines: [{ ...B, name: 'Later' }], completions: [done('2026-11-26')] }

    expect(applySyncOps(prev, diffForSync(prev, next))).toEqual({
      routines: next.routines,
      completions: next.completions,
    })
  })

  it('keeps other fields of the state untouched', () => {
    const state = { version: 1 as const, firedReminders: ['x'], routines: [A], completions: [] }
    expect(applySyncOps(state, [{ type: 'deleteRoutine', routineId: A.id }])).toMatchObject({
      version: 1,
      firedReminders: ['x'],
      routines: [],
    })
  })
})
