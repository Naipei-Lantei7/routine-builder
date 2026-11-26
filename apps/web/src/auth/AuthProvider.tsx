import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../api/client'
import { AuthContext, type AuthStatus, type AuthValue, type User } from './authContext'

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
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    let active = true
    api<{ user: User | null }>('/auth/session')
      .then(({ user }) => {
        if (!active) return
        setUser(user)
        setStatus(user ? 'signed-in' : 'signed-out')
      })
      .catch(() => {
        if (active) setStatus('unavailable')
      })
    return () => {
      active = false
    }
  }, [])

  const requestCode = useCallback(async (email: string) => {
    await api('/auth/code', { method: 'POST', body: { email } })
  }, [])

  const verifyCode = useCallback(async (email: string, code: string) => {
    const result = await api<{ user: User }>('/auth/verify', {
      method: 'POST',
      body: { email, code, timeZone: deviceTimeZone() },
    })
    setUser(result.user)
    setStatus('signed-in')
    return result.user
  }, [])

  const signOut = useCallback(async () => {
    await api('/auth/sign-out', { method: 'POST' })
    setUser(null)
    setStatus('signed-out')
  }, [])

  const value = useMemo<AuthValue>(
    () => ({ status, user, requestCode, verifyCode, signOut }),
    [status, user, requestCode, verifyCode, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
