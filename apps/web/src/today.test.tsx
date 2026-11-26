import type { Routine } from '@routine-builder/domain'
import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderApp, seed, stored } from './test/utils'

// Thu 26 Nov 2026, 07:20 local time.
const NOW = new Date(2026, 10, 26, 7, 20)

const morning: Routine = {
  id: '0b6e3c8d-2f4a-4c1b-8e9d-7a5f3b2c1d00',
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
      durationMinutes: 10,
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

const weekend: Routine = {
  ...morning,
  id: '4b6e3c8d-2f4a-4c1b-8e9d-7a5f3b2c1d00',
  name: 'Weekend',
  days: [6, 7],
  activities: [{ ...morning.activities[0], id: '44444444-4444-4444-8444-444444444444' }],
}

function rows() {
  const list = screen.getByRole('list')
  return within(list)
    .getAllByRole('listitem')
    .map((row) => row.textContent)
}

beforeEach(() => {
  localStorage.clear()
  // Fake only Date so timers, promises and user-event keep working normally.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('today view', () => {
  it('lists today’s activities in time order with their status', async () => {
    seed(morning, weekend)
    await renderApp('/')

    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument()
    expect(screen.getByText(/Thursday/)).toBeInTheDocument()
    expect(screen.getByText('0 of 3')).toBeInTheDocument()

    const [wake, stretch, leave] = rows()
    expect(wake).toMatch(/07:00Wake upMorning.*Overdue/)
    expect(stretch).toMatch(/07:15StretchMorning · 10 min.*5 min before.*Now/)
    expect(leave).toMatch(/08:00LeaveMorning.*10 min before/)
    expect(leave).not.toMatch(/Next|Now|Overdue/)
  })

  it('ticks an activity off, saves it for today and moves "next" along', async () => {
    seed(morning)
    const { user } = await renderApp('/')

    await user.click(await screen.findByRole('checkbox', { name: 'Stretch' }))

    expect(screen.getByRole('checkbox', { name: 'Stretch' })).toBeChecked()
    expect(screen.getByText('1 of 3')).toBeInTheDocument()
    expect(rows()[2]).toMatch(/Next · in 40 min/)
    expect(stored().completions).toEqual([
      {
        routineId: morning.id,
        activityId: morning.activities[1].id,
        date: '2026-11-26',
        completedAt: NOW.toISOString(),
      },
    ])
  })

  it('unticks an activity', async () => {
    seed(morning)
    const { user } = await renderApp('/')
    const stretch = await screen.findByRole('checkbox', { name: 'Stretch' })

    await user.click(stretch)
    await user.click(stretch)

    expect(stretch).not.toBeChecked()
    expect(stored().completions).toEqual([])
  })

  it('celebrates when everything is done', async () => {
    seed(morning)
    const { user } = await renderApp('/')

    for (const name of ['Wake up', 'Stretch', 'Leave']) {
      await user.click(await screen.findByRole('checkbox', { name }))
    }

    expect(screen.getByText('3 of 3')).toBeInTheDocument()
    expect(screen.getByText('All done for today.')).toBeInTheDocument()
  })

  it('remembers what was done after a reload', async () => {
    seed(morning)
    const first = await renderApp('/')
    await first.user.click(await screen.findByRole('checkbox', { name: 'Wake up' }))

    document.body.innerHTML = ''
    await renderApp('/')

    expect(await screen.findByRole('checkbox', { name: 'Wake up' })).toBeChecked()
  })

  it('starts fresh the next day', async () => {
    seed(morning)
    const { user } = await renderApp('/')
    await user.click(await screen.findByRole('checkbox', { name: 'Wake up' }))

    document.body.innerHTML = ''
    vi.setSystemTime(new Date(2026, 10, 27, 6, 0)) // Friday
    await renderApp('/')

    expect(await screen.findByRole('checkbox', { name: 'Wake up' })).not.toBeChecked()
    expect(screen.getByText('0 of 3')).toBeInTheDocument()
  })

  it('says when nothing is scheduled today', async () => {
    seed(weekend)
    await renderApp('/')
    expect(await screen.findByText('Nothing scheduled today.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'See your routines' })).toBeInTheDocument()
  })

  it('points to creating a routine when there are none', async () => {
    await renderApp('/')
    expect(await screen.findByText('No routines yet.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'New routine' })).toHaveAttribute(
      'href',
      '/routines/new',
    )
  })

  it('highlights the current page in the header', async () => {
    const { user } = await renderApp('/')
    const nav = screen.getByRole('navigation', { name: 'Main' })

    expect(within(nav).getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page')
    await user.click(within(nav).getByRole('link', { name: 'Routines' }))

    expect(await screen.findByRole('heading', { name: 'Your routines' })).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: 'Routines' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(nav).getByRole('link', { name: 'Today' })).not.toHaveAttribute('aria-current')
  })
})
