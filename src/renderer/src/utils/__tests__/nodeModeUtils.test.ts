/**
 * nodeModeUtils.test.ts - Unit tests for node mode visual differentiation utilities
 *
 * Tests tint opacity calculations, border styles, and border widths for all node modes.
 * Based on spec: docs/specs/node-mode-visual-system.md
 */

import { describe, it, expect } from 'vitest'
import { getTintOpacity, getBorderStyle, getBorderWidth } from '../nodeModeUtils'
import type { NoteMode } from '@shared/types'

// =============================================================================
// Suite 1: getTintOpacity()
// =============================================================================

describe('getTintOpacity', () => {
  // ---------------------------------------------------------------------------
  // Note mode base opacity tests (normal intensity, light theme)
  // ---------------------------------------------------------------------------

  describe('Note modes - base opacity', () => {
    it('returns 35% for persona mode (high importance)', () => {
      expect(getTintOpacity('persona', 'normal', 'light')).toBe(35)
    })

    it('returns 35% for instruction mode (high importance)', () => {
      expect(getTintOpacity('instruction', 'normal', 'light')).toBe(35)
    })

    it('returns 30% for design-tokens mode (special mode)', () => {
      expect(getTintOpacity('design-tokens', 'normal', 'light')).toBe(30)
    })

    it('returns 28% for reference mode (scoped content)', () => {
      expect(getTintOpacity('reference', 'normal', 'light')).toBe(28)
    })

    it('returns 28% for examples mode (scoped content)', () => {
      expect(getTintOpacity('examples', 'normal', 'light')).toBe(28)
    })

    it('returns 28% for page mode (scoped content)', () => {
      expect(getTintOpacity('page', 'normal', 'light')).toBe(28)
    })

    it('returns 28% for component mode (scoped content)', () => {
      expect(getTintOpacity('component', 'normal', 'light')).toBe(28)
    })

    it('returns 28% for content-model mode (scoped content)', () => {
      expect(getTintOpacity('content-model', 'normal', 'light')).toBe(28)
    })

    it('returns 20% for general mode (default/low priority)', () => {
      expect(getTintOpacity('general', 'normal', 'light')).toBe(20)
    })

    it('returns 20% for background mode (default/low priority)', () => {
      expect(getTintOpacity('background', 'normal', 'light')).toBe(20)
    })

    it('returns 20% for wp-config mode (special case like general)', () => {
      expect(getTintOpacity('wp-config', 'normal', 'light')).toBe(20)
    })

    it('returns 20% base opacity for undefined mode', () => {
      expect(getTintOpacity(undefined, 'normal', 'light')).toBe(20)
    })

    it('returns 20% base opacity for unknown mode (fallback)', () => {
      // @ts-expect-error - Testing invalid input
      expect(getTintOpacity('invalid-mode' as NoteMode, 'normal', 'light')).toBe(20)
    })
  })

  // ---------------------------------------------------------------------------
  // Dark mode compensation tests
  // ---------------------------------------------------------------------------

  describe('Dark mode compensation (50% reduction)', () => {
    it('applies dark mode compensation to persona (35% → 18%)', () => {
      expect(getTintOpacity('persona', 'normal', 'dark')).toBe(18) // 35 * 0.5 = 17.5, rounded to 18
    })

    it('applies dark mode compensation to instruction (35% → 18%)', () => {
      expect(getTintOpacity('instruction', 'normal', 'dark')).toBe(18)
    })

    it('applies dark mode compensation to design-tokens (30% → 15%)', () => {
      expect(getTintOpacity('design-tokens', 'normal', 'dark')).toBe(15)
    })

    it('applies dark mode compensation to reference (28% → 14%)', () => {
      expect(getTintOpacity('reference', 'normal', 'dark')).toBe(14)
    })

    it('applies dark mode compensation to examples (28% → 14%)', () => {
      expect(getTintOpacity('examples', 'normal', 'dark')).toBe(14)
    })

    it('applies dark mode compensation to page (28% → 14%)', () => {
      expect(getTintOpacity('page', 'normal', 'dark')).toBe(14)
    })

    it('applies dark mode compensation to component (28% → 14%)', () => {
      expect(getTintOpacity('component', 'normal', 'dark')).toBe(14)
    })

    it('applies dark mode compensation to content-model (28% → 14%)', () => {
      expect(getTintOpacity('content-model', 'normal', 'dark')).toBe(14)
    })

    it('applies dark mode compensation to general (20% → 10%)', () => {
      expect(getTintOpacity('general', 'normal', 'dark')).toBe(10)
    })

    it('applies dark mode compensation to background (20% → 10%)', () => {
      expect(getTintOpacity('background', 'normal', 'dark')).toBe(10)
    })

    it('applies dark mode compensation to wp-config (20% → 10%)', () => {
      expect(getTintOpacity('wp-config', 'normal', 'dark')).toBe(10)
    })

    it('applies dark mode compensation to undefined mode (20% → 10%)', () => {
      expect(getTintOpacity(undefined, 'normal', 'dark')).toBe(10)
    })
  })

  // ---------------------------------------------------------------------------
  // Intensity multiplier tests
  // ---------------------------------------------------------------------------

  describe('Intensity multipliers', () => {
    describe('Subtle intensity (70%)', () => {
      it('applies subtle multiplier to persona (35% * 0.7 = 25%)', () => {
        expect(getTintOpacity('persona', 'subtle', 'light')).toBe(25) // 35 * 0.7 = 24.5, rounded to 25
      })

      it('applies subtle multiplier to design-tokens (30% * 0.7 = 21%)', () => {
        expect(getTintOpacity('design-tokens', 'subtle', 'light')).toBe(21)
      })

      it('applies subtle multiplier to reference (28% * 0.7 = 20%)', () => {
        expect(getTintOpacity('reference', 'subtle', 'light')).toBe(20) // 28 * 0.7 = 19.6, rounded to 20
      })

      it('applies subtle multiplier to general (20% * 0.7 = 14%)', () => {
        expect(getTintOpacity('general', 'subtle', 'light')).toBe(14)
      })
    })

    describe('Normal intensity (100%) - default', () => {
      it('returns base opacity for persona with normal intensity', () => {
        expect(getTintOpacity('persona', 'normal', 'light')).toBe(35)
      })

      it('returns base opacity for general with normal intensity', () => {
        expect(getTintOpacity('general', 'normal', 'light')).toBe(20)
      })

      it('uses normal intensity as default when not specified', () => {
        expect(getTintOpacity('persona')).toBe(35)
      })
    })

    describe('Strong intensity (130%)', () => {
      it('applies strong multiplier to persona (35% * 1.3 = 46%)', () => {
        expect(getTintOpacity('persona', 'strong', 'light')).toBe(46) // 35 * 1.3 = 45.5, rounded to 46
      })

      it('applies strong multiplier to design-tokens (30% * 1.3 = 39%)', () => {
        expect(getTintOpacity('design-tokens', 'strong', 'light')).toBe(39)
      })

      it('applies strong multiplier to reference (28% * 1.3 = 36%)', () => {
        expect(getTintOpacity('reference', 'strong', 'light')).toBe(36) // 28 * 1.3 = 36.4, rounded to 36
      })

      it('applies strong multiplier to general (20% * 1.3 = 26%)', () => {
        expect(getTintOpacity('general', 'strong', 'light')).toBe(26)
      })
    })
  })

  // ---------------------------------------------------------------------------
  // Combined modifiers tests
  // ---------------------------------------------------------------------------

  describe('Combined intensity + dark mode', () => {
    it('applies subtle + dark mode to persona (35% * 0.7 * 0.5 = 12%)', () => {
      expect(getTintOpacity('persona', 'subtle', 'dark')).toBe(12) // 35 * 0.7 * 0.5 = 12.25, rounded to 12
    })

    it('applies strong + dark mode to persona (35% * 1.3 * 0.5 = 23%)', () => {
      expect(getTintOpacity('persona', 'strong', 'dark')).toBe(23) // 35 * 1.3 * 0.5 = 22.75, rounded to 23
    })

    it('applies subtle + dark mode to general (20% * 0.7 * 0.5 = 7%)', () => {
      expect(getTintOpacity('general', 'subtle', 'dark')).toBe(7)
    })

    it('applies strong + dark mode to general (20% * 1.3 * 0.5 = 13%)', () => {
      expect(getTintOpacity('general', 'strong', 'dark')).toBe(13)
    })
  })

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('Edge cases', () => {
    it('clamps opacity to 100% maximum', () => {
      // Even if calculation exceeds 100%, should clamp
      // Strong multiplier on high opacity could theoretically exceed 100%
      // but current values don't trigger this. Test behavior anyway.
      const result = getTintOpacity('persona', 'strong', 'light')
      expect(result).toBeLessThanOrEqual(100)
    })

    it('clamps opacity to 0% minimum', () => {
      // Even if calculation goes negative (unlikely), should clamp to 0
      const result = getTintOpacity('general', 'subtle', 'dark')
      expect(result).toBeGreaterThanOrEqual(0)
    })

    it('returns integer values (no decimals)', () => {
      // All results should be rounded
      expect(getTintOpacity('persona', 'subtle', 'light')).toBe(Math.floor(35 * 0.7 + 0.5))
      expect(getTintOpacity('persona', 'strong', 'light')).toBe(Math.floor(35 * 1.3 + 0.5))
    })
  })
})

// =============================================================================
// Suite 2: getBorderStyle()
// =============================================================================

describe('getBorderStyle', () => {
  describe('High importance modes (solid)', () => {
    it('returns "solid" for persona mode', () => {
      expect(getBorderStyle('persona')).toBe('solid')
    })

    it('returns "solid" for instruction mode', () => {
      expect(getBorderStyle('instruction')).toBe('solid')
    })

    it('returns "solid" for design-tokens mode', () => {
      expect(getBorderStyle('design-tokens')).toBe('solid')
    })
  })

  describe('Medium importance modes (dashed)', () => {
    it('returns "dashed" for reference mode', () => {
      expect(getBorderStyle('reference')).toBe('dashed')
    })

    it('returns "dashed" for examples mode', () => {
      expect(getBorderStyle('examples')).toBe('dashed')
    })

    it('returns "dashed" for page mode', () => {
      expect(getBorderStyle('page')).toBe('dashed')
    })

    it('returns "dashed" for component mode', () => {
      expect(getBorderStyle('component')).toBe('dashed')
    })

    it('returns "dashed" for content-model mode', () => {
      expect(getBorderStyle('content-model')).toBe('dashed')
    })
  })

  describe('Low importance modes (dotted)', () => {
    it('returns "dotted" for general mode', () => {
      expect(getBorderStyle('general')).toBe('dotted')
    })

    it('returns "dotted" for background mode', () => {
      expect(getBorderStyle('background')).toBe('dotted')
    })

    it('returns "dotted" for wp-config mode', () => {
      expect(getBorderStyle('wp-config')).toBe('dotted')
    })
  })

  describe('Edge cases', () => {
    it('returns "dotted" for undefined mode (fallback to general)', () => {
      expect(getBorderStyle(undefined)).toBe('dotted')
    })

    it('returns "dotted" for unknown mode (fallback to general)', () => {
      // @ts-expect-error - Testing invalid input
      expect(getBorderStyle('invalid-mode' as NoteMode)).toBe('dotted')
    })
  })
})

// =============================================================================
// Suite 3: getBorderWidth()
// =============================================================================

describe('getBorderWidth', () => {
  describe('High importance modes (2px)', () => {
    it('returns 2 for persona mode (heavy tint level)', () => {
      expect(getBorderWidth('persona')).toBe(2)
    })

    it('returns 2 for instruction mode (heavy tint level)', () => {
      expect(getBorderWidth('instruction')).toBe(2)
    })

    it('returns 2 for design-tokens mode (heavy tint level)', () => {
      expect(getBorderWidth('design-tokens')).toBe(2)
    })
  })

  describe('Medium importance modes (1.5px)', () => {
    it('returns 1.5 for reference mode (medium tint level)', () => {
      expect(getBorderWidth('reference')).toBe(1.5)
    })

    it('returns 1.5 for examples mode (medium tint level)', () => {
      expect(getBorderWidth('examples')).toBe(1.5)
    })

    it('returns 1.5 for page mode (medium tint level)', () => {
      expect(getBorderWidth('page')).toBe(1.5)
    })

    it('returns 1.5 for component mode (medium tint level)', () => {
      expect(getBorderWidth('component')).toBe(1.5)
    })

    it('returns 1.5 for content-model mode (medium tint level)', () => {
      expect(getBorderWidth('content-model')).toBe(1.5)
    })
  })

  describe('Low importance modes (1px)', () => {
    it('returns 1 for general mode (light tint level)', () => {
      expect(getBorderWidth('general')).toBe(1)
    })

    it('returns 1 for background mode (light tint level)', () => {
      expect(getBorderWidth('background')).toBe(1)
    })

    it('returns 1 for wp-config mode (light tint level)', () => {
      expect(getBorderWidth('wp-config')).toBe(1)
    })
  })

  describe('Edge cases', () => {
    it('returns 1 for undefined mode (fallback to general → light)', () => {
      expect(getBorderWidth(undefined)).toBe(1)
    })

    it('returns 1 for unknown mode (fallback to general → light)', () => {
      // @ts-expect-error - Testing invalid input
      expect(getBorderWidth('invalid-mode' as NoteMode)).toBe(1)
    })

    it('returns numeric value (not string with px)', () => {
      expect(typeof getBorderWidth('persona')).toBe('number')
      expect(getBorderWidth('persona')).toBe(2) // not '2px'
    })
  })
})
