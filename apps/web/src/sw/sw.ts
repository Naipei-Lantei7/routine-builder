// Service worker: makes the app installable and openable offline, and shows
// notifications (Android only allows notifications from a service worker).
import { notificationTarget, strategyFor } from './strategy'

declare const self: ServiceWorkerGlobalScope

// Filled in at build time by the precache plugin in vite.config.ts: every hashed
// file Vite produced, and an id that changes whenever that list changes.
const PRECACHE = '__PRECACHE_MANIFEST__' as unknown as string[]
const BUILD_ID = '__BUILD_ID__'

// A new build gets a new cache; activate deletes the old ones.
const CACHE = `routine-builder-${BUILD_ID}`
const SHELL = '/'

self.addEventListener('install', (event) => {
  // Cache the whole app up front so every screen opens offline, not only ones visited.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([SHELL, '/manifest.webmanifest', ...PRECACHE]))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const strategy = strategyFor(event.request, self.location.origin)
  if (strategy === 'network-first-shell') event.respondWith(networkFirstShell(event.request))
  else if (strategy === 'cache-first') event.respondWith(cacheFirst(event.request))
})

async function networkFirstShell(request: Request): Promise<Response> {
  try {
    const response = await fetch(request)
    if (response.ok) {
      // Every route serves the same index.html, so keep the latest copy as the shell.
      const cache = await caches.open(CACHE)
      await cache.put(SHELL, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(SHELL)
    return cached ?? Response.error()
  }
}

async function cacheFirst(request: Request): Promise<Response> {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(CACHE)
    await cache.put(request, response.clone())
  }
  return response
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = notificationTarget(event.notification.data, self.location.origin)
  event.waitUntil(openApp(target))
})

// Focuses an open window of the app and asks it to navigate (keeping its state),
// or opens a new one.
async function openApp(target: string): Promise<void> {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  const existing = windows.find((client) => new URL(client.url).origin === self.location.origin)
  if (existing) {
    await existing.focus()
    existing.postMessage({ type: 'open', url: target })
    return
  }
  await self.clients.openWindow(target)
}
