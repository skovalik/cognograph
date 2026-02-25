import { describe, it, expect } from 'vitest'
import { SESSION_ACCENT_COLORS, getNextSessionColor } from '../sessionColors'

describe('SESSION_ACCENT_COLORS', () => {
  it('should have exactly 8 entries', () => {
    expect(SESSION_ACCENT_COLORS).toHaveLength(8)
  })

  it('all colors should be valid hex strings', () => {
    const hexPattern = /^#[0-9a-fA-F]{6}$/
    for (const color of SESSION_ACCENT_COLORS) {
      expect(color).toMatch(hexPattern)
    }
  })
})

describe('getNextSessionColor', () => {
  it('should return the first color when no colors are used', () => {
    const result = getNextSessionColor([])
    expect(result).toBe(SESSION_ACCENT_COLORS[0])
  })

  it('should return the first unused color', () => {
    const used = [SESSION_ACCENT_COLORS[0], SESSION_ACCENT_COLORS[1]]
    const result = getNextSessionColor(used)
    expect(result).toBe(SESSION_ACCENT_COLORS[2])
  })

  it('should skip used colors and return the next available', () => {
    // Use colors 0, 1, 2, 4 (skip 3)
    const used = [
      SESSION_ACCENT_COLORS[0],
      SESSION_ACCENT_COLORS[1],
      SESSION_ACCENT_COLORS[2],
      SESSION_ACCENT_COLORS[4],
    ]
    const result = getNextSessionColor(used)
    expect(result).toBe(SESSION_ACCENT_COLORS[3])
  })

  it('should wrap around when all colors are used', () => {
    const allUsed = [...SESSION_ACCENT_COLORS]
    const result = getNextSessionColor(allUsed)
    // usedColors.length = 8, 8 % 8 = 0 → first color
    expect(result).toBe(SESSION_ACCENT_COLORS[0])
  })

  it('should wrap around correctly with more used than palette size', () => {
    // 9 used colors → 9 % 8 = 1 → second color
    const nineUsed = [...SESSION_ACCENT_COLORS, SESSION_ACCENT_COLORS[0]]
    const result = getNextSessionColor(nineUsed)
    expect(result).toBe(SESSION_ACCENT_COLORS[1])
  })
})
