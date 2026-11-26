import { describe, expect, it } from 'vitest'
import { formatDays } from './days'

describe('formatDays', () => {
  it.each([
    [[1, 2, 3, 4, 5, 6, 7], 'Every day'],
    [[1, 2, 3, 4, 5], 'Weekdays'],
    [[7, 6], 'Weekends'],
    [[5, 1, 3], 'Mon, Wed, Fri'],
    [[7], 'Sun'],
  ] as const)('formats %j as %s', (days, expected) => {
    expect(formatDays(days)).toBe(expected)
  })
})
