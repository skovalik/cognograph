/**
 * Color conversion utilities for React Bits ambient effects.
 *
 * Handles hex ↔ RGB float conversions and harmonic color generation
 * needed by different React Bits components.
 */

/** Convert hex color (#RRGGBB) to [0-1, 0-1, 0-1] floats (for OGL components) */
export function hexToRgbFloat(hex: string): [number, number, number] {
  const h = hex.startsWith('#') ? hex.slice(1) : hex
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  return [
    isNaN(r) ? 0.3 : r,
    isNaN(g) ? 0.3 : g,
    isNaN(b) ? 0.3 : b
  ]
}

/** Convert [0-1, 0-1, 0-1] floats back to hex string */
export function rgbFloatToHex(rgb: [number, number, number]): string {
  const toHex = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')
  return `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`
}

/**
 * Generate a palette from two accent colors (primary + secondary).
 * Interpolates and extends between the two seeds, producing richer palettes
 * than single-color hue rotation. Falls back to harmonics if no secondary.
 */
export function generatePaletteFromAccents(
  primary: string,
  secondary: string | undefined,
  count: number
): string[] {
  if (count <= 0) return []
  if (count === 1) return [primary]
  if (!secondary) return generateHarmonics(primary, count)

  // Convert both to HSL for interpolation
  const [pr, pg, pb] = hexToRgbFloat(primary)
  const [sr, sg, sb] = hexToRgbFloat(secondary)
  const pHsl = rgbToHsl(pr, pg, pb)
  const sHsl = rgbToHsl(sr, sg, sb)

  const colors: string[] = []
  for (let i = 0; i < count; i++) {
    // Distribute stops across the two accent colors with slight overshoot
    const t = count === 1 ? 0 : i / (count - 1)
    // Interpolate in HSL space for perceptually smooth blends
    let h = lerpHue(pHsl.h, sHsl.h, t)
    const s = pHsl.s + (sHsl.s - pHsl.s) * t
    const l = pHsl.l + (sHsl.l - pHsl.l) * t
    // Slight hue spread for visual interest on middle stops
    if (count > 2 && i > 0 && i < count - 1) {
      h = (h + 0.05 * (i % 2 === 0 ? 1 : -1) + 1) % 1
    }
    colors.push(hslToHex(h, Math.min(1, s * 1.1), l))
  }
  return colors
}

/** Lerp between two hue values taking the shortest arc */
function lerpHue(h1: number, h2: number, t: number): number {
  let diff = h2 - h1
  if (diff > 0.5) diff -= 1
  if (diff < -0.5) diff += 1
  return ((h1 + diff * t) % 1 + 1) % 1
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }

  return { h, s, l }
}

/**
 * Generate a harmonious set of hex colors from a base color.
 * Uses hue rotation to create evenly-spaced stops (for Aurora, LiquidEther, etc.)
 */
export function generateHarmonics(baseHex: string, count: number): string[] {
  if (count <= 0) return []
  if (count === 1) return [baseHex]

  const [r, g, b] = hexToRgbFloat(baseHex)

  // RGB → HSL
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }

  const colors: string[] = []
  const step = 360 / count
  for (let i = 0; i < count; i++) {
    const hue = ((h * 360 + step * i) % 360) / 360
    colors.push(hslToHex(hue, s, l))
  }
  return colors
}

/**
 * Derive a color from a source hex by adjusting darkness, saturation, and hue.
 * Used for auto-generating complementary colors (e.g., DotGrid baseColor from activeColor).
 *
 * When `isDark` is false and `opts.lightMode` is provided, uses the light-mode
 * overrides instead — typically lightening toward white rather than darkening.
 */
export function deriveColor(
  sourceHex: string,
  opts: {
    darken?: number
    desaturate?: number
    hueShift?: number
    lightMode?: { lighten?: number; desaturate?: number; hueShift?: number }
  },
  isDark = true
): string {
  const [r, g, b] = hexToRgbFloat(sourceHex)
  const { h, s, l } = rgbToHsl(r, g, b)

  if (!isDark && opts.lightMode) {
    const lm = opts.lightMode
    const newH = ((h + (lm.hueShift ?? 0)) % 1 + 1) % 1
    const newS = Math.max(0, Math.min(1, s * (1 - (lm.desaturate ?? 0))))
    // Lighten: push luminance toward 1.0 (white)
    const newL = Math.max(0, Math.min(1, l + (1 - l) * (lm.lighten ?? 0)))
    return hslToHex(newH, newS, newL)
  }

  const newH = ((h + (opts.hueShift ?? 0)) % 1 + 1) % 1
  const newS = Math.max(0, Math.min(1, s * (1 - (opts.desaturate ?? 0))))
  const newL = Math.max(0, Math.min(1, l * (1 - (opts.darken ?? 0))))

  return hslToHex(newH, newS, newL)
}

function hslToHex(h: number, s: number, l: number): string {
  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }

  let r: number, g: number, b: number
  if (s === 0) {
    r = g = b = l
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }

  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}
