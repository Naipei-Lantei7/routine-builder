import { useEffect, useState } from 'react'

// The current time, refreshed every `intervalMs` and whenever the tab becomes
// visible again (timers are throttled in background tabs and stop during sleep).
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const tick = () => setNow(new Date())
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') tick()
    }
    const timer = setInterval(tick, intervalMs)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', tick)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', tick)
    }
  }, [intervalMs])

  return now
}
