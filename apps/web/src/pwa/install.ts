import { useSyncExternalStore } from 'react'

// True when the app runs from the home screen / as an installed app.
export function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches
}

// iPhone and iPad, including iPads that report themselves as a Mac.
export function isIos(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

// Chrome, Edge and Samsung Internet fire `beforeinstallprompt` when the app can be
// installed. It fires once, early, so it is captured at startup and kept here.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

export function captureInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Stop the browser's mini-infobar; the app shows its own install button.
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    notify()
  })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// Whether the browser offered an install prompt, and a function to show it.
export function useInstallPrompt(): { canInstall: boolean; install: () => Promise<void> } {
  const prompt = useSyncExternalStore(subscribe, () => deferredPrompt)
  return {
    canInstall: prompt !== null,
    install: async () => {
      if (!prompt) return
      await prompt.prompt()
      await prompt.userChoice
      // A prompt can only be used once.
      deferredPrompt = null
      notify()
    },
  }
}
