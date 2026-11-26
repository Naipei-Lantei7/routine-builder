import { createMiddleware } from 'hono/factory'

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

// Protects cookie-authenticated requests from other sites (CSRF). Changes must be
// sent as JSON, which a cross-site form cannot do without the browser asking
// permission first (a CORS preflight, which we never grant), and when the browser
// says where the request came from, it must be this site.
export const sameOrigin = createMiddleware(async (c, next) => {
  if (!UNSAFE_METHODS.has(c.req.method)) return next()

  const contentType = c.req.header('content-type') ?? ''
  if (!contentType.toLowerCase().startsWith('application/json')) {
    return c.json(
      { error: 'unsupported_media_type', message: 'Send the request body as JSON.' },
      415,
    )
  }

  const origin = c.req.header('origin')
  if (origin && origin !== new URL(c.req.url).origin) {
    return c.json({ error: 'forbidden', message: 'Cross-site requests are not allowed.' }, 403)
  }

  return next()
})
