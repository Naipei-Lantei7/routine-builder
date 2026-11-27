import { completions, createDb, routines, sessions, users } from '@routine-builder/db'
import type { Routine, SyncOp, SyncState } from '@routine-builder/domain'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { createSession, SESSION_COOKIE } from '../src/auth/session'
import type { Env } from '../src/env'
import { createTestEnv } from './d1'

const NOW = new Date('2026-11-26T09:00:00.000Z')
const ME = '11111111-1111-4111-8111-111111111111'
const OTHER = '99999999-9999-4999-8999-999999999999'

let testEnv: Awaited<ReturnType<typeof createTestEnv>>
let env: Env
let myCookie: string
let otherCookie: string

const app = () => createApp({ now: () => NOW })

function routine(id: string, name: string, updatedAt: string, titles = ['Stretch']): Routine {
  return {
    id,
    name,
    days: [1, 2, 3, 4, 5],
    enabled: true,
    activities: titles.map((title, i) => ({
      id: `${i}${id.slice(1)}`,
      title,
      time: `07:${String(i * 10).padStart(2, '0')}`,
      reminderMinutesBefore: i === 0 ? 5 : null,
      ...(i === 1 ? { durationMinutes: 20, notes: 'Slowly' } : {}),
    })),
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt,
  }
}

const MORNING = routine(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Morning',
  '2026-11-26T07:00:00.000Z',
  ['Stretch', 'Breakfast'],
)

async function push(ops: SyncOp[], cookie = myCookie) {
  const response = await app().request(
    '/api/sync',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ ops }),
    },
    env,
  )
  return { status: response.status, body: (await response.json()) as SyncState }
}

async function pull(cookie = myCookie) {
  const response = await app().request('/api/sync', { headers: { cookie } }, env)
  return { status: response.status, body: (await response.json()) as SyncState }
}

async function signInAs(id: string, email: string) {
  const db = createDb(env.DB)
  await db.insert(users).values({ id, email })
  const { token } = await createSession(db, id, NOW)
  return `${SESSION_COOKIE}=${token}`
}

beforeAll(async () => {
  testEnv = await createTestEnv()
  env = testEnv.env
})

afterAll(async () => {
  await testEnv?.dispose()
})

beforeEach(async () => {
  const db = createDb(env.DB)
  await db.delete(completions)
  await db.delete(routines)
  await db.delete(sessions)
  await db.delete(users)
  myCookie = await signInAs(ME, 'me@example.com')
  otherCookie = await signInAs(OTHER, 'other@example.com')
})

describe('access', () => {
  it('requires a signed-in user', async () => {
    expect((await pull('')).status).toBe(401)
    expect((await push([], '')).status).toBe(401)
  })

  it('starts empty for a new user', async () => {
    expect((await pull()).body).toEqual({ routines: [], completions: [] })
  })

  it('rejects malformed operations without applying any', async () => {
    const response = await app().request(
      '/api/sync',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: myCookie },
        body: JSON.stringify({
          ops: [
            { type: 'putRoutine', routine: MORNING },
            { type: 'putRoutine', routine: { id: 'x' } },
          ],
        }),
      },
      env,
    )

    expect(response.status).toBe(400)
    expect((await pull()).body.routines).toEqual([])
  })
})

describe('routines', () => {
  it('stores a routine with its activities, in order, and returns it unchanged', async () => {
    const { status, body } = await push([{ type: 'putRoutine', routine: MORNING }])

    expect(status).toBe(200)
    expect(body.routines).toEqual([MORNING])
    expect((await pull()).body.routines).toEqual([MORNING])
  })

  it('replaces activities when a newer version arrives (last write wins)', async () => {
    await push([{ type: 'putRoutine', routine: MORNING }])
    const newer = routine(MORNING.id, 'Morning v2', '2026-11-26T08:00:00.000Z', ['Run'])

    const { body } = await push([{ type: 'putRoutine', routine: newer }])

    expect(body.routines).toEqual([newer])
  })

  it('ignores an older version from a device that was offline', async () => {
    const newer = { ...MORNING, name: 'Newer', updatedAt: '2026-11-26T08:00:00.000Z' }
    await push([{ type: 'putRoutine', routine: newer }])

    const { body } = await push([{ type: 'putRoutine', routine: MORNING }])

    expect(body.routines[0].name).toBe('Newer')
  })

  it('deletes a routine and its activities', async () => {
    await push([{ type: 'putRoutine', routine: MORNING }])

    const { body } = await push([{ type: 'deleteRoutine', routineId: MORNING.id }])

    expect(body.routines).toEqual([])
    const left = await env.DB.prepare('select count(*) as n from activities').first<{ n: number }>()
    expect(left?.n).toBe(0)
  })

  it('applies operations in order within one push', async () => {
    const renamed = { ...MORNING, name: 'Renamed', updatedAt: '2026-11-26T07:30:00.000Z' }

    const { body } = await push([
      { type: 'putRoutine', routine: MORNING },
      { type: 'putRoutine', routine: renamed },
      { type: 'deleteRoutine', routineId: MORNING.id },
      {
        type: 'putRoutine',
        routine: { ...renamed, name: 'Back', updatedAt: '2026-11-26T07:40:00.000Z' },
      },
    ])

    expect(body.routines.map((r) => r.name)).toEqual(['Back'])
  })
})

describe('isolation between users', () => {
  it('never shows or changes another user’s routines', async () => {
    await push([{ type: 'putRoutine', routine: MORNING }], otherCookie)

    expect((await pull()).body.routines).toEqual([])

    // Same id from another account: ignored, not overwritten or deleted.
    await push([
      {
        type: 'putRoutine',
        routine: { ...MORNING, name: 'Hijacked', updatedAt: '2030-01-01T00:00:00.000Z' },
      },
    ])
    await push([{ type: 'deleteRoutine', routineId: MORNING.id }])

    expect((await pull(otherCookie)).body.routines).toEqual([MORNING])
  })
})

describe('completions', () => {
  const tick = (date: string, done: boolean): SyncOp => ({
    type: 'setCompletion',
    routineId: MORNING.id,
    activityId: MORNING.activities[0].id,
    date,
    done,
    completedAt: `${date}T07:20:00.000Z`,
  })

  it('records and removes completions, and repeats are harmless', async () => {
    await push([{ type: 'putRoutine', routine: MORNING }])

    let { body } = await push([tick('2026-11-26', true), tick('2026-11-26', true)])
    expect(body.completions).toEqual([
      {
        routineId: MORNING.id,
        activityId: MORNING.activities[0].id,
        date: '2026-11-26',
        completedAt: '2026-11-26T07:20:00.000Z',
      },
    ])
    ;({ body } = await push([tick('2026-11-26', false)]))
    expect(body.completions).toEqual([])
  })

  it('keeps completions when the routine is deleted, for history', async () => {
    await push([{ type: 'putRoutine', routine: MORNING }, tick('2026-11-26', true)])

    const { body } = await push([{ type: 'deleteRoutine', routineId: MORNING.id }])

    expect(body.completions).toHaveLength(1)
  })

  it('only sends the last 400 days of history', async () => {
    const { body } = await push([tick('2025-10-21', true), tick('2025-10-22', true)])
    expect(body.completions.map((c) => c.date)).toEqual(['2025-10-22'])
  })
})

describe('large pushes', () => {
  it('imports 150 routines in one request within the free plan’s query limit', async () => {
    const many = Array.from({ length: 150 }, (_, i) =>
      routine(
        `bbbbbbbb-bbbb-4bbb-8bbb-${String(i).padStart(12, '0')}`,
        `Routine ${i}`,
        '2026-11-26T07:00:00.000Z',
        ['A', 'B'],
      ),
    )

    const { status, body } = await push(
      many.map((r) => ({ type: 'putRoutine' as const, routine: r })),
    )

    expect(status).toBe(200)
    expect(body.routines).toHaveLength(150)
  })
})
