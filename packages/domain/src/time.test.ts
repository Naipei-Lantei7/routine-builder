import { describe, expect, it } from 'vitest'
import { addDays, atLocalTime, fromDateKey, isoWeekday, toDateKey, toMinutes } from './time'

describe('toMinutes', () => {
  it.each([
    ['00:00', 0],
    ['07:30', 450],
    ['23:59', 1439],
  ] as const)('converts %s to %i', (time, minutes) => {
    expect(toMinutes(time)).toBe(minutes)
  })
})

describe('isoWeekday', () => {
  it('returns 1 for Monday and 7 for Sunday', () => {
    expect(isoWeekday(new Date(2026, 10, 23))).toBe(1) // Mon 23 Nov 2026
    expect(isoWeekday(new Date(2026, 10, 26))).toBe(4) // Thu 26 Nov 2026
    expect(isoWeekday(new Date(2026, 10, 29))).toBe(7) // Sun 29 Nov 2026
  })
})

describe('toDateKey', () => {
  it('uses the local date and pads month and day', () => {
    expect(toDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })

  it('round-trips with fromDateKey', () => {
    expect(toDateKey(fromDateKey('2026-11-26'))).toBe('2026-11-26')
  })
})

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29')
  })
})

describe('atLocalTime', () => {
  it('builds the instant from local date and time', () => {
    const date = atLocalTime('2026-11-26', '07:30')
    expect(toDateKey(date)).toBe('2026-11-26')
    expect(date.getHours()).toBe(7)
    expect(date.getMinutes()).toBe(30)
  })

  it('handles midnight', () => {
    expect(atLocalTime('2026-11-26', '00:00').getTime()).toBe(fromDateKey('2026-11-26').getTime())
  })
})
