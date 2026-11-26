// Calls the Worker API on the same origin. Errors come back as ApiError with the
// server's message, ready to show to the user.
export class ApiError extends Error {
  override name = 'ApiError'
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export async function api<T>(
  path: string,
  options: { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown } = {},
): Promise<T> {
  const method = options.method ?? 'GET'
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: method === 'GET' ? {} : { 'content-type': 'application/json' },
      body: method === 'GET' ? undefined : JSON.stringify(options.body ?? {}),
    })
  } catch {
    throw new ApiError(0, 'network', 'Could not reach the server. Check your connection.')
  }

  const data = (await response.json().catch(() => null)) as
    (T & { error?: string; message?: string }) | null
  if (!response.ok) {
    throw new ApiError(
      response.status,
      data?.error ?? 'request_failed',
      data?.message ?? 'Something went wrong. Try again.',
    )
  }
  return data as T
}
