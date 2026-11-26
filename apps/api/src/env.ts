// Bindings and variables available to the Worker (see wrangler.jsonc).
export interface Env {
  DB: D1Database
  ASSETS: Fetcher
}

export type AppEnv = { Bindings: Env }
