// Small Web Crypto helpers. Web Crypto is available in Workers and in Node.

const encoder = new TextEncoder()

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

// A uniformly random 6-digit code. Rejection sampling avoids the slight bias
// that `random % 1_000_000` would have.
export function randomCode(): string {
  const limit = Math.floor(0x1_0000_0000 / 1_000_000) * 1_000_000
  const buffer = new Uint32Array(1)
  let value: number
  do {
    crypto.getRandomValues(buffer)
    value = buffer[0]
  } while (value >= limit)
  return String(value % 1_000_000).padStart(6, '0')
}

// 256 bits of randomness, URL-safe: the session cookie value.
export function randomToken(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)))
}

export async function sha256Hex(data: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', encoder.encode(data)))
}

// Keyed hash, so a 6-digit code cannot be brute-forced from a leaked hash
// without also having the secret.
export async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(data)))
}

// Compares two strings without returning early on the first difference.
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let difference = 0
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return difference === 0
}
