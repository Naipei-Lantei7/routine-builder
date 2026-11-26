import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { createEmptyState, type AppState, type Routine } from '@routine-builder/domain'
import { AppStateProvider } from './state/AppStateProvider'
import { STORAGE_KEY, createLocalStorageRepository } from './storage/localStorageRepository'

const ROUTINE_ID = '0b6e3c8d-2f4a-4c1b-8e9d-7a5f3b2c1d00'

function sequentialIds() {
  let n = 0
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`
}

function renderApp() {
  const repository = createLocalStorageRepository({ storage: localStorage })
  const user = userEvent.setup()
  render(
    <AppStateProvider repository={repository}>
      <App newId={sequentialIds()} />
    </AppStateProvider>,
  )
  return { user }
}

function stored(): AppState {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
}

function seed(...routines: Routine[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...createEmptyState(), routines }))
}

const morning: Routine = {
  id: ROUTINE_ID,
  name: 'Morning',
  days: [1, 2, 3, 4, 5],
  enabled: true,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  activities: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      title: 'Wake up',
      time: '07:00',
      reminderMinutesBefore: null,
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      title: 'Stretch',
      time: '07:15',
      reminderMinutesBefore: 5,
    },
    {
      id: '33333333-3333-4333-8333-333333333333',
      title: 'Leave',
      time: '08:00',
      reminderMinutesBefore: 10,
    },
  ],
}

function activityTitles() {
  return screen
    .getAllByRole('group', { name: /^Activity \d+$/ })
    .map((group) => (within(group).getByLabelText('Title') as HTMLInputElement).value)
}

beforeEach(() => {
  localStorage.clear()
})

describe('routine list', () => {
  it('shows an empty state on first visit', () => {
    renderApp()
    expect(screen.getByRole('heading', { level: 1, name: 'Routine Builder' })).toBeInTheDocument()
    expect(screen.getByText('No routines yet.')).toBeInTheDocument()
  })

  it('summarises each routine', () => {
    seed(morning)
    renderApp()
    expect(screen.getByRole('heading', { name: 'Morning' })).toBeInTheDocument()
    expect(screen.getByText('Weekdays · 3 activities · 07:00–08:00')).toBeInTheDocument()
  })

  it('turns a routine off and saves it', async () => {
    seed(morning)
    const { user } = renderApp()

    await user.click(screen.getByRole('checkbox', { name: /Morning/ }))

    expect(screen.getByRole('checkbox', { name: 'Morning is off' })).not.toBeChecked()
    expect(stored().routines[0].enabled).toBe(false)
  })

  it('warns when saved data could not be read', () => {
    localStorage.setItem(STORAGE_KEY, '{broken')
    renderApp()
    expect(screen.getByRole('status')).toHaveTextContent('could not be read')
  })
})

describe('creating a routine', () => {
  it('creates a routine with an activity and saves it', async () => {
    const { user } = renderApp()

    await user.click(screen.getByRole('button', { name: 'New routine' }))
    await user.type(screen.getByLabelText('Name'), 'Evening')
    await user.click(screen.getByRole('checkbox', { name: 'Monday' })) // untick Monday
    await user.click(screen.getByRole('button', { name: 'Add activity' }))

    const activity = screen.getByRole('group', { name: 'Activity 1' })
    expect(within(activity).getByLabelText('Title')).toHaveFocus()
    await user.type(within(activity).getByLabelText('Title'), 'Read')
    const time = within(activity).getByLabelText('Time')
    await user.clear(time)
    await user.type(time, '21:30')
    await user.type(within(activity).getByLabelText('Duration (min)'), '20')
    await user.selectOptions(within(activity).getByLabelText('Reminder'), '10 min before')
    await user.click(screen.getByRole('button', { name: 'Save routine' }))

    expect(screen.getByRole('heading', { name: 'Evening' })).toBeInTheDocument()
    expect(stored().routines).toEqual([
      expect.objectContaining({
        name: 'Evening',
        days: [2, 3, 4, 5, 6, 7],
        enabled: true,
        activities: [
          {
            id: expect.any(String),
            title: 'Read',
            time: '21:30',
            durationMinutes: 20,
            reminderMinutesBefore: 10,
          },
        ],
      }),
    ])
  })

  it('shows errors and saves nothing when the form is invalid', async () => {
    const { user } = renderApp()

    await user.click(screen.getByRole('button', { name: 'New routine' }))
    await user.click(screen.getByRole('button', { name: 'Add activity' }))
    await user.click(screen.getByRole('button', { name: 'Save routine' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Fix 2 problems before saving.')
    expect(screen.getByRole('alert')).toHaveFocus()
    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription('Give the routine a name')
    expect(screen.getByLabelText('Title')).toHaveAccessibleDescription('Give the activity a title')
    expect(stored()).toBeNull()

    // Errors clear as they are fixed.
    await user.type(screen.getByLabelText('Name'), 'Evening')
    expect(screen.getByRole('alert')).toHaveTextContent('Fix 1 problem before saving.')
  })

  it('discards the draft on cancel', async () => {
    const { user } = renderApp()

    await user.click(screen.getByRole('button', { name: 'New routine' }))
    await user.type(screen.getByLabelText('Name'), 'Evening')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByText('No routines yet.')).toBeInTheDocument()
    expect(stored()).toBeNull()
  })
})

describe('editing a routine', () => {
  it('reorders, sorts and removes activities', async () => {
    seed(morning)
    const { user } = renderApp()
    await user.click(screen.getByRole('button', { name: 'Edit Morning' }))

    expect(screen.getByRole('button', { name: 'Move Wake up up' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Move Wake up down' }))
    expect(activityTitles()).toEqual(['Stretch', 'Wake up', 'Leave'])

    await user.click(screen.getByRole('button', { name: 'Sort by time' }))
    expect(activityTitles()).toEqual(['Wake up', 'Stretch', 'Leave'])

    await user.click(screen.getByRole('button', { name: 'Remove Stretch' }))
    expect(activityTitles()).toEqual(['Wake up', 'Leave'])

    await user.click(screen.getByRole('button', { name: 'Save routine' }))

    const saved = stored().routines[0]
    expect(saved.activities.map((a) => a.title)).toEqual(['Wake up', 'Leave'])
    expect(saved.createdAt).toBe(morning.createdAt)
    expect(saved.updatedAt).not.toBe(morning.updatedAt)
  })

  it('renames a routine', async () => {
    seed(morning)
    const { user } = renderApp()
    await user.click(screen.getByRole('button', { name: 'Edit Morning' }))

    const name = screen.getByLabelText('Name')
    await user.clear(name)
    await user.type(name, 'Early morning')
    await user.click(screen.getByRole('button', { name: 'Save routine' }))

    expect(screen.getByRole('heading', { name: 'Early morning' })).toBeInTheDocument()
    expect(stored().routines).toHaveLength(1)
  })

  it('deletes a routine after confirmation', async () => {
    seed(morning)
    const { user } = renderApp()
    await user.click(screen.getByRole('button', { name: 'Edit Morning' }))

    await user.click(screen.getByRole('button', { name: 'Delete routine' }))
    await user.click(screen.getByRole('button', { name: 'Keep it' }))
    expect(stored().routines).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Delete routine' }))
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }))

    expect(screen.getByText('No routines yet.')).toBeInTheDocument()
    expect(stored().routines).toEqual([])
  })
})
