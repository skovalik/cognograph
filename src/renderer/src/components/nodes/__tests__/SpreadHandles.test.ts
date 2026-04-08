import { describe, expect, it } from 'vitest'
import { getVisibleSpreadCount } from '../SpreadHandles'

describe('SpreadHandles visibility', () => {
  it('returns 0 for small nodes (<200px)', () => {
    expect(getVisibleSpreadCount(100)).toBe(0)
    expect(getVisibleSpreadCount(199)).toBe(0)
  })

  it('returns 2 for medium nodes (200-399px)', () => {
    expect(getVisibleSpreadCount(200)).toBe(2)
    expect(getVisibleSpreadCount(399)).toBe(2)
  })

  it('returns 3 for large nodes (400-599px)', () => {
    expect(getVisibleSpreadCount(400)).toBe(3)
    expect(getVisibleSpreadCount(599)).toBe(3)
  })

  it('returns 4 for extra-large nodes (600px+)', () => {
    expect(getVisibleSpreadCount(600)).toBe(4)
    expect(getVisibleSpreadCount(1000)).toBe(4)
  })
})
