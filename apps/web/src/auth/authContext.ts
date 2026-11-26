import { createContext, useContext } from 'react'

export interface User {
  id: string
  email: string
  timeZone: string
}

export type AuthStatus =
  // Checking the session on startup.
  | 'loading'
  | 'signed-in'
  | 'signed-out'
  // The server could not be reached (offline): the app keeps working locally.
  | 'unavailable'

export interface AuthValue {
  status: AuthStatus
  user: User | null
  requestCode: (email: string) => Promise<void>
  verifyCode: (email: string, code: string) => Promise<User>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthValue | null>(null)

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}
