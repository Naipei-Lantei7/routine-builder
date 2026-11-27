import { createEmptyState, type AppState, type Routine } from '@routine-builder/domain'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { AuthProvider } from '../auth/AuthProvider'
import { createAppRouter } from '../router'
import { AppStateProvider } from '../state/AppStateProvider'
import { SyncProvider } from '../sync/SyncProvider'
import { STORAGE_KEY, createLocalStorageRepository } from '../storage/localStorageRepository'

export interface ApiCall {
  method: string
  path: string
  body: unknown
}

// A JSON response from the fake API: status defaults to 200.
export type ApiReply = { status?: number; body: unknown }
export type ApiRoutes = Record<string, (call: ApiCall) => ApiReply | Promise<ApiReply>>

const defaultRoutes: ApiRoutes = {
  'GET /api/auth/session': () => ({ body: { user: null } }),
}

// Replaces fetch with a fake API keyed by "METHOD /path". Unknown routes get a 404.
// A handler that throws makes fetch reject, like a network failure.
export function mockApi(routes: ApiRoutes = {}) {
  const calls: ApiCall[] = []
  const handlers = { ...defaultRoutes, ...routes }
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path =
      typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url
    const method = init?.method ?? 'GET'
    const call = { method, path, body: init?.body ? JSON.parse(String(init.body)) : undefined }
    calls.push(call)
    const handler = handlers[`${method} ${path}`]
    const reply = handler ? await handler(call) : { status: 404, body: { error: 'not_found' } }
    return new Response(JSON.stringify(reply.body), {
      status: reply.status ?? 200,
      headers: { 'content-type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return { calls, fetch: fetchMock }
}

// Renders the whole app (auth + state + router) at `path`, backed by jsdom's
// localStorage and a fake API.
export async function renderApp(path = '/', routes: ApiRoutes = {}) {
  const api = mockApi(routes)
  const repository = createLocalStorageRepository({ storage: localStorage })
  const router = createAppRouter({ history: createMemoryHistory({ initialEntries: [path] }) })
  const user = userEvent.setup()
  render(
    <AuthProvider>
      <AppStateProvider repository={repository}>
        <SyncProvider>
          <RouterProvider router={router} />
        </SyncProvider>
      </AppStateProvider>
    </AuthProvider>,
  )
  // Routes load asynchronously; wait for the app shell.
  await screen.findByRole('heading', { level: 1, name: 'Routine Builder' })
  return { user, router, api }
}

export function stored(): AppState {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
}

export function seed(...routines: Routine[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...createEmptyState(), routines }))
}
