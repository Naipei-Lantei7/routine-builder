import { describe, expect, it } from 'vitest'
import { notificationTarget, strategyFor } from './strategy'

const ORIGIN = 'https://routines.example'
const req = (path: string, mode = 'cors', method = 'GET', origin = ORIGIN) => ({
  url: `${origin}${path}`,
  mode,
  method,
})

describe('strategyFor', () => {
  it('serves page loads network-first with the cached shell as fallback', () => {
    expect(strategyFor(req('/', 'navigate'), ORIGIN)).toBe('network-first-shell')
    expect(strategyFor(req('/routines/abc/edit', 'navigate'), ORIGIN)).toBe('network-first-shell')
  })

  it('serves hashed build files and icons cache-first', () => {
    expect(strategyFor(req('/assets/main-abc123.js'), ORIGIN)).toBe('cache-first')
    expect(strategyFor(req('/icons/icon-192.png'), ORIGIN)).toBe('cache-first')
  })

  it('leaves API calls, other methods and other sites to the browser', () => {
    expect(strategyFor(req('/api/routines'), ORIGIN)).toBe('passthrough')
    expect(strategyFor(req('/api/session', 'navigate'), ORIGIN)).toBe('passthrough')
    expect(strategyFor(req('/assets/main.js', 'cors', 'POST'), ORIGIN)).toBe('passthrough')
    expect(strategyFor(req('/assets/x.js', 'cors', 'GET', 'https://cdn.example'), ORIGIN)).toBe(
      'passthrough',
    )
    expect(strategyFor(req('/sw.js'), ORIGIN)).toBe('passthrough')
  })
})

describe('notificationTarget', () => {
  it('returns the in-app path from the notification data', () => {
    expect(notificationTarget({ url: '/#today-a-b' }, ORIGIN)).toBe('/#today-a-b')
    expect(notificationTarget({ url: `${ORIGIN}/routines?x=1` }, ORIGIN)).toBe('/routines?x=1')
  })

  it('never leaves the app', () => {
    expect(notificationTarget({ url: 'https://evil.example/' }, ORIGIN)).toBe('/')
    expect(notificationTarget({ url: '//evil.example/x' }, ORIGIN)).toBe('/')
  })

  it('falls back to the home page for missing or bad data', () => {
    expect(notificationTarget(null, ORIGIN)).toBe('/')
    expect(notificationTarget({ url: 42 }, ORIGIN)).toBe('/')
    expect(notificationTarget(undefined, ORIGIN)).toBe('/')
  })
})
