// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  measureTextWidth,
  calculateAutoFitDimensions,
  AUTO_FIT_CONSTRAINTS,
  TYPE_BADGE_H,
  MIN_BODY_H,
  __resetContextForTesting
} from '../textMeasure'

// ---------------------------------------------------------------------------
// jsdom does NOT provide a real Canvas 2D context (getContext returns null
// unless the `canvas` npm package is installed).  The module falls back to
// the character-width heuristic in this environment, which is exactly what
// we want to verify — the fallback must produce correct results.
//
// When running in Electron / a real browser, the OffscreenCanvas or
// HTMLCanvasElement path is taken instead.  We test that path indirectly
// by verifying the singleton reset mechanism.
// ---------------------------------------------------------------------------

beforeEach(() => {
  __resetContextForTesting()
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// measureTextWidth — heuristic path (jsdom)
// ---------------------------------------------------------------------------

describe('measureTextWidth', () => {
  it('returns a positive width for non-empty text', () => {
    const w = measureTextWidth('Hello')
    expect(w).toBeGreaterThan(0)
  })

  it('returns 0 for an empty string', () => {
    expect(measureTextWidth('')).toBe(0)
  })

  it('scales width with text length', () => {
    const w1 = measureTextWidth('A')
    const w5 = measureTextWidth('AAAAA')
    // 5 chars should be ~5x wider
    expect(w5).toBeCloseTo(w1 * 5, 0)
  })

  it('scales width with font size', () => {
    const small = measureTextWidth('Test', '12px sans-serif')
    const large = measureTextWidth('Test', '24px sans-serif')
    // 24px should be ~2x wider than 12px
    expect(large).toBeCloseTo(small * 2, 0)
  })

  it('handles weight + size font strings', () => {
    const w = measureTextWidth('X', '600 16px Roboto, sans-serif')
    // Heuristic: 1 char * 16px * 0.55 = 8.8
    expect(w).toBeCloseTo(8.8, 1)
  })

  it('defaults to 14px when font string has no px value', () => {
    const w = measureTextWidth('A', 'monospace')
    // Falls back to 14px: 1 * 14 * 0.55 = 7.7
    expect(w).toBeCloseTo(7.7, 1)
  })

  it('singleton is lazily created and reused', () => {
    // After reset, the first call creates the singleton
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
    measureTextWidth('a')
    measureTextWidth('b')
    measureTextWidth('c')

    // In jsdom, getContext returns null, so the fallback is used.
    // The module should only try getContext once (then cache null).
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('__resetContextForTesting forces re-initialization', () => {
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
    measureTextWidth('first')
    expect(spy).toHaveBeenCalledTimes(1)

    __resetContextForTesting()
    measureTextWidth('second')
    // After reset, getContext is called again
    expect(spy).toHaveBeenCalledTimes(2)
  })
})

// ---------------------------------------------------------------------------
// calculateAutoFitDimensions — dimension snapshot tests
// ---------------------------------------------------------------------------

describe('calculateAutoFitDimensions', () => {
  it('returns dimensions within constraints for short title', () => {
    const { width, height } = calculateAutoFitDimensions('Task')
    expect(width).toBeGreaterThanOrEqual(AUTO_FIT_CONSTRAINTS.minWidth)
    expect(width).toBeLessThanOrEqual(AUTO_FIT_CONSTRAINTS.maxWidth)
    expect(height).toBeGreaterThanOrEqual(AUTO_FIT_CONSTRAINTS.minHeight)
    expect(height).toBeLessThanOrEqual(AUTO_FIT_CONSTRAINTS.maxHeight)
  })

  it('returns dimensions within constraints for long title', () => {
    const longTitle = 'A'.repeat(200)
    const { width, height } = calculateAutoFitDimensions(longTitle)
    expect(width).toBeLessThanOrEqual(AUTO_FIT_CONSTRAINTS.maxWidth)
    expect(height).toBeGreaterThanOrEqual(AUTO_FIT_CONSTRAINTS.minHeight)
  })

  it('grows height for multiline HTML content', () => {
    const shortContent = '<p>One line</p>'
    const longContent = '<p>Line 1</p><p>Line 2</p><p>Line 3</p><p>Line 4</p><p>Line 5</p>'

    const short = calculateAutoFitDimensions('Title', shortContent)
    const long = calculateAutoFitDimensions('Title', longContent)

    // Long content should produce a taller node
    expect(long.height).toBeGreaterThanOrEqual(short.height)
  })

  it('produces stable (snapshot) dimensions for known inputs', () => {
    const dims = calculateAutoFitDimensions(
      'My Task Title',
      '<p>Some description text here</p>',
      40,
      36
    )

    // Snapshot within ±5%:
    // Title width via heuristic: "My Task Title" = 13 chars * 14 * 0.55 = 100.1 + 60 = 161
    // Content: "Some description text here" = 26 chars * 7.5 = 195 + 32 = 227
    // Width = max(161, 227) = 227 clamped to [100,600] => 227
    const expectedWidth = 227
    expect(dims.width).toBeGreaterThanOrEqual(expectedWidth * 0.95)
    expect(dims.width).toBeLessThanOrEqual(expectedWidth * 1.05)

    // Height = TYPE_BADGE_H(20) + header(40) + max(contentH, MIN_BODY_H(48)) + footer(36) + padding(32)
    // contentH: charsPerLine = floor((600-32)/7.5) = 75, lineCount = ceil(26/75) = 1
    // htmlLines = 1, effectiveLines = 1, contentHeight = 20
    // height = 20 + 40 + max(20,48) + 36 + 32 = 176
    const expectedHeight = 176
    expect(dims.height).toBeGreaterThanOrEqual(expectedHeight * 0.95)
    expect(dims.height).toBeLessThanOrEqual(expectedHeight * 1.05)
  })

  it('respects nodeWidth parameter for content wrapping', () => {
    const content = '<p>' + 'word '.repeat(50) + '</p>'
    const narrow = calculateAutoFitDimensions('T', content, 40, 36, 200)
    const wide = calculateAutoFitDimensions('T', content, 40, 36, 500)

    // Narrower nodeWidth should produce taller (or equal) height
    expect(narrow.height).toBeGreaterThanOrEqual(wide.height)
  })

  it('handles empty content gracefully', () => {
    const { width, height } = calculateAutoFitDimensions('Title Only')
    expect(width).toBeGreaterThanOrEqual(AUTO_FIT_CONSTRAINTS.minWidth)
    expect(height).toBeGreaterThanOrEqual(AUTO_FIT_CONSTRAINTS.minHeight)
  })

  it('handles CJK text in title', () => {
    const { width, height } = calculateAutoFitDimensions(
      '日本語のタイトル',
      '<p>内容テキスト</p>'
    )
    expect(Number.isFinite(width)).toBe(true)
    expect(Number.isFinite(height)).toBe(true)
    expect(width).toBeGreaterThanOrEqual(AUTO_FIT_CONSTRAINTS.minWidth)
    expect(height).toBeGreaterThanOrEqual(AUTO_FIT_CONSTRAINTS.minHeight)
  })

  it('CJK title is wider than same-length Latin title', () => {
    const latin = calculateAutoFitDimensions('ABCD')
    const cjk = calculateAutoFitDimensions('日本語文')

    // CJK chars are full-width in the heuristic (~1.0 * fontSize vs 0.55)
    expect(cjk.width).toBeGreaterThanOrEqual(latin.width)
  })
})

// ---------------------------------------------------------------------------
// Exported constants
// ---------------------------------------------------------------------------

describe('constants', () => {
  it('exports expected constraint values', () => {
    expect(AUTO_FIT_CONSTRAINTS.minWidth).toBe(100)
    expect(AUTO_FIT_CONSTRAINTS.maxWidth).toBe(600)
    expect(AUTO_FIT_CONSTRAINTS.minHeight).toBe(60)
    expect(AUTO_FIT_CONSTRAINTS.maxHeight).toBe(2400)
    expect(AUTO_FIT_CONSTRAINTS.padding).toBe(32)
    expect(TYPE_BADGE_H).toBe(20)
    expect(MIN_BODY_H).toBe(48)
  })
})

// ---------------------------------------------------------------------------
// Heuristic fallback — explicit forced path
// ---------------------------------------------------------------------------

describe('heuristic fallback', () => {
  it('returns a positive width when Canvas is unavailable', () => {
    __resetContextForTesting()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      null as unknown as CanvasRenderingContext2D
    )

    const w = measureTextWidth('Fallback test', '14px Inter, sans-serif')
    expect(w).toBeGreaterThan(0)
    // Heuristic: "Fallback test" = 13 chars * 14 * 0.55 ≈ 100.1
    expect(w).toBeGreaterThan(50)
  })

  it('heuristic handles CJK as full-width characters', () => {
    __resetContextForTesting()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      null as unknown as CanvasRenderingContext2D
    )

    const latinW = measureTextWidth('AAAA', '14px sans-serif')
    const cjkW = measureTextWidth('日本語文', '14px sans-serif')

    // CJK should be wider (4 full-width chars vs 4 narrow chars)
    expect(cjkW).toBeGreaterThan(latinW)
  })
})
