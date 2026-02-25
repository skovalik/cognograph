// =============================================================================
// sessionColors.ts -- Session accent color palette for CC terminal sessions
//
// 8 distinct accent colors assigned round-robin to active sessions.
// Used by ccSession.accentColor to visually distinguish concurrent sessions.
// =============================================================================

/** 8 distinct accent colors for terminal sessions */
export const SESSION_ACCENT_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#6366f1', // indigo
] as const

export type SessionAccentColor = typeof SESSION_ACCENT_COLORS[number]

/**
 * Get next available color (round-robin based on active session count).
 * Prefers unused colors; falls back to round-robin when all 8 are taken.
 */
export function getNextSessionColor(usedColors: string[]): string {
  const available = SESSION_ACCENT_COLORS.filter(c => !usedColors.includes(c))
  return available.length > 0
    ? available[0]
    : SESSION_ACCENT_COLORS[usedColors.length % SESSION_ACCENT_COLORS.length]
}
