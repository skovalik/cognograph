import { describe, it, expect } from 'vitest'
import { parseCronToMs } from '../../hooks/useScheduleService'

describe('parseCronToMs', () => {
  describe('5-field cron: every N minutes', () => {
    it('parses */5 * * * * as 5 minutes', () => {
      expect(parseCronToMs('*/5 * * * *')).toBe(5 * 60 * 1000)
    })

    it('parses */1 * * * * as 1 minute', () => {
      expect(parseCronToMs('*/1 * * * *')).toBe(60 * 1000)
    })

    it('parses */30 * * * * as 30 minutes', () => {
      expect(parseCronToMs('*/30 * * * *')).toBe(30 * 60 * 1000)
    })
  })

  describe('5-field cron: every N hours', () => {
    it('parses 0 */2 * * * as 2 hours', () => {
      expect(parseCronToMs('0 */2 * * *')).toBe(2 * 60 * 60 * 1000)
    })

    it('parses 0 */1 * * * as 1 hour', () => {
      expect(parseCronToMs('0 */1 * * *')).toBe(60 * 60 * 1000)
    })

    it('parses 0 */12 * * * as 12 hours', () => {
      expect(parseCronToMs('0 */12 * * *')).toBe(12 * 60 * 60 * 1000)
    })
  })

  describe('5-field cron: daily at specific time', () => {
    it('parses 30 9 * * * as 24 hours', () => {
      expect(parseCronToMs('30 9 * * *')).toBe(24 * 60 * 60 * 1000)
    })

    it('parses 0 0 * * * as 24 hours (midnight)', () => {
      expect(parseCronToMs('0 0 * * *')).toBe(24 * 60 * 60 * 1000)
    })

    it('parses 59 23 * * * as 24 hours', () => {
      expect(parseCronToMs('59 23 * * *')).toBe(24 * 60 * 60 * 1000)
    })
  })

  describe('6-field cron: every N seconds', () => {
    it('parses */10 * * * * * as 10 seconds', () => {
      expect(parseCronToMs('*/10 * * * * *')).toBe(10 * 1000)
    })

    it('parses */30 * * * * * as 30 seconds', () => {
      expect(parseCronToMs('*/30 * * * * *')).toBe(30 * 1000)
    })
  })

  describe('6-field cron: every N minutes (with seconds)', () => {
    it('parses 0 */5 * * * * as 5 minutes', () => {
      expect(parseCronToMs('0 */5 * * * *')).toBe(5 * 60 * 1000)
    })
  })

  describe('unsupported patterns', () => {
    it('returns null for complex day-of-week patterns', () => {
      expect(parseCronToMs('0 9 * * 1-5')).toBeNull()
    })

    it('returns null for day-of-month patterns', () => {
      expect(parseCronToMs('0 0 1 * *')).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(parseCronToMs('')).toBeNull()
    })

    it('returns null for garbage input', () => {
      expect(parseCronToMs('not a cron')).toBeNull()
    })

    it('returns null for too few fields', () => {
      expect(parseCronToMs('* *')).toBeNull()
    })

    it('returns null for */0 (zero interval)', () => {
      expect(parseCronToMs('*/0 * * * *')).toBeNull()
    })
  })
})
