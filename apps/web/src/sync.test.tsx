import { applySyncOps, type Routine, type SyncOp, type SyncState } from '@routine-builder/domain'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderApp, seed, stored, type ApiRoutes } from './test/utils'

const USER = { id: 'u1', email: 'me@example.com', timeZone: 'Africa/Nairobi' }

const routine = (id: string, name: string, updatedAt = '2026-11-26T07:00:00.000Z'): Routine => ({
  id,
  name,
  days: [1, 2, 3, 4, 5, 6, 7],
  enabled: true,
  activities: [
    {
      id: `${id.slice(0, 35)}9`,
      title: `${name} activity`,
      time: '07:15',
      reminderMinutesBefore: null,
    },
  ],
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt,
})

const LOCAL = routine('11111111-1111-4111-8111-111111111111', 'From this phone')
const REMOTE = routine('22222222-2222-4222-8222-222222222222', 'From the laptop')

// An in-memory sync server that applies operations the same way the real one does.
function fakeServer(initial: SyncState = { routines: [], completions: [] }) {
  const server = {
    state: structuredClone(initial),
    online: true,
    session: true,
    pushes: [] as SyncOp[][],
  }
  const offline = () => {
    throw new TypeError('Failed to fetch')
  }
  const routes: ApiRoutes = {
    'GET /api/auth/session': () => ({ body: { user: server.session ? USER : null } }),
    'POST /api/auth/sign-out': () => {
      server.session = false
      return { body: { signedOut: true } }
    },
    'GET /api/sync': () => {
      if (!server.online) offline()
      if (!server.session)
        return { status: 401, body: { error: 'unauthorized', message: 'Sign in.' } }
      return { body: server.state }
    },
    'POST /api/sync': ({ body }) => {
      if (!server.online) offline()
      if (!server.session)
        return { status: 401, body: { error: 'unauthorized', message: 'Sign in.' } }
      const ops = (body as { ops: SyncOp[] }).ops
      server.pushes.push(ops)
      server.state = applySyncOps(server.state, ops)
      return { body: server.state }
    },
  }
  return { server, routes }
}

function signedInOnThisDevice() {
  localStorage.setItem('routine-builder:user', JSON.stringify(USER))
}

function outbox(): SyncOp[] {
  return JSON.parse(localStorage.getItem(`routine-builder:outbox:${USER.id}`) ?? '[]')
}

async function openAccountMenu(user: Awaited<ReturnType<typeof renderApp>>['user']) {
  await user.click(await screen.findByRole('button', { name: 'Account: me@example.com' }))
  return screen.getByRole('menu')
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('first sign-in on a device', () => {
  it('uploads the routines already on the device, then keeps the server’s copy', async () => {
    seed(LOCAL)
    signedInOnThisDevice()
    const { server, routes } = fakeServer({ routines: [REMOTE], completions: [] })

    await renderApp('/routines', routes)

    await waitFor(() =>
      expect(server.state.routines.map((r) => r.name)).toContain('From this phone'),
    )
    expect(server.pushes[0]).toEqual([{ type: 'putRoutine', routine: LOCAL }])
    // The device now shows everything on the account.
    expect(await screen.findByRole('heading', { name: 'From the laptop' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'From this phone' })).toBeInTheDocument()
    expect(localStorage.getItem('routine-builder:last-user')).toBe(USER.id)
    expect(outbox()).toEqual([])
  })

  it('does not upload another account’s leftovers to a second account', async () => {
    seed(LOCAL)
    localStorage.setItem('routine-builder:last-user', 'someone-else')
    signedInOnThisDevice()
    const { server, routes } = fakeServer()

    await renderApp('/routines', routes)

    await waitFor(() => expect(screen.getByText('No routines yet.')).toBeInTheDocument())
    expect(server.pushes).toEqual([])
    expect(stored().routines).toEqual([])
  })
})

describe('while signed in', () => {
  beforeEach(() => {
    signedInOnThisDevice()
    localStorage.setItem('routine-builder:last-user', USER.id)
  })

  it('sends edits to the server', async () => {
    const { server, routes } = fakeServer({ routines: [REMOTE], completions: [] })
    const { user } = await renderApp('/routines', routes)

    await user.click(await screen.findByRole('switch', { name: 'From the laptop is on' }))

    await waitFor(() => expect(server.state.routines[0].enabled).toBe(false))
    expect(server.pushes.at(-1)).toEqual([
      { type: 'putRoutine', routine: expect.objectContaining({ id: REMOTE.id, enabled: false }) },
    ])
  })

  it('picks up changes made on another device when the app is opened again', async () => {
    const { server, routes } = fakeServer({ routines: [REMOTE], completions: [] })
    await renderApp('/routines', routes)
    expect(await screen.findByRole('heading', { name: 'From the laptop' })).toBeInTheDocument()

    server.state = { routines: [{ ...REMOTE, name: 'Renamed on laptop' }], completions: [] }
    act(() => {
      fireEvent(document, new Event('visibilitychange'))
    })

    expect(await screen.findByRole('heading', { name: 'Renamed on laptop' })).toBeInTheDocument()
  })

  it('keeps edits made offline and sends them when back online', async () => {
    const { server, routes } = fakeServer({ routines: [REMOTE], completions: [] })
    const { user } = await renderApp('/routines', routes)
    await screen.findByRole('heading', { name: 'From the laptop' })

    server.online = false
    await user.click(screen.getByRole('switch', { name: 'From the laptop is on' }))

    await waitFor(() => expect(outbox()).toHaveLength(1))
    const menu = await openAccountMenu(user)
    expect(await within(menu).findByText('Offline. Changes will sync later')).toBeInTheDocument()
    expect(within(menu).getByText('1 waiting')).toBeInTheDocument()
    expect(server.state.routines[0].enabled).toBe(true)

    server.online = true
    act(() => {
      window.dispatchEvent(new Event('online'))
    })

    await waitFor(() => expect(server.state.routines[0].enabled).toBe(false))
    expect(outbox()).toEqual([])
  })

  it('keeps an edit made during a sync instead of losing it to the server’s reply', async () => {
    // Real browsers run one sync at a time (Web Locks); jsdom has none, so use a
    // stand-in that queues lock requests the same way.
    let queue = Promise.resolve()
    vi.stubGlobal('navigator', {
      ...navigator,
      locks: {
        request: (_name: string, task: () => Promise<void>) => {
          const run = queue.then(task)
          queue = run.catch(() => {})
          return run
        },
      },
    })
    // Hold requests open until the test lets them finish.
    const gates: (() => void)[] = []
    const gate = () => new Promise<void>((resolve) => gates.push(resolve))
    const { server, routes } = fakeServer({ routines: [REMOTE], completions: [] })
    const get = routes['GET /api/sync']
    const post = routes['POST /api/sync']
    routes['GET /api/sync'] = async (call) => {
      const reply = get(call) // the server's state when the request arrives
      await gate()
      return reply
    }
    routes['POST /api/sync'] = async (call) => {
      await gate()
      return post(call)
    }
    // The device already shows the routine from an earlier visit.
    seed(REMOTE)
    const { user } = await renderApp('/routines', routes)
    await waitFor(() => expect(gates).toHaveLength(1)) // first pull in flight

    // Edit while the pull is in flight: queued, and its push waits for the lock.
    await user.click(await screen.findByRole('switch', { name: 'From the laptop is on' }))
    await waitFor(() => expect(outbox()).toHaveLength(1))

    // The pull returns the old version. The queued edit must be replayed on top.
    await act(async () => gates[0]())
    expect(screen.getByRole('switch', { name: 'From the laptop is off' })).toBeInTheDocument()

    // Then the edit is sent.
    await waitFor(() => expect(gates).toHaveLength(2))
    await act(async () => gates[1]())
    await waitFor(() => expect(server.state.routines[0].enabled).toBe(false))
    expect(outbox()).toEqual([])
  })

  it('shows that everything is synced', async () => {
    const { routes } = fakeServer({ routines: [REMOTE], completions: [] })
    const { user } = await renderApp('/routines', routes)
    await screen.findByRole('heading', { name: 'From the laptop' })

    const menu = await openAccountMenu(user)

    expect(await within(menu).findByText('Synced')).toBeInTheDocument()
  })

  it('signs out locally when the session has ended on the server', async () => {
    const { server, routes } = fakeServer({ routines: [REMOTE], completions: [] })
    server.session = true
    routes['GET /api/sync'] = () => ({
      status: 401,
      body: { error: 'unauthorized', message: 'Sign in to continue.' },
    })

    await renderApp('/routines', routes)

    expect(await screen.findByRole('link', { name: 'Sign in' })).toBeInTheDocument()
  })
})

describe('signing out', () => {
  it('sends pending changes, then clears this device', async () => {
    signedInOnThisDevice()
    localStorage.setItem('routine-builder:last-user', USER.id)
    const { server, routes } = fakeServer({ routines: [REMOTE], completions: [] })
    const { user } = await renderApp('/routines', routes)
    await screen.findByRole('heading', { name: 'From the laptop' })

    const menu = await openAccountMenu(user)
    await act(async () => {
      await user.click(within(menu).getByRole('menuitem', { name: 'Sign out' }))
    })

    expect(await screen.findByRole('link', { name: 'Sign in' })).toBeInTheDocument()
    expect(stored().routines).toEqual([])
    expect(localStorage.getItem('routine-builder:user')).toBeNull()
    // Still on the server for next time.
    expect(server.state.routines).toHaveLength(1)
  })
})

describe('signed out', () => {
  it('never calls the sync API', async () => {
    seed(LOCAL)
    const { server, routes } = fakeServer()
    server.session = false
    const { api } = await renderApp('/routines', routes)

    await screen.findByRole('heading', { name: 'From this phone' })

    expect(api.calls.filter((call) => call.path === '/api/sync')).toEqual([])
  })
})
