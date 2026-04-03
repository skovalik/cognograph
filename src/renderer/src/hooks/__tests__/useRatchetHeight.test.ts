// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * useRatchetHeight — layout-shift prevention tests.
 *
 * Tests the pure computeRatchetHeight function that determines
 * the min-height during streaming to prevent layout shift.
 *
 * Invariants:
 * 1. Height only increases during streaming (ratchet up)
 * 2. Resets to 0 when streaming ends
 */

import { describe, it, expect } from 'vitest'
import { computeRatchetHeight } from '../useRatchetHeight'

describe('computeRatchetHeight', () => {
  // --- Ratchet only increases during streaming ---

  it('returns observed height when it exceeds current min', () => {
    expect(computeRatchetHeight(50, 100, true)).toBe(100)
  })

  it('keeps current min when observed height is smaller', () => {
    expect(computeRatchetHeight(100, 80, true)).toBe(100)
  })

  it('keeps current min when observed height equals current min', () => {
    expect(computeRatchetHeight(100, 100, true)).toBe(100)
  })

  it('starts from 0 and ratchets up on first observation', () => {
    expect(computeRatchetHeight(0, 42, true)).toBe(42)
  })

  it('simulates a growing stream correctly', () => {
    // Simulate sequential height observations during streaming
    let min = 0
    min = computeRatchetHeight(min, 20, true)
    expect(min).toBe(20)

    min = computeRatchetHeight(min, 50, true)
    expect(min).toBe(50)

    // Height dips — ratchet holds
    min = computeRatchetHeight(min, 30, true)
    expect(min).toBe(50)

    // Height grows again
    min = computeRatchetHeight(min, 200, true)
    expect(min).toBe(200)

    // Another dip — still holds
    min = computeRatchetHeight(min, 150, true)
    expect(min).toBe(200)

    // New max
    min = computeRatchetHeight(min, 400, true)
    expect(min).toBe(400)
  })

  // --- Reset when streaming ends ---

  it('resets to 0 when streaming is false', () => {
    expect(computeRatchetHeight(300, 300, false)).toBe(0)
  })

  it('resets to 0 regardless of observed height when not streaming', () => {
    expect(computeRatchetHeight(100, 500, false)).toBe(0)
  })

  it('returns 0 when both current and observed are 0 and not streaming', () => {
    expect(computeRatchetHeight(0, 0, false)).toBe(0)
  })

  // --- Edge cases ---

  it('handles 0 observed height during streaming', () => {
    expect(computeRatchetHeight(50, 0, true)).toBe(50)
  })

  it('handles very large heights', () => {
    expect(computeRatchetHeight(0, 99999, true)).toBe(99999)
    expect(computeRatchetHeight(99999, 100000, true)).toBe(100000)
  })

  it('handles fractional pixel heights', () => {
    expect(computeRatchetHeight(50.5, 50.7, true)).toBe(50.7)
    expect(computeRatchetHeight(50.7, 50.5, true)).toBe(50.7)
  })
})
