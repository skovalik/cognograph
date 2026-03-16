// =============================================================================
// colorUtils.ts -- Color manipulation utilities
//
// Provides hex color manipulation for dynamic accent theme generation.
// =============================================================================

/** Lighten a hex color by a percentage (0-100) */
export function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, (num >> 16) + Math.round(((255 - (num >> 16)) * percent) / 100))
  const g = Math.min(255, ((num >> 8) & 0x00ff) + Math.round(((255 - ((num >> 8) & 0x00ff)) * percent) / 100))
  const b = Math.min(255, (num & 0x0000ff) + Math.round(((255 - (num & 0x0000ff)) * percent) / 100))
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}
