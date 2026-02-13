/**
 * Shared color utilities for ambient effects
 *
 * Extracted from individual effect files to reduce duplication.
 */

/** Parse a hex color string (#RRGGBB) to [R, G, B] components */
export function parseHexToRGB(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) || 100
  const g = parseInt(hex.slice(3, 5), 16) || 100
  const b = parseInt(hex.slice(5, 7), 16) || 100
  return [r, g, b]
}

/** Map a 0-100 slider value to an effect-specific range via linear interpolation */
export function mapSetting(value: number, min: number, max: number): number {
  return min + (value / 100) * (max - min)
}

/**
 * Shift the hue of a hex color by the given degrees.
 * hex → HSL → rotate hue → back to hex.
 */
export function adjustHue(hex: string, degrees: number): string {
  const [r, g, b] = parseHexToRGB(hex)
  // RGB → HSL
  const rf = r / 255, gf = g / 255, bf = b / 255
  const max = Math.max(rf, gf, bf), min = Math.min(rf, gf, bf)
  const l = (max + min) / 2
  let h = 0, s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === rf) h = ((gf - bf) / d + (gf < bf ? 6 : 0)) / 6
    else if (max === gf) h = ((bf - rf) / d + 2) / 6
    else h = ((rf - gf) / d + 4) / 6
  }
  // Rotate hue
  h = ((h * 360 + degrees) % 360 + 360) % 360
  // HSL → RGB
  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1; if (t > 1) t -= 1
    if (t < 1/6) return p + (q - p) * 6 * t
    if (t < 1/2) return q
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
    return p
  }
  const hN = h / 360
  let rr: number, gg: number, bb: number
  if (s === 0) {
    rr = gg = bb = l
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    rr = hue2rgb(p, q, hN + 1/3)
    gg = hue2rgb(p, q, hN)
    bb = hue2rgb(p, q, hN - 1/3)
  }
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0')
  return `#${toHex(rr)}${toHex(gg)}${toHex(bb)}`
}

/** Linearly interpolate between two RGB colors. t clamped to [0, 1]. */
export function lerpRGB(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number,
  t: number
): [number, number, number] {
  const c = Math.max(0, Math.min(1, t))
  return [
    Math.round(r1 + (r2 - r1) * c),
    Math.round(g1 + (g2 - g1) * c),
    Math.round(b1 + (b2 - b1) * c)
  ]
}
