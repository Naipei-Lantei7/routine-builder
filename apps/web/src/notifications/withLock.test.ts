import { afterEach, describe, expect, it, vi } from 'vitest'
import { withLock } from './withLock'

// Minimal Web Locks stand-in: one holder per name, others wait in order.
function fakeLocks() {
  const queues = new Map<string, Promise<void>>()
  return {
    request: vi.fn((name: string, callback: () => Promise<void>) => {
      const previous = queues.get(name) ?? Promise.resolve()
      const run = previous.then(callback)
      queues.set(
        name,
        run.catch(() => {}),
      )
      return run
    }),
  }
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('withLock', () => {
  it('runs tasks one at a time when Web Locks are available', async () => {
    const locks = fakeLocks()
    vi.stubGlobal('navigator', { ...navigator, locks })
    const events: string[] = []
    const task = (name: string) => async () => {
      events.push(`${name} start`)
      await tick()
      events.push(`${name} end`)
    }

    await Promise.all([withLock('reminders', task('a')), withLock('reminders', task('b'))])

    expect(locks.request).toHaveBeenCalledTimes(2)
    expect(events).toEqual(['a start', 'a end', 'b start', 'b end'])
  })

  it('still runs the task when Web Locks are not supported', async () => {
    vi.stubGlobal('navigator', { ...navigator, locks: undefined })
    const task = vi.fn()

    await withLock('reminders', task)

    expect(task).toHaveBeenCalledTimes(1)
  })
})
