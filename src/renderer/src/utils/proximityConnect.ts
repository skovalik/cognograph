// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import type { NodeData } from '@shared/types'
import type { Node } from '@xyflow/react'

/** Bounding rectangle in flow coordinates */
export interface NodeRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Proximity detection threshold in flow-coordinate pixels (edge-to-edge).
 * This is zoom-invariant: 150px in logical canvas space regardless of viewport zoom.
 * At default node size (280x140), this equals roughly half a node width of gap.
 */
export const PROXIMITY_THRESHOLD = 150

/**
 * Calculate edge-to-edge distance between two axis-aligned rectangles.
 * Returns 0 if rects overlap or touch.
 *
 * Math: For each axis, compute the gap between nearest edges.
 * If gap is negative (overlap), clamp to 0. Then Euclidean distance of gaps.
 * Result shape is a rounded-rectangle proximity zone (diagonal triggers at
 * closer visual separation than pure horizontal/vertical).
 */
export function edgeToEdgeDistance(a: NodeRect, b: NodeRect): number {
  const dx = Math.max(0, Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width)))
  const dy = Math.max(0, Math.max(a.y - (b.y + b.height), b.y - (a.y + a.height)))
  return Math.sqrt(dx * dx + dy * dy)
}

/** Get bounding rect for a React Flow node, using measured dimensions with fallback */
export function getNodeRect(node: Node<NodeData>): NodeRect {
  return {
    x: node.position.x,
    y: node.position.y,
    width: (node.width as number) || node.measured?.width || 280,
    height: (node.height as number) || node.measured?.height || 140,
  }
}

/** Result of proximity detection */
export interface ProximityTarget {
  nodeId: string
  distance: number
}

/**
 * Find conversation nodes within proximity threshold of the dragged node rect.
 * Returns array sorted by distance (nearest first).
 *
 * Note: For multi-node drag, call once per dragged node rect and dedup results.
 * V1 only checks the primary (leader) dragged node — documented limitation.
 */
export function findProximityTargets(
  draggedNodeRect: NodeRect,
  allNodes: Node<NodeData>[],
  draggedNodeIds: string[],
  existingEdgePairs: Set<string>,
): ProximityTarget[] {
  const targets: ProximityTarget[] = []

  for (const node of allNodes) {
    // Skip dragged nodes
    if (draggedNodeIds.includes(node.id)) continue

    // Only target conversation nodes
    if ((node.data as NodeData).type !== 'conversation') continue

    // Skip if edge already exists in either direction
    // buildEdgePairSet stores source-target; we check both orientations
    const hasEdge = draggedNodeIds.some(
      (did) =>
        existingEdgePairs.has(`${did}-${node.id}`) || existingEdgePairs.has(`${node.id}-${did}`),
    )
    if (hasEdge) continue

    const targetRect = getNodeRect(node)
    const distance = edgeToEdgeDistance(draggedNodeRect, targetRect)

    if (distance <= PROXIMITY_THRESHOLD) {
      targets.push({ nodeId: node.id, distance })
    }
  }

  return targets.sort((a, b) => a.distance - b.distance)
}

/**
 * Build a Set of "source-target" edge key strings for O(1) duplicate lookup.
 * Only stores forward direction (source-target). The caller (findProximityTargets)
 * checks both orientations explicitly.
 */
export function buildEdgePairSet(edges: Array<{ source: string; target: string }>): Set<string> {
  const set = new Set<string>()
  for (const e of edges) {
    set.add(`${e.source}-${e.target}`)
  }
  return set
}
