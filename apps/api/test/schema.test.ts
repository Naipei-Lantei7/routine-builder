import { activities, completions, createDb, routines, users } from '@routine-builder/db'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestEnv } from './d1'

let testEnv: Awaited<ReturnType<typeof createTestEnv>>

beforeAll(async () => {
  testEnv = await createTestEnv()
})

afterAll(async () => {
  await testEnv?.dispose()
})

const userId = '11111111-1111-4111-8111-111111111111'
const routineId = '22222222-2222-4222-8222-222222222222'
const activityId = '33333333-3333-4333-8333-333333333333'

async function seed() {
  const db = createDb(testEnv.env.DB)
  await db.insert(users).values({ id: userId, email: 'me@example.com', timeZone: 'Africa/Nairobi' })
  await db.insert(routines).values({
    id: routineId,
    userId,
    name: 'Morning',
    days: [1, 2, 3, 4, 5],
    createdAt: '2026-11-26T07:00:00.000Z',
    updatedAt: '2026-11-26T07:00:00.000Z',
  })
  await db.insert(activities).values({
    id: activityId,
    routineId,
    position: 0,
    title: 'Stretch',
    time: '07:15',
    reminderMinutesBefore: 5,
    nextReminderAt: Date.UTC(2026, 10, 27, 4, 10),
  })
  await db.insert(completions).values({
    userId,
    routineId,
    activityId,
    date: '2026-11-26',
    completedAt: '2026-11-26T04:20:00.000Z',
  })
  return db
}

describe('database schema', () => {
  it('creates every table from the migration', async () => {
    const { results } = await testEnv.env.DB.prepare(
      "select name from sqlite_master where type = 'table' and name not like '\\_%' escape '\\' and name not like 'sqlite_%' order by name",
    ).all<{ name: string }>()

    expect(results.map((row) => row.name)).toEqual([
      'activities',
      'completions',
      'login_codes',
      'push_subscriptions',
      'routines',
      'sessions',
      'users',
    ])
  })

  it('round-trips typed values (JSON days, booleans, defaults)', async () => {
    const db = await seed()

    const [routine] = await db.select().from(routines).where(eq(routines.id, routineId))
    const [user] = await db.select().from(users).where(eq(users.id, userId))

    expect(routine).toMatchObject({ days: [1, 2, 3, 4, 5], enabled: true })
    expect(user.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })

  it('rejects a second user with the same email', async () => {
    const db = createDb(testEnv.env.DB)
    await expect(
      db
        .insert(users)
        .values({ id: '44444444-4444-4444-8444-444444444444', email: 'me@example.com' }),
    ).rejects.toThrow()
  })

  it('deleting a user removes their routines, activities and completions', async () => {
    const db = createDb(testEnv.env.DB)

    await db.delete(users).where(eq(users.id, userId))

    expect(await db.select().from(routines)).toEqual([])
    expect(await db.select().from(activities)).toEqual([])
    expect(await db.select().from(completions)).toEqual([])
  })
})
