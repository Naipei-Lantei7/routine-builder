import { activities, completions, routines, type Db } from '@routine-builder/db'
import type { Routine, SyncOp, SyncState } from '@routine-builder/domain'
import { and, asc, eq, gte, inArray } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'

// How much completion history a device downloads.
export const COMPLETION_HISTORY_DAYS = 400
// D1 allows at most 100 bound parameters per query.
const ID_CHUNK = 90

interface Known {
  userId: string
  updatedAt: string
}

// Applies a device's operations for one user. Free D1 allows 50 queries per
// request, so the routines involved are looked up in a few chunked queries and
// every write goes into one batch, which counts as a single query and is atomic.
//
// Rules:
// - putRoutine: last write wins, by updatedAt. Activities are replaced as a whole.
// - deleteRoutine: removes the routine and its activities.
// - setCompletion: ticks or unticks an activity for a day; repeats are harmless.
// - Operations on another user's routine are ignored.
export async function applyOps(db: Db, userId: string, ops: readonly SyncOp[]): Promise<void> {
  const known = await lookUpRoutines(db, routineIds(ops))
  const writes: BatchItem<'sqlite'>[] = []

  for (const op of ops) {
    switch (op.type) {
      case 'putRoutine': {
        const routine = op.routine
        const existing = known.get(routine.id)
        if (existing && existing.userId !== userId) break
        if (existing && existing.updatedAt > routine.updatedAt) break
        writes.push(...putRoutineWrites(db, userId, routine))
        known.set(routine.id, { userId, updatedAt: routine.updatedAt })
        break
      }
      case 'deleteRoutine': {
        const existing = known.get(op.routineId)
        if (existing && existing.userId !== userId) break
        writes.push(
          db
            .delete(routines)
            .where(and(eq(routines.id, op.routineId), eq(routines.userId, userId))),
        )
        known.delete(op.routineId)
        break
      }
      case 'setCompletion': {
        const key = {
          userId,
          routineId: op.routineId,
          activityId: op.activityId,
          date: op.date,
        }
        writes.push(
          op.done
            ? db
                .insert(completions)
                .values({ ...key, completedAt: op.completedAt })
                .onConflictDoNothing()
            : db
                .delete(completions)
                .where(
                  and(
                    eq(completions.userId, userId),
                    eq(completions.routineId, op.routineId),
                    eq(completions.activityId, op.activityId),
                    eq(completions.date, op.date),
                  ),
                ),
        )
        break
      }
    }
  }

  if (writes.length > 0) {
    await db.batch(writes as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]])
  }
}

function putRoutineWrites(db: Db, userId: string, routine: Routine): BatchItem<'sqlite'>[] {
  const values = {
    id: routine.id,
    userId,
    name: routine.name,
    days: routine.days,
    enabled: routine.enabled,
    createdAt: routine.createdAt,
    updatedAt: routine.updatedAt,
  }
  return [
    db
      .insert(routines)
      .values(values)
      .onConflictDoUpdate({
        target: routines.id,
        set: {
          name: values.name,
          days: values.days,
          enabled: values.enabled,
          updatedAt: values.updatedAt,
        },
      }),
    db.delete(activities).where(eq(activities.routineId, routine.id)),
    ...routine.activities.map((activity, position) =>
      db.insert(activities).values({
        id: activity.id,
        routineId: routine.id,
        position,
        title: activity.title,
        time: activity.time,
        durationMinutes: activity.durationMinutes ?? null,
        notes: activity.notes ?? null,
        reminderMinutesBefore: activity.reminderMinutesBefore,
      }),
    ),
  ]
}

function routineIds(ops: readonly SyncOp[]): string[] {
  const ids = new Set<string>()
  for (const op of ops) {
    if (op.type === 'putRoutine') ids.add(op.routine.id)
    if (op.type === 'deleteRoutine') ids.add(op.routineId)
  }
  return [...ids]
}

async function lookUpRoutines(db: Db, ids: string[]): Promise<Map<string, Known>> {
  const known = new Map<string, Known>()
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const rows = await db
      .select({ id: routines.id, userId: routines.userId, updatedAt: routines.updatedAt })
      .from(routines)
      .where(inArray(routines.id, ids.slice(i, i + ID_CHUNK)))
    for (const row of rows) known.set(row.id, { userId: row.userId, updatedAt: row.updatedAt })
  }
  return known
}

// Everything a device needs for one user, in the shape of the domain schemas.
export async function loadState(db: Db, userId: string, now: Date): Promise<SyncState> {
  const since = new Date(now.getTime() - COMPLETION_HISTORY_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const [routineRows, activityRows, completionRows] = await db.batch([
    db.select().from(routines).where(eq(routines.userId, userId)).orderBy(asc(routines.createdAt)),
    db
      .select({ activity: activities })
      .from(activities)
      .innerJoin(routines, eq(routines.id, activities.routineId))
      .where(eq(routines.userId, userId))
      .orderBy(asc(activities.position)),
    db
      .select()
      .from(completions)
      .where(and(eq(completions.userId, userId), gte(completions.date, since))),
  ])

  const byRoutine = new Map<string, Routine['activities']>()
  for (const { activity } of activityRows) {
    const list = byRoutine.get(activity.routineId) ?? []
    list.push({
      id: activity.id,
      title: activity.title,
      time: activity.time,
      ...(activity.durationMinutes !== null ? { durationMinutes: activity.durationMinutes } : {}),
      ...(activity.notes !== null ? { notes: activity.notes } : {}),
      reminderMinutesBefore: activity.reminderMinutesBefore,
    })
    byRoutine.set(activity.routineId, list)
  }

  return {
    routines: routineRows.map((row) => ({
      id: row.id,
      name: row.name,
      days: row.days as Routine['days'],
      enabled: row.enabled,
      activities: byRoutine.get(row.id) ?? [],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })),
    completions: completionRows.map((row) => ({
      routineId: row.routineId,
      activityId: row.activityId,
      date: row.date,
      completedAt: row.completedAt,
    })),
  }
}
