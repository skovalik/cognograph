import { describe, it, expect } from 'vitest'
import { resolveGlassStyle } from '../glassUtils'
import type { GlassStyle } from '@shared/types'

describe('resolveGlassStyle', () => {
  describe('auto mode', () => {
    it('should return solid for low GPU tier', () => {
      const result = resolveGlassStyle('auto', 'low', false)
      expect(result).toBe('solid')
    })

    it('should return solid for low GPU tier even with ambient active', () => {
      const result = resolveGlassStyle('auto', 'low', true)
      expect(result).toBe('solid')
    })

    it('should return soft-blur for medium GPU tier without ambient', () => {
      const result = resolveGlassStyle('auto', 'medium', false)
      expect(result).toBe('soft-blur')
    })

    it('should return soft-blur for medium GPU tier with ambient active', () => {
      const result = resolveGlassStyle('auto', 'medium', true)
      expect(result).toBe('soft-blur')
    })

    it('should return fluid-glass for high GPU tier without ambient', () => {
      const result = resolveGlassStyle('auto', 'high', false)
      expect(result).toBe('fluid-glass')
    })

    it('should return fluid-glass for high GPU tier with ambient active', () => {
      const result = resolveGlassStyle('auto', 'high', true)
      expect(result).toBe('fluid-glass')
    })
  })

  describe('user preference overrides', () => {
    it('should honor solid preference on high GPU', () => {
      const result = resolveGlassStyle('solid', 'high', false)
      expect(result).toBe('solid')
    })

    it('should honor soft-blur preference on high GPU', () => {
      const result = resolveGlassStyle('soft-blur', 'high', false)
      expect(result).toBe('soft-blur')
    })

    it('should honor fluid-glass preference on high GPU', () => {
      const result = resolveGlassStyle('fluid-glass', 'high', false)
      expect(result).toBe('fluid-glass')
    })

    it('should honor solid preference on medium GPU', () => {
      const result = resolveGlassStyle('solid', 'medium', false)
      expect(result).toBe('solid')
    })

    it('should honor soft-blur preference on medium GPU', () => {
      const result = resolveGlassStyle('soft-blur', 'medium', false)
      expect(result).toBe('soft-blur')
    })
  })

  describe('safety fallbacks', () => {
    it('should downgrade fluid-glass to solid on low GPU', () => {
      const result = resolveGlassStyle('fluid-glass', 'low', false)
      expect(result).toBe('solid')
    })

    it('should downgrade fluid-glass to soft-blur on medium GPU with ambient', () => {
      const result = resolveGlassStyle('fluid-glass', 'medium', true)
      expect(result).toBe('soft-blur')
    })

    it('should allow fluid-glass on medium GPU without ambient', () => {
      const result = resolveGlassStyle('fluid-glass', 'medium', false)
      expect(result).toBe('fluid-glass')
    })
  })

  describe('edge cases', () => {
    it('should handle all glass style values', () => {
      const styles: GlassStyle[] = ['solid', 'soft-blur', 'fluid-glass', 'auto']
      const tiers: Array<'high' | 'medium' | 'low'> = ['high', 'medium', 'low']

      styles.forEach((style) => {
        tiers.forEach((tier) => {
          [true, false].forEach((ambient) => {
            const result = resolveGlassStyle(style, tier, ambient)
            expect(['solid', 'soft-blur', 'fluid-glass']).toContain(result)
          })
        })
      })
    })
  })
})
