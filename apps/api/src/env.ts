// Bindings and variables available to the Worker (see wrangler.jsonc).
// Secrets are set with `wrangler secret put NAME`; locally they come from .dev.vars.
export interface Env {
  DB: D1Database
  ASSETS: Fetcher
  // Signs login codes so a database leak does not reveal them. Required.
  AUTH_SECRET: string
  // Resend API key, required to send sign-in emails.
  RESEND_API_KEY?: string
  // "true" only in local development (.dev.vars): log codes instead of emailing them.
  DEV_LOG_CODES?: string
  // Sender address, e.g. "Routine Builder <onboarding@resend.dev>".
  EMAIL_FROM?: string
}

import type { SessionUser } from './auth/session'

export type AppEnv = { Bindings: Env; Variables: { user: SessionUser } }
