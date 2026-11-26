import type { Routine } from '@routine-builder/domain'
import { act, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderApp, seed, stored } from './test/utils'

// Thu 26 Nov 2026. Stretch is at 07:15 with a reminder 5 minutes before.
const at = (hours: number, minutes: number) => new Date(2026, 10, 26, hours, minutes)

const morning: Routine = {
  id: '0b6e3c8d-2f4a-4c1b-8e9d-7a5f3b2c1d00',
  name: 'Morning',
  days: [1, 2, 3, 4, 5],
  enabled: true,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  activities: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      title: 'Stretch',
      time: '07:15',
      durationMinutes: 10,
      reminderMinutesBefore: 5,
    },
  ],
}
const STRETCH_KEY = `${morning.id}:${morning.activities[0].id}:2026-11-26`

// A stand-in for the browser's Notification API that records what was shown.
class FakeNotification {
  static permission: NotificationPermission = 'default'
  static requestPermission = vi.fn(async () => FakeNotification.permission)
  static shown: FakeNotification[] = []

  title: string
  options: NotificationOptions
  onclick: (() => void) | null = null
  close = vi.fn()

  constructor(title: string, options: NotificationOptions) {
    this.title = title
    this.options = options
    FakeNotification.shown.push(this)
  }
}

function useNotifications(permission: NotificationPermission) {
  FakeNotification.permission = permission
  FakeNotification.shown = []
  FakeNotification.requestPermission.mockClear()
  vi.stubGlobal('Notification', FakeNotification)
}

// Moves the clock and triggers a check, as returning to the tab would.
async function advanceTo(time: Date) {
  vi.setSystemTime(time)
  await act(async () => {
    fireEvent.focus(window)
  })
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(at(7, 0))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('reminders with notifications allowed', () => {
  beforeEach(() => useNotifications('granted'))

  it('shows a system notification when a reminder is due, and records it', async () => {
    seed(morning)
    await renderApp('/')
    expect(FakeNotification.shown).toHaveLength(0)

    await advanceTo(at(7, 10))

    expect(FakeNotification.shown).toHaveLength(1)
    const [notification] = FakeNotification.shown
    expect(notification.title).toBe('Stretch in 5 min')
    expect(notification.options).toMatchObject({ body: 'Morning · 07:15', tag: STRETCH_KEY })
    expect(stored().firedReminders).toEqual([STRETCH_KEY])
    expect(screen.queryByText('Stretch in 5 min')).not.toBeInTheDocument()
  })

  it('does not repeat a reminder on later checks or after a reload', async () => {
    seed(morning)
    await renderApp('/')
    await advanceTo(at(7, 10))
    await advanceTo(at(7, 12))

    document.body.innerHTML = ''
    await renderApp('/')
    await advanceTo(at(7, 13))

    expect(FakeNotification.shown).toHaveLength(1)
  })

  it('skips a reminder for an activity already ticked off', async () => {
    seed(morning)
    const { user } = await renderApp('/')
    await user.click(await screen.findByRole('checkbox', { name: 'Stretch' }))

    await advanceTo(at(7, 10))

    expect(FakeNotification.shown).toHaveLength(0)
  })

  it('does not show a reminder that was missed while the tab was closed', async () => {
    seed(morning)
    vi.setSystemTime(at(7, 30))
    await renderApp('/')

    expect(FakeNotification.shown).toHaveLength(0)
    expect(await screen.findByText('Overdue')).toBeInTheDocument()
  })

  it('opens Today at the activity when the notification is clicked', async () => {
    seed(morning)
    const { router } = await renderApp('/routines')
    await advanceTo(at(7, 10))
    const focus = vi.spyOn(window, 'focus').mockImplementation(() => {})

    await act(async () => {
      FakeNotification.shown[0].onclick?.()
    })

    expect(focus).toHaveBeenCalled()
    expect(FakeNotification.shown[0].close).toHaveBeenCalled()
    expect(router.state.location.pathname).toBe('/')
    expect(router.state.location.hash).toBe(`today-${morning.id}-${morning.activities[0].id}`)
  })

  it('says reminders are on', async () => {
    seed(morning)
    await renderApp('/')
    expect(
      await screen.findByText('Reminders are on. They work while this tab is open.'),
    ).toBeInTheDocument()
  })
})

describe('reminders without notifications', () => {
  it('shows the reminder on the page and lets the user dismiss it', async () => {
    useNotifications('default')
    seed(morning)
    const { user } = await renderApp('/')

    await advanceTo(at(7, 10))

    expect(FakeNotification.shown).toHaveLength(0)
    expect(screen.getByText('Stretch in 5 min')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View in Today' })).toHaveAttribute(
      'href',
      `/#today-${morning.id}-${morning.activities[0].id}`,
    )

    await user.click(screen.getByRole('button', { name: 'Dismiss reminder: Stretch in 5 min' }))
    expect(screen.queryByText('Stretch in 5 min')).not.toBeInTheDocument()
  })

  it('falls back to the page when the browser refuses to create a notification', async () => {
    useNotifications('granted')
    vi.stubGlobal(
      'Notification',
      Object.assign(
        function Broken() {
          throw new TypeError('Illegal constructor')
        },
        { permission: 'granted', requestPermission: FakeNotification.requestPermission },
      ),
    )
    seed(morning)
    await renderApp('/')

    await advanceTo(at(7, 10))

    expect(screen.getByText('Stretch in 5 min')).toBeInTheDocument()
  })

  it('asks for permission only when the user clicks "Turn on reminders"', async () => {
    useNotifications('default')
    seed(morning)
    const { user } = await renderApp('/')
    expect(FakeNotification.requestPermission).not.toHaveBeenCalled()

    FakeNotification.requestPermission.mockImplementationOnce(async () => {
      FakeNotification.permission = 'granted'
      return 'granted'
    })
    await user.click(await screen.findByRole('button', { name: 'Turn on reminders' }))

    expect(FakeNotification.requestPermission).toHaveBeenCalledTimes(1)
    expect(
      await screen.findByText('Reminders are on. They work while this tab is open.'),
    ).toBeInTheDocument()
  })

  it('explains how to unblock notifications when they are denied', async () => {
    useNotifications('denied')
    seed(morning)
    await renderApp('/')
    expect(await screen.findByText(/Notifications are blocked for this site/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Turn on reminders' })).not.toBeInTheDocument()
  })

  it('works in browsers without the Notification API', async () => {
    vi.stubGlobal('Notification', undefined)
    seed(morning)
    await renderApp('/')

    expect(await screen.findByText(/This browser can’t show notifications/)).toBeInTheDocument()
    await advanceTo(at(7, 10))
    expect(screen.getByText('Stretch in 5 min')).toBeInTheDocument()
  })
})
