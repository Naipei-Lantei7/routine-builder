import { describe, expect, it } from 'vitest'
import { MigrationError, migrate, type Migration } from './migrations'

describe('migrate', () => {
  it('returns current-version data unchanged', () => {
    const data = { version: 1, routines: [] }
    expect(migrate(data, {}, 1)).toBe(data)
  })

  it('applies each migration in order up to the target version', () => {
    const migrations: Record<number, Migration> = {
      1: (data) => ({ ...data, version: 2, a: true }),
      2: (data) => ({ ...data, version: 3, b: true }),
    }
    expect(migrate({ version: 1 }, migrations, 3)).toEqual({ version: 3, a: true, b: true })
  })

  it('throws when a migration step is missing', () => {
    expect(() => migrate({ version: 1 }, {}, 2)).toThrow('No migration from version 1')
  })

  it('throws when a migration does not advance the version', () => {
    const migrations: Record<number, Migration> = { 1: (data) => data }
    expect(() => migrate({ version: 1 }, migrations, 2)).toThrow('did not advance')
  })

  it('throws for data from a newer app version', () => {
    expect(() => migrate({ version: 5 }, {}, 1)).toThrow(MigrationError)
  })

  it.each([null, 'text', 42, [], { routines: [] }, { version: '1' }, { version: 0 }])(
    'throws for %j',
    (data) => {
      expect(() => migrate(data, {}, 1)).toThrow(MigrationError)
    },
  )
})
