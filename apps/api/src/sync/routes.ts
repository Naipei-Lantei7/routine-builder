import { createDb } from '@routine-builder/db'
import { SyncPushSchema } from '@routine-builder/domain'
import { Hono } from 'hono'
import { requireUser } from '../auth/requireUser'
import type { AppEnv } from '../env'
import { applyOps, loadState } from './store'

// GET  /api/sync  → the user's routines and recent completions
// POST /api/sync  → apply a device's pending operations, then return the same
export function syncRoutes(now: () => Date) {
  const app = new Hono<AppEnv>()
  app.use(requireUser(now))

  app.get('/', async (c) => {
    return c.json(await loadState(createDb(c.env.DB), c.var.user.id, now()))
  })

  app.post('/', async (c) => {
    const body = SyncPushSchema.safeParse(await c.req.json().catch(() => null))
    if (!body.success) {
      const issue = body.error.issues[0]
      return c.json(
        {
          error: 'invalid_request',
          message: issue?.message ?? 'Invalid request.',
          field: issue?.path.join('.'),
        },
        400,
      )
    }
    const db = createDb(c.env.DB)
    await applyOps(db, c.var.user.id, body.data.ops)
    return c.json(await loadState(db, c.var.user.id, now()))
  })

  return app
}
