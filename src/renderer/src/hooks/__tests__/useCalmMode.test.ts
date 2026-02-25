/**
 * useCalmMode (Phase 6F) -- Calm mode hook and zoom shift tests
 *
 * Tests the pure computeEffectiveZoomWithCalm function that shifts
 * zoom levels toward ultra-far based on the calm offset.
 */

import { describe, it, expect } from 'vitest'
import { computeEffectiveZoomWithCalm } from '../useCalmMode'
import type { ZoomLevel } from '../useSemanticZoom'

describe('computeEffectiveZoomWithCalm', () => {
  it('returns unchanged level when offset is 0', () => {
    expect(computeEffectiveZoomWithCalm('ultra-close', 0)).toBe('ultra-close')
    expect(computeEffectiveZoomWithCalm('close', 0)).toBe('close')
    expect(computeEffectiveZoomWithCalm('mid', 0)).toBe('mid')
    expect(computeEffectiveZoomWithCalm('far', 0)).toBe('far')
    expect(computeEffectiveZoomWithCalm('ultra-far', 0)).toBe('ultra-far')
  })

  it('shifts ultra-close by 1 to close', () => {
    expect(computeEffectiveZoomWithCalm('ultra-close', 1)).toBe('close')
  })

  it('shifts close by 1 to mid', () => {
    expect(computeEffectiveZoomWithCalm('close', 1)).toBe('mid')
  })

  it('shifts mid by 1 to far', () => {
    expect(computeEffectiveZoomWithCalm('mid', 1)).toBe('far')
  })

  it('shifts far by 1 to ultra-far', () => {
    expect(computeEffectiveZoomWithCalm('far', 1)).toBe('ultra-far')
  })

  it('shifts close by 2 to far', () => {
    expect(computeEffectiveZoomWithCalm('close', 2)).toBe('far')
  })

  it('shifts ultra-close by 3 to far', () => {
    expect(computeEffectiveZoomWithCalm('ultra-close', 3)).toBe('far')
  })

  it('cannot shift below ultra-far (caps at index 0)', () => {
    expect(computeEffectiveZoomWithCalm('ultra-far', 1)).toBe('ultra-far')
    expect(computeEffectiveZoomWithCalm('ultra-far', 3)).toBe('ultra-far')
    expect(computeEffectiveZoomWithCalm('far', 2)).toBe('ultra-far')
    expect(computeEffectiveZoomWithCalm('far', 3)).toBe('ultra-far')
  })

  it('shifts mid by 2 all the way to ultra-far', () => {
    expect(computeEffectiveZoomWithCalm('mid', 2)).toBe('ultra-far')
  })

  it('shifts ultra-close by 4 to ultra-far (overshoot capped)', () => {
    expect(computeEffectiveZoomWithCalm('ultra-close', 4)).toBe('ultra-far')
  })
})
