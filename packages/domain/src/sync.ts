import { z } from 'zod'
import { setActivityDone, upsertRoutine } from './appState'
import {
  CompletionSchema,
  DateKeySchema,
  RoutineSchema,
  type AppState,
  type Completion,
  type Routine,
} from './schema'

// Changes sent from a device to the server (Plan 003, section 9). The web app
// records them in an outbox as the user edits, and sends them when online.
export const SyncOpSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('putRoutine'), routine: RoutineSchema }),
  z.object({ type: z.literal('deleteRoutine'), routineId: z.uuid() }),
  z.object({
    type: z.literal('setCompletion'),
    routineId: z.uuid(),
    activityId: z.uuid(),
    date: DateKeySchema,
    done: z.boolean(),
    completedAt: z.iso.datetime(),
  }),
])

export const MAX_OPS_PER_PUSH = 500

export const SyncPushSchema = z.object({
  ops: z.array(SyncOpSchema).max(MAX_OPS_PER_PUSH),
})

// What the server holds for a user, and returns after every sync.
export const SyncStateSchema = z.object({
  routines: z.array(RoutineSchema),
  completions: z.array(CompletionSchema),
})

export type SyncOp = z.infer<typeof SyncOpSchema>
export type SyncState = z.infer<typeof SyncStateSchema>

// The operations that turn `prev` into `next`, for routines and completions.
// Other state (such as which reminders were shown) is local to the device.
export function diffForSync(
  prev: Pick<AppState, 'routines' | 'completions'>,
  next: Pick<AppState, 'routines' | 'completions'>,
): SyncOp[] {
  const ops: SyncOp[] = []

  const before = new Map(prev.routines.map((r) => [r.id, r]))
  const after = new Map(next.routines.map((r) => [r.id, r]))
  for (const routine of next.routines) {
    const old = before.get(routine.id)
    if (!old || !sameRoutine(old, routine)) ops.push({ type: 'putRoutine', routine })
  }
  for (const routine of prev.routines) {
    if (!after.has(routine.id)) ops.push({ type: 'deleteRoutine', routineId: routine.id })
  }

  const doneBefore = new Map(prev.completions.map((c) => [completionKey(c), c]))
  const doneAfter = new Map(next.completions.map((c) => [completionKey(c), c]))
  for (const [key, completion] of doneAfter) {
    if (!doneBefore.has(key)) ops.push(completionOp(completion, true))
  }
  for (const [key, completion] of doneBefore) {
    if (!doneAfter.has(key)) ops.push(completionOp(completion, false))
  }

  return ops
}

// Applies operations to local state. Used to replay changes that are still in
// the outbox on top of the latest state from the server.
export function applySyncOps<S extends Pick<AppState, 'routines' | 'completions'>>(
  state: S,
  ops: readonly SyncOp[],
): S {
  return ops.reduce<S>((current, op) => {
    switch (op.type) {
      case 'putRoutine':
        return { ...current, routines: upsertRoutine(asAppState(current), op.routine).routines }
      case 'deleteRoutine':
        return { ...current, routines: current.routines.filter((r) => r.id !== op.routineId) }
      case 'setCompletion': {
        const { routineId, activityId, date } = op
        const updated = setActivityDone(
          asAppState(current),
          { routineId, activityId, date },
          op.done,
          new Date(op.completedAt),
        )
        return { ...current, completions: updated.completions }
      }
    }
  }, state)
}

function asAppState(state: Pick<AppState, 'routines' | 'completions'>): AppState {
  return { version: 1, firedReminders: [], ...state }
}

function completionKey(c: Completion): string {
  return `${c.routineId}:${c.activityId}:${c.date}`
}

function completionOp(c: Completion, done: boolean): SyncOp {
  return {
    type: 'setCompletion',
    routineId: c.routineId,
    activityId: c.activityId,
    date: c.date,
    done,
    completedAt: c.completedAt,
  }
}

function sameRoutine(a: Routine, b: Routine): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b)
}
