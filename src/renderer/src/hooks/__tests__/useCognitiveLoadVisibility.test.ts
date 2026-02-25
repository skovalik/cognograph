/**
 * useCognitiveLoadVisibility (Phase 6F) -- Cognitive load meter visibility tests
 *
 * Tests the pure computeCognitiveLoadVisibility function that determines
 * when the cognitive load meter should be shown based on zoom level
 * and current load.
 */

import { describe, it, expect } from 'vitest'
import {
  computeCognitiveLoadVisibility,
  INTERMEDIATE_LOAD_THRESHOLD
} from '../useCognitiveLoadVisibility'

describe('computeCognitiveLoadVisibility', () => {
  // --- L0 (ultra-far): ALWAYS visible ---

  it('is always visible at ultra-far regardless of load', () => {
    const low = computeCognitiveLoadVisibility('ultra-far', 0.1)
    expect(low.isVisible).toBe(true)

    const high = computeCognitiveLoadVisibility('ultra-far', 0.95)
    expect(high.isVisible).toBe(true)

    const zero = computeCognitiveLoadVisibility('ultra-far', 0)
    expect(zero.isVisible).toBe(true)
  })

  // --- L1-L2 (far/mid): visible when load > threshold ---

  it('is visible at far zoom when load exceeds threshold', () => {
    const result = computeCognitiveLoadVisibility('far', 0.85)
    expect(result.isVisible).toBe(true)
  })

  it('is hidden at far zoom when load is below threshold', () => {
    const result = computeCognitiveLoadVisibility('far', 0.5)
    expect(result.isVisible).toBe(false)
  })

  it('is visible at mid zoom when load exceeds threshold', () => {
    const result = computeCognitiveLoadVisibility('mid', 0.75)
    expect(result.isVisible).toBe(true)
  })

  it('is hidden at mid zoom when load is at exactly the threshold', () => {
    // Threshold is > 0.7, so exactly 0.7 should be hidden
    const result = computeCognitiveLoadVisibility('mid', INTERMEDIATE_LOAD_THRESHOLD)
    expect(result.isVisible).toBe(false)
  })

  it('is visible at mid zoom when load is just above threshold', () => {
    const result = computeCognitiveLoadVisibility('mid', INTERMEDIATE_LOAD_THRESHOLD + 0.01)
    expect(result.isVisible).toBe(true)
  })

  // --- L3-L4 (close/ultra-close): HIDDEN ---

  it('is hidden at close zoom regardless of load', () => {
    const result = computeCognitiveLoadVisibility('close', 1.0)
    expect(result.isVisible).toBe(false)
  })

  it('is hidden at ultra-close zoom regardless of load', () => {
    const result = computeCognitiveLoadVisibility('ultra-close', 0.99)
    expect(result.isVisible).toBe(false)
  })

  // --- Reason strings ---

  it('provides a reason string for all results', () => {
    const visible = computeCognitiveLoadVisibility('ultra-far', 0.5)
    expect(visible.reason).toBeTruthy()
    expect(typeof visible.reason).toBe('string')

    const hidden = computeCognitiveLoadVisibility('close', 0.9)
    expect(hidden.reason).toBeTruthy()
    expect(typeof hidden.reason).toBe('string')
  })
})
