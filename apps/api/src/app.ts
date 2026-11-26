import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { secureHeaders } from 'hono/secure-headers'
import { createDb } from '@routine-builder/db'
import type { AppEnv } from './env'

// The HTTP API, mounted under /api. Static files never reach this app: the
// Worker only runs first for /api/* (wrangler.jsonc, run_worker_first).
export function createApp() {
  const app = new Hono<AppEnv>().basePath('/api')

  app.use(secureHeaders())

  // Responses are per user and change often, so never cache them.
  app.use(async (c, next) => {
    await next()
    c.header('Cache-Control', 'no-store')
  })

  // Liveness and database check, used by deploy verification and monitoring.
  app.get('/health', async (c) => {
    const db = createDb(c.env.DB)
    await db.run(sql`select 1`)
    return c.json({ ok: true })
  })

  app.notFound((c) => c.json({ error: 'not_found', message: 'No such API route.' }, 404))

  app.onError((error, c) => {
    if (error instanceof HTTPException) {
      return c.json({ error: 'request_failed', message: error.message }, error.status)
    }
    // Details go to the Worker logs, never to the client.
    console.error(error)
    return c.json({ error: 'internal_error', message: 'Something went wrong.' }, 500)
  })

  return app
}
