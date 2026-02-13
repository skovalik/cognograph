/**
 * nodeModeUtils.ts - Node mode visual differentiation utilities
 *
 * Provides tint opacity and border style calculations for node modes.
 * Based on Phase 0 user research (76% accuracy, 80% preference).
 *
 * Modifications from simulation:
 * - Increased opacity delta: 15%/25%/40% (was 20%/26%/35%)
 * - Added border style redundancy for accessibility
 * - Supports intensity multiplier (subtle/normal/strong)
 */

import type { NoteMode } from '@shared/types'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type TintLevel = 'light' | 'medium' | 'heavy'
export type BorderStyleType = 'solid' | 'dashed' | 'dotted'
export type TintIntensity = 'subtle' | 'normal' | 'strong'

/**
 * Mode configuration with visual properties
 */
export interface ModeConfig {
  label: string
  tintLevel: TintLevel
  borderStyle: BorderStyleType
  description?: string
}

// -----------------------------------------------------------------------------
// Mode Configuration Map
// -----------------------------------------------------------------------------

/**
 * Visual configuration for each note mode
 *
 * Opacity values from spec (node-mode-visual-system.md):
 * - High importance (35%): Persona, Instruction
 * - Special modes (30%): Design Tokens
 * - Scoped content (28%): Reference, Example, Page, Component, Content Model
 * - Default/low priority (20%): General, Background
 *
 * Border styles (accessibility):
 * - Solid: High importance modes
 * - Dashed: Medium modes
 * - Dotted: Light modes
 */
const NOTE_MODE_CONFIG: Record<NoteMode, ModeConfig> = {
  // High importance: 35% opacity
  persona: {
    label: 'Persona',
    tintLevel: 'heavy',
    borderStyle: 'solid',
    description: 'Character descriptions, AI persona definitions'
  },
  'instruction': {
    label: 'Instruction',
    tintLevel: 'heavy',
    borderStyle: 'solid',
    description: 'Guidelines, rules, system prompts'
  },

  // Special mode: 30% opacity
  'design-tokens': {
    label: 'Design Tokens',
    tintLevel: 'heavy',
    borderStyle: 'solid',
    description: 'Colors, typography, spacing definitions'
  },

  // Scoped content: 28% opacity
  reference: {
    label: 'Reference',
    tintLevel: 'medium',
    borderStyle: 'dashed',
    description: 'Links, documentation, external resources'
  },
  examples: {
    label: 'Examples',
    tintLevel: 'medium',
    borderStyle: 'dashed',
    description: 'Code snippets, use cases, demos'
  },
  page: {
    label: 'Page',
    tintLevel: 'medium',
    borderStyle: 'dashed',
    description: 'Website page specification'
  },
  component: {
    label: 'Component',
    tintLevel: 'medium',
    borderStyle: 'dashed',
    description: 'UI component specification'
  },
  'content-model': {
    label: 'Content Model',
    tintLevel: 'medium',
    borderStyle: 'dashed',
    description: 'CMS content type definition'
  },

  // Default/low priority: 20% opacity
  general: {
    label: 'General',
    tintLevel: 'light',
    borderStyle: 'dotted',
    description: 'General notes, meeting notes, scratch'
  },
  background: {
    label: 'Background',
    tintLevel: 'light',
    borderStyle: 'dotted',
    description: 'Context, research, background information'
  },

  // WP Config: Special case (20% like general)
  'wp-config': {
    label: 'WP Config',
    tintLevel: 'light',
    borderStyle: 'dotted',
    description: 'WordPress configuration settings'
  }
}

/**
 * Direct opacity map for NoteNode modes (from spec)
 *
 * Values are exact percentages that will be applied to color-mix()
 * Pattern: background: color-mix(in srgb, ${nodeColor} ${opacity}%, transparent)
 */
const NOTE_MODE_OPACITY_MAP: Record<NoteMode, number> = {
  'general': 20,
  'persona': 35,
  'instruction': 35,
  'reference': 28,
  'examples': 28,
  'background': 20,
  'design-tokens': 30,
  'page': 28,
  'component': 28,
  'content-model': 28,
  'wp-config': 20
}

/**
 * Base opacity values for each tint level (percentages)
 *
 * For use when mode-specific opacity isn't defined
 * - Light: 20% - Default/low priority
 * - Medium: 28% - Scoped content
 * - Heavy: 35% - High importance
 */
const TINT_OPACITY_MAP: Record<TintLevel, number> = {
  light: 20,    // 20% opacity
  medium: 28,   // 28% opacity (+8% delta)
  heavy: 35     // 35% opacity (+7% delta)
}

/**
 * Intensity multipliers for user preference
 *
 * - Subtle (70%): For users who want less contrast
 * - Normal (100%): Default, validated by user study
 * - Strong (130%): For users who want more contrast (Riley's request)
 */
const INTENSITY_MULTIPLIERS: Record<TintIntensity, number> = {
  subtle: 0.7,   // 70% of base opacity
  normal: 1.0,   // 100% of base opacity (default)
  strong: 1.3    // 130% of base opacity
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Get mode configuration for a note mode
 *
 * @param mode - The note mode
 * @returns Mode configuration (label, tint level, border style, description)
 *
 * @example
 * const config = getModeConfig('persona')
 * // { label: 'Persona', tintLevel: 'heavy', borderStyle: 'solid', ... }
 */
export function getModeConfig(mode: NoteMode | undefined): ModeConfig {
  if (!mode) {
    return NOTE_MODE_CONFIG.general // Default to general
  }

  const config = NOTE_MODE_CONFIG[mode]
  if (!config) {
    console.warn(`Unknown note mode: ${mode}, falling back to general`)
    return NOTE_MODE_CONFIG.general
  }

  return config
}

/**
 * Get tint opacity percentage for a mode
 *
 * @param mode - The note mode
 * @param intensity - Tint intensity (subtle/normal/strong), default 'normal'
 * @param theme - Current theme for dark mode adjustment, default 'light'
 * @returns Opacity percentage (0-100)
 *
 * @example
 * getTintOpacity('persona') // 35 (high importance)
 * getTintOpacity('persona', 'subtle') // 24 (35 * 0.7)
 * getTintOpacity('persona', 'strong') // 46 (35 * 1.3)
 */
export function getTintOpacity(
  mode: NoteMode | undefined,
  intensity: TintIntensity = 'normal',
  theme: 'light' | 'dark' = 'light'
): number {
  // Use direct opacity map for NoteNode modes (exact values from spec)
  const baseOpacity = mode ? (NOTE_MODE_OPACITY_MAP[mode] ?? TINT_OPACITY_MAP[getModeConfig(mode).tintLevel]) : TINT_OPACITY_MAP.light
  const intensityMultiplier = INTENSITY_MULTIPLIERS[intensity]

  // Apply intensity multiplier
  let opacity = baseOpacity * intensityMultiplier

  // Dark theme compensation: Reduce node color opacity for better text contrast
  // Less bright node color + more dark background = darker backgrounds, better readability
  if (theme === 'dark') {
    opacity *= 0.5  // Reduce by 50% for consistency (e.g., 20% → 10%, 35% → 17.5%)
  }

  // Clamp to valid range [0, 100]
  return Math.min(100, Math.max(0, Math.round(opacity)))
}

/**
 * Get border style for a mode (accessibility redundancy layer)
 *
 * @param mode - The note mode
 * @returns CSS border style value
 *
 * @example
 * getBorderStyle('persona') // 'solid'
 * getBorderStyle('reference') // 'dashed'
 * getBorderStyle('general') // 'dotted'
 */
export function getBorderStyle(mode: NoteMode | undefined): BorderStyleType {
  const config = getModeConfig(mode)
  return config.borderStyle
}

/**
 * Get border width for a mode (heavier modes = thicker borders)
 *
 * @param mode - The note mode
 * @returns Border width in pixels
 *
 * @example
 * getBorderWidth('persona') // 2 (heavy)
 * getBorderWidth('reference') // 1.5 (medium)
 * getBorderWidth('general') // 1 (light)
 */
export function getBorderWidth(mode: NoteMode | undefined): number {
  const config = getModeConfig(mode)

  switch (config.tintLevel) {
    case 'heavy':
      return 2
    case 'medium':
      return 1.5
    case 'light':
      return 1
    default:
      return 1
  }
}

/**
 * Get complete CSS background style for a mode
 *
 * Uses CSS color-mix() for proper theme integration
 *
 * @param mode - The note mode
 * @param nodeColor - The node's base color (CSS custom property or color value)
 * @param intensity - Tint intensity (subtle/normal/strong), default 'normal'
 * @param theme - Current theme for dark mode adjustment, default 'light'
 * @returns CSS background value
 *
 * @example
 * getModeTintBackground('persona', 'var(--node-color)')
 * // "color-mix(in srgb, var(--node-color) 40%, transparent)"
 *
 * getModeTintBackground('general', '#6366F1', 'subtle')
 * // "color-mix(in srgb, #6366F1 10%, transparent)"
 */
export function getModeTintBackground(
  mode: NoteMode | undefined,
  nodeColor: string,
  intensity: TintIntensity = 'normal',
  theme: 'light' | 'dark' = 'light'
): string {
  const opacity = getTintOpacity(mode, intensity, theme)
  return `color-mix(in srgb, ${nodeColor} ${opacity}%, transparent)`
}

/**
 * Get complete node style object for React components
 *
 * @param mode - The note mode
 * @param nodeColor - The node's base color
 * @param intensity - Tint intensity, default 'normal'
 * @param theme - Current theme, default 'light'
 * @returns Style object with background, border-style, border-width, transition
 *
 * @example
 * const nodeStyle = getNodeModeStyle('persona', 'var(--node-color)')
 * <div style={nodeStyle}>...</div>
 */
export function getNodeModeStyle(
  mode: NoteMode | undefined,
  nodeColor: string,
  intensity: TintIntensity = 'normal',
  theme: 'light' | 'dark' = 'light'
): React.CSSProperties {
  return {
    background: getModeTintBackground(mode, nodeColor, intensity, theme),
    borderStyle: getBorderStyle(mode),
    borderWidth: `${getBorderWidth(mode)}px`,
    transition: 'background 200ms ease-in-out, border-style 200ms ease-in-out'
  }
}

// -----------------------------------------------------------------------------
// Utilities
// -----------------------------------------------------------------------------

/**
 * Get all mode options for dropdowns
 *
 * @returns Array of mode configurations suitable for dropdown rendering
 */
export function getAllModeOptions(): Array<ModeConfig & { value: NoteMode }> {
  return (Object.keys(NOTE_MODE_CONFIG) as NoteMode[]).map(mode => ({
    value: mode,
    ...NOTE_MODE_CONFIG[mode]
  }))
}

/**
 * Group modes by tint level (for UI organization)
 *
 * @returns Modes grouped by tint level
 */
export function getModesByTintLevel(): Record<TintLevel, NoteMode[]> {
  const grouped: Record<TintLevel, NoteMode[]> = {
    heavy: [],
    medium: [],
    light: []
  }

  for (const [mode, config] of Object.entries(NOTE_MODE_CONFIG)) {
    grouped[config.tintLevel].push(mode as NoteMode)
  }

  return grouped
}
