import { act, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderApp, type ApiRoutes } from './test/utils'

const USER = { id: 'u1', email: 'me@example.com', timeZone: 'Africa/Nairobi' }

afterEach(() => {
  vi.unstubAllGlobals()
})

// A fake server that accepts code "123456" and tracks the session.
function authServer(): ApiRoutes {
  let signedIn = false
  return {
    'GET /api/auth/session': () => ({ body: { user: signedIn ? USER : null } }),
    'POST /api/auth/code': () => ({ body: { sent: true } }),
    'POST /api/auth/verify': ({ body }) => {
      if ((body as { code: string }).code !== '123456') {
        return { status: 400, body: { error: 'wrong_code', message: 'That code is not right.' } }
      }
      signedIn = true
      return { body: { user: USER } }
    },
    'POST /api/auth/sign-out': () => {
      signedIn = false
      return { body: { signedOut: true } }
    },
  }
}

describe('header', () => {
  it('offers to sign in when signed out', async () => {
    await renderApp('/')
    expect(await screen.findByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in')
  })

  it('shows the account when already signed in', async () => {
    await renderApp('/', { 'GET /api/auth/session': () => ({ body: { user: USER } }) })
    expect(
      await screen.findByRole('button', { name: 'Account: me@example.com' }),
    ).toBeInTheDocument()
  })

  it('still offers sign-in when the server cannot be reached', async () => {
    const { api } = await renderApp('/', {
      'GET /api/auth/session': () => {
        throw new TypeError('Failed to fetch')
      },
    })

    expect(await screen.findByRole('link', { name: 'Sign in' })).toBeInTheDocument()
    expect(api.calls.map((call) => call.path)).toContain('/api/auth/session')
  })
})

describe('signing in', () => {
  it('emails a code, accepts it, and returns to Today signed in', async () => {
    const { user, router, api } = await renderApp('/sign-in', authServer())

    await user.type(await screen.findByLabelText('Email'), 'me@example.com')
    await user.click(screen.getByRole('button', { name: 'Send code' }))

    expect(await screen.findByText(/We sent a code to me@example.com/)).toBeInTheDocument()
    expect(api.calls).toContainEqual({
      method: 'POST',
      path: '/api/auth/code',
      body: { email: 'me@example.com' },
    })

    // Typing the sixth digit submits on its own.
    await user.type(screen.getByLabelText('Code'), '123456')

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(
      await screen.findByRole('button', { name: 'Account: me@example.com' }),
    ).toBeInTheDocument()
    const verify = api.calls.find((call) => call.path === '/api/auth/verify')
    expect(verify?.body).toEqual({
      email: 'me@example.com',
      code: '123456',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })
  })

  it('shows the server’s message for a wrong code and lets the user retry', async () => {
    const { user } = await renderApp('/sign-in', authServer())
    await user.type(await screen.findByLabelText('Email'), 'me@example.com')
    await user.click(screen.getByRole('button', { name: 'Send code' }))

    await user.type(await screen.findByLabelText('Code'), '999999')

    expect(await screen.findByText('That code is not right.')).toBeInTheDocument()
    expect(screen.getByLabelText('Code')).toHaveValue('')
  })

  it('shows why a code could not be sent', async () => {
    const { user } = await renderApp('/sign-in', {
      'POST /api/auth/code': () => ({
        status: 429,
        body: {
          error: 'too_many_codes',
          message: 'Too many codes requested. Try again in an hour.',
        },
      }),
    })

    await user.type(await screen.findByLabelText('Email'), 'me@example.com')
    await user.click(screen.getByRole('button', { name: 'Send code' }))

    expect(
      await screen.findByText('Too many codes requested. Try again in an hour.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(
      'Too many codes requested. Try again in an hour.',
    )
  })

  it('waits before allowing another code, and can go back to change the email', async () => {
    const { user } = await renderApp('/sign-in', authServer())
    await user.type(await screen.findByLabelText('Email'), 'me@example.com')
    await user.click(screen.getByRole('button', { name: 'Send code' }))

    expect(await screen.findByRole('button', { name: /Send a new code \(\d+s\)/ })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Use a different email' }))
    expect(screen.getByLabelText('Email')).toHaveValue('me@example.com')
  })
})

describe('signing out', () => {
  it('signs out from the account menu', async () => {
    const routes = authServer()
    const { user, api } = await renderApp('/sign-in', routes)
    await user.type(await screen.findByLabelText('Email'), 'me@example.com')
    await user.click(screen.getByRole('button', { name: 'Send code' }))
    await user.type(await screen.findByLabelText('Code'), '123456')

    await user.click(await screen.findByRole('button', { name: 'Account: me@example.com' }))
    expect(screen.getByText('Signed in as')).toBeInTheDocument()
    await act(async () => {
      await user.click(screen.getByRole('menuitem', { name: 'Sign out' }))
    })

    expect(await screen.findByRole('link', { name: 'Sign in' })).toBeInTheDocument()
    expect(api.calls.some((call) => call.path === '/api/auth/sign-out')).toBe(true)
  })
})
