// =============================================================================
// edges.ts -- Edge system types
//
// Contains: EdgeData, EdgeStrength, EdgeStyle, presets, migration helpers,
// label presets. No cross-module dependencies.
// =============================================================================

// -----------------------------------------------------------------------------
// Edge Style (moved from theme section -- logically an edge concept)
// -----------------------------------------------------------------------------

// Edge style options for theming (industry standard: 4 core types)
// - straight: Direct line segments (no curves)
// - smooth: Bezier curves (flowing, organic)
// - sharp: Orthogonal 90° turns (circuit board style)
// - rounded: Orthogonal with rounded corners (modern diagram style)
export type EdgeStyle = 'straight' | 'smooth' | 'sharp' | 'rounded'

// -----------------------------------------------------------------------------
// Edge Data Types
// -----------------------------------------------------------------------------

// Edge line style options
export type EdgeLineStyle = 'solid' | 'dashed' | 'dotted' | 'animated'

// Edge arrow/marker style options
export type EdgeArrowStyle = 'filled' | 'outline' | 'none' | 'dot' | 'diamond'

// Edge stroke thickness presets
export type EdgeStrokePreset = 'thin' | 'normal' | 'bold' | 'heavy'

// Waypoint for multi-point edge routing
export interface EdgeWaypoint {
  x: number // Absolute X position
  y: number // Absolute Y position
}

/**
 * Edge strength levels for context injection priority
 * - light: Low priority, depth 1, thin/dashed visual
 * - normal: Medium priority, depth 2, standard visual
 * - strong: High priority, depth 3, thick/prominent visual
 */
export type EdgeStrength = 'light' | 'normal' | 'strong'

export interface EdgeData {
  // Direction control
  direction: 'unidirectional' | 'bidirectional'

  // Metadata
  label?: string // "provides context", "related to", "child of"
  labelBold?: boolean // Bold text styling for label
  labelItalic?: boolean // Italic text styling for label

  // NEW: Simplified strength (replaces weight)
  strength?: EdgeStrength

  /**
   * @deprecated Use strength instead. Was 1-10 scale, now migrated to 'light' | 'normal' | 'strong'
   */
  weight?: number

  // State
  active: boolean // toggle without deleting

  // Visual
  color?: string // hex color for differentiation

  // Z-index control for edges within projects
  intraProject?: boolean // true when source and target share same parentId

  // Multi-waypoint routing - absolute positions for path control points
  // When set, edge path passes through these points in order
  waypoints?: EdgeWaypoint[]

  // Per-edge style override (overrides global theme setting)
  edgeStyle?: EdgeStyle

  // Line decoration style
  lineStyle?: EdgeLineStyle

  // Stroke thickness preset
  strokePreset?: EdgeStrokePreset

  // Arrow/marker style at endpoints
  arrowStyle?: EdgeArrowStyle

  // DEPRECATED: Use waypoints instead. Kept for backwards compatibility.
  // Will be auto-migrated to waypoints[0] relative to midpoint on load.
  centerOffset?: { x: number; y: number }

  // Index signature for React Flow compatibility
  [key: string]: unknown
}

export const DEFAULT_EDGE_DATA: EdgeData = {
  direction: 'unidirectional',
  strength: 'normal',
  active: true,
  label: undefined,
  color: undefined,
  waypoints: undefined,
  edgeStyle: undefined,
  lineStyle: 'solid',
  strokePreset: 'normal',
  arrowStyle: 'filled'
}

/**
 * Migrate legacy weight-based edges to strength-based edges
 * Maps 1-10 weight scale to 'light' | 'normal' | 'strong'
 *
 * @param edgeData - Edge data possibly containing legacy weight
 * @returns Edge data with strength field set
 */
export function migrateEdgeStrength(edgeData: EdgeData): EdgeData {
  // Already migrated
  if (edgeData.strength) return edgeData

  // Map legacy weight (1-10) to strength
  const weight = edgeData.weight ?? 5
  let strength: EdgeStrength

  if (weight <= 3) {
    strength = 'light'
  } else if (weight >= 8) {
    strength = 'strong'
  } else {
    strength = 'normal'
  }

  return {
    ...edgeData,
    strength
  }
}

/**
 * Get context depth from edge strength
 * Used by context builder to determine how deep to traverse
 */
export function getContextDepthFromStrength(strength: EdgeStrength | undefined): number {
  switch (strength) {
    case 'light':
      return 1
    case 'strong':
      return 3
    case 'normal':
    default:
      return 2
  }
}

export const EDGE_LABEL_PRESETS = [
  'provides context',
  'related to',
  'child of',
  'references',
  'continues from',
  'alternative to',
  'depends on',
  'extracted',
  'spawned'
] as const

export type EdgeLabelPreset = (typeof EDGE_LABEL_PRESETS)[number]
