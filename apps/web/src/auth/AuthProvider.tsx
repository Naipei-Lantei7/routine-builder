import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../api/client'
import { AuthContext, type AuthStatus, type AuthValue, type User } from './authContext'

// The last signed-in user, so an offline start still knows who is signed in and
// keeps recording changes to sync later. The session itself stays in the cookie.
const USER_KEY = 'routine-builder:user'

function readCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

function cacheUser(user: User | null) {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
    else localStorage.removeItem(USER_KEY)
  } catch {
    // Storage blocked: the app still works for this visit.
  }
}

// The device's IANA time zone, sent at sign-in so reminders use local time.
function deviceTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return undefined
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<User | null>(readCachedUser)

  const applyUser = useCallback((next: User | null) => {
    cacheUser(next)
    setUser(next)
    setStatus(next ? 'signed-in' : 'signed-out')
  }, [])

  // Asks the server who is signed in on start and when back online. Offline, the
  // cached user is kept.
  useEffect(() => {
    let active = true
    const check = () =>
      api<{ user: User | null }>('/auth/session').then(
        ({ user: current }) => {
          if (active) applyUser(current)
        },
        () => {
          if (active) setStatus('unavailable')
        },
      )
    void check()
    window.addEventListener('online', check)
    return () => {
      active = false
      window.removeEventListener('online', check)
    }
  }, [applyUser])

  const requestCode = useCallback(async (email: string) => {
    await api('/auth/code', { method: 'POST', body: { email } })
  }, [])

  const verifyCode = useCallback(
    async (email: string, code: string) => {
      const result = await api<{ user: User }>('/auth/verify', {
        method: 'POST',
        body: { email, code, timeZone: deviceTimeZone() },
      })
      applyUser(result.user)
      return result.user
    },
    [applyUser],
  )

  const signOut = useCallback(async () => {
    try {
      await api('/auth/sign-out', { method: 'POST' })
    } finally {
      // Even offline, forget the user on this device; the server session expires on its own.
      applyUser(null)
    }
  }, [applyUser])

  // The session ended on the server (for example it expired): sign out locally.
  const sessionEnded = useCallback(() => applyUser(null), [applyUser])

  const value = useMemo<AuthValue>(
    () => ({ status, user, requestCode, verifyCode, signOut, sessionEnded }),
    [status, user, requestCode, verifyCode, signOut, sessionEnded],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
