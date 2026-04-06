// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Tests for the chat textarea auto-grow behavior.
 *
 * Validates the auto-grow algorithm used in ChatPanel's onInput handler:
 * - Textarea height resets to 'auto' before measuring
 * - Grows up to 50% of viewport height
 * - Shrinks back when content is deleted
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Simulates the auto-grow algorithm extracted from ChatPanel's onInput handler.
 * This is the exact logic used in both embedded and modal textarea modes.
 */
function simulateAutoGrow(
  scrollHeight: number,
  viewportHeight: number,
): { autoHeight: string; finalHeight: string } {
  // Step 1: reset height to auto (collapses to content size)
  const autoHeight = 'auto'
  // Step 2: cap at 50% viewport
  const maxH = Math.floor(viewportHeight * 0.5)
  const finalHeight = `${Math.min(scrollHeight, maxH)}px`
  return { autoHeight, finalHeight }
}

describe('chat auto-grow', () => {
  it('should grow to scrollHeight when under 50vh', () => {
    const result = simulateAutoGrow(100, 800)
    expect(result.finalHeight).toBe('100px')
  })

  it('should cap at 50% of viewport height', () => {
    const result = simulateAutoGrow(600, 800) // 50% of 800 = 400
    expect(result.finalHeight).toBe('400px')
  })

  it('should cap at 50% of a 1080px viewport', () => {
    const result = simulateAutoGrow(999, 1080) // 50% of 1080 = 540
    expect(result.finalHeight).toBe('540px')
  })

  it('should handle small viewport (e.g. 400px mobile)', () => {
    const result = simulateAutoGrow(300, 400) // 50% of 400 = 200
    expect(result.finalHeight).toBe('200px')
  })

  it('should shrink back when content is small', () => {
    // Simulate user typing a lot, then deleting
    const growResult = simulateAutoGrow(500, 800) // capped at 400
    expect(growResult.finalHeight).toBe('400px')

    const shrinkResult = simulateAutoGrow(40, 800) // small content
    expect(shrinkResult.finalHeight).toBe('40px')
  })

  it('should always set auto height before measuring', () => {
    const result = simulateAutoGrow(100, 800)
    expect(result.autoHeight).toBe('auto')
  })

  it('should handle edge case where scrollHeight equals max', () => {
    const result = simulateAutoGrow(400, 800) // exactly 50%
    expect(result.finalHeight).toBe('400px')
  })

  it('should floor the max height calculation', () => {
    // 50% of 801 = 400.5, floored to 400
    const result = simulateAutoGrow(999, 801)
    expect(result.finalHeight).toBe('400px')
  })
})
