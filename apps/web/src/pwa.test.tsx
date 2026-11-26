import type { Routine } from '@routine-builder/domain'
import { act, screen } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { captureInstallPrompt, isIos, isStandalone } from './pwa/install'
import { renderApp, seed } from './test/utils'

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36'

const morning: Routine = {
  id: '0b6e3c8d-2f4a-4c1b-8e9d-7a5f3b2c1d00',
  name: 'Morning',
  days: [1, 2, 3, 4, 5, 6, 7],
  enabled: true,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  activities: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      title: 'Stretch',
      time: '23:59',
      reminderMinutesBefore: 5,
    },
  ],
}

function stubDevice(userAgent: string, { standalone = false } = {}) {
  vi.stubGlobal('navigator', { ...navigator, userAgent, platform: 'test', maxTouchPoints: 5 })
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: standalone && query === '(display-mode: standalone)',
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  )
}

// What Chrome fires when the app can be installed.
function fireInstallPrompt(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt: vi.fn(async () => {}),
    userChoice: Promise.resolve({ outcome }),
  })
  act(() => {
    window.dispatchEvent(event)
  })
  return event
}

beforeAll(() => {
  captureInstallPrompt()
})

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  // Reset any captured prompt between tests.
  act(() => {
    window.dispatchEvent(new Event('appinstalled'))
  })
  vi.unstubAllGlobals()
})

describe('platform detection', () => {
  it('recognises iPhone and Android', () => {
    stubDevice(IPHONE_UA)
    expect(isIos()).toBe(true)
    stubDevice(ANDROID_UA)
    expect(isIos()).toBe(false)
  })

  it('recognises the installed app', () => {
    stubDevice(ANDROID_UA, { standalone: true })
    expect(isStandalone()).toBe(true)
    stubDevice(ANDROID_UA)
    expect(isStandalone()).toBe(false)
  })
})

describe('install suggestion', () => {
  it('offers a one-tap install when the browser allows it', async () => {
    stubDevice(ANDROID_UA)
    seed(morning)
    const { user } = await renderApp('/')
    expect(screen.queryByText('Install Routine Builder')).not.toBeInTheDocument()

    const prompt = fireInstallPrompt()
    await user.click(await screen.findByRole('button', { name: 'Install' }))

    expect(prompt.defaultPrevented).toBe(true)
    expect(prompt.prompt).toHaveBeenCalledTimes(1)
    // A prompt can only be used once, so the card goes away.
    expect(screen.queryByText('Install Routine Builder')).not.toBeInTheDocument()
  })

  it('explains Add to Home Screen on iPhone, including for reminders', async () => {
    stubDevice(IPHONE_UA)
    seed(morning)
    await renderApp('/')

    expect(await screen.findByText('Add Routine Builder to your Home Screen')).toBeInTheDocument()
    expect(
      screen.getByText(/reminders work once Routine Builder is on your Home Screen/),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Turn on reminders' })).not.toBeInTheDocument()
  })

  it('is hidden once the app is installed', async () => {
    stubDevice(IPHONE_UA, { standalone: true })
    seed(morning)
    await renderApp('/')

    await screen.findByRole('heading', { name: 'Today' })
    expect(screen.queryByText('Add Routine Builder to your Home Screen')).not.toBeInTheDocument()
  })

  it('stays dismissed', async () => {
    stubDevice(IPHONE_UA)
    seed(morning)
    const { user } = await renderApp('/')

    await user.click(await screen.findByRole('button', { name: 'Dismiss install suggestion' }))
    expect(screen.queryByText('Add Routine Builder to your Home Screen')).not.toBeInTheDocument()

    document.body.innerHTML = ''
    await renderApp('/')
    await screen.findByRole('heading', { name: 'Today' })
    expect(screen.queryByText('Add Routine Builder to your Home Screen')).not.toBeInTheDocument()
  })
})

describe('notification clicks from the service worker', () => {
  it('opens the activity in Today without reloading the app', async () => {
    const serviceWorker = Object.assign(new EventTarget(), {
      getRegistration: async () => undefined,
    })
    vi.stubGlobal('navigator', { ...navigator, serviceWorker })
    seed(morning)
    const { router } = await renderApp('/routines')

    await act(async () => {
      serviceWorker.dispatchEvent(
        new MessageEvent('message', { data: { type: 'open', url: '/#today-r-a' } }),
      )
    })

    expect(router.state.location.pathname).toBe('/')
    expect(router.state.location.hash).toBe('today-r-a')
  })
})
