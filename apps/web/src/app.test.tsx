import type { Routine } from '@routine-builder/domain'
import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { STORAGE_KEY } from './storage/localStorageRepository'
import { renderApp, seed, stored } from './test/utils'

const ROUTINE_ID = '0b6e3c8d-2f4a-4c1b-8e9d-7a5f3b2c1d00'

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
  it('shows an empty state on first visit', async () => {
    await renderApp()
    expect(await screen.findByText('No routines yet.')).toBeInTheDocument()
  })

  it('summarises each routine and its activities', async () => {
    seed(morning)
    await renderApp('/routines')
    expect(await screen.findByRole('heading', { name: 'Morning' })).toBeInTheDocument()
    expect(screen.getByText('Weekdays · 3 activities · 07:00–08:00')).toBeInTheDocument()
    expect(screen.getByText('10 min before')).toBeInTheDocument()
  })

  it('turns a routine off and saves it', async () => {
    seed(morning)
    const { user } = await renderApp('/routines')

    await user.click(await screen.findByRole('switch', { name: 'Morning is on' }))

    expect(screen.getByRole('switch', { name: 'Morning is off' })).not.toBeChecked()
    expect(screen.getByText('Off')).toBeInTheDocument()
    expect(stored().routines[0].enabled).toBe(false)
  })

  it('warns when saved data could not be read', async () => {
    localStorage.setItem(STORAGE_KEY, '{broken')
    await renderApp()
    expect(screen.getByRole('status')).toHaveTextContent('could not be read')
  })
})

describe('routing', () => {
  it('opens the editor at /routines/new from the list', async () => {
    const { user, router } = await renderApp('/routines')

    await user.click(await screen.findByRole('link', { name: 'New routine' }))

    expect(await screen.findByRole('heading', { name: 'New routine' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/routines/new')
  })

  it('loads the editor directly from its URL', async () => {
    seed(morning)
    await renderApp(`/routines/${ROUTINE_ID}/edit`)
    expect(await screen.findByRole('heading', { name: 'Edit Morning' })).toBeInTheDocument()
  })

  it('shows "Routine not found" for an unknown id', async () => {
    await renderApp('/routines/does-not-exist/edit')
    expect(await screen.findByRole('heading', { name: 'Routine not found' })).toBeInTheDocument()
  })

  it('shows a not-found page for unknown URLs', async () => {
    await renderApp('/nope')
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })
})

describe('creating a routine', () => {
  it('creates a routine with an activity and saves it', async () => {
    const { user, router } = await renderApp('/routines/new')

    await user.type(await screen.findByLabelText('Name'), 'Evening')
    await user.click(screen.getByRole('button', { name: 'Monday', pressed: true })) // untick Monday
    await user.click(screen.getByRole('button', { name: 'Add activity' }))

    const activity = screen.getByRole('group', { name: 'Activity 1' })
    expect(within(activity).getByLabelText('Title')).toHaveFocus()
    await user.type(within(activity).getByLabelText('Title'), 'Read')
    const time = within(activity).getByLabelText('Time')
    await user.clear(time)
    await user.type(time, '21:30')
    await user.type(within(activity).getByLabelText('Duration (min)'), '20')
    await user.click(within(activity).getByRole('combobox', { name: 'Reminder' }))
    await user.click(await screen.findByRole('option', { name: '10 min before' }))
    await user.click(screen.getByRole('button', { name: 'Save routine' }))

    expect(await screen.findByRole('heading', { name: 'Evening' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/routines')
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
    const { user } = await renderApp('/routines/new')

    await user.click(await screen.findByRole('button', { name: 'Add activity' }))
    await user.click(screen.getByRole('button', { name: 'Save routine' }))

    const summary = screen.getByText('Fix 2 problems before saving.').closest('[role="alert"]')
    expect(summary).toHaveFocus()
    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription('Give the routine a name')
    expect(screen.getByLabelText('Title')).toHaveAccessibleDescription('Give the activity a title')
    expect(stored()).toBeNull()

    // Errors clear as they are fixed.
    await user.type(screen.getByLabelText('Name'), 'Evening')
    expect(screen.getByText('Fix 1 problem before saving.')).toBeInTheDocument()
  })

  it('requires at least one day', async () => {
    const { user } = await renderApp('/routines/new')
    await user.type(await screen.findByLabelText('Name'), 'Never')
    for (const day of [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ]) {
      await user.click(screen.getByRole('button', { name: day }))
    }
    await user.click(screen.getByRole('button', { name: 'Save routine' }))

    expect(screen.getByRole('group', { name: 'Days' })).toHaveAccessibleDescription(
      'Pick at least one day',
    )
    expect(stored()).toBeNull()
  })

  it('discards the draft on cancel', async () => {
    const { user } = await renderApp('/routines/new')

    await user.type(await screen.findByLabelText('Name'), 'Evening')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(await screen.findByText('No routines yet.')).toBeInTheDocument()
    expect(stored()).toBeNull()
  })
})

describe('editing a routine', () => {
  it('reorders, sorts and removes activities', async () => {
    seed(morning)
    const { user } = await renderApp(`/routines/${ROUTINE_ID}/edit`)

    expect(await screen.findByRole('button', { name: 'Move Wake up up' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Move Wake up down' }))
    expect(activityTitles()).toEqual(['Stretch', 'Wake up', 'Leave'])

    await user.click(screen.getByRole('button', { name: 'Sort by time' }))
    expect(activityTitles()).toEqual(['Wake up', 'Stretch', 'Leave'])

    await user.click(screen.getByRole('button', { name: 'Remove Stretch' }))
    expect(activityTitles()).toEqual(['Wake up', 'Leave'])

    await user.click(screen.getByRole('button', { name: 'Save routine' }))
    await screen.findByRole('heading', { name: 'Your routines' })

    const saved = stored().routines[0]
    expect(saved.activities.map((a) => a.title)).toEqual(['Wake up', 'Leave'])
    expect(saved.createdAt).toBe(morning.createdAt)
    expect(saved.updatedAt).not.toBe(morning.updatedAt)
  })

  it('renames a routine', async () => {
    seed(morning)
    const { user } = await renderApp('/routines')
    await user.click(await screen.findByRole('link', { name: 'Edit Morning' }))

    const name = await screen.findByLabelText('Name')
    await user.clear(name)
    await user.type(name, 'Early morning')
    await user.click(screen.getByRole('button', { name: 'Save routine' }))

    expect(await screen.findByRole('heading', { name: 'Early morning' })).toBeInTheDocument()
    expect(stored().routines).toHaveLength(1)
  })

  it('deletes a routine after confirmation', async () => {
    seed(morning)
    const { user } = await renderApp(`/routines/${ROUTINE_ID}/edit`)

    await user.click(await screen.findByRole('button', { name: 'Delete routine' }))
    expect(screen.getByRole('alertdialog', { name: 'Delete Morning?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Keep it' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(stored().routines).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Delete routine' }))
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }))

    expect(await screen.findByText('No routines yet.')).toBeInTheDocument()
    expect(stored().routines).toEqual([])
  })
})
