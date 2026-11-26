import { createEmptyState, type AppState, type Routine } from '@routine-builder/domain'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createAppRouter } from '../router'
import { AppStateProvider } from '../state/AppStateProvider'
import { STORAGE_KEY, createLocalStorageRepository } from '../storage/localStorageRepository'

// Renders the whole app (state + router) at `path`, backed by jsdom's localStorage.
export async function renderApp(path = '/') {
  const repository = createLocalStorageRepository({ storage: localStorage })
  const router = createAppRouter({ history: createMemoryHistory({ initialEntries: [path] }) })
  const user = userEvent.setup()
  render(
    <AppStateProvider repository={repository}>
      <RouterProvider router={router} />
    </AppStateProvider>,
  )
  // Routes load asynchronously; wait for the app shell.
  await screen.findByRole('heading', { level: 1, name: 'Routine Builder' })
  return { user, router }
}

export function stored(): AppState {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
}

export function seed(...routines: Routine[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...createEmptyState(), routines }))
}
