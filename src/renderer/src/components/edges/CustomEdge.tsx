import { memo, useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { EdgeLabelRenderer, getSmoothStepPath, getBezierPath, getStraightPath, useStore } from '@xyflow/react'
import type { Position } from '@xyflow/react'
import type { EdgeData, EdgeStyle, EdgeWaypoint, EdgeLineStyle, EdgeArrowStyle, EdgeStrokePreset, EdgeStrength } from '@shared/types'
import { DEFAULT_EDGE_DATA, DEFAULT_LINK_COLORS_DARK } from '@shared/types'
import { useIsStreaming, useWorkspaceStore } from '../../stores/workspaceStore'
import { useContextMenuStore } from '../../stores/contextMenuStore'
import { useBridgeStore } from '../../stores/bridgeStore'
import { toast } from 'react-hot-toast'
import { Plus, MapPin, Trash2 } from 'lucide-react'
import { FormattedText } from '../FormattedText'

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum number of waypoints per edge to prevent performance issues */
const MAX_WAYPOINTS = 20

/** Grid size for snap-to-grid feature (in pixels) */
const SNAP_GRID_SIZE = 20

/** Fallback node type colors — used when themeSettings.nodeColors is empty/corrupted */
const NODE_TYPE_COLORS: Record<string, string> = {
  conversation: '#3b82f6', project: '#8b5cf6', note: '#f59e0b', task: '#10b981',
  artifact: '#06b6d4', workspace: '#ef4444', text: '#94a3b8', action: '#f97316',
  orchestrator: '#8b5cf6'
}

/** Minimum distance from cursor to path for ghost point to show */
const GHOST_POINT_MAX_DISTANCE = 30

/** Minimum distance from ghost point to existing waypoints/endpoints */
const GHOST_POINT_COLLISION_DISTANCE = 20

/** Minimum edge length to show ghost point */
const MIN_EDGE_LENGTH_FOR_GHOST = 50

/** Debounce time for rapid clicks (ms) */
const CLICK_DEBOUNCE_MS = 200

// =============================================================================
// TYPES
// =============================================================================

interface CustomEdgeProps {
  id: string
  source: string
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  sourcePosition: Position
  targetPosition: Position
  target: string
  data?: EdgeData
  selected?: boolean
}

interface Point {
  x: number
  y: number
}

// =============================================================================
// PATH CALCULATION UTILITIES
// =============================================================================

/**
 * Calculate distance between two points
 */
function distance(p1: Point, p2: Point): number {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2)
}

/**
 * Get point on line at given distance from start
 */
function pointOnLine(start: Point, end: Point, dist: number): Point {
  const d = distance(start, end)
  if (d === 0) return start
  const t = dist / d
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t
  }
}

/**
 * Catmull-Rom spline path through points
 * Creates a smooth curve that passes through all control points
 * @param tension - Lower = more curve, Higher = tighter to control points
 */
function catmullRomPath(points: Point[], tension: number = 6): string {
  if (points.length < 2) return ''
  if (points.length === 2) {
    // Safe: length check ensures indices 0 and 1 exist
    return `M ${points[0]!.x} ${points[0]!.y} L ${points[1]!.x} ${points[1]!.y}`
  }

  // Duplicate first and last points for tangent calculation at endpoints
  // Safe: points.length >= 3 here, so indices 0 and length-1 exist
  const pts = [points[0]!, ...points, points[points.length - 1]!]
  let path = `M ${pts[1]!.x} ${pts[1]!.y}`

  for (let i = 1; i < pts.length - 2; i++) {
    // Safe: loop bounds guarantee i-1, i, i+1, i+2 are all valid indices
    const p0 = pts[i - 1]!
    const p1 = pts[i]!
    const p2 = pts[i + 1]!
    const p3 = pts[i + 2]!

    // Calculate control points for cubic bezier approximation
    // Using Catmull-Rom to Bezier conversion
    const cp1x = p1.x + (p2.x - p0.x) / tension
    const cp1y = p1.y + (p2.y - p0.y) / tension
    const cp2x = p2.x - (p3.x - p1.x) / tension
    const cp2y = p2.y - (p3.y - p1.y) / tension

    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
  }

  return path
}


/**
 * Rounded corner path through waypoints
 * Creates a polyline with smooth rounded corners
 * @param radiusRatio - Corner radius as percentage of shorter adjacent segment (0-0.5)
 *   - 0.1 = 10% of segment length (subtle rounding)
 *   - 0.3 = 30% of segment length (medium rounding)
 *   - 0.45 = 45% of segment length (large, flowing corners)
 */
function roundedCornerPath(points: Point[], radiusRatio: number = 0.3): string {
  if (points.length < 2) return ''
  if (points.length === 2) {
    // Safe: length check ensures indices exist
    return `M ${points[0]!.x} ${points[0]!.y} L ${points[1]!.x} ${points[1]!.y}`
  }

  let path = `M ${points[0]!.x} ${points[0]!.y}`

  for (let i = 1; i < points.length - 1; i++) {
    // Safe: loop bounds guarantee these indices are valid
    const prev = points[i - 1]!
    const curr = points[i]!
    const next = points[i + 1]!

    const d1 = distance(prev, curr)
    const d2 = distance(curr, next)

    // Radius is percentage of the shorter adjacent segment
    const minSegment = Math.min(d1, d2)
    const r = minSegment * Math.min(radiusRatio, 0.45) // Cap at 45% to leave some straight

    if (r <= 2) {
      path += ` L ${curr.x} ${curr.y}`
      continue
    }

    // Calculate corner start and end points
    const cornerStart = pointOnLine(curr, prev, r)
    const cornerEnd = pointOnLine(curr, next, r)

    path += ` L ${cornerStart.x} ${cornerStart.y}`
    path += ` Q ${curr.x} ${curr.y} ${cornerEnd.x} ${cornerEnd.y}`
  }

  // Safe: points.length >= 3 at this point
  const lastPoint = points[points.length - 1]!
  path += ` L ${lastPoint.x} ${lastPoint.y}`
  return path
}



/**
 * Sharp corner path (no radius) - straight lines between points
 */
function sharpCornerPath(points: Point[]): string {
  if (points.length < 2) return ''
  // Safe: length check ensures index 0 exists
  let path = `M ${points[0]!.x} ${points[0]!.y}`
  for (let i = 1; i < points.length; i++) {
    // Safe: loop bounds guarantee index i is valid
    const pt = points[i]!
    path += ` L ${pt.x} ${pt.y}`
  }
  return path
}



/**
 * Snap value to grid
 */
function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize
}

/**
 * Find nearest point on SVG path to cursor position
 * Uses binary search for performance on complex paths
 */
function getNearestPointOnPath(
  pathElement: SVGPathElement,
  cursorX: number,
  cursorY: number
): { x: number; y: number; distance: number } | null {
  try {
    const pathLength = pathElement.getTotalLength()
    if (pathLength === 0) return null

    const SAMPLES = 25 // Initial coarse sampling
    const PRECISION = 4 // Pixels - refinement threshold

    let bestPoint = { x: 0, y: 0 }
    let bestDistance = Infinity
    let bestT = 0

    // Coarse pass: sample path at intervals
    for (let i = 0; i <= SAMPLES; i++) {
      const t = (i / SAMPLES) * pathLength
      const point = pathElement.getPointAtLength(t)
      const dist = Math.hypot(point.x - cursorX, point.y - cursorY)
      if (dist < bestDistance) {
        bestDistance = dist
        bestPoint = { x: point.x, y: point.y }
        bestT = t
      }
    }

    // Fine pass: binary search around best point
    let low = Math.max(0, bestT - pathLength / SAMPLES)
    let high = Math.min(pathLength, bestT + pathLength / SAMPLES)

    while (high - low > PRECISION) {
      const mid1 = low + (high - low) / 3
      const mid2 = high - (high - low) / 3
      const p1 = pathElement.getPointAtLength(mid1)
      const p2 = pathElement.getPointAtLength(mid2)
      const d1 = Math.hypot(p1.x - cursorX, p1.y - cursorY)
      const d2 = Math.hypot(p2.x - cursorX, p2.y - cursorY)

      if (d1 < d2) {
        high = mid2
        if (d1 < bestDistance) {
          bestDistance = d1
          bestPoint = { x: p1.x, y: p1.y }
        }
      } else {
        low = mid1
        if (d2 < bestDistance) {
          bestDistance = d2
          bestPoint = { x: p2.x, y: p2.y }
        }
      }
    }

    return { ...bestPoint, distance: bestDistance }
  } catch {
    return null
  }
}

/**
 * Check if a point is too close to any existing waypoints or endpoints
 */
function isNearExistingPoints(
  point: Point,
  waypoints: EdgeWaypoint[] | undefined,
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  threshold: number
): boolean {
  // Check source
  if (distance(point, { x: sourceX, y: sourceY }) < threshold) return true
  // Check target
  if (distance(point, { x: targetX, y: targetY }) < threshold) return true
  // Check waypoints
  if (waypoints) {
    for (const wp of waypoints) {
      if (distance(point, wp) < threshold) return true
    }
  }
  return false
}

/**
 * Get the label position (midpoint of path)
 */
function getLabelPosition(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 }
  // Safe: length check ensures index 0 exists
  if (points.length === 1) return points[0]!

  // Calculate total path length
  let totalLen = 0
  for (let i = 1; i < points.length; i++) {
    // Safe: loop bounds guarantee indices are valid
    totalLen += distance(points[i - 1]!, points[i]!)
  }

  // Find midpoint
  const targetLen = totalLen / 2
  let accLen = 0

  for (let i = 1; i < points.length; i++) {
    // Safe: loop bounds guarantee indices are valid
    const prev = points[i - 1]!
    const curr = points[i]!
    const segLen = distance(prev, curr)
    if (accLen + segLen >= targetLen) {
      const t = (targetLen - accLen) / segLen
      return {
        x: prev.x + (curr.x - prev.x) * t,
        y: prev.y + (curr.y - prev.y) * t
      }
    }
    accLen += segLen
  }

  // Safe: points.length >= 2 at this point
  return points[points.length - 1]!
}

// =============================================================================
// MAIN PATH GENERATOR
// =============================================================================

interface PathParams {
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  sourcePosition: Position
  targetPosition: Position
  waypoints?: EdgeWaypoint[]
  // Legacy support
  centerOffset?: { x: number; y: number }
}

/**
 * Generate edge path based on style and waypoints
 * Returns [path, labelX, labelY, allPoints]
 */
function getEdgePath(
  style: EdgeStyle,
  params: PathParams
): [string, number, number, Point[]] {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, waypoints, centerOffset } = params

  const source: Point = { x: sourceX, y: sourceY }
  const target: Point = { x: targetX, y: targetY }

  // Build points array: source -> waypoints -> target
  let points: Point[] = [source]

  if (waypoints && waypoints.length > 0) {
    // Filter out any invalid waypoints (NaN or Infinity)
    const validWaypoints = waypoints.filter(wp =>
      Number.isFinite(wp.x) && Number.isFinite(wp.y)
    )
    points.push(...validWaypoints)
  } else if (centerOffset && (Math.abs(centerOffset.x) > 5 || Math.abs(centerOffset.y) > 5)) {
    // Legacy: Convert centerOffset to a single waypoint at midpoint + offset
    const midX = (sourceX + targetX) / 2
    const midY = (sourceY + targetY) / 2
    points.push({ x: midX + centerOffset.x, y: midY + centerOffset.y })
  }

  points.push(target)

  const hasWaypoints = points.length > 2
  const labelPos = getLabelPosition(points)

  // ==========================================================================
  // WITHOUT WAYPOINTS: Use React Flow's battle-tested built-in functions
  // ==========================================================================
  if (!hasWaypoints) {
    switch (style) {
      case 'straight': {
        // Direct line between points
        const [path, lx, ly] = getStraightPath({ sourceX, sourceY, targetX, targetY })
        return [path, lx, ly, points]
      }

      case 'smooth': {
        // Smooth bezier curve - React Flow's getBezierPath is the industry standard
        const [path, lx, ly] = getBezierPath({
          sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition
        })
        return [path, lx, ly, points]
      }

      case 'sharp': {
        // Orthogonal 90° turns - circuit board style
        const [path, lx, ly] = getSmoothStepPath({
          sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
          borderRadius: 0
        })
        return [path, lx, ly, points]
      }

      case 'rounded':
      default: {
        // Orthogonal with rounded corners - modern diagram style (like Figma)
        const [path, lx, ly] = getSmoothStepPath({
          sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
          borderRadius: 20
        })
        return [path, lx, ly, points]
      }
    }
  }

  // ==========================================================================
  // WITH WAYPOINTS: Custom path generation through control points
  // ==========================================================================
  let path: string

  switch (style) {
    case 'straight':
      // Direct line segments between all points - no curves
      path = sharpCornerPath(points)
      break

    case 'smooth':
      // Smooth bezier spline through all waypoints using Catmull-Rom
      // Tension of 6 provides smooth curves that pass through control points
      path = catmullRomPath(points, 6)
      break

    case 'sharp':
      // Sharp corners at waypoints - no rounding
      path = sharpCornerPath(points)
      break

    case 'rounded':
    default:
      // Rounded corners at waypoints (30% of segment length for balanced rounding)
      path = roundedCornerPath(points, 0.3)
      break
  }

  return [path, labelPos.x, labelPos.y, points]
}

// =============================================================================
// STROKE DASHARRAY HELPERS
// =============================================================================

function getStrokeDasharray(lineStyle: EdgeLineStyle | undefined, isInactive: boolean): string | undefined {
  if (isInactive) return '5,5'

  switch (lineStyle) {
    case 'dashed':
      return '8,4'
    case 'dotted':
      return '2,4'
    case 'animated':
      return '8,4' // CSS animation handles the flow
    case 'solid':
    default:
      return undefined
  }
}

// =============================================================================
// STROKE WIDTH HELPERS
// =============================================================================

function getPresetMultiplier(strokePreset: EdgeStrokePreset | undefined): number {
  return { thin: 0.6, normal: 1, bold: 1.5, heavy: 2 }[strokePreset || 'normal']
}

function getBaseStrokeWidth(weight: number, strokePreset: EdgeStrokePreset | undefined): number {
  // Weight affects final width: 1-10 scale
  const weightFactor = 0.5 + (weight * 0.35)
  return weightFactor * getPresetMultiplier(strokePreset)
}

/**
 * Get visual properties from edge strength
 * Returns stroke width, dash pattern, and opacity based on strength level
 */
function getStrengthVisuals(strength: EdgeStrength | undefined): {
  strokeWidth: number
  dashArray: string | undefined
  opacity: number
} {
  switch (strength) {
    case 'light':
      return {
        strokeWidth: 1.5,
        dashArray: '6,4',
        opacity: 0.7
      }
    case 'strong':
      return {
        strokeWidth: 4,
        dashArray: undefined,
        opacity: 1
      }
    case 'normal':
    default:
      return {
        strokeWidth: 2.5,
        dashArray: undefined,
        opacity: 0.9
      }
  }
}

// =============================================================================
// ARROW MARKER PATHS
// =============================================================================

function getArrowPath(arrowStyle: EdgeArrowStyle | undefined, isStart: boolean): string {
  switch (arrowStyle) {
    case 'outline':
      return isStart
        ? 'M 8 1 L 2 5 L 8 9'  // Chevron pointing left
        : 'M 2 1 L 8 5 L 2 9'  // Chevron pointing right
    case 'dot':
      return 'M 5 5 m -3 0 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0' // Circle
    case 'diamond':
      return isStart
        ? 'M 1 5 L 5 1 L 9 5 L 5 9 Z'
        : 'M 1 5 L 5 1 L 9 5 L 5 9 Z'
    case 'none':
      return '' // No path
    case 'filled':
    default:
      return isStart
        ? 'M 10 0 L 0 5 L 10 10 z'
        : 'M 0 0 L 10 5 L 0 10 z'
  }
}

function getArrowFill(arrowStyle: EdgeArrowStyle | undefined, color: string, _opacity: number): string {
  if (arrowStyle === 'outline') return 'none'
  if (arrowStyle === 'none') return 'none'
  return color
}

function getArrowStroke(arrowStyle: EdgeArrowStyle | undefined, color: string): string | undefined {
  if (arrowStyle === 'outline') return color
  return undefined
}

function getArrowStrokeWidth(arrowStyle: EdgeArrowStyle | undefined): number {
  if (arrowStyle === 'outline') return 1.5
  return 0
}

// =============================================================================
// CUSTOM EDGE COMPONENT
// =============================================================================

function CustomEdgeComponent({
  id,
  source,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  target,
  data,
  selected
}: CustomEdgeProps): JSX.Element {
  const edgeData = data || DEFAULT_EDGE_DATA
  const isInactive = edgeData.active === false
  const isBidirectional = edgeData.direction === 'bidirectional'
  const isWorkspaceLink = (edgeData as { isWorkspaceLink?: boolean }).isWorkspaceLink === true

  // Store subscriptions
  const zoom = useStore((s) => s.transform[2])
  const globalEdgeStyle = useWorkspaceStore((state) => state.themeSettings.edgeStyle) || 'rounded'
  const linkGradientEnabled = useWorkspaceStore((state) => state.themeSettings.linkGradientEnabled) ?? true
  const themeMode = useWorkspaceStore((state) => state.themeSettings.mode)
  const linkColors = useWorkspaceStore((state) => state.themeSettings.linkColors)
  const updateEdge = useWorkspaceStore((state) => state.updateEdge)
  const commitEdgeWaypointDrag = useWorkspaceStore((state) => state.commitEdgeWaypointDrag)
  const selectedEdgeIds = useWorkspaceStore((state) => state.selectedEdgeIds)
  const setSelectedEdges = useWorkspaceStore((state) => state.setSelectedEdges)
  const openContextMenu = useContextMenuStore((state) => state.open)

  // P3-4: Hide waypoint handles when multiple edges are selected (too cluttered)
  const isMultiEdgeSelection = selectedEdgeIds.length > 1

  // Use per-edge style if set, otherwise fall back to global
  const edgeStyle: EdgeStyle = edgeData.edgeStyle || globalEdgeStyle

  // Node colors for gradients (with defensive fallback to hardcoded defaults)
  // Return primitives to avoid new object references causing re-renders on every drag frame
  const sourceColor = useWorkspaceStore((state) => {
    const node = state.nodes.find(n => n.id === source)
    const nodeType = node?.data?.type || 'conversation'
    return node?.data?.color || state.themeSettings.nodeColors[nodeType] || NODE_TYPE_COLORS[nodeType] || '#64748b'
  })
  const targetColor = useWorkspaceStore((state) => {
    const node = state.nodes.find(n => n.id === target)
    const nodeType = node?.data?.type || 'conversation'
    return node?.data?.color || state.themeSettings.nodeColors[nodeType] || NODE_TYPE_COLORS[nodeType] || '#64748b'
  })

  // Node metadata for context flow indicators — return primitives, not objects
  const sourceNodeType = useWorkspaceStore((state) => {
    const node = state.nodes.find(n => n.id === source)
    return node?.data?.type ?? null
  })
  const sourceNodeTitle = useWorkspaceStore((state) => {
    const node = state.nodes.find(n => n.id === source)
    return node?.data?.title || 'Untitled'
  })
  const targetNodeType = useWorkspaceStore((state) => {
    const node = state.nodes.find(n => n.id === target)
    return node?.data?.type ?? null
  })
  const targetNodeTitle = useWorkspaceStore((state) => {
    const node = state.nodes.find(n => n.id === target)
    return node?.data?.title || 'Untitled'
  })
  const sourceNodeInfo = sourceNodeType != null ? { type: sourceNodeType, title: sourceNodeTitle } : null
  const targetNodeInfo = targetNodeType != null ? { type: targetNodeType, title: targetNodeTitle } : null

  // Determine if this edge carries context (inbound to conversation, or bidirectional)
  const isContextEdge = useMemo(() => {
    if (isInactive || isWorkspaceLink) return false
    const targetIsConversation = targetNodeInfo?.type === 'conversation'
    const sourceIsConversation = sourceNodeInfo?.type === 'conversation'
    // Inbound: any node → conversation
    if (targetIsConversation) return true
    // Bidirectional: conversation ↔ any node
    if (sourceIsConversation && isBidirectional) return true
    return false
  }, [isInactive, isWorkspaceLink, targetNodeInfo?.type, sourceNodeInfo?.type, isBidirectional])

  // Context provider glow: is this edge's target conversation currently selected?
  const isContextProviderHighlighted = useWorkspaceStore((state) => {
    if (!isContextEdge) return false
    const selectedIds = state.selectedNodeIds
    if (selectedIds.length !== 1) return false
    const selectedId = selectedIds[0]
    const selectedNode = state.nodes.find(n => n.id === selectedId)
    if (!selectedNode || selectedNode.data?.type !== 'conversation') return false
    // Highlight if this edge targets the selected conversation
    return target === selectedId || (source === selectedId && isBidirectional)
  })

  // Interaction state
  const [isDragging, setIsDragging] = useState(false)
  const [draggedWaypointIndex, setDraggedWaypointIndex] = useState<number | null>(null)
  const [isHovering, setIsHovering] = useState(false)
  const [hoveredWaypointIndex, setHoveredWaypointIndex] = useState<number | null>(null)
  const [selectedWaypointIndex, setSelectedWaypointIndex] = useState<number | null>(null)
  const dragStartRef = useRef<{ x: number; y: number; waypoint: Point } | null>(null)
  // Store initial waypoints at drag start for proper undo batching
  const initialWaypointsRef = useRef<EdgeWaypoint[] | undefined>(undefined)

  // Ghost point state (P0-1)
  const [ghostPoint, setGhostPoint] = useState<Point | null>(null)
  const [ghostPointVisible, setGhostPointVisible] = useState(false)
  const pathRef = useRef<SVGPathElement>(null)
  const lastClickTimeRef = useRef<number>(0)

  // Modifier key visualization state (P2-1, P2-2)
  const [isShiftHeld, setIsShiftHeld] = useState(false)
  const [isCtrlHeld, setIsCtrlHeld] = useState(false)
  const [axisLockDirection, setAxisLockDirection] = useState<'horizontal' | 'vertical' | null>(null)

  // Modifier hints state (P2-3) - show hint on first drag, dismiss after learning
  const [showModifierHint, setShowModifierHint] = useState(false)
  const modifierHintShownRef = useRef(false)
  const modifierUseCountRef = useRef({ shift: 0, ctrl: 0 })

  // Bridge: animated edge detection (Phase 1)
  const isBridgeAnimated = useBridgeStore((state) => state.animatedEdgeIds.includes(id))
  const bridgeAnimationSpeed = useBridgeStore((state) => state.settings.animationSpeed)
  const showBridgeEdgeAnimations = useBridgeStore((state) => state.settings.showEdgeAnimations)

  // Streaming state
  const isTargetStreaming = useIsStreaming(target)
  const showContextFlow = isTargetStreaming && !isInactive
  const linkColor = (edgeData as { linkColor?: string }).linkColor

  // Colors - use theme linkColors based on edge state (fallback to defaults if not set)
  const effectiveLinkColors = linkColors || DEFAULT_LINK_COLORS_DARK
  const useGradient = linkGradientEnabled && !edgeData.color && !linkColor
  const themeLinkColor = selected
    ? effectiveLinkColors.selected
    : isInactive
      ? effectiveLinkColors.inactive
      : effectiveLinkColors.default
  const edgeColor = linkColor || edgeData.color || themeLinkColor
  const gradientId = `edge-gradient-${id}`
  const isIntraProject = edgeData.intraProject === true

  // Get waypoints (or legacy centerOffset)
  const waypoints = edgeData.waypoints
  const centerOffset = edgeData.centerOffset

  // Calculate stroke width - prefer strength over legacy weight
  const strengthVisuals = getStrengthVisuals(edgeData.strength)
  const hasStrength = edgeData.strength !== undefined

  // Use strength-based width if available, otherwise fall back to weight-based
  // Strength provides the base; strokePreset multiplies it (thin=0.6x, bold=1.5x, heavy=2x)
  const baseStrokeWidth = hasStrength
    ? strengthVisuals.strokeWidth * getPresetMultiplier(edgeData.strokePreset)
    : getBaseStrokeWidth(edgeData.weight ?? 5, edgeData.strokePreset)

  const weightedStroke = isWorkspaceLink
    ? Math.max(1, baseStrokeWidth * 0.75)
    : isContextProviderHighlighted
      ? baseStrokeWidth + 0.75
      : selected
        ? baseStrokeWidth + 0.5
        : isHovering
          ? baseStrokeWidth + 0.25
          : baseStrokeWidth

  const zoomFactor = 1 / Math.max(zoom, 0.3)
  const strokeWidth = weightedStroke * Math.min(zoomFactor, 3)
  // Arrow size proportional to stroke width (not independent zoom scaling)
  // This keeps arrows visually balanced with the edge thickness
  const markerSize = Math.max(4, Math.min(12, strokeWidth * 2.5))

  // Line style
  const lineStyle = edgeData.lineStyle || 'solid'
  const arrowStyle = edgeData.arrowStyle || 'filled'

  // Calculate path and get all points
  const [edgePath, labelX, labelY, _allPoints] = useMemo(() =>
    getEdgePath(edgeStyle, {
      sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
      waypoints, centerOffset
    }),
    [edgeStyle, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, waypoints, centerOffset]
  )

  // Helper to check if legacy centerOffset is significant (memoized)
  const hasLegacyCenterOffset = useMemo(() =>
    centerOffset && (Math.abs(centerOffset.x) > 5 || Math.abs(centerOffset.y) > 5),
    [centerOffset]
  )

  // Waypoint indices (excluding source and target)
  const waypointIndices = useMemo(() => {
    if (!waypoints || waypoints.length === 0) {
      // Check for legacy centerOffset
      if (hasLegacyCenterOffset) {
        return [0] // Single virtual waypoint
      }
      return []
    }
    return waypoints.map((_, i) => i)
  }, [waypoints, hasLegacyCenterOffset])

  // Calculate segment midpoints for + buttons (P0-2)
  const segmentMidpoints = useMemo(() => {
    const points: Point[] = [{ x: sourceX, y: sourceY }]
    if (waypoints && waypoints.length > 0) {
      points.push(...waypoints)
    } else if (hasLegacyCenterOffset && centerOffset) {
      const midX = (sourceX + targetX) / 2
      const midY = (sourceY + targetY) / 2
      points.push({ x: midX + centerOffset.x, y: midY + centerOffset.y })
    }
    points.push({ x: targetX, y: targetY })

    // Calculate midpoint of each segment
    const midpoints: Point[] = []
    for (let i = 0; i < points.length - 1; i++) {
      // Safe: loop bounds guarantee indices are valid
      const p1 = points[i]!
      const p2 = points[i + 1]!
      midpoints.push({
        x: (p1.x + p2.x) / 2,
        y: (p1.y + p2.y) / 2
      })
    }
    return midpoints
  }, [sourceX, sourceY, targetX, targetY, waypoints, hasLegacyCenterOffset, centerOffset])

  // Calculate edge length for ghost point threshold
  const edgeLength = useMemo(() => {
    return distance({ x: sourceX, y: sourceY }, { x: targetX, y: targetY })
  }, [sourceX, sourceY, targetX, targetY])

  // Calculate handle scale once for all handles (non-linear inverse zoom scaling)
  // Uses power curve for smoother scaling: more visible at low zoom, reasonable at 1x
  const handleScale = Math.max(1, Math.min(2.5, Math.pow(1 / Math.max(zoom, 0.2), 0.6)))

  // Should show ghost point
  const canShowGhostPoint = !isWorkspaceLink && edgeLength >= MIN_EDGE_LENGTH_FOR_GHOST && (!waypoints || waypoints.length < MAX_WAYPOINTS)

  // ==========================================================================
  // WAYPOINT INTERACTION HANDLERS (with click vs drag detection)
  // ==========================================================================

  /** Threshold for distinguishing click from drag (in pixels) */
  const CLICK_VS_DRAG_THRESHOLD = 5
  /** Maximum time for a click (in ms) */
  const CLICK_MAX_TIME = 200

  /**
   * Unified pointer handler that distinguishes clicks from drags
   * - Click: mousedown + mouseup within 5px AND 200ms → select waypoint
   * - Drag: mouse moves >5px before mouseup → start drag behavior
   */
  const handleWaypointPointerDown = useCallback((e: React.MouseEvent, index: number) => {
    if (isWorkspaceLink) return
    e.stopPropagation()
    e.preventDefault()

    const startPos = { x: e.clientX, y: e.clientY }
    const startTime = Date.now()
    let hasDragged = false

    // Get current waypoint position for potential drag
    let currentWaypoint: Point
    if (waypoints && waypoints[index]) {
      currentWaypoint = { ...waypoints[index] }
    } else if (centerOffset) {
      const midX = (sourceX + targetX) / 2
      const midY = (sourceY + targetY) / 2
      currentWaypoint = { x: midX + centerOffset.x, y: midY + centerOffset.y }
    } else {
      return
    }

    // Store for drag calculations
    dragStartRef.current = {
      x: startPos.x,
      y: startPos.y,
      waypoint: currentWaypoint
    }

    const handleMouseMove = (moveEvent: MouseEvent): void => {
      if (!dragStartRef.current) return

      const dist = Math.hypot(moveEvent.clientX - startPos.x, moveEvent.clientY - startPos.y)

      // Check if we've crossed the drag threshold
      if (!hasDragged && dist > CLICK_VS_DRAG_THRESHOLD) {
        hasDragged = true
        setIsDragging(true)
        setDraggedWaypointIndex(index)

        // Store initial waypoints for undo batching
        initialWaypointsRef.current = waypoints ? [...waypoints] : undefined

        // Show modifier hint on first drag (P2-3) - unless user has learned
        const learnedModifiers = localStorage.getItem('edge-modifiers-learned') === 'true'
        if (!modifierHintShownRef.current && !learnedModifiers) {
          setShowModifierHint(true)
          modifierHintShownRef.current = true
          setTimeout(() => setShowModifierHint(false), 3000)
        }
      }

      // Only update position if we're actually dragging
      if (!hasDragged) return

      const deltaX = (moveEvent.clientX - dragStartRef.current.x) / zoom
      const deltaY = (moveEvent.clientY - dragStartRef.current.y) / zoom

      let newX = dragStartRef.current.waypoint.x + deltaX
      let newY = dragStartRef.current.waypoint.y + deltaY

      // Track modifier key states for visual feedback (P2-1, P2-2)
      setIsShiftHeld(moveEvent.shiftKey)
      setIsCtrlHeld(moveEvent.ctrlKey || moveEvent.metaKey)

      // Track modifier usage for hint dismissal (P2-3)
      if (moveEvent.shiftKey && modifierUseCountRef.current.shift < 3) {
        modifierUseCountRef.current.shift++
        setShowModifierHint(false)
      }
      if ((moveEvent.ctrlKey || moveEvent.metaKey) && modifierUseCountRef.current.ctrl < 3) {
        modifierUseCountRef.current.ctrl++
        setShowModifierHint(false)
      }
      if (modifierUseCountRef.current.shift >= 3 || modifierUseCountRef.current.ctrl >= 3) {
        localStorage.setItem('edge-modifiers-learned', 'true')
      }

      // Ctrl key constrains to horizontal or vertical axis
      if (moveEvent.ctrlKey || moveEvent.metaKey) {
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          newY = dragStartRef.current.waypoint.y
          setAxisLockDirection('horizontal')
        } else {
          newX = dragStartRef.current.waypoint.x
          setAxisLockDirection('vertical')
        }
      } else {
        setAxisLockDirection(null)
      }

      // Shift key enables grid snapping
      if (moveEvent.shiftKey) {
        newX = snapToGrid(newX, SNAP_GRID_SIZE)
        newY = snapToGrid(newY, SNAP_GRID_SIZE)
      }

      const newWaypoint: Point = { x: newX, y: newY }

      // Update during drag without creating history entries (batched at drag end)
      if (waypoints) {
        const newWaypoints = [...waypoints]
        newWaypoints[index] = newWaypoint
        updateEdge(id, { waypoints: newWaypoints }, { skipHistory: true })
      } else {
        const midX = (sourceX + targetX) / 2
        const midY = (sourceY + targetY) / 2
        updateEdge(id, {
          centerOffset: {
            x: newWaypoint.x - midX,
            y: newWaypoint.y - midY
          }
        }, { skipHistory: true })
      }
    }

    const handleMouseUp = (): void => {
      const elapsed = Date.now() - startTime

      // If we didn't drag and it was quick, treat as a click → select
      if (!hasDragged && elapsed < CLICK_MAX_TIME) {
        setSelectedWaypointIndex(index)
      }

      // Commit drag as single undo action (if we actually dragged)
      if (hasDragged) {
        // Get final waypoints state
        const finalWaypoints = waypoints ? [...waypoints] : undefined
        commitEdgeWaypointDrag(id, initialWaypointsRef.current, finalWaypoints)
        initialWaypointsRef.current = undefined
      }

      // Clean up drag state
      setIsDragging(false)
      setDraggedWaypointIndex(null)
      setIsShiftHeld(false)
      setIsCtrlHeld(false)
      setAxisLockDirection(null)
      dragStartRef.current = null

      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [id, waypoints, centerOffset, sourceX, sourceY, targetX, targetY, zoom, updateEdge, commitEdgeWaypointDrag, isWorkspaceLink])

  // Double-click waypoint to straighten edge (removes ALL waypoints)
  // MindNode-inspired UX: double-click any waypoint to reset edge to direct path
  const handleWaypointDoubleClick = useCallback((e: React.MouseEvent, _index: number) => {
    e.stopPropagation()
    e.preventDefault()

    // Clear ALL waypoints to straighten the edge (not just the clicked one)
    if (waypoints && waypoints.length > 0) {
      updateEdge(id, { waypoints: undefined })
      toast('Edge straightened', { duration: 1500, icon: '📏' })
    } else if (centerOffset) {
      updateEdge(id, { centerOffset: { x: 0, y: 0 } })
      toast('Edge straightened', { duration: 1500, icon: '📏' })
    }

    // Deselect waypoint after straightening
    setSelectedWaypointIndex(null)
  }, [id, waypoints, centerOffset, updateEdge])

  // ==========================================================================
  // GHOST POINT HANDLERS (P0-1)
  // ==========================================================================

  // Handle mouse move for ghost point tracking
  const handlePathMouseMove = useCallback((e: React.MouseEvent) => {
    if (!canShowGhostPoint || !pathRef.current || isDragging) {
      setGhostPointVisible(false)
      return
    }

    // Get cursor position in SVG coordinates
    const svg = (e.target as SVGElement).closest('svg')
    if (!svg) return

    const point = svg.createSVGPoint()
    point.x = e.clientX
    point.y = e.clientY

    const ctm = svg.getScreenCTM()
    if (!ctm) return

    const svgPoint = point.matrixTransform(ctm.inverse())

    // Find nearest point on path
    const nearest = getNearestPointOnPath(pathRef.current, svgPoint.x, svgPoint.y)

    if (nearest && nearest.distance < GHOST_POINT_MAX_DISTANCE) {
      // Check if too close to existing waypoints or endpoints
      const tooClose = isNearExistingPoints(
        nearest,
        waypoints,
        sourceX,
        sourceY,
        targetX,
        targetY,
        GHOST_POINT_COLLISION_DISTANCE
      )

      if (!tooClose) {
        setGhostPoint({ x: nearest.x, y: nearest.y })
        setGhostPointVisible(true)
        return
      }
    }

    setGhostPointVisible(false)
  }, [canShowGhostPoint, isDragging, waypoints, sourceX, sourceY, targetX, targetY])

  // Handle ghost point click to add waypoint
  // @ts-expect-error - Function reserved for future use
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleGhostPointClick = useCallback((e: React.MouseEvent) => {
    if (!ghostPoint || !canShowGhostPoint) return
    e.stopPropagation()
    e.preventDefault()

    // Debounce rapid clicks
    const now = Date.now()
    if (now - lastClickTimeRef.current < CLICK_DEBOUNCE_MS) return
    lastClickTimeRef.current = now

    const newWaypoint: EdgeWaypoint = { x: ghostPoint.x, y: ghostPoint.y }

    if (waypoints && waypoints.length > 0) {
      // Find best insertion index based on distance along path
      let bestIndex = waypoints.length
      let minDistance = Infinity

      for (let i = 0; i <= waypoints.length; i++) {
        // Safe: ternary guarantees array access only when index is valid
        const prev: Point = i === 0 ? { x: sourceX, y: sourceY } : waypoints[i - 1]!
        const next: Point = i === waypoints.length ? { x: targetX, y: targetY } : waypoints[i]!

        const d = distance(prev, newWaypoint) + distance(newWaypoint, next) - distance(prev, next)
        if (d < minDistance) {
          minDistance = d
          bestIndex = i
        }
      }

      const newWaypoints = [...waypoints]
      newWaypoints.splice(bestIndex, 0, newWaypoint)
      updateEdge(id, { waypoints: newWaypoints })
      // Screen reader announcement (P3-2)
      toast(`Waypoint added. ${newWaypoints.length} waypoints total.`, { duration: 2000, icon: <MapPin size={16} className="text-blue-400" /> })
    } else {
      // First waypoint
      updateEdge(id, { waypoints: [newWaypoint], centerOffset: undefined })
      // Screen reader announcement (P3-2)
      toast('Waypoint added. 1 waypoint total.', { duration: 2000, icon: <MapPin size={16} className="text-blue-400" /> })
    }

    // Hide ghost point after click
    setGhostPointVisible(false)
  }, [ghostPoint, canShowGhostPoint, waypoints, sourceX, sourceY, targetX, targetY, id, updateEdge])

  // Handle segment + button click to add waypoint at midpoint
  const handleSegmentButtonClick = useCallback((e: React.MouseEvent, segmentIndex: number) => {
    e.stopPropagation()
    e.preventDefault()

    // Debounce rapid clicks
    const now = Date.now()
    if (now - lastClickTimeRef.current < CLICK_DEBOUNCE_MS) return
    lastClickTimeRef.current = now

    if (!segmentMidpoints[segmentIndex]) return

    const midpoint = segmentMidpoints[segmentIndex]
    const newWaypoint: EdgeWaypoint = { x: midpoint.x, y: midpoint.y }

    if (waypoints && waypoints.length > 0) {
      const newWaypoints = [...waypoints]
      newWaypoints.splice(segmentIndex, 0, newWaypoint)
      updateEdge(id, { waypoints: newWaypoints })
      // Screen reader announcement (P3-2)
      toast(`Waypoint added. ${newWaypoints.length} waypoints total.`, { duration: 2000, icon: <MapPin size={16} className="text-blue-400" /> })
    } else {
      updateEdge(id, { waypoints: [newWaypoint], centerOffset: undefined })
      // Screen reader announcement (P3-2)
      toast('Waypoint added. 1 waypoint total.', { duration: 2000, icon: <MapPin size={16} className="text-blue-400" /> })
    }
  }, [segmentMidpoints, waypoints, id, updateEdge])

  // Handle waypoint context menu (P1-3)
  const handleWaypointContextMenu = useCallback((e: React.MouseEvent, waypointIndex: number) => {
    e.preventDefault()
    e.stopPropagation()

    // Select the waypoint when opening context menu
    setSelectedWaypointIndex(waypointIndex)

    openContextMenu(
      { x: e.clientX, y: e.clientY },
      { type: 'waypoint', edgeId: id, waypointIndex }
    )
  }, [id, openContextMenu])

  // ==========================================================================
  // KEYBOARD SHORTCUTS
  // ==========================================================================

  // Delete key removes hovered OR selected waypoint (P1-1 enhancement)
  useEffect(() => {
    // Work with either hovered or selected waypoint
    const activeIndex = selectedWaypointIndex ?? hoveredWaypointIndex
    if (activeIndex === null || isWorkspaceLink) return

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        e.stopPropagation()

        if (waypoints && waypoints.length > 0) {
          const newWaypoints = waypoints.filter((_, i) => i !== activeIndex)
          updateEdge(id, { waypoints: newWaypoints.length > 0 ? newWaypoints : undefined })
          // Screen reader announcement (P3-2)
          toast(`Waypoint removed. ${newWaypoints.length} waypoints remaining.`, { duration: 2000, icon: <Trash2 size={16} className="text-red-400" /> })
        } else if (centerOffset) {
          // Legacy: reset centerOffset
          updateEdge(id, { centerOffset: { x: 0, y: 0 } })
          // Screen reader announcement (P3-2)
          toast('Waypoint removed. 0 waypoints remaining.', { duration: 2000, icon: <Trash2 size={16} className="text-red-400" /> })
        }
        setHoveredWaypointIndex(null)
        setSelectedWaypointIndex(null)
      }

      // Escape key cancels drag or deselects
      if (e.key === 'Escape') {
        if (isDragging) {
          setIsDragging(false)
          setDraggedWaypointIndex(null)
          dragStartRef.current = null
        }
        setSelectedWaypointIndex(null)
      }

      // Arrow keys nudge selected waypoint (P3-1)
      if (selectedWaypointIndex !== null && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()
        e.stopPropagation()

        const nudgeAmount = e.shiftKey ? 10 : 1 // Shift = 10px, otherwise 1px
        const dx = e.key === 'ArrowRight' ? nudgeAmount : e.key === 'ArrowLeft' ? -nudgeAmount : 0
        const dy = e.key === 'ArrowDown' ? nudgeAmount : e.key === 'ArrowUp' ? -nudgeAmount : 0

        if (waypoints && waypoints[selectedWaypointIndex]) {
          const newWaypoints = [...waypoints]
          newWaypoints[selectedWaypointIndex] = {
            x: waypoints[selectedWaypointIndex].x + dx,
            y: waypoints[selectedWaypointIndex].y + dy
          }
          updateEdge(id, { waypoints: newWaypoints })
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [hoveredWaypointIndex, selectedWaypointIndex, isDragging, waypoints, centerOffset, id, updateEdge, isWorkspaceLink])

  // Click elsewhere to deselect waypoint
  useEffect(() => {
    if (selectedWaypointIndex === null) return

    const handleClickOutside = (e: MouseEvent): void => {
      // Check if click was on a waypoint handle
      const target = e.target as HTMLElement
      if (target.closest('.edge-waypoint-handle') || target.closest('.edge-waypoint-add-handle') || target.closest('.edge-segment-add-button')) {
        return
      }
      setSelectedWaypointIndex(null)
    }

    // Delay to avoid immediate deselection
    const timeout = setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
    }, 100)

    return () => {
      clearTimeout(timeout)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [selectedWaypointIndex])

  // Double-click on edge path to add waypoint
  const handlePathDoubleClick = useCallback((e: React.MouseEvent) => {
    if (isWorkspaceLink) return
    e.stopPropagation()

    // Get click position in SVG coordinates
    const svg = (e.target as SVGElement).closest('svg')
    if (!svg) return

    const point = svg.createSVGPoint()
    point.x = e.clientX
    point.y = e.clientY

    const ctm = svg.getScreenCTM()
    if (!ctm) return

    const svgPoint = point.matrixTransform(ctm.inverse())

    const newWaypoint: EdgeWaypoint = { x: svgPoint.x, y: svgPoint.y }

    if (waypoints && waypoints.length > 0) {
      if (waypoints.length >= MAX_WAYPOINTS) {
        console.warn(`Maximum waypoints (${MAX_WAYPOINTS}) reached for edge ${id}`)
        return
      }

      // Find best insertion index based on distance along path
      let bestIndex = waypoints.length
      let minDistance = Infinity

      for (let i = 0; i <= waypoints.length; i++) {
        // Safe: ternary guarantees array access only when index is valid
        const prev: Point = i === 0 ? { x: sourceX, y: sourceY } : waypoints[i - 1]!
        const next: Point = i === waypoints.length ? { x: targetX, y: targetY } : waypoints[i]!

        const d = distance(prev, newWaypoint) + distance(newWaypoint, next) - distance(prev, next)
        if (d < minDistance) {
          minDistance = d
          bestIndex = i
        }
      }

      const newWaypoints = [...waypoints]
      newWaypoints.splice(bestIndex, 0, newWaypoint)
      updateEdge(id, { waypoints: newWaypoints })
    } else {
      // First waypoint
      updateEdge(id, { waypoints: [newWaypoint], centerOffset: undefined })
    }
  }, [id, waypoints, sourceX, sourceY, targetX, targetY, updateEdge, isWorkspaceLink])

  // ==========================================================================
  // EDGE LOD (Level of Detail) — PFD Phase 3A
  // Far zoom: strong edges only. Mid: strong + normal. Close: all edges.
  // Selected, workspace-link, and context-highlighted edges always visible.
  // ==========================================================================

  const edgeLodHidden = useMemo(() => {
    if (selected || isWorkspaceLink || isContextProviderHighlighted || showContextFlow) return false
    const strength = edgeData.strength || 'normal'
    if (zoom < 0.25) {
      // Far zoom: only strong edges
      return strength !== 'strong'
    }
    if (zoom < 0.5) {
      // Mid zoom: strong + normal edges
      return strength === 'light'
    }
    // Close zoom: all edges
    return false
  }, [zoom, edgeData.strength, selected, isWorkspaceLink, isContextProviderHighlighted, showContextFlow])

  if (edgeLodHidden) {
    return <g />
  }

  // ==========================================================================
  // RENDER
  // ==========================================================================

  const intraProjectStyles = isIntraProject ? {
    filter: 'drop-shadow(0 0 2px rgba(168, 85, 247, 0.3))'
  } : {}

  // Determine stroke dasharray - strength takes precedence over lineStyle
  const strokeDasharray = showContextFlow ? undefined : (
    isWorkspaceLink ? '5,5' : (
      hasStrength && strengthVisuals.dashArray
        ? strengthVisuals.dashArray
        : getStrokeDasharray(lineStyle, isInactive)
    )
  )

  // Determine opacity - strength provides base opacity, can be modified by inactive state
  const edgeOpacity = isInactive ? 0.4 : (hasStrength ? strengthVisuals.opacity : 1)

  // Animation class for animated line style
  const animationClass = lineStyle === 'animated' && !isInactive ? 'edge-animated-flow' : ''

  // Bridge edge flow animation (Phase 1)
  const shouldShowBridgeAnimation = isBridgeAnimated && showBridgeEdgeAnimations && !isInactive && !isWorkspaceLink && zoom >= 0.5
  const bridgeAnimClass = shouldShowBridgeAnimation
    ? `edge-flow-animated edge-flow-animated-glow${bridgeAnimationSpeed === 'slow' ? ' edge-flow-animated--slow' : bridgeAnimationSpeed === 'fast' ? ' edge-flow-animated--fast' : ''}`
    : ''
  // Thicker stroke when bridge-animated
  const bridgeStrokeBoost = shouldShowBridgeAnimation ? 0.5 : 0

  return (
    <g data-intra-project={isIntraProject ? 'true' : undefined} style={intraProjectStyles}>
      {/* Main edge path - using direct path element for reliable inline style application */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        className={[
          'react-flow__edge-path',
          showContextFlow && !isWorkspaceLink && 'context-flowing',
          showContextFlow && isWorkspaceLink && 'workspace-link-flowing',
          !showContextFlow && isContextEdge && 'context-idle',
          isContextProviderHighlighted && 'context-provider-glow',
          isBidirectional && 'bidirectional',
          animationClass,
          bridgeAnimClass,
          isDragging && 'edge-dragging'
        ].filter(Boolean).join(' ')}
        style={{
          stroke: useGradient ? `url(#${gradientId})` : edgeColor,
          strokeWidth: strokeWidth + bridgeStrokeBoost,
          strokeDasharray,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          opacity: isWorkspaceLink ? 0.6 : edgeOpacity,
          filter: isContextProviderHighlighted
            ? 'drop-shadow(0 0 6px var(--context-glow-color, rgba(139, 92, 246, 0.6)))'
            : selected
              ? 'drop-shadow(0 0 4px rgba(59, 130, 246, 0.4))'
              : isHovering && !isWorkspaceLink
                ? 'drop-shadow(0 0 2px rgba(255, 255, 255, 0.2))'
                : undefined,
          transition: 'stroke-width 0.15s ease, filter 0.15s ease, opacity 0.15s ease'
        }}
        markerEnd={arrowStyle !== 'none' ? `url(#arrow-${id})` : undefined}
        markerStart={isBidirectional && arrowStyle !== 'none' ? `url(#arrow-start-${id})` : undefined}
      />

      {/* Hidden path for ghost point calculation (needs ref) */}
      <path
        ref={pathRef}
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={0}
        pointerEvents="none"
      />

      {/* Invisible wider path for interaction */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={30}
        style={{ cursor: isWorkspaceLink ? 'pointer' : (ghostPointVisible ? 'copy' : 'pointer') }}
        onDoubleClick={handlePathDoubleClick}
        onClick={(e) => {
          e.stopPropagation()
          // Select the edge on click
          setSelectedEdges([id])
        }}
        onMouseMove={handlePathMouseMove}
        onMouseEnter={() => !isWorkspaceLink && setIsHovering(true)}
        onMouseLeave={() => {
          if (!isDragging) setIsHovering(false)
          setGhostPointVisible(false)
        }}
        aria-label={`Connection from ${source} to ${target}${edgeData.label ? `: ${edgeData.label}` : ''}`}
        role="graphics-symbol"
      >
        <title>{isWorkspaceLink ? 'Click to select' : 'Click to select, double-click to add waypoint'}</title>
      </path>

      {/* SVG definitions for markers and gradients — placed directly in <g> to avoid
          nested <svg> viewport boundary issues with gradientUnits="userSpaceOnUse" */}
      <defs>
        {/* Gradient definition */}
        {useGradient && (
          <linearGradient
            id={gradientId}
            gradientUnits="userSpaceOnUse"
            x1={sourceX}
            y1={sourceY}
            x2={targetX}
            y2={targetY}
          >
            <stop offset="0%" stopColor={sourceColor} />
            {isBidirectional ? (
              <stop offset="100%" stopColor={targetColor} />
            ) : (
              <>
                <stop offset="65%" stopColor={sourceColor} />
                <stop offset="100%" stopColor={targetColor} />
              </>
            )}
          </linearGradient>
        )}

        {/* End arrow marker */}
        {arrowStyle !== 'none' && (
          <marker
            id={`arrow-${id}`}
            viewBox="0 0 10 10"
            refX={arrowStyle === 'dot' ? 5 : 8}
            refY="5"
            markerUnits="strokeWidth"
            markerWidth={markerSize}
            markerHeight={markerSize}
            orient="auto"
          >
            <path
              d={getArrowPath(arrowStyle, false)}
              fill={getArrowFill(arrowStyle, useGradient ? targetColor : edgeColor, isInactive ? 0.4 : 1)}
              stroke={getArrowStroke(arrowStyle, useGradient ? targetColor : edgeColor)}
              strokeWidth={getArrowStrokeWidth(arrowStyle)}
              opacity={isInactive ? 0.4 : 1}
            />
          </marker>
        )}

        {/* Start arrow marker (bidirectional) */}
        {isBidirectional && arrowStyle !== 'none' && (
          <marker
            id={`arrow-start-${id}`}
            viewBox="0 0 10 10"
            refX={arrowStyle === 'dot' ? 5 : 2}
            refY="5"
            markerUnits="strokeWidth"
            markerWidth={markerSize}
            markerHeight={markerSize}
            orient="auto"
          >
            <path
              d={getArrowPath(arrowStyle, true)}
              fill={getArrowFill(arrowStyle, useGradient ? sourceColor : edgeColor, isInactive ? 0.4 : 1)}
              stroke={getArrowStroke(arrowStyle, useGradient ? sourceColor : edgeColor)}
              strokeWidth={getArrowStrokeWidth(arrowStyle)}
              opacity={isInactive ? 0.4 : 1}
            />
          </marker>
        )}
      </defs>

      {/* Edge label */}
      {edgeData.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
              fontWeight: edgeData.labelBold ? 'bold' : 'normal',
              fontStyle: edgeData.labelItalic ? 'italic' : 'normal',
              boxShadow: selected ? `0 0 0 1px ${edgeColor}` : undefined,
              background: useGradient
                ? `linear-gradient(90deg, color-mix(in srgb, ${sourceColor} ${themeMode === 'dark' ? '8%' : '5%'}, var(--gui-panel-bg)), color-mix(in srgb, ${targetColor} ${themeMode === 'dark' ? '8%' : '5%'}, var(--gui-panel-bg)))`
                : 'color-mix(in srgb, var(--gui-panel-bg) 90%, transparent)',
              color: isInactive ? 'var(--gui-text-secondary)' : 'var(--gui-text-primary)'
            }}
            className={`px-2 py-0.5 rounded text-xs transition-opacity backdrop-blur-sm ${
              isInactive ? 'opacity-60' : 'opacity-100'
            }`}
          >
            <FormattedText text={edgeData.label} />
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Hover hint — shows context flow info or "click to edit" */}
      {isHovering && !selected && !isWorkspaceLink && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -100%) translate(${labelX}px, ${labelY - 8}px)`,
              pointerEvents: 'none',
              background: 'color-mix(in srgb, var(--gui-panel-bg) 92%, transparent)',
              color: 'var(--gui-text-secondary)',
              fontSize: '10px',
              maxWidth: '240px'
            }}
            className="px-2 py-1 rounded backdrop-blur-sm"
          >
            {isContextEdge && sourceNodeInfo && targetNodeInfo ? (
              <div className="flex flex-col gap-0.5">
                <span style={{ color: 'var(--gui-accent-secondary)', fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Context flows
                </span>
                <span className="truncate">
                  {sourceNodeInfo.title} → {targetNodeInfo.title}
                  {isBidirectional && ' (bidirectional)'}
                </span>
              </div>
            ) : (
              !edgeData.label && 'Click to edit'
            )}
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Waypoint handles - hidden when multiple edges selected (P3-4) */}
      {!isWorkspaceLink && !isMultiEdgeSelection && (selected || isHovering || isDragging) && (
        <EdgeLabelRenderer>
          {waypointIndices.map((wpIndex) => {
            // Calculate waypoint position
            let wpX: number, wpY: number
            if (waypoints && waypoints[wpIndex]) {
              wpX = waypoints[wpIndex].x
              wpY = waypoints[wpIndex].y
            } else if (centerOffset) {
              // Legacy centerOffset
              wpX = (sourceX + targetX) / 2 + centerOffset.x
              wpY = (sourceY + targetY) / 2 + centerOffset.y
            } else {
              return null
            }

            const isThisHovered = hoveredWaypointIndex === wpIndex
            const isThisDragging = draggedWaypointIndex === wpIndex
            const isThisSelected = selectedWaypointIndex === wpIndex

            // Calculate size based on state (handleScale defined at component level)
            const baseSize = isThisDragging ? 20 : (isThisHovered || isThisSelected) ? 16 : 12
            const handleSize = baseSize * handleScale

            return (
              <div
                key={`waypoint-${wpIndex}`}
                role="button"
                tabIndex={selected ? 0 : -1}
                aria-label={`Waypoint ${wpIndex + 1} of ${waypointIndices.length}. Press Delete to remove, arrow keys to nudge.`}
                style={{
                  position: 'absolute',
                  transform: `translate(${wpX - handleSize / 2}px, ${wpY - handleSize / 2}px)`,
                  pointerEvents: 'all',
                  cursor: isThisDragging ? 'grabbing' : 'grab',
                  zIndex: isThisDragging ? 1000 : (isThisSelected ? 100 : 50),
                  outline: 'none'
                }}
                onMouseDown={(e) => handleWaypointPointerDown(e, wpIndex)}
                onDoubleClick={(e) => handleWaypointDoubleClick(e, wpIndex)}
                onContextMenu={(e) => handleWaypointContextMenu(e, wpIndex)}
                onFocus={() => setSelectedWaypointIndex(wpIndex)}
                onMouseEnter={() => {
                  setIsHovering(true)
                  setHoveredWaypointIndex(wpIndex)
                }}
                onMouseLeave={() => {
                  if (!isDragging) {
                    setHoveredWaypointIndex(null)
                  }
                }}
              >
                <div
                  className="flex items-center justify-center rounded-full transition-all duration-150 edge-waypoint-handle"
                  style={{
                    width: handleSize,
                    height: handleSize,
                    backgroundColor: isThisDragging
                      ? 'var(--edge-waypoint-active, rgb(59, 130, 246))'
                      : (isThisHovered || isThisSelected)
                        ? 'var(--edge-waypoint-hover, rgb(96, 165, 250))'
                        : 'var(--edge-waypoint-color, rgba(59, 130, 246, 0.8))',
                    border: `${Math.max(1.5, 2 * handleScale)}px solid var(--edge-waypoint-border, white)`,
                    boxShadow: isThisDragging
                      ? '0 0 12px var(--edge-waypoint-glow-active, rgba(59, 130, 246, 0.6))'
                      : isThisSelected
                        ? '0 0 0 3px rgba(255, 255, 255, 0.8), 0 0 12px var(--edge-waypoint-glow, rgba(59, 130, 246, 0.5))'
                        : isThisHovered
                          ? '0 0 8px var(--edge-waypoint-glow, rgba(59, 130, 246, 0.4))'
                          : '0 1px 3px rgba(0,0,0,0.3)'
                  }}
                  title="Drag to move"
                />
              </div>
            )
          })}

          {/* Segment + buttons at all midpoints (P0-2) */}
          {!isWorkspaceLink && segmentMidpoints.map((midpoint, segmentIndex) => {
            const addHandleSize = 18 * handleScale

            return (
              <div
                key={`segment-btn-${segmentIndex}`}
                style={{
                  position: 'absolute',
                  transform: `translate(${midpoint.x - addHandleSize / 2}px, ${midpoint.y - addHandleSize / 2}px)`,
                  pointerEvents: 'all',
                  cursor: 'copy',
                  zIndex: 1
                }}
                className={`transition-all duration-200 ${
                  selected || isHovering ? 'opacity-100' : 'opacity-0'
                }`}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => !isDragging && setIsHovering(false)}
                onClick={(e) => handleSegmentButtonClick(e, segmentIndex)}
                title={`Add waypoint to segment ${segmentIndex + 1}`}
              >
                <div
                  className="flex items-center justify-center rounded-full transition-all duration-150 hover:scale-125 edge-waypoint-add-handle"
                  style={{
                    width: addHandleSize,
                    height: addHandleSize,
                    backgroundColor: 'var(--edge-waypoint-add-bg, rgba(59, 130, 246, 0.85))',
                    border: `${Math.max(1.5, 2 * handleScale)}px solid var(--edge-waypoint-border, white)`,
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)'
                  }}
                >
                  <Plus
                    style={{ width: 9 * handleScale, height: 9 * handleScale }}
                    className="text-white"
                    strokeWidth={3}
                  />
                </div>
              </div>
            )
          })}

          {/* Ghost point indicator (P0-1) */}
          {ghostPoint && ghostPointVisible && canShowGhostPoint && (
            <div
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${ghostPoint.x}px, ${ghostPoint.y}px)`,
                pointerEvents: 'none',
                zIndex: 2
              }}
            >
              <div
                className="edge-ghost-point"
                style={{
                  width: 12 * handleScale,
                  height: 12 * handleScale,
                  backgroundColor: 'var(--edge-ghost-point-bg, rgba(59, 130, 246, 0.6))',
                  border: `2px solid var(--edge-ghost-point-border, rgba(255, 255, 255, 0.8))`,
                  borderRadius: '50%',
                  boxShadow: '0 0 8px var(--edge-ghost-point-glow, rgba(59, 130, 246, 0.4))',
                  animation: 'edge-ghost-pulse 1.5s ease-in-out infinite'
                }}
              />
            </div>
          )}

          {/* Modifier key visual feedback during drag (P2-1, P2-2) */}
          {isDragging && draggedWaypointIndex !== null && (() => {
            // Get current dragged waypoint position
            let wpX: number, wpY: number
            if (waypoints && waypoints[draggedWaypointIndex]) {
              wpX = waypoints[draggedWaypointIndex].x
              wpY = waypoints[draggedWaypointIndex].y
            } else if (centerOffset) {
              wpX = (sourceX + targetX) / 2 + centerOffset.x
              wpY = (sourceY + targetY) / 2 + centerOffset.y
            } else {
              return null
            }

            return (
              <>
                {/* Grid snap indicator (P2-1) - small dot grid around waypoint */}
                {isShiftHeld && (
                  <div
                    style={{
                      position: 'absolute',
                      transform: `translate(-50%, -50%) translate(${wpX}px, ${wpY}px)`,
                      pointerEvents: 'none',
                      zIndex: 5
                    }}
                  >
                    {/* 5x5 grid of dots centered on waypoint */}
                    <svg
                      width={100 * handleScale}
                      height={100 * handleScale}
                      style={{
                        position: 'absolute',
                        left: -50 * handleScale,
                        top: -50 * handleScale,
                        opacity: 0.6
                      }}
                    >
                      {[-2, -1, 0, 1, 2].map(row =>
                        [-2, -1, 0, 1, 2].map(col => (
                          <circle
                            key={`grid-${row}-${col}`}
                            cx={50 * handleScale + col * 20 * handleScale}
                            cy={50 * handleScale + row * 20 * handleScale}
                            r={2 * handleScale}
                            fill="var(--gui-accent-primary, #8b5cf6)"
                          />
                        ))
                      )}
                    </svg>
                    {/* SNAP badge */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 30 * handleScale,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        fontSize: 10 * handleScale,
                        fontWeight: 600,
                        color: 'white',
                        backgroundColor: 'var(--gui-accent-primary, #8b5cf6)',
                        padding: `${2 * handleScale}px ${6 * handleScale}px`,
                        borderRadius: 4 * handleScale,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      SNAP
                    </div>
                  </div>
                )}

                {/* Axis lock indicator (P2-2) - line showing locked axis */}
                {isCtrlHeld && axisLockDirection && dragStartRef.current && (
                  <div
                    style={{
                      position: 'absolute',
                      transform: `translate(-50%, -50%) translate(${wpX}px, ${wpY}px)`,
                      pointerEvents: 'none',
                      zIndex: 4
                    }}
                  >
                    <svg
                      width={400 * handleScale}
                      height={400 * handleScale}
                      style={{
                        position: 'absolute',
                        left: -200 * handleScale,
                        top: -200 * handleScale,
                        overflow: 'visible'
                      }}
                    >
                      {axisLockDirection === 'horizontal' ? (
                        <line
                          x1={0}
                          y1={200 * handleScale}
                          x2={400 * handleScale}
                          y2={200 * handleScale}
                          stroke="var(--gui-accent-primary, #8b5cf6)"
                          strokeWidth={2 * handleScale}
                          strokeDasharray={`${4 * handleScale} ${4 * handleScale}`}
                          opacity={0.6}
                        />
                      ) : (
                        <line
                          x1={200 * handleScale}
                          y1={0}
                          x2={200 * handleScale}
                          y2={400 * handleScale}
                          stroke="var(--gui-accent-primary, #8b5cf6)"
                          strokeWidth={2 * handleScale}
                          strokeDasharray={`${4 * handleScale} ${4 * handleScale}`}
                          opacity={0.6}
                        />
                      )}
                    </svg>
                    {/* Axis badge */}
                    <div
                      style={{
                        position: 'absolute',
                        top: axisLockDirection === 'horizontal' ? -25 * handleScale : 30 * handleScale,
                        left: axisLockDirection === 'horizontal' ? 30 * handleScale : '50%',
                        transform: axisLockDirection === 'vertical' ? 'translateX(-50%)' : 'none',
                        fontSize: 10 * handleScale,
                        fontWeight: 600,
                        color: 'white',
                        backgroundColor: 'var(--gui-accent-primary, #8b5cf6)',
                        padding: `${2 * handleScale}px ${6 * handleScale}px`,
                        borderRadius: 4 * handleScale,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {axisLockDirection === 'horizontal' ? 'H' : 'V'}
                    </div>
                  </div>
                )}

                {/* Contextual modifier hint (P2-3) - shown on first drag */}
                {showModifierHint && !isShiftHeld && !isCtrlHeld && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 35 * handleScale,
                      left: 25 * handleScale,
                      fontSize: 11 * handleScale,
                      color: 'var(--gui-text-primary, #f3f4f6)',
                      backgroundColor: 'var(--gui-panel-bg, rgba(17, 24, 39, 0.9))',
                      padding: `${4 * handleScale}px ${8 * handleScale}px`,
                      borderRadius: 6 * handleScale,
                      whiteSpace: 'nowrap',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                      border: '1px solid var(--gui-border, rgba(255, 255, 255, 0.1))',
                      pointerEvents: 'none',
                      zIndex: 10
                    }}
                  >
                    <span style={{ opacity: 0.7 }}>Shift:</span> snap &nbsp;
                    <span style={{ opacity: 0.7 }}>Ctrl:</span> lock axis
                  </div>
                )}
              </>
            )
          })()}
        </EdgeLabelRenderer>
      )}
    </g>
  )
}

export const CustomEdge = memo(CustomEdgeComponent)
