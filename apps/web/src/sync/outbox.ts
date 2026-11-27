import { SyncOpSchema, type SyncOp } from '@routine-builder/domain'
import { z } from 'zod'

// Changes not yet confirmed by the server, kept per user in localStorage so they
// survive reloads, going offline and signing out before they were sent.
const outboxKey = (userId: string) => `routine-builder:outbox:${userId}`

// The account this device last synced with. Data created before the first
// sign-in on a device is uploaded to that first account only.
export const LAST_USER_KEY = 'routine-builder:last-user'

const OpsSchema = z.array(SyncOpSchema)

export function readOutbox(userId: string): SyncOp[] {
  try {
    const raw = localStorage.getItem(outboxKey(userId))
    if (!raw) return []
    const parsed = OpsSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : []
  } catch {
    return []
  }
}

function writeOutbox(userId: string, ops: SyncOp[]) {
  try {
    if (ops.length === 0) localStorage.removeItem(outboxKey(userId))
    else localStorage.setItem(outboxKey(userId), JSON.stringify(ops))
  } catch {
    // Storage full or blocked: changes stay local until the next successful sync.
  }
}

export function appendToOutbox(userId: string, ops: SyncOp[]) {
  if (ops.length > 0) writeOutbox(userId, [...readOutbox(userId), ...ops])
}

// Removes the first `count` operations, once the server has applied them.
// Operations added while the request was in flight stay queued.
export function dropFromOutbox(userId: string, count: number) {
  writeOutbox(userId, readOutbox(userId).slice(count))
}

export function readLastUser(): string | null {
  try {
    return localStorage.getItem(LAST_USER_KEY)
  } catch {
    return null
  }
}

export function writeLastUser(userId: string) {
  try {
    localStorage.setItem(LAST_USER_KEY, userId)
  } catch {
    // Ignore: worst case, local data is offered for upload again.
  }
}
