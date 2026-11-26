import { CURRENT_VERSION } from '@routine-builder/domain'

type StoredData = Record<string, unknown> & { version: number }

// Upgrades stored data from version N (the key) to N + 1.
export type Migration = (data: StoredData) => StoredData

// Add an entry here whenever the stored shape changes, and bump
// CURRENT_VERSION. Example: `1: (data) => ({ ...data, version: 2, tags: [] })`.
export const MIGRATIONS: Record<number, Migration> = {}

export class MigrationError extends Error {
  override name = 'MigrationError'
}

// Brings parsed stored data up to `targetVersion`. Does not validate the
// result; callers run the schema afterwards.
export function migrate(
  data: unknown,
  migrations: Record<number, Migration> = MIGRATIONS,
  targetVersion: number = CURRENT_VERSION,
): unknown {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new MigrationError('Stored data is not an object')
  }
  const version = (data as { version?: unknown }).version
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new MigrationError('Stored data has no valid version')
  }
  if (version > targetVersion) {
    throw new MigrationError(
      `Stored data is version ${version}, newer than this app (${targetVersion})`,
    )
  }

  let current = data as StoredData
  while (current.version < targetVersion) {
    const step = migrations[current.version]
    if (!step) {
      throw new MigrationError(`No migration from version ${current.version}`)
    }
    const next = step(current)
    if (next.version !== current.version + 1) {
      throw new MigrationError(`Migration from version ${current.version} did not advance`)
    }
    current = next
  }
  return current
}
