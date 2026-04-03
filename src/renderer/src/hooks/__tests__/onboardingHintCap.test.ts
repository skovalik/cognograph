// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Tests for the per-hint show cap logic in useOnboardingTooltips.
 *
 * Validates that:
 * - Hints are shown at most MAX_SHOWS_PER_HINT times
 * - Each hint has an independent counter
 * - Counts persist via localStorage
 * - isHintUnderCap returns false once the cap is reached
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  HINT_CAP_STORAGE_KEY,
  MAX_SHOWS_PER_HINT,
  getHintShowCounts,
  incrementHintShowCount,
  isHintUnderCap,
} from '../useOnboardingTooltips'

describe('onboarding hint cap', () => {
  beforeEach(() => {
    localStorage.removeItem(HINT_CAP_STORAGE_KEY)
  })

  it('should export MAX_SHOWS_PER_HINT as 4', () => {
    expect(MAX_SHOWS_PER_HINT).toBe(4)
  })

  it('should return empty counts when localStorage has no data', () => {
    expect(getHintShowCounts()).toEqual({})
  })

  it('should increment a hint count and persist to localStorage', () => {
    incrementHintShowCount('first-note')
    expect(getHintShowCounts()).toEqual({ 'first-note': 1 })

    incrementHintShowCount('first-note')
    expect(getHintShowCounts()).toEqual({ 'first-note': 2 })
  })

  it('should track independent counters per hint ID', () => {
    incrementHintShowCount('first-note')
    incrementHintShowCount('first-note')
    incrementHintShowCount('first-edge')

    const counts = getHintShowCounts()
    expect(counts['first-note']).toBe(2)
    expect(counts['first-edge']).toBe(1)
  })

  it('should report under cap when count is below MAX_SHOWS_PER_HINT', () => {
    expect(isHintUnderCap('first-note')).toBe(true)

    incrementHintShowCount('first-note')
    incrementHintShowCount('first-note')
    incrementHintShowCount('first-note')
    expect(isHintUnderCap('first-note')).toBe(true) // 3 < 4
  })

  it('should report NOT under cap when count reaches MAX_SHOWS_PER_HINT', () => {
    for (let i = 0; i < MAX_SHOWS_PER_HINT; i++) {
      incrementHintShowCount('first-note')
    }
    expect(isHintUnderCap('first-note')).toBe(false)
  })

  it('should report NOT under cap when count exceeds MAX_SHOWS_PER_HINT', () => {
    for (let i = 0; i < MAX_SHOWS_PER_HINT + 2; i++) {
      incrementHintShowCount('first-note')
    }
    expect(isHintUnderCap('first-note')).toBe(false)
  })

  it('should handle one hint at cap and another under cap independently', () => {
    for (let i = 0; i < MAX_SHOWS_PER_HINT; i++) {
      incrementHintShowCount('first-note')
    }
    incrementHintShowCount('first-edge')

    expect(isHintUnderCap('first-note')).toBe(false)
    expect(isHintUnderCap('first-edge')).toBe(true)
  })

  it('should handle corrupted localStorage gracefully', () => {
    localStorage.setItem(HINT_CAP_STORAGE_KEY, 'not-valid-json')
    expect(getHintShowCounts()).toEqual({})
    expect(isHintUnderCap('first-note')).toBe(true)
  })

  it('should treat unknown hint IDs as under cap', () => {
    expect(isHintUnderCap('never-seen-before')).toBe(true)
  })
})
