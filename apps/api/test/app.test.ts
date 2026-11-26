import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import type { Env } from '../src/env'
import { createTestEnv } from './d1'

let testEnv: Awaited<ReturnType<typeof createTestEnv>>
let env: Env

beforeAll(async () => {
  testEnv = await createTestEnv()
  env = { DB: testEnv.env.DB, ASSETS: { fetch: () => new Response('asset') } as unknown as Fetcher }
})

afterAll(async () => {
  await testEnv?.dispose()
})

describe('GET /api/health', () => {
  it('reports ok when the database answers', async () => {
    const response = await createApp().request('/api/health', {}, env)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })

  it('is never cached and carries security headers', async () => {
    const response = await createApp().request('/api/health', {}, env)

    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('x-frame-options')).toBe('SAMEORIGIN')
  })
})

describe('errors', () => {
  it('answers unknown API routes with a JSON 404', async () => {
    const response = await createApp().request('/api/nope', {}, env)

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'not_found', message: 'No such API route.' })
  })

  it('hides internal error details from the client', async () => {
    const app = createApp()
    app.get('/boom', () => {
      throw new Error('secret database detail')
    })
    const errors: unknown[] = []
    const original = console.error
    console.error = (error: unknown) => errors.push(error)

    let response: Response
    try {
      response = await app.request('/api/boom', {}, env)
    } finally {
      console.error = original
    }

    expect(response.status).toBe(500)
    const body = await response.text()
    expect(body).not.toContain('secret')
    expect(JSON.parse(body)).toEqual({ error: 'internal_error', message: 'Something went wrong.' })
    expect(errors).toHaveLength(1)
  })
})
