import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getPlatformProxy } from 'wrangler'
import type { Env } from '../src/env'

const MIGRATIONS_DIR = join(import.meta.dirname, '../../../packages/db/migrations')
const CONFIG = join(import.meta.dirname, 'wrangler.test.jsonc')

// A real local D1 database (SQLite via Miniflare), in memory, with every migration
// applied in order, the same files `wrangler d1 migrations apply` uses.
export async function createTestEnv() {
  const proxy = await getPlatformProxy<Pick<Env, 'DB'>>({ configPath: CONFIG, persist: false })
  const db = proxy.env.DB

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort()
  for (const file of files) {
    const statements = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
      .split('--> statement-breakpoint')
      .map((statement) => statement.trim())
      .filter(Boolean)
    await db.batch(statements.map((statement) => db.prepare(statement)))
  }

  return { env: proxy.env, dispose: () => proxy.dispose() }
}
