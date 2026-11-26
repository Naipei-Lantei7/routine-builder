import { sessions, users, type Db } from '@routine-builder/db'
import { and, eq, gt } from 'drizzle-orm'
import { randomToken, sha256Hex } from './crypto'

export const SESSION_COOKIE = 'rb_session'
export const SESSION_DAYS = 90
// Sessions used within this many days of expiring are extended, so regular
// users stay signed in.
const RENEW_WITHIN_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

export interface SessionUser {
  id: string
  email: string
  timeZone: string
}

// Creates a session and returns the token for the cookie. Only its hash is stored.
export async function createSession(db: Db, userId: string, now: Date) {
  const token = randomToken()
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * DAY_MS)
  await db.insert(sessions).values({
    idHash: await sha256Hex(token),
    userId,
    expiresAt: expiresAt.toISOString(),
  })
  return { token, expiresAt }
}

// The signed-in user for a cookie token, or null. Extends sessions close to expiry
// and returns the new expiry so the cookie can be refreshed too.
export async function readSession(
  db: Db,
  token: string,
  now: Date,
): Promise<{ user: SessionUser; renewedUntil: Date | null } | null> {
  const idHash = await sha256Hex(token)
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      timeZone: users.timeZone,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.idHash, idHash), gt(sessions.expiresAt, now.toISOString())))
  if (!row) return null

  let renewedUntil: Date | null = null
  if (new Date(row.expiresAt).getTime() - now.getTime() < RENEW_WITHIN_DAYS * DAY_MS) {
    renewedUntil = new Date(now.getTime() + SESSION_DAYS * DAY_MS)
    await db
      .update(sessions)
      .set({ expiresAt: renewedUntil.toISOString() })
      .where(eq(sessions.idHash, idHash))
  }

  return { user: { id: row.id, email: row.email, timeZone: row.timeZone }, renewedUntil }
}

export async function deleteSession(db: Db, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.idHash, await sha256Hex(token)))
}
