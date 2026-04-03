// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Cached Canvas 2D text measurement utilities.
 *
 * Uses a singleton CanvasRenderingContext2D to avoid creating a new
 * <canvas> element on every call. Falls back to a character-width
 * heuristic when Canvas is unavailable (SSR, test environments without
 * canvas support).
 */

// ---------------------------------------------------------------------------
// Singleton context
// ---------------------------------------------------------------------------

let _ctx: CanvasRenderingContext2D | null | undefined

/**
 * Return a reusable 2D context, creating it once.  Returns `null` when
 * the Canvas API is not available (SSR / headless tests).
 */
function getContext(): CanvasRenderingContext2D | null {
  if (_ctx !== undefined) return _ctx

  try {
    if (typeof OffscreenCanvas !== 'undefined') {
      _ctx = new OffscreenCanvas(1, 1).getContext('2d') ?? null
    } else if (typeof document !== 'undefined') {
      const el = document.createElement('canvas')
      _ctx = el.getContext('2d') ?? null
    } else {
      _ctx = null
    }
  } catch {
    _ctx = null
  }
  return _ctx
}

// ---------------------------------------------------------------------------
// Heuristic fallback
// ---------------------------------------------------------------------------

/**
 * Average character width ratios relative to font size.  Used when Canvas
 * is not available.
 */
const HEURISTIC_RATIO = 0.55 // covers most Latin / CJK at body sizes
const CJK_REGEX = /[\u3000-\u9FFF\uF900-\uFAFF]/

function estimateTextWidth(text: string, fontSize: number): number {
  let width = 0
  for (let i = 0; i < text.length; i++) {
    // CJK characters are roughly full-width
    width += CJK_REGEX.test(text[i]) ? fontSize : fontSize * HEURISTIC_RATIO
  }
  return width
}

/**
 * Parse the numeric font size from a CSS font string.
 * Handles patterns like "14px Inter", "600 14px Inter", "bold 16px/1.5 serif".
 */
function parseFontSize(font: string): number {
  const match = font.match(/(\d+(?:\.\d+)?)px/)
  return match ? parseFloat(match[1]) : 14
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Measure the rendered pixel width of `text` using a cached Canvas 2D
 * context.  Falls back to a heuristic when Canvas is unavailable.
 *
 * @param text  The string to measure.
 * @param font  CSS font shorthand (default: `'14px Inter, sans-serif'`).
 */
export function measureTextWidth(
  text: string,
  font: string = '14px Inter, sans-serif'
): number {
  const ctx = getContext()
  if (ctx) {
    ctx.font = font
    return ctx.measureText(text).width
  }
  return estimateTextWidth(text, parseFontSize(font))
}

// ---------------------------------------------------------------------------
// Auto-fit dimensions
// ---------------------------------------------------------------------------

export const AUTO_FIT_CONSTRAINTS = {
  minWidth: 100,
  maxWidth: 600,
  minHeight: 60,
  maxHeight: 2400,
  padding: 32 // 16px on each side
} as const

export const TYPE_BADGE_H = 20
export const MIN_BODY_H = 48

export interface AutoFitOptions {
  headerHeight?: number
  footerHeight?: number
  nodeWidth?: number
}

/**
 * Calculate auto-fit dimensions for a node based on its title and content.
 *
 * @param title         Node title text.
 * @param content       Node HTML content (optional).
 * @param headerHeight  Height of the header section (default 40).
 * @param footerHeight  Height of the footer section (default 36).
 * @param nodeWidth     Optional width to constrain content measurement.
 */
export function calculateAutoFitDimensions(
  title: string,
  content?: string,
  headerHeight: number = 40,
  footerHeight: number = 36,
  nodeWidth?: number
): { width: number; height: number } {
  const constraints = AUTO_FIT_CONSTRAINTS
  const effectiveWidth = Math.min(constraints.maxWidth, nodeWidth ?? constraints.maxWidth)

  // Measure title width
  const titleWidth = measureTextWidth(title, '600 14px Inter, sans-serif')
  const iconAndPadding = 60 // icon (24) + gaps + padding
  const titleRequiredWidth = Math.ceil(titleWidth + iconAndPadding)

  // Calculate content dimensions if present
  let contentWidth = 0
  let contentHeight = 0

  if (content) {
    // Strip HTML and measure plain text
    const plainContent = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

    if (plainContent.length > 0) {
      // Estimate content dimensions
      // Assume ~7.5px per character at 14px font size
      const charsPerLine = Math.floor((effectiveWidth - constraints.padding) / 7.5)
      const lineCount = Math.ceil(plainContent.length / charsPerLine)
      const lineHeight = 20 // Approximate line height

      // Calculate based on actual line breaks in HTML
      const htmlLines = content.split(/<\/p>|<br\s*\/?>/i).filter(Boolean).length
      const effectiveLines = Math.max(lineCount, htmlLines)

      contentHeight = effectiveLines * lineHeight
      contentWidth = Math.min(
        effectiveWidth,
        Math.ceil(plainContent.length * 7.5) + constraints.padding
      )
    }
  }

  // Calculate final dimensions
  const width = Math.max(
    constraints.minWidth,
    Math.min(constraints.maxWidth, Math.max(titleRequiredWidth, contentWidth))
  )

  const height = Math.max(
    constraints.minHeight,
    Math.min(
      constraints.maxHeight,
      TYPE_BADGE_H + headerHeight + Math.max(contentHeight, MIN_BODY_H) + footerHeight + constraints.padding
    )
  )

  return { width, height }
}

// ---------------------------------------------------------------------------
// DOM-based content measurement (unchanged logic, kept for compatibility)
// ---------------------------------------------------------------------------

/**
 * Measures the dimensions needed to fit content within a node using DOM
 * measurement for accurate text sizing.
 *
 * @param element  The DOM element containing the content to measure.
 * @param options  Optional constraints for min/max dimensions.
 */
export function measureContentDimensions(
  element: HTMLElement,
  options: Partial<typeof AUTO_FIT_CONSTRAINTS> = {}
): { width: number; height: number } {
  const constraints = { ...AUTO_FIT_CONSTRAINTS, ...options }

  // Create a clone to measure without affecting layout
  const clone = element.cloneNode(true) as HTMLElement
  clone.style.position = 'absolute'
  clone.style.visibility = 'hidden'
  clone.style.width = 'auto'
  clone.style.height = 'auto'
  clone.style.maxWidth = `${constraints.maxWidth - constraints.padding}px`
  clone.style.whiteSpace = 'pre-wrap'
  clone.style.wordWrap = 'break-word'

  document.body.appendChild(clone)

  const rect = clone.getBoundingClientRect()

  document.body.removeChild(clone)

  // Calculate dimensions with constraints
  const width = Math.max(
    constraints.minWidth,
    Math.min(constraints.maxWidth, Math.ceil(rect.width + constraints.padding))
  )
  const height = Math.max(
    constraints.minHeight,
    Math.min(constraints.maxHeight, Math.ceil(rect.height + constraints.padding))
  )

  return { width, height }
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Reset the cached context.  Only for testing — allows verifying that the
 * singleton is created once and reused.
 * @internal
 */
export function __resetContextForTesting(): void {
  _ctx = undefined
}
