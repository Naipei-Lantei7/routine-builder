import { drizzle } from 'drizzle-orm/d1'
import * as schema from './schema'

export * from './schema'
export { schema }

// A typed Drizzle client over a D1 binding.
export function createDb(d1: D1Database) {
  return drizzle(d1, { schema })
}

export type Db = ReturnType<typeof createDb>
