import {
  applySyncOps,
  diffForSync,
  MAX_OPS_PER_PUSH,
  type SyncState,
} from '@routine-builder/domain'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api, ApiError } from '../api/client'
import { useAuth } from '../auth/authContext'
import { withLock } from '../notifications/withLock'
import { useAppState } from '../state/appStateContext'
import { appendToOutbox, dropFromOutbox, readLastUser, readOutbox, writeLastUser } from './outbox'
import { SyncContext, type SyncStatus, type SyncValue } from './syncContext'

const LOCK_NAME = 'routine-builder:sync'
// Pull changes made on other devices this often while the app is open.
export const PULL_INTERVAL_MS = 60_000
// Wait for a burst of edits (typing, ticking several boxes) before sending.
const PUSH_DELAY_MS = 400

// Local-first sync for signed-in users (Plan 003, section 9):
// 1. Every local change is applied immediately, and also recorded as operations
//    in an outbox kept in localStorage.
// 2. The outbox is sent to the server when online. The server answers with the
//    user's full state, which replaces the local copy, with any operations still
//    queued replayed on top.
// 3. The first time a device signs in, routines already on it are uploaded.
// Stops a sync from looping forever if the outbox cannot be emptied.
const MAX_ROUNDS = 20

async function sendChunk(userId: string): Promise<SyncState> {
  const chunk = readOutbox(userId).slice(0, MAX_OPS_PER_PUSH)
  const result =
    chunk.length > 0
      ? await api<SyncState>('/sync', { method: 'POST', body: { ops: chunk } })
      : await api<SyncState>('/sync')
  dropFromOutbox(userId, chunk.length)
  return result
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const { state, subscribe, replace } = useAppState()
  const userId = auth.user?.id ?? null

  const [status, setStatus] = useState<SyncStatus>(userId ? 'syncing' : 'local')
  const [pending, setPending] = useState(() => (userId ? readOutbox(userId).length : 0))
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)

  const userRef = useRef(userId)
  const stateRef = useRef(state)
  useEffect(() => {
    userRef.current = userId
    stateRef.current = state
  }, [userId, state])

  const sync = useCallback(async () => {
    const id = userRef.current
    if (!id) return
    setStatus('syncing')
    try {
      await withLock(LOCK_NAME, async () => {
        // Send everything queued, in chunks the server accepts; each reply is the
        // full state. With nothing queued, just pull.
        let result = await sendChunk(id)
        for (let round = 1; readOutbox(id).length > 0 && round < MAX_ROUNDS; round++) {
          result = await sendChunk(id)
        }

        if (userRef.current !== id) return
        // Anything queued meanwhile is replayed on top of the server's state.
        const remaining = readOutbox(id)
        replace((s) =>
          applySyncOps(
            { ...s, routines: result.routines, completions: result.completions },
            remaining,
          ),
        )
        writeLastUser(id)
        setPending(remaining.length)
      })
      setStatus('synced')
      setLastSyncedAt(new Date())
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        auth.sessionEnded()
        return
      }
      setStatus(error instanceof ApiError && error.status === 0 ? 'offline' : 'error')
    }
  }, [auth, replace])

  // Debounced push after local edits.
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const schedulePush = useCallback(() => {
    if (pushTimer.current) clearTimeout(pushTimer.current)
    pushTimer.current = setTimeout(() => void sync(), PUSH_DELAY_MS)
  }, [sync])

  // Record every local change in the outbox while signed in.
  useEffect(() => {
    if (!userId) return
    return subscribe((prev, next) => {
      const ops = diffForSync(prev, next)
      if (ops.length === 0) return
      appendToOutbox(userId, ops)
      setPending(readOutbox(userId).length)
      schedulePush()
    })
  }, [userId, subscribe, schedulePush])

  // On sign-in (or app start while signed in): upload this device's routines the
  // first time, then sync. Afterwards, sync when the app regains focus, comes back
  // online, and every minute.
  useEffect(() => {
    if (!userId) return
    if (readLastUser() === null) {
      const local = stateRef.current
      appendToOutbox(userId, diffForSync({ routines: [], completions: [] }, local))
    }
    // Start on the next tick, after this render has settled.
    const kickoff = setTimeout(() => void sync(), 0)

    const onVisible = () => {
      if (document.visibilityState === 'visible') void sync()
    }
    const onOnline = () => void sync()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    const timer = setInterval(() => void sync(), PULL_INTERVAL_MS)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
      clearTimeout(kickoff)
      clearInterval(timer)
      if (pushTimer.current) clearTimeout(pushTimer.current)
    }
  }, [userId, sync])

  const signOut = useCallback(async () => {
    if (pushTimer.current) clearTimeout(pushTimer.current)
    // Best effort: anything not sent stays in this user's outbox for next time.
    await sync().catch(() => {})
    await auth.signOut()
    // This device's copy belonged to the account; the next person starts empty.
    replace((s) => ({ ...s, routines: [], completions: [], firedReminders: [] }))
    setPending(0)
  }, [auth, replace, sync])

  const value = useMemo<SyncValue>(
    () => ({
      // Signed out means local-only, whatever the last sync did.
      status: userId ? status : 'local',
      pending: userId ? pending : 0,
      lastSyncedAt,
      syncNow: sync,
      signOut,
    }),
    [userId, status, pending, lastSyncedAt, sync, signOut],
  )

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}
