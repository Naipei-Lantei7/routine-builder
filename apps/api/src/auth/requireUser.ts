import { createDb } from '@routine-builder/db'
import { getCookie, setCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../env'
import { readSession, SESSION_COOKIE, SESSION_DAYS } from './session'

// Rejects requests without a valid session; otherwise makes the user available
// as c.var.user and extends the session when it is close to expiring.
export function requireUser(now: () => Date) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const token = getCookie(c, SESSION_COOKIE)
    const session = token ? await readSession(createDb(c.env.DB), token, now()) : null
    if (!token || !session) {
      return c.json({ error: 'unauthorized', message: 'Sign in to continue.' }, 401)
    }
    if (session.renewedUntil) {
      setCookie(c, SESSION_COOKIE, token, {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        expires: session.renewedUntil,
        maxAge: SESSION_DAYS * 24 * 60 * 60,
      })
    }
    c.set('user', session.user)
    await next()
  })
}
