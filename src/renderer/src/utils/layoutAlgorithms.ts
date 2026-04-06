// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Layout Algorithms Utility
 *
 * Provides various automatic layout algorithms for arranging nodes on the canvas.
 * Uses dagre for hierarchical layouts and custom implementations for others.
 */

import type { Edge, Node } from '@xyflow/react'
import dagre from 'dagre'

// Layout types
export type LayoutType =
  | 'hierarchical-down'
  | 'hierarchical-right'
  | 'hierarchical-up'
  | 'hierarchical-left'
  | 'force'
  | 'circular'

// Spacing presets
export type SpacingPreset = 'narrow' | 'default' | 'wide'

export const SPACING_VALUES: Record<SpacingPreset, { nodeGap: number; edgeLength: number }> = {
  narrow: { nodeGap: 40, edgeLength: 60 },
  default: { nodeGap: 80, edgeLength: 120 },
  wide: { nodeGap: 120, edgeLength: 180 },
}

// Direction mapping for dagre
const DIRECTION_MAP: Record<string, 'TB' | 'LR' | 'BT' | 'RL'> = {
  'hierarchical-down': 'TB',
  'hierarchical-right': 'LR',
  'hierarchical-up': 'BT',
  'hierarchical-left': 'RL',
}

export interface LayoutOptions {
  spacing?: SpacingPreset
  center?: { x: number; y: number }
}

/**
 * Apply hierarchical (tree) layout using dagre
 */
export function applyHierarchicalLayout(
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' | 'BT' | 'RL' = 'TB',
  spacing: { nodeGap: number; edgeLength: number } = SPACING_VALUES.default,
): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph()
  g.setGraph({
    rankdir: direction,
    nodesep: spacing.nodeGap,
    ranksep: spacing.edgeLength,
    marginx: 50,
    marginy: 50,
  })
  g.setDefaultEdgeLabel(() => ({}))

  // Add nodes to the graph
  nodes.forEach((node) => {
    const width = (node.width as number) || node.measured?.width || 280
    const height = (node.height as number) || node.measured?.height || 140
    g.setNode(node.id, { width, height })
  })

  // Add edges to the graph
  edges.forEach((edge) => {
    // Only include edges between nodes in our layout set
    const sourceInSet = nodes.some((n) => n.id === edge.source)
    const targetInSet = nodes.some((n) => n.id === edge.target)
    if (sourceInSet && targetInSet) {
      g.setEdge(edge.source, edge.target)
    }
  })

  // Run the layout
  dagre.layout(g)

  // Extract positions
  const positions = new Map<string, { x: number; y: number }>()
  nodes.forEach((node) => {
    const layoutNode = g.node(node.id)
    if (layoutNode) {
      const width = (node.width as number) || node.measured?.width || 280
      const height = (node.height as number) || node.measured?.height || 140
      // Dagre returns center positions, convert to top-left
      positions.set(node.id, {
        x: layoutNode.x - width / 2,
        y: layoutNode.y - height / 2,
      })
    }
  })

  return positions
}

/**
 * Apply force-directed layout using simple spring physics
 * Good for showing clusters and relationships
 */
export function applyForceLayout(
  nodes: Node[],
  edges: Edge[],
  iterations: number = 100,
  options: LayoutOptions = {},
): Map<string, { x: number; y: number }> {
  const spacing = SPACING_VALUES[options.spacing || 'default']

  // Initialize positions (use current positions or random)
  const positions = new Map<string, { x: number; y: number }>()
  const velocities = new Map<string, { x: number; y: number }>()

  nodes.forEach((node) => {
    positions.set(node.id, { ...node.position })
    velocities.set(node.id, { x: 0, y: 0 })
  })

  // Build adjacency for quick edge lookup
  const adjacency = new Map<string, Set<string>>()
  nodes.forEach((n) => adjacency.set(n.id, new Set()))
  edges.forEach((e) => {
    const sourceInSet = nodes.some((n) => n.id === e.source)
    const targetInSet = nodes.some((n) => n.id === e.target)
    if (sourceInSet && targetInSet) {
      adjacency.get(e.source)?.add(e.target)
      adjacency.get(e.target)?.add(e.source)
    }
  })

  // Physics constants
  const repulsionStrength = spacing.nodeGap * 100
  const attractionStrength = 0.1
  const idealEdgeLength = spacing.edgeLength
  const damping = 0.9
  const minDistance = 10

  for (let i = 0; i < iterations; i++) {
    // Calculate forces for each node
    nodes.forEach((node) => {
      const pos = positions.get(node.id)!
      let fx = 0
      let fy = 0

      // Repulsion from all other nodes
      nodes.forEach((other) => {
        if (other.id === node.id) return
        const otherPos = positions.get(other.id)!

        const dx = pos.x - otherPos.x
        const dy = pos.y - otherPos.y
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), minDistance)

        // Coulomb's law: F = k / r^2
        const force = repulsionStrength / (dist * dist)
        fx += (dx / dist) * force
        fy += (dy / dist) * force
      })

      // Attraction along edges (Hooke's law)
      const neighbors = adjacency.get(node.id)!
      neighbors.forEach((neighborId) => {
        const neighborPos = positions.get(neighborId)!
        const dx = neighborPos.x - pos.x
        const dy = neighborPos.y - pos.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        // Spring force: F = k * (x - rest_length)
        const force = attractionStrength * (dist - idealEdgeLength)
        fx += (dx / Math.max(dist, minDistance)) * force
        fy += (dy / Math.max(dist, minDistance)) * force
      })

      // Update velocity with damping
      const vel = velocities.get(node.id)!
      vel.x = (vel.x + fx) * damping
      vel.y = (vel.y + fy) * damping
    })

    // Update positions
    nodes.forEach((node) => {
      const pos = positions.get(node.id)!
      const vel = velocities.get(node.id)!
      pos.x += vel.x
      pos.y += vel.y
    })
  }

  return positions
}

/**
 * Apply circular layout
 * Nodes arranged in a circle, optionally sorted by connectivity
 */
export function applyCircularLayout(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {},
): Map<string, { x: number; y: number }> {
  const spacing = SPACING_VALUES[options.spacing || 'default']

  // Calculate center - use provided or calculate from current positions
  let center = options.center
  if (!center) {
    const avgX = nodes.reduce((sum, n) => sum + n.position.x, 0) / nodes.length
    const avgY = nodes.reduce((sum, n) => sum + n.position.y, 0) / nodes.length
    center = { x: avgX, y: avgY }
  }

  // Calculate radius based on number of nodes and spacing
  const circumference = nodes.length * spacing.nodeGap * 2
  const radius = Math.max(circumference / (2 * Math.PI), spacing.edgeLength * 2)

  // Sort nodes by connectivity (most connected in center angles)
  const connectivity = new Map<string, number>()
  nodes.forEach((n) => connectivity.set(n.id, 0))
  edges.forEach((e) => {
    const sourceInSet = nodes.some((n) => n.id === e.source)
    const targetInSet = nodes.some((n) => n.id === e.target)
    if (sourceInSet && targetInSet) {
      connectivity.set(e.source, (connectivity.get(e.source) || 0) + 1)
      connectivity.set(e.target, (connectivity.get(e.target) || 0) + 1)
    }
  })

  const sortedNodes = [...nodes].sort((a, b) => {
    return (connectivity.get(b.id) || 0) - (connectivity.get(a.id) || 0)
  })

  // Position nodes in a circle
  const positions = new Map<string, { x: number; y: number }>()
  const angleStep = (2 * Math.PI) / sortedNodes.length

  sortedNodes.forEach((node, i) => {
    const angle = i * angleStep - Math.PI / 2 // Start from top
    const width = (node.width as number) || node.measured?.width || 280
    const height = (node.height as number) || node.measured?.height || 140

    // Position is top-left corner
    positions.set(node.id, {
      x: center!.x + radius * Math.cos(angle) - width / 2,
      y: center!.y + radius * Math.sin(angle) - height / 2,
    })
  })

  return positions
}

/**
 * Apply layout based on type
 */
export function applyLayout(
  layoutType: LayoutType,
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {},
): Map<string, { x: number; y: number }> {
  const spacing = SPACING_VALUES[options.spacing || 'default']

  switch (layoutType) {
    case 'hierarchical-down':
    case 'hierarchical-right':
    case 'hierarchical-up':
    case 'hierarchical-left':
      return applyHierarchicalLayout(nodes, edges, DIRECTION_MAP[layoutType], spacing)

    case 'force':
      return applyForceLayout(nodes, edges, 100, options)

    case 'circular':
      return applyCircularLayout(nodes, edges, options)

    default:
      return new Map()
  }
}

/**
 * Get layout type display info
 * Icon names correspond to lucide-react icons
 */
export const LAYOUT_INFO: Record<LayoutType, { label: string; description: string; icon: string }> =
  {
    'hierarchical-down': {
      label: 'Hierarchical (Down)',
      description: 'Tree layout flowing top to bottom',
      icon: 'ArrowDown',
    },
    'hierarchical-right': {
      label: 'Hierarchical (Right)',
      description: 'Tree layout flowing left to right',
      icon: 'ArrowRight',
    },
    'hierarchical-up': {
      label: 'Hierarchical (Up)',
      description: 'Tree layout flowing bottom to top',
      icon: 'ArrowUp',
    },
    'hierarchical-left': {
      label: 'Hierarchical (Left)',
      description: 'Tree layout flowing right to left',
      icon: 'ArrowLeft',
    },
    force: {
      label: 'Force-directed',
      description: 'Organic clustering based on connections',
      icon: 'Sparkles',
    },
    circular: {
      label: 'Circular',
      description: 'Nodes arranged in a circle',
      icon: 'Circle',
    },
  }

/**
 * Clustered hierarchical layout — subtree-aware positioning.
 * Replaces dagre for tree/dag topologies. Children cluster under their parent
 * in columns, cross-dependency nodes sit at the midpoint of their parents.
 *
 * Algorithm: Kahn's topological sort → subtree width → place subtrees → multi-parent reposition → assign y from rank.
 */
export function applyClusteredHierarchicalLayout(
  nodes: Node[],
  edges: Edge[],
  opts: { nodeGap?: number; rankGap?: number; clusterGap?: number } = {},
): Map<string, { x: number; y: number }> {
  const nodeGap = opts.nodeGap ?? 28
  const rankGap = opts.rankGap ?? 120
  const clusterGap = opts.clusterGap ?? 120

  const nodeSet = new Set(nodes.map((n) => n.id))
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  // 1. Build adjacency
  const children = new Map<string, string[]>()
  const parents = new Map<string, string[]>()
  for (const n of nodes) {
    children.set(n.id, [])
    parents.set(n.id, [])
  }
  for (const e of edges) {
    if (nodeSet.has(e.source) && nodeSet.has(e.target)) {
      children.get(e.source)!.push(e.target)
      parents.get(e.target)!.push(e.source)
    }
  }

  // 2. Kahn's topological sort → assign rank = max(parent ranks) + 1
  const inDeg = new Map<string, number>()
  for (const n of nodes) inDeg.set(n.id, parents.get(n.id)!.length)
  const rank = new Map<string, number>()
  const queue: string[] = []
  for (const n of nodes) {
    if (inDeg.get(n.id) === 0) {
      queue.push(n.id)
      rank.set(n.id, 0)
    }
  }
  let qi = 0
  while (qi < queue.length) {
    const id = queue[qi++]!
    const r = rank.get(id)!
    for (const kid of children.get(id)!) {
      const parentRank = Math.max(rank.get(kid) ?? 0, r + 1)
      rank.set(kid, parentRank)
      inDeg.set(kid, inDeg.get(kid)! - 1)
      if (inDeg.get(kid) === 0) queue.push(kid)
    }
  }
  // Cycle guard: unranked nodes get maxRank + 1
  const maxRank = Math.max(0, ...Array.from(rank.values()))
  for (const n of nodes) {
    if (!rank.has(n.id)) rank.set(n.id, maxRank + 1)
  }

  // Helper: get node width (with per-type minimum floor)
  const MIN_WIDTHS: Record<string, number> = { task: 300, note: 300, artifact: 300, project: 400 }
  const nodeWidth = (id: string): number => {
    const n = nodeMap.get(id)
    const w = n ? (n.measured?.width ?? (n.width as number) ?? 280) : 280
    const type = (n?.data as any)?.type as string | undefined
    return Math.max(w, MIN_WIDTHS[type ?? ''] ?? 280)
  }
  const nodeHeight = (id: string): number => {
    const n = nodeMap.get(id)
    return n ? (n.measured?.height ?? (n.height as number) ?? 140) : 140
  }

  // 3. Subtree width (memoized)
  // For DAGs with shared children, each child is "claimed" by the first parent
  // that computes its subtree. Subsequent parents see the child as width 0
  // (it's placed elsewhere). The multi-parent step 5 repositions shared children.
  const stWidthCache = new Map<string, number>()
  const claimed = new Set<string>()
  function subtreeWidth(id: string): number {
    if (stWidthCache.has(id)) return stWidthCache.get(id)!
    const kids = children
      .get(id)!
      .filter((c) => (rank.get(c) ?? 0) > (rank.get(id) ?? 0) && !claimed.has(c))
    // Claim these children so other parents don't double-count
    for (const k of kids) claimed.add(k)
    if (kids.length === 0) {
      stWidthCache.set(id, nodeWidth(id))
      return nodeWidth(id)
    }
    const total = kids.reduce((s, k) => s + subtreeWidth(k), 0) + nodeGap * (kids.length - 1)
    const w = Math.max(nodeWidth(id), total)
    stWidthCache.set(id, w)
    return w
  }

  // 4. Place subtrees
  // Guard: skip nodes already placed by another parent (multi-parent nodes
  // get repositioned to midpoint in step 5). Without this, shared children
  // get placed twice, overwriting positions and breaking subtreeWidth allocations.
  const positions = new Map<string, { x: number; y: number }>()

  // Fix 1: Barycenter sibling ordering (pre-sort)
  // Sort children by edge-target centroid before placement. Cross-phase targets
  // may already be positioned; unpositioned targets fall back to edge count.
  const edgeTargetCentroid = (childId: string): number => {
    const outEdges = edges.filter((e) => e.source === childId)
    if (outEdges.length === 0) return (children.get(childId) ?? []).length // child-count fallback
    let sum = 0,
      posCount = 0
    for (const e of outEdges) {
      const tp = positions.get(e.target)
      if (tp) {
        sum += tp.x
        posCount++
      }
    }
    return posCount > 0 ? sum / posCount : outEdges.length // edge-count fallback for unpositioned targets
  }

  function placeSubtree(id: string, centerX: number): void {
    if (positions.has(id)) return // already placed by another parent path
    positions.set(id, { x: centerX - nodeWidth(id) / 2, y: 0 }) // y assigned later
    const kids = children.get(id)!.filter((c) => (rank.get(c) ?? 0) > (rank.get(id) ?? 0))
    if (kids.length === 0) return
    // Sort children by edge-target centroid — stable sort preserves insertion order on ties
    kids.sort((a, b) => edgeTargetCentroid(a) - edgeTargetCentroid(b))
    const totalW = kids.reduce((s, k) => s + subtreeWidth(k), 0) + nodeGap * (kids.length - 1)
    let cursor = centerX - totalW / 2
    for (const kid of kids) {
      const sw = subtreeWidth(kid)
      placeSubtree(kid, cursor + sw / 2)
      cursor += sw + nodeGap
    }
  }

  const roots = nodes.filter((n) => parents.get(n.id)!.length === 0)
  // Sort: roots with more children claim first — defines primary clusters
  roots.sort((a, b) => (children.get(b.id)?.length ?? 0) - (children.get(a.id)?.length ?? 0))
  let rootCursor = 0
  for (const root of roots) {
    const sw = subtreeWidth(root.id)
    placeSubtree(root.id, rootCursor + sw / 2)
    rootCursor += sw + clusterGap
  }

  // Step 4b: Post-placement sibling reorder (crossing minimization)
  // All positions are now real. Re-sort each node's children by downstream centroid.
  // Reverse-topological order: leaves first, roots last (ensures child reorders
  // propagate into parent centroid computation).
  const sortedNodes = [...nodes].sort((a, b) => (rank.get(b.id) ?? 0) - (rank.get(a.id) ?? 0))

  for (const node of sortedNodes) {
    const kids = children.get(node.id)!.filter((c) => (rank.get(c) ?? 0) > (rank.get(node.id) ?? 0))
    if (kids.length < 2) continue

    // Skip multi-parent kids — step 5 will override their positions
    const ownedKids = kids.filter((k) => (parents.get(k)?.length ?? 0) <= 1)
    if (ownedKids.length < 2) continue

    // Current order by x position
    const currentOrder = [...ownedKids].sort(
      (a, b) => (positions.get(a)?.x ?? 0) - (positions.get(b)?.x ?? 0),
    )

    // Desired order: sort by x-centroid of THEIR placed children (real barycenter)
    const barycenter = (kidId: string): number => {
      const grandkids = children
        .get(kidId)!
        .filter((c) => (rank.get(c) ?? 0) > (rank.get(kidId) ?? 0))
      if (grandkids.length === 0) return positions.get(kidId)?.x ?? 0 // leaf: own x
      let sum = 0,
        count = 0
      for (const gc of grandkids) {
        const pos = positions.get(gc)
        if (pos) {
          sum += pos.x
          count++
        }
      }
      return count > 0 ? sum / count : (positions.get(kidId)?.x ?? 0)
    }
    const desiredOrder = [...ownedKids].sort((a, b) => barycenter(a) - barycenter(b))

    // Check if order changed (noUncheckedIndexedAccess-safe)
    const orderChanged = currentOrder.some((id, i) => {
      const desired = desiredOrder[i]
      return desired !== undefined && id !== desired
    })
    if (!orderChanged) continue

    // Reassign x-coordinates using subtree widths in the new order
    const parentPos = positions.get(node.id)
    if (!parentPos) continue
    // positions.x is LEFT EDGE — convert to center for cursor math
    const parentCenterX = parentPos.x + nodeWidth(node.id) / 2
    const totalW =
      desiredOrder.reduce((s, k) => s + subtreeWidth(k), 0) + nodeGap * (desiredOrder.length - 1)
    let cursor = parentCenterX - totalW / 2
    for (const kid of desiredOrder) {
      const sw = subtreeWidth(kid)
      const newCenterX = cursor + sw / 2
      const oldPos = positions.get(kid)
      if (oldPos) {
        // oldPos.x is left edge, newCenterX is center — convert to left edge for delta
        const oldCenterX = oldPos.x + nodeWidth(kid) / 2
        const dx = newCenterX - oldCenterX
        if (Math.abs(dx) < 1) {
          cursor += sw + nodeGap
          continue
        } // skip negligible shifts
        // Shift this kid AND all descendants by dx
        const shiftSubtree = (id: string): void => {
          const pos = positions.get(id)
          if (pos) positions.set(id, { x: pos.x + dx, y: pos.y })
          const subKids = children.get(id)!.filter((c) => (rank.get(c) ?? 0) > (rank.get(id) ?? 0))
          for (const sk of subKids) shiftSubtree(sk)
        }
        shiftSubtree(kid)
      }
      cursor += sw + nodeGap
    }
  }

  // 5. Multi-parent reposition: x = midpoint of all parent x-centroids
  for (const n of nodes) {
    const pars = parents.get(n.id)!
    if (pars.length >= 2) {
      const avgX =
        pars.reduce((s, p) => {
          const pp = positions.get(p)
          return s + (pp ? pp.x + nodeWidth(p) / 2 : 0)
        }, 0) / pars.length
      positions.set(n.id, { x: avgX - nodeWidth(n.id) / 2, y: 0 })
    }
  }

  // 6. Assign y from rank
  const rankGroups = new Map<number, string[]>()
  for (const n of nodes) {
    const r = rank.get(n.id) ?? 0
    if (!rankGroups.has(r)) rankGroups.set(r, [])
    rankGroups.get(r)!.push(n.id)
  }
  const sortedRanks = Array.from(rankGroups.keys()).sort((a, b) => a - b)
  let yAccum = 0
  for (const r of sortedRanks) {
    const ids = rankGroups.get(r)!
    const maxH = Math.max(...ids.map((id) => nodeHeight(id)))
    for (const id of ids) {
      const pos = positions.get(id)
      if (pos) pos.y = yAccum
    }
    yAccum += maxH + rankGap
  }

  // 7. Orphans: unplaced nodes go right of layout
  for (const n of nodes) {
    if (!positions.has(n.id)) {
      const r = rank.get(n.id) ?? 0
      const ids = rankGroups.get(r)
      const maxX = ids
        ? Math.max(
            ...ids
              .filter((id) => positions.has(id))
              .map((id) => positions.get(id)!.x + nodeWidth(id)),
          )
        : 0
      positions.set(n.id, { x: maxX + clusterGap, y: 0 })
    }
  }

  return positions
}

/**
 * Detect the topology type of a subgraph to select optimal layout algorithm.
 * Used by the auto-layout pipeline after AI node creation.
 */
export function detectGraphType(
  nodes: Node[],
  edges: Edge[],
): 'tree' | 'chain' | 'hub' | 'dag' | 'mesh' | 'single' | 'disconnected' {
  if (nodes.length === 0) return 'disconnected'
  if (nodes.length === 1) return 'single'
  if (edges.length === 0) return 'disconnected'

  const inDeg = new Map<string, number>()
  const outDeg = new Map<string, number>()
  nodes.forEach((n) => {
    inDeg.set(n.id, 0)
    outDeg.set(n.id, 0)
  })
  edges.forEach((e) => {
    inDeg.set(e.target, (inDeg.get(e.target) || 0) + 1)
    outDeg.set(e.source, (outDeg.get(e.source) || 0) + 1)
  })

  const maxDeg = Math.max(...nodes.map((n) => (inDeg.get(n.id) || 0) + (outDeg.get(n.id) || 0)))
  const roots = nodes.filter((n) => inDeg.get(n.id) === 0)
  const leaves = nodes.filter((n) => outDeg.get(n.id) === 0)

  // Chain: max degree 2, one root, one leaf
  if (maxDeg <= 2 && roots.length === 1 && leaves.length === 1) return 'chain'

  // Hub: one node has >50% of edges
  for (const n of nodes) {
    if ((inDeg.get(n.id) || 0) + (outDeg.get(n.id) || 0) > edges.length * 0.5) return 'hub'
  }

  // Cycle detection (DFS)
  const visited = new Set<string>()
  const stack = new Set<string>()
  const adj = new Map<string, string[]>()
  nodes.forEach((n) => adj.set(n.id, []))
  edges.forEach((e) => adj.get(e.source)?.push(e.target))
  function hasCycle(id: string): boolean {
    visited.add(id)
    stack.add(id)
    for (const nb of adj.get(id) || []) {
      if (!visited.has(nb) && hasCycle(nb)) return true
      if (stack.has(nb)) return true
    }
    stack.delete(id)
    return false
  }
  for (const n of nodes) if (!visited.has(n.id) && hasCycle(n.id)) return 'mesh'

  // Tree: one root, no node has in-degree > 1
  if (roots.length === 1 && !Array.from(inDeg.values()).some((d) => d > 1)) return 'tree'

  if (roots.length >= 1) return 'dag'
  return 'mesh'
}

/**
 * Test whether two line segments (ax1,ay1)→(ax2,ay2) and (bx1,by1)→(bx2,by2) intersect
 * at a strict interior point (excludes shared endpoints).
 */
export function segmentsIntersect(
  ax1: number,
  ay1: number,
  ax2: number,
  ay2: number,
  bx1: number,
  by1: number,
  bx2: number,
  by2: number,
): boolean {
  const d = (bx2 - bx1) * (ay2 - ay1) - (by2 - by1) * (ax2 - ax1)
  if (Math.abs(d) < 1e-10) return false
  const t = ((bx1 - ax1) * (ay2 - ay1) - (by1 - ay1) * (ax2 - ax1)) / d
  const u = ((bx1 - ax1) * (by2 - by1) - (by1 - ay1) * (bx2 - bx1)) / d
  return t > 0 && t < 1 && u > 0 && u < 1
}
