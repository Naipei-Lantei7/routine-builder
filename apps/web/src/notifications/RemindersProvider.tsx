import { getDueReminders, markRemindersFired, reminderMessage } from '@routine-builder/domain'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAppState } from '../state/appStateContext'
import { getPermission, requestPermission, showSystemNotification } from './notifier'
import { RemindersContext, type InAppReminder, type RemindersValue } from './remindersContext'
import { withLock } from './withLock'

export const CHECK_INTERVAL_MS = 30_000
const LOCK_NAME = 'routine-builder:reminders'

// Checks for due reminders every 30 seconds and whenever the tab regains focus
// or becomes visible (Plan 001, section 5.6), then shows each one as a system
// notification, or on the page if notifications are unavailable.
export function RemindersProvider({ children }: { children: ReactNode }) {
  const { refresh, update } = useAppState()
  const navigate = useNavigate()
  const router = useRouter()
  const [permission, setPermission] = useState(getPermission)
  const [inApp, setInApp] = useState<InAppReminder[]>([])

  const check = useCallback(() => {
    return withLock(LOCK_NAME, async () => {
      // Read the latest stored state inside the lock: another tab may have just
      // shown (and recorded) the same reminder.
      const state = refresh()
      const now = new Date()
      const due = getDueReminders(state, now)
      if (due.length === 0) return

      update((s) =>
        markRemindersFired(
          s,
          due.map((d) => d.key),
        ),
      )

      const onPage: InAppReminder[] = []
      for (const reminder of due) {
        const { title, body } = reminderMessage(reminder, now)
        const targetId = `today-${reminder.routineId}-${reminder.activity.id}`
        const shown = await showSystemNotification({
          title,
          body,
          tag: reminder.key,
          url: `/#${targetId}`,
          onClick: () => navigate({ to: '/', hash: targetId }),
        })
        if (!shown) onPage.push({ key: reminder.key, title, body, targetId })
      }
      if (onPage.length > 0) setInApp((current) => [...current, ...onPage])
    })
  }, [refresh, update, navigate])

  useEffect(() => {
    // Permission can change in browser settings at any time, so re-read it on every tick.
    const tick = () => {
      setPermission(getPermission())
      void check()
    }
    void check()
    const timer = setInterval(tick, CHECK_INTERVAL_MS)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') tick()
    }
    const onFocus = tick
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', onFocus)
    }
  }, [check])

  // A notification clicked while the app is open: the service worker focuses this
  // window and asks it to navigate, which keeps the app's state.
  useEffect(() => {
    const container = navigator.serviceWorker
    if (!container) return
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: unknown; url?: unknown } | null
      if (data?.type === 'open' && typeof data.url === 'string') router.history.push(data.url)
    }
    container.addEventListener('message', onMessage)
    return () => container.removeEventListener('message', onMessage)
  }, [router])

  const enable = useCallback(async () => {
    setPermission(await requestPermission())
  }, [])

  const dismiss = useCallback((key: string) => {
    setInApp((current) => current.filter((r) => r.key !== key))
  }, [])

  const value = useMemo<RemindersValue>(
    () => ({ permission, inApp, enable, dismiss }),
    [permission, inApp, enable, dismiss],
  )

  return <RemindersContext.Provider value={value}>{children}</RemindersContext.Provider>
}
