// Registers /sw.js in production builds. In development Vite serves modules
// directly and there is no built service worker, so it is skipped.
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      console.error('Service worker registration failed', error)
    })
  })
}
