import { createDb, loginCodes, users } from '@routine-builder/db'
import { and, count, desc, eq, gt } from 'drizzle-orm'
import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { z } from 'zod'
import type { AppEnv, Env } from '../env'
import { hmacHex, randomCode, timingSafeEqual } from './crypto'
import type { Mailer } from './mailer'
import { createSession, deleteSession, readSession, SESSION_COOKIE, SESSION_DAYS } from './session'

export const CODE_TTL_MINUTES = 10
export const MAX_ATTEMPTS = 5
// Codes per email per hour: with 5 attempts each, at most 25 guesses an hour
// out of a million possible codes.
export const MAX_CODES_PER_HOUR = 5

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: 'Enter a valid email address.' }))

const timeZone = z.string().refine(isValidTimeZone, { message: 'Unknown time zone.' }).optional()

const requestCodeBody = z.object({ email })
const verifyBody = z.object({
  email,
  code: z.string().regex(/^\d{6}$/, { message: 'Enter the 6-digit code.' }),
  timeZone,
})

export interface AuthDeps {
  mailer: (env: Env) => Mailer
  now: () => Date
}

export function authRoutes({ mailer, now }: AuthDeps) {
  const app = new Hono<AppEnv>()

  // Step 1: email a one-time code. Works for new and existing users alike.
  app.post('/code', async (c) => {
    const body = requestCodeBody.safeParse(await c.req.json().catch(() => null))
    if (!body.success) return invalid(c, body.error)
    const address = body.data.email
    const db = createDb(c.env.DB)
    const at = now()

    const hourAgo = new Date(at.getTime() - 60 * 60 * 1000).toISOString()
    const [{ recent }] = await db
      .select({ recent: count() })
      .from(loginCodes)
      .where(and(eq(loginCodes.email, address), gt(loginCodes.createdAt, hourAgo)))
    if (recent >= MAX_CODES_PER_HOUR) {
      return c.json(
        { error: 'too_many_codes', message: 'Too many codes requested. Try again in an hour.' },
        429,
      )
    }

    const code = randomCode()
    // A new code replaces any earlier one for this email. Older rows are kept only
    // as a count for the hourly limit, with their hash cleared.
    await db
      .update(loginCodes)
      .set({ codeHash: '', expiresAt: at.toISOString() })
      .where(eq(loginCodes.email, address))
    await db.insert(loginCodes).values({
      email: address,
      codeHash: await hmacHex(c.env.AUTH_SECRET, `${address}:${code}`),
      expiresAt: new Date(at.getTime() + CODE_TTL_MINUTES * 60 * 1000).toISOString(),
      createdAt: at.toISOString(),
    })

    await mailer(c.env).sendLoginCode(address, code)
    return c.json({ sent: true })
  })

  // Step 2: check the code, then sign in, creating the account on first use.
  app.post('/verify', async (c) => {
    const body = verifyBody.safeParse(await c.req.json().catch(() => null))
    if (!body.success) return invalid(c, body.error)
    const { email: address, code } = body.data
    const db = createDb(c.env.DB)
    const at = now()

    const [pending] = await db
      .select()
      .from(loginCodes)
      .where(and(eq(loginCodes.email, address), gt(loginCodes.expiresAt, at.toISOString())))
      .orderBy(desc(loginCodes.id))
      .limit(1)
    if (!pending) {
      return c.json(
        { error: 'code_expired', message: 'This code has expired. Ask for a new one.' },
        400,
      )
    }
    if (pending.attempts >= MAX_ATTEMPTS) {
      return c.json(
        { error: 'too_many_attempts', message: 'Too many wrong codes. Ask for a new one.' },
        400,
      )
    }

    const expected = await hmacHex(c.env.AUTH_SECRET, `${address}:${code}`)
    if (!timingSafeEqual(expected, pending.codeHash)) {
      await db
        .update(loginCodes)
        .set({ attempts: pending.attempts + 1 })
        .where(eq(loginCodes.id, pending.id))
      return c.json({ error: 'wrong_code', message: 'That code is not right.' }, 400)
    }

    // Single use: expire it before signing in.
    await db
      .update(loginCodes)
      .set({ codeHash: '', expiresAt: at.toISOString() })
      .where(eq(loginCodes.id, pending.id))

    let [user] = await db.select().from(users).where(eq(users.email, address))
    if (!user) {
      ;[user] = await db
        .insert(users)
        .values({ id: crypto.randomUUID(), email: address, timeZone: body.data.timeZone ?? 'UTC' })
        .returning()
    } else if (body.data.timeZone && body.data.timeZone !== user.timeZone) {
      ;[user] = await db
        .update(users)
        .set({ timeZone: body.data.timeZone })
        .where(eq(users.id, user.id))
        .returning()
    }

    const session = await createSession(db, user.id, at)
    setSessionCookie(c, session.token, session.expiresAt)
    return c.json({ user: { id: user.id, email: user.email, timeZone: user.timeZone } })
  })

  // The signed-in user, or null. Always 200, so signed-out is not an error.
  app.get('/session', async (c) => {
    const token = getCookie(c, SESSION_COOKIE)
    if (!token) return c.json({ user: null })
    const session = await readSession(createDb(c.env.DB), token, now())
    if (!session) {
      deleteCookie(c, SESSION_COOKIE, { path: '/' })
      return c.json({ user: null })
    }
    if (session.renewedUntil) setSessionCookie(c, token, session.renewedUntil)
    return c.json({ user: session.user })
  })

  app.post('/sign-out', async (c) => {
    const token = getCookie(c, SESSION_COOKIE)
    if (token) await deleteSession(createDb(c.env.DB), token)
    deleteCookie(c, SESSION_COOKIE, { path: '/', secure: true, httpOnly: true, sameSite: 'Lax' })
    return c.json({ signedOut: true })
  })

  return app
}

function setSessionCookie(c: Parameters<typeof setCookie>[0], token: string, expires: Date) {
  setCookie(c, SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    expires,
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  })
}

function invalid(c: Parameters<typeof setCookie>[0], error: z.ZodError) {
  const issue = error.issues[0]
  return c.json(
    {
      error: 'invalid_request',
      message: issue?.message ?? 'Invalid request.',
      field: issue?.path.join('.'),
    },
    400,
  )
}

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value })
    return true
  } catch {
    return false
  }
}
