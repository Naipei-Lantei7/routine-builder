import { createDb, loginCodes, sessions, users } from '@routine-builder/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { MAX_ATTEMPTS, MAX_CODES_PER_HOUR } from '../src/auth/routes'
import { SESSION_COOKIE } from '../src/auth/session'
import type { Env } from '../src/env'
import { createTestEnv } from './d1'

const ORIGIN = 'http://localhost'
const EMAIL = 'me@example.com'

let testEnv: Awaited<ReturnType<typeof createTestEnv>>
let env: Env
let clock: Date
let sent: { email: string; code: string }[]

// The app with a fake clock and a mailer that records codes instead of sending them.
function app() {
  return createApp({
    now: () => clock,
    mailer: () => ({
      sendLoginCode: async (email, code) => {
        sent.push({ email, code })
      },
    }),
  })
}

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return app().request(
    `/api/auth${path}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers },
      body: JSON.stringify(body),
    },
    env,
  )
}

function get(path: string, cookie?: string) {
  return app().request(`/api/auth${path}`, { headers: cookie ? { cookie } : {} }, env)
}

// "rb_session=abc; Path=/; ..." → "rb_session=abc"
function sessionCookie(response: Response): string {
  const header = response.headers.get('set-cookie') ?? ''
  const match = header.match(new RegExp(`${SESSION_COOKIE}=([^;]*)`))
  if (!match) throw new Error(`No session cookie in: ${header}`)
  return `${SESSION_COOKIE}=${match[1]}`
}

async function signIn(email = EMAIL) {
  await post('/code', { email })
  const { code } = sent.at(-1)!
  const response = await post('/verify', { email, code, timeZone: 'Africa/Nairobi' })
  return { response, cookie: sessionCookie(response) }
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
  await db.delete(sessions)
  await db.delete(loginCodes)
  await db.delete(users)
  clock = new Date('2026-11-26T09:00:00.000Z')
  sent = []
})

describe('requesting a code', () => {
  it('emails a 6-digit code and stores only a hash of it', async () => {
    const response = await post('/code', { email: '  Me@Example.com ' })

    expect(response.status).toBe(200)
    expect(sent).toHaveLength(1)
    expect(sent[0].email).toBe(EMAIL)
    expect(sent[0].code).toMatch(/^\d{6}$/)

    const [row] = await createDb(env.DB).select().from(loginCodes)
    expect(row.email).toBe(EMAIL)
    expect(row.codeHash).toMatch(/^[0-9a-f]{64}$/)
    expect(row.codeHash).not.toContain(sent[0].code)
  })

  it('rejects an invalid email', async () => {
    const response = await post('/code', { email: 'not-an-email' })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'invalid_request', field: 'email' })
    expect(sent).toHaveLength(0)
  })

  it(`limits each email to ${MAX_CODES_PER_HOUR} codes an hour`, async () => {
    for (let i = 0; i < MAX_CODES_PER_HOUR; i++) {
      expect((await post('/code', { email: EMAIL })).status).toBe(200)
    }
    expect((await post('/code', { email: EMAIL })).status).toBe(429)

    clock = new Date(clock.getTime() + 61 * 60 * 1000)
    expect((await post('/code', { email: EMAIL })).status).toBe(200)
  })

  it('makes an earlier code stop working', async () => {
    await post('/code', { email: EMAIL })
    const first = sent[0].code
    await post('/code', { email: EMAIL })

    const response = await post('/verify', { email: EMAIL, code: first })
    // Codes are random, so the second one could in theory equal the first.
    if (first !== sent[1].code) expect(response.status).toBe(400)
  })
})

describe('verifying a code', () => {
  it('signs in a new user with a secure session cookie', async () => {
    const { response } = await signIn()

    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      user: { id: string; email: string; timeZone: string }
    }
    expect(body.user).toMatchObject({ email: EMAIL, timeZone: 'Africa/Nairobi' })

    const cookie = response.headers.get('set-cookie') ?? ''
    expect(cookie).toMatch(/HttpOnly/)
    expect(cookie).toMatch(/Secure/)
    expect(cookie).toMatch(/SameSite=Lax/)
    expect(cookie).toMatch(/Path=\//)
    expect(cookie).toMatch(/Max-Age=7776000/) // 90 days
  })

  it('signs an existing user back in to the same account', async () => {
    const first = (await (await signIn()).response.json()) as { user: { id: string } }
    const second = (await (await signIn()).response.json()) as { user: { id: string } }

    expect(second.user.id).toBe(first.user.id)
    expect(await createDb(env.DB).select().from(users)).toHaveLength(1)
  })

  it('accepts a code only once', async () => {
    await post('/code', { email: EMAIL })
    const { code } = sent[0]

    expect((await post('/verify', { email: EMAIL, code })).status).toBe(200)
    expect((await post('/verify', { email: EMAIL, code })).status).toBe(400)
  })

  it('rejects a wrong code, and locks the code after too many attempts', async () => {
    await post('/code', { email: EMAIL })
    const { code } = sent[0]
    const wrong = code === '000000' ? '111111' : '000000'

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const response = await post('/verify', { email: EMAIL, code: wrong })
      expect(await response.json()).toMatchObject({ error: 'wrong_code' })
    }

    const locked = await post('/verify', { email: EMAIL, code })
    expect(locked.status).toBe(400)
    expect(await locked.json()).toMatchObject({ error: 'too_many_attempts' })
  })

  it('rejects an expired code', async () => {
    await post('/code', { email: EMAIL })
    clock = new Date(clock.getTime() + 11 * 60 * 1000)

    const response = await post('/verify', { email: EMAIL, code: sent[0].code })

    expect(await response.json()).toMatchObject({ error: 'code_expired' })
  })

  it('rejects a code sent to a different email', async () => {
    await post('/code', { email: EMAIL })
    await post('/code', { email: 'other@example.com' })

    const response = await post('/verify', { email: 'other@example.com', code: sent[0].code })

    if (sent[0].code !== sent[1].code) expect(response.status).toBe(400)
  })

  it('rejects an unknown time zone', async () => {
    await post('/code', { email: EMAIL })
    const response = await post('/verify', {
      email: EMAIL,
      code: sent[0].code,
      timeZone: 'Mars/Base',
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ field: 'timeZone' })
  })
})

describe('sessions', () => {
  it('returns the signed-in user', async () => {
    const { cookie } = await signIn()

    const response = await get('/session', cookie)

    expect(await response.json()).toMatchObject({ user: { email: EMAIL } })
  })

  it('returns null when signed out or the cookie is unknown', async () => {
    expect(await (await get('/session')).json()).toEqual({ user: null })
    expect(await (await get('/session', `${SESSION_COOKIE}=nope`)).json()).toEqual({ user: null })
  })

  it('stores only a hash of the session token', async () => {
    const { cookie } = await signIn()
    const token = cookie.split('=')[1]

    const rows = await createDb(env.DB).select().from(sessions)

    expect(rows).toHaveLength(1)
    expect(rows[0].idHash).not.toBe(token)
    expect(rows[0].idHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('expires after 90 days unless used', async () => {
    const { cookie } = await signIn()
    clock = new Date(clock.getTime() + 91 * 24 * 60 * 60 * 1000)

    expect(await (await get('/session', cookie)).json()).toEqual({ user: null })
  })

  it('extends a session used in its last 30 days', async () => {
    const { cookie } = await signIn()
    clock = new Date(clock.getTime() + 70 * 24 * 60 * 60 * 1000)

    const renewed = await get('/session', cookie)
    expect(renewed.headers.get('set-cookie')).toContain(SESSION_COOKIE)

    clock = new Date(clock.getTime() + 60 * 24 * 60 * 60 * 1000) // day 130
    expect(await (await get('/session', cookie)).json()).toMatchObject({ user: { email: EMAIL } })
  })

  it('signs out by deleting the session and clearing the cookie', async () => {
    const { cookie } = await signIn()

    const response = await post('/sign-out', {}, { cookie })

    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toMatch(new RegExp(`${SESSION_COOKIE}=;`))
    expect(await (await get('/session', cookie)).json()).toEqual({ user: null })
  })
})

describe('cross-site protection', () => {
  it('rejects requests from another site', async () => {
    const response = await post('/code', { email: EMAIL }, { origin: 'https://evil.example' })

    expect(response.status).toBe(403)
    expect(sent).toHaveLength(0)
  })

  it('rejects changes that are not sent as JSON', async () => {
    const response = await app().request(
      '/api/auth/code',
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', origin: ORIGIN },
        body: 'email=me%40example.com',
      },
      env,
    )

    expect(response.status).toBe(415)
    expect(sent).toHaveLength(0)
  })
})

describe('email configuration', () => {
  it('fails clearly, without logging codes, when no email service is configured', async () => {
    const original = console.error
    console.error = () => {}
    try {
      const response = await createApp({ now: () => clock }).request(
        '/api/auth/code',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin: ORIGIN },
          body: JSON.stringify({ email: EMAIL }),
        },
        env,
      )
      expect(response.status).toBe(503)
      expect(await response.json()).toMatchObject({ error: 'email_unavailable' })
    } finally {
      console.error = original
    }
  })
})
