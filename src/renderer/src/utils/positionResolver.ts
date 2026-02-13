/**
 * Position Resolver
 *
 * Resolves RelativePosition specifications to absolute canvas coordinates.
 * Handles topological sorting of operations for dependency-aware execution.
 */

import type { Node } from '@xyflow/react'
import type {
  RelativePosition,
  NodeData,
  MutationOp
} from '@shared/types'
import { NODE_DEFAULTS } from '@shared/types'

// Re-export constants for use
export const NODE_SPACING = 50
export const GRID_SPACING = 250
export const CLUSTER_SPREAD = 100

// Re-export NODE_DEFAULTS as DEFAULT_NODE_DIMENSIONS for backwards compatibility
export const DEFAULT_NODE_DIMENSIONS = NODE_DEFAULTS

// -----------------------------------------------------------------------------
// Position Resolution Context
// -----------------------------------------------------------------------------

export interface PositionResolutionContext {
  // Existing nodes on canvas
  nodes: Node<NodeData>[]

  // Already resolved positions (for chained relative positions)
  resolvedPositions: Map<string, { x: number; y: number }>

  // Viewport info
  viewport: { x: number; y: number; zoom: number }
  viewportBounds: { width: number; height: number }

  // Selected node positions
  selectedNodeIds: string[]
  selectionCenter?: { x: number; y: number }
  selectionBounds?: { minX: number; minY: number; maxX: number; maxY: number }
}

// -----------------------------------------------------------------------------
// Main Position Resolution Function
// -----------------------------------------------------------------------------

/**
 * Resolve a RelativePosition to absolute canvas coordinates.
 */
export function resolvePosition(
  position: RelativePosition,
  context: PositionResolutionContext
): { x: number; y: number } {
  // Defensive check: if position has x/y but no type, treat as absolute
  // This handles malformed positions from templates or AI that forgot the type field
  if (!position.type && 'x' in position && 'y' in position) {
    const pos = position as unknown as { x: number; y: number }
    return { x: pos.x, y: pos.y }
  }

  switch (position.type) {
    case 'absolute':
      return { x: position.x, y: position.y }

    case 'relative-to':
      return resolveRelativeTo(position, context)

    case 'center-of-selection':
      return resolveCenterOfSelection(context)

    case 'center-of-view':
      return resolveCenterOfView(context)

    case 'below-selection':
      return resolveBelowSelection(position, context)

    case 'grid':
      return resolveGrid(position, context)

    case 'cluster':
      return resolveCluster(position, context)

    default:
      // Fallback to center of view for unknown types
      return resolveCenterOfView(context)
  }
}

// -----------------------------------------------------------------------------
// Position Resolution Helpers
// -----------------------------------------------------------------------------

function resolveRelativeTo(
  position: Extract<RelativePosition, { type: 'relative-to' }>,
  context: PositionResolutionContext
): { x: number; y: number } {
  const offset = position.offset ?? NODE_SPACING

  // First check resolved positions (for tempIds)
  let anchorPos = context.resolvedPositions.get(position.anchor)

  // If not found, look for existing node
  if (!anchorPos) {
    const anchorNode = context.nodes.find((n) => n.id === position.anchor)
    if (anchorNode) {
      anchorPos = { x: anchorNode.position.x, y: anchorNode.position.y }
    }
  }

  // Fallback to center of view if anchor not found
  if (!anchorPos) {
    console.warn(`[PositionResolver] Anchor not found: ${position.anchor}, using center of view`)
    return resolveCenterOfView(context)
  }

  // Get anchor dimensions for proper spacing
  const anchorNode = context.nodes.find((n) => n.id === position.anchor)
  const anchorWidth = anchorNode?.measured?.width ?? 300
  const anchorHeight = anchorNode?.measured?.height ?? 150

  switch (position.direction) {
    case 'above':
      return { x: anchorPos.x, y: anchorPos.y - anchorHeight - offset }
    case 'below':
      return { x: anchorPos.x, y: anchorPos.y + anchorHeight + offset }
    case 'left':
      return { x: anchorPos.x - anchorWidth - offset, y: anchorPos.y }
    case 'right':
      return { x: anchorPos.x + anchorWidth + offset, y: anchorPos.y }
    default:
      return anchorPos
  }
}

function resolveCenterOfSelection(context: PositionResolutionContext): { x: number; y: number } {
  if (context.selectionCenter) {
    return context.selectionCenter
  }

  // Calculate from selected nodes
  const selectedNodes = context.nodes.filter((n) => context.selectedNodeIds.includes(n.id))

  if (selectedNodes.length === 0) {
    return resolveCenterOfView(context)
  }

  const sumX = selectedNodes.reduce((sum, n) => sum + n.position.x, 0)
  const sumY = selectedNodes.reduce((sum, n) => sum + n.position.y, 0)

  return {
    x: sumX / selectedNodes.length,
    y: sumY / selectedNodes.length
  }
}

function resolveCenterOfView(context: PositionResolutionContext): { x: number; y: number } {
  // Convert viewport center to canvas coordinates
  const viewCenterX = context.viewportBounds.width / 2
  const viewCenterY = context.viewportBounds.height / 2

  return {
    x: (viewCenterX - context.viewport.x) / context.viewport.zoom,
    y: (viewCenterY - context.viewport.y) / context.viewport.zoom
  }
}

function resolveBelowSelection(
  position: Extract<RelativePosition, { type: 'below-selection' }>,
  context: PositionResolutionContext
): { x: number; y: number } {
  if (!context.selectionBounds) {
    return resolveCenterOfView(context)
  }

  const index = position.index ?? 0
  const x = context.selectionBounds.minX + index * GRID_SPACING
  const y = context.selectionBounds.maxY + NODE_SPACING

  return { x, y }
}

function resolveGrid(
  position: Extract<RelativePosition, { type: 'grid' }>,
  context: PositionResolutionContext
): { x: number; y: number } {
  const spacing = position.spacing ?? GRID_SPACING

  // Find base anchor position
  let basePos = context.resolvedPositions.get(position.baseAnchor)

  if (!basePos) {
    const baseNode = context.nodes.find((n) => n.id === position.baseAnchor)
    if (baseNode) {
      basePos = { x: baseNode.position.x, y: baseNode.position.y }
    }
  }

  if (!basePos) {
    basePos = resolveCenterOfView(context)
  }

  return {
    x: basePos.x + position.col * spacing,
    y: basePos.y + position.row * spacing
  }
}

function resolveCluster(
  position: Extract<RelativePosition, { type: 'cluster' }>,
  context: PositionResolutionContext
): { x: number; y: number } {
  const spread = position.spread ?? CLUSTER_SPREAD

  // Find the "near" node position
  let nearPos = context.resolvedPositions.get(position.near)

  if (!nearPos) {
    const nearNode = context.nodes.find((n) => n.id === position.near)
    if (nearNode) {
      nearPos = { x: nearNode.position.x, y: nearNode.position.y }
    }
  }

  if (!nearPos) {
    return resolveCenterOfView(context)
  }

  // Add some randomness for clustering effect
  const angle = Math.random() * Math.PI * 2
  const distance = spread * (0.5 + Math.random() * 0.5)

  return {
    x: nearPos.x + Math.cos(angle) * distance,
    y: nearPos.y + Math.sin(angle) * distance
  }
}

// -----------------------------------------------------------------------------
// Topological Sorting for Position Dependencies
// -----------------------------------------------------------------------------

/**
 * Extract position dependencies from a MutationOp.
 * Returns array of node IDs (or tempIds) that this operation depends on.
 */
function getPositionDependencies(op: MutationOp): string[] {
  if (op.op !== 'create-node' && op.op !== 'move-node') {
    return []
  }

  const position = op.op === 'create-node' ? op.position : op.position

  switch (position.type) {
    case 'relative-to':
      return [position.anchor]
    case 'grid':
      return [position.baseAnchor]
    case 'cluster':
      return [position.near]
    default:
      return []
  }
}

/**
 * Sort operations by position dependencies using topological sort.
 * Operations with no dependencies come first.
 * Returns operations in execution order.
 */
export function sortOperationsByPositionDependency(operations: MutationOp[]): MutationOp[] {
  // Build dependency graph
  const opById = new Map<string, MutationOp>()
  const dependencies = new Map<string, string[]>()

  // First pass: index operations and extract dependencies
  for (const op of operations) {
    let opId: string

    if (op.op === 'create-node') {
      opId = op.tempId
    } else if (op.op === 'move-node') {
      opId = `move:${op.nodeId}`
    } else if (op.op === 'delete-node') {
      opId = `delete:${op.nodeId}`
    } else if (op.op === 'update-node') {
      opId = `update:${op.nodeId}`
    } else if (op.op === 'create-edge') {
      opId = op.tempId ?? `edge:${op.source}-${op.target}`
    } else if (op.op === 'delete-edge') {
      opId = `delete-edge:${op.edgeId}`
    } else if (op.op === 'update-edge') {
      opId = `update-edge:${op.edgeId}`
    } else {
      continue
    }

    opById.set(opId, op)
    dependencies.set(opId, getPositionDependencies(op))
  }

  // Topological sort
  const sorted: MutationOp[] = []
  const visited = new Set<string>()
  const visiting = new Set<string>()

  function visit(opId: string): void {
    if (visited.has(opId)) return
    if (visiting.has(opId)) {
      console.warn(`[PositionResolver] Circular dependency detected involving: ${opId}`)
      return
    }

    visiting.add(opId)

    const deps = dependencies.get(opId) || []
    for (const depId of deps) {
      // Only visit if it's an operation we know about (tempIds for create-node)
      if (opById.has(depId)) {
        visit(depId)
      }
    }

    visiting.delete(opId)
    visited.add(opId)

    const op = opById.get(opId)
    if (op) {
      sorted.push(op)
    }
  }

  // Visit all operations
  for (const opId of opById.keys()) {
    visit(opId)
  }

  return sorted
}

// -----------------------------------------------------------------------------
// Utility: Calculate Selection Bounds
// -----------------------------------------------------------------------------

export function calculateSelectionBounds(
  nodes: Node<NodeData>[],
  selectedIds: string[]
): { center: { x: number; y: number }; bounds: { minX: number; minY: number; maxX: number; maxY: number } } | null {
  const selectedNodes = nodes.filter((n) => selectedIds.includes(n.id))

  if (selectedNodes.length === 0) {
    return null
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const node of selectedNodes) {
    const width = node.measured?.width ?? 300
    const height = node.measured?.height ?? 150

    minX = Math.min(minX, node.position.x)
    minY = Math.min(minY, node.position.y)
    maxX = Math.max(maxX, node.position.x + width)
    maxY = Math.max(maxY, node.position.y + height)
  }

  return {
    center: {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2
    },
    bounds: { minX, minY, maxX, maxY }
  }
}

// -----------------------------------------------------------------------------
// Edge Handle Calculation
// -----------------------------------------------------------------------------

/**
 * Calculate optimal source and target handles based on relative node positions.
 * This ensures edges flow naturally (bottom→top for vertical, right→left for horizontal).
 */
export function calculateOptimalHandles(
  sourcePos: { x: number; y: number },
  sourceDim: { width: number; height: number },
  targetPos: { x: number; y: number },
  targetDim: { width: number; height: number }
): { sourceHandle: string; targetHandle: string } {
  // Calculate center points
  const sourceCenterX = sourcePos.x + sourceDim.width / 2
  const sourceCenterY = sourcePos.y + sourceDim.height / 2
  const targetCenterX = targetPos.x + targetDim.width / 2
  const targetCenterY = targetPos.y + targetDim.height / 2

  const dx = targetCenterX - sourceCenterX
  const dy = targetCenterY - sourceCenterY

  // Determine primary direction and select handles accordingly
  if (Math.abs(dy) > Math.abs(dx)) {
    // Vertical arrangement
    if (dy > 0) {
      // Target is below source: flow bottom → top
      return { sourceHandle: 'bottom-source', targetHandle: 'top-target' }
    } else {
      // Target is above source: flow top → bottom
      return { sourceHandle: 'top-source', targetHandle: 'bottom-target' }
    }
  } else {
    // Horizontal arrangement
    if (dx > 0) {
      // Target is to the right: flow right → left
      return { sourceHandle: 'right-source', targetHandle: 'left-target' }
    } else {
      // Target is to the left: flow left → right
      return { sourceHandle: 'left-source', targetHandle: 'right-target' }
    }
  }
}

/**
 * Get the position of a handle on a node.
 * Returns the center point of the handle based on its ID.
 */
export function getHandlePosition(
  nodePos: { x: number; y: number },
  nodeDim: { width: number; height: number },
  handleId: string
): { x: number; y: number } {
  const centerX = nodePos.x + nodeDim.width / 2
  const centerY = nodePos.y + nodeDim.height / 2

  if (handleId.includes('top')) {
    return { x: centerX, y: nodePos.y }
  }
  if (handleId.includes('bottom')) {
    return { x: centerX, y: nodePos.y + nodeDim.height }
  }
  if (handleId.includes('left')) {
    return { x: nodePos.x, y: centerY }
  }
  if (handleId.includes('right')) {
    return { x: nodePos.x + nodeDim.width, y: centerY }
  }
  // Default: return center
  return { x: centerX, y: centerY }
}
