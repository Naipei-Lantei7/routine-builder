import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { showSystemNotification, type SystemNotification } from './notifier'

const notification: SystemNotification = {
  title: 'Stretch in 5 min',
  body: 'Morning · 07:15',
  tag: 'r:a:2026-11-26',
  url: '/#today-r-a',
  onClick: vi.fn(),
}

const PageNotification = vi.fn()

function stubPermission(permission: NotificationPermission) {
  vi.stubGlobal('Notification', Object.assign(PageNotification, { permission }))
}

function stubServiceWorker(registration: unknown) {
  vi.stubGlobal('navigator', {
    ...navigator,
    serviceWorker: { getRegistration: vi.fn(async () => registration) },
  })
}

beforeEach(() => {
  PageNotification.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('showSystemNotification', () => {
  it('shows the notification through the service worker, with the link in its data', async () => {
    stubPermission('granted')
    const showNotification = vi.fn(async () => {})
    stubServiceWorker({ active: {}, showNotification })

    await expect(showSystemNotification(notification)).resolves.toBe(true)

    expect(showNotification).toHaveBeenCalledWith('Stretch in 5 min', {
      body: 'Morning · 07:15',
      tag: 'r:a:2026-11-26',
      icon: '/icons/icon-192.png',
      data: { url: '/#today-r-a' },
    })
    expect(PageNotification).not.toHaveBeenCalled()
  })

  it('falls back to a page notification when no service worker is active', async () => {
    stubPermission('granted')
    stubServiceWorker(undefined)

    await expect(showSystemNotification(notification)).resolves.toBe(true)

    expect(PageNotification).toHaveBeenCalledWith('Stretch in 5 min', {
      body: 'Morning · 07:15',
      tag: 'r:a:2026-11-26',
      icon: '/icons/icon-192.png',
    })
  })

  it('falls back when the service worker refuses', async () => {
    stubPermission('granted')
    stubServiceWorker({
      active: {},
      showNotification: vi.fn(async () => {
        throw new TypeError('No notification permission')
      }),
    })

    await expect(showSystemNotification(notification)).resolves.toBe(true)
    expect(PageNotification).toHaveBeenCalled()
  })

  it('returns false when neither way works, so the app shows it on the page', async () => {
    stubPermission('granted')
    stubServiceWorker(undefined)
    PageNotification.mockImplementation(() => {
      throw new TypeError('Illegal constructor')
    })

    await expect(showSystemNotification(notification)).resolves.toBe(false)
  })

  it('shows nothing without permission', async () => {
    stubPermission('default')
    const showNotification = vi.fn()
    stubServiceWorker({ active: {}, showNotification })

    await expect(showSystemNotification(notification)).resolves.toBe(false)
    expect(showNotification).not.toHaveBeenCalled()
  })
})
