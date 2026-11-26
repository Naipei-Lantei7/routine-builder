// How the service worker handles a request. Kept free of service worker APIs
// so it can be unit tested.
export type Strategy =
  // Page loads: try the network, fall back to the cached app shell when offline.
  | 'network-first-shell'
  // Hashed build files: they never change, so serve from cache when present.
  | 'cache-first'
  // Everything else (API calls later, cross-origin requests): leave to the browser.
  | 'passthrough'

export function strategyFor(
  request: { method: string; mode: string; url: string },
  origin: string,
): Strategy {
  if (request.method !== 'GET') return 'passthrough'
  const url = new URL(request.url)
  if (url.origin !== origin) return 'passthrough'
  if (url.pathname.startsWith('/api/')) return 'passthrough'
  if (request.mode === 'navigate') return 'network-first-shell'
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    return 'cache-first'
  }
  return 'passthrough'
}

// Where a notification click should take the user. Only same-origin paths are
// allowed, so a notification can never open another site.
export function notificationTarget(data: unknown, origin: string): string {
  const url = (data as { url?: unknown } | null)?.url
  if (typeof url !== 'string') return '/'
  try {
    const target = new URL(url, origin)
    return target.origin === origin ? target.pathname + target.search + target.hash : '/'
  } catch {
    return '/'
  }
}
