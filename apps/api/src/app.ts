import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { secureHeaders } from 'hono/secure-headers'
import { createDb } from '@routine-builder/db'
import { mailerFromEnv, EmailNotConfiguredError } from './auth/mailer'
import { authRoutes, type AuthDeps } from './auth/routes'
import type { AppEnv } from './env'
import { sameOrigin } from './middleware/sameOrigin'

export type AppOptions = Partial<AuthDeps>

// The HTTP API, mounted under /api. Static files never reach this app: the
// Worker only runs first for /api/* (wrangler.jsonc, run_worker_first).
export function createApp(options: AppOptions = {}) {
  const deps: AuthDeps = {
    mailer: options.mailer ?? mailerFromEnv,
    now: options.now ?? (() => new Date()),
  }
  const app = new Hono<AppEnv>().basePath('/api')

  app.use(secureHeaders())
  app.use(sameOrigin)

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

  app.route('/auth', authRoutes(deps))

  app.notFound((c) => c.json({ error: 'not_found', message: 'No such API route.' }, 404))

  app.onError((error, c) => {
    if (error instanceof EmailNotConfiguredError) {
      console.error(error.message)
      return c.json(
        { error: 'email_unavailable', message: 'Sign-in emails are not set up on this server.' },
        503,
      )
    }
    if (error instanceof HTTPException) {
      return c.json({ error: 'request_failed', message: error.message }, error.status)
    }
    // Details go to the Worker logs, never to the client.
    console.error(error)
    return c.json({ error: 'internal_error', message: 'Something went wrong.' }, 500)
  })

  return app
}
