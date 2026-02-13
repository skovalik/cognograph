// =============================================================================
// glass.ts -- Glassmorphism settings and types
//
// Contains: GlassStyle type, GlassSettings interface, defaults
// Used for three-tier GPU-accelerated glassmorphism UI
// =============================================================================

/**
 * Glass style tiers for glassmorphism UI
 * - solid: No glass effect, opaque backgrounds (low GPU / reduced motion)
 * - soft-blur: CSS backdrop-filter only, no GPU effects (medium GPU)
 * - fluid-glass: Full GPU-accelerated glass with shimmer (high GPU)
 * - auto: Automatically select based on GPU tier and ambient canvas state
 */
export type GlassStyle = 'solid' | 'soft-blur' | 'fluid-glass' | 'auto'

/**
 * Where to apply glass effects (per theme)
 */
export interface GlassApplyTo {
  nodes: boolean
  modals: boolean
  panels: boolean
  overlays: boolean
  toolbar: boolean
}

/**
 * Glass settings stored per theme
 */
export interface GlassSettings {
  /** User's preference (can be 'auto' for automatic) */
  userPreference: GlassStyle
  /** Resolved effective style (never 'auto', set by glassUtils) */
  effectiveStyle: 'solid' | 'soft-blur' | 'fluid-glass'
  /** Blur radius in pixels (8-20) */
  blurRadius: number
  /** Panel background opacity percentage (70-100) */
  panelOpacity: number
  /** Noise texture opacity percentage (0-20, only for fluid-glass) */
  noiseOpacity: number
  /** Shimmer animation speed multiplier (0.5-2.0, only for fluid-glass) */
  shimmerSpeed: number
  /** Keep text/content opaque when reducing panel opacity */
  opaqueContent: boolean
  /** Where to apply glass effects */
  applyTo: GlassApplyTo
}

/**
 * Default glass settings
 * Auto mode will detect GPU tier and choose appropriate style
 */
export const DEFAULT_GLASS_SETTINGS: GlassSettings = {
  userPreference: 'auto',
  effectiveStyle: 'soft-blur', // Safe default until GPU detected
  blurRadius: 12,
  panelOpacity: 85,
  noiseOpacity: 5,
  shimmerSpeed: 1.0,
  opaqueContent: true, // Keep text opaque by default (better readability)
  applyTo: {
    nodes: true, // Glass on nodes by default
    modals: true, // Glass on modals by default
    panels: true, // Glass on panels by default
    overlays: false, // Disabled (too busy)
    toolbar: false // Disabled (prefer solid toolbar)
  }
}

/**
 * Data attribute constants for type safety
 */
export const GLASS_DATA_ATTRS = {
  STYLE: 'data-glass-style',
  NODES: 'data-glass-nodes',
  MODALS: 'data-glass-modals',
  PANELS: 'data-glass-panels',
  OVERLAYS: 'data-glass-overlays',
  TOOLBAR: 'data-glass-toolbar'
} as const
