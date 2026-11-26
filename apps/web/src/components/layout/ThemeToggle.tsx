import { Button } from '@routine-builder/ui/components/button'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'routine-builder:theme'
const NEXT: Record<Theme, Theme> = { light: 'dark', dark: 'system', system: 'light' }
const LABEL: Record<Theme, string> = { light: 'Light', dark: 'Dark', system: 'System' }

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    return 'system'
  }
}

// Cycles light → dark → system. index.html applies the stored theme before
// React loads, so there is no flash of the wrong theme.
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches)
      document.documentElement.classList.toggle('dark', dark)
    }
    apply()
    try {
      if (theme === 'system') localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // Storage blocked: the theme still applies for this visit.
    }
    if (theme !== 'system') return
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])

  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Theme: ${LABEL[theme]}. Switch to ${LABEL[NEXT[theme]]}`}
      title={`Theme: ${LABEL[theme]}`}
      onClick={() => setTheme(NEXT[theme])}
    >
      <Icon aria-hidden="true" />
    </Button>
  )
}
