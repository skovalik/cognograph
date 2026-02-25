/**
 * Tidy Up Layout — Pure Algorithm
 *
 * Force-directed layout normalization for selected nodes.
 * Used by Ctrl+Shift+L shortcut. Respects pinned anchors,
 * preserves cluster structure, normalizes inter-node gaps.
 *
 * Algorithm: Simple force-directed with simulated annealing.
 *   1. Repulsion: inverse-square between all node pairs
 *   2. Attraction: spring force between connected nodes
 *   3. Pinned nodes: exert forces but never move
 *   4. Iteration with decreasing damping (annealing)
 *
 * Zero external dependencies. Pure function only.
 */

// ─── Types ───────────────────────────────────────────────────────────

export interface LayoutNode {
  id: string
  x: number
  y: number
  width: number
  height: number
  pinned?: boolean // pinned nodes don't move, act as fixed anchors
}

export interface LayoutEdge {
  source: string
  target: string
}

export interface TidyOptions {
  horizontalGap?: number // default 80
  verticalGap?: number // default 60
  iterations?: number // default 50
  strength?: number // default 0.1
}

// ─── Main function ───────────────────────────────────────────────────

export function tidyUpLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  options?: TidyOptions
): Array<{ id: string; x: number; y: number }> {
  if (nodes.length === 0) return []

  const horizontalGap = options?.horizontalGap ?? 80
  const verticalGap = options?.verticalGap ?? 60
  const iterations = options?.iterations ?? 50
  const strength = options?.strength ?? 0.1

  // Target minimum distance based on gaps
  const targetDist = Math.max(horizontalGap, verticalGap)

  // Ideal edge length for connected nodes
  const idealEdgeLength = horizontalGap * 1.5

  // Initialize mutable positions
  const positions = new Map<string, { x: number; y: number }>()
  const isPinned = new Map<string, boolean>()

  for (const node of nodes) {
    positions.set(node.id, { x: node.x, y: node.y })
    isPinned.set(node.id, node.pinned === true)
  }

  // Build adjacency for quick edge lookup
  const adjacency = new Map<string, Set<string>>()
  for (const node of nodes) {
    adjacency.set(node.id, new Set())
  }
  const nodeIdSet = new Set(nodes.map((n) => n.id))
  for (const edge of edges) {
    if (nodeIdSet.has(edge.source) && nodeIdSet.has(edge.target)) {
      adjacency.get(edge.source)!.add(edge.target)
      adjacency.get(edge.target)!.add(edge.source)
    }
  }

  // Single node — no forces to compute
  if (nodes.length === 1) {
    const node = nodes[0]
    return [{ id: node.id, x: node.x, y: node.y }]
  }

  // Repulsion constant scales with target distance
  const repulsionK = targetDist * targetDist * 2
  const minDist = 1 // Prevent division by zero

  // ─── Force iteration loop ──────────────────────────────────────

  for (let iter = 0; iter < iterations; iter++) {
    // Simulated annealing: damping decreases each iteration
    const temperature = strength * (1 - iter / iterations)

    // Accumulate forces per node
    const forces = new Map<string, { fx: number; fy: number }>()
    for (const node of nodes) {
      forces.set(node.id, { fx: 0, fy: 0 })
    }

    // 1. Repulsion — every pair repels (inverse square)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const posA = positions.get(nodes[i].id)!
        const posB = positions.get(nodes[j].id)!

        let dx = posA.x - posB.x
        let dy = posA.y - posB.y
        let distSq = dx * dx + dy * dy
        let d = Math.sqrt(distSq)

        if (d < minDist) {
          // Nudge apart deterministically when overlapping exactly
          dx = (i - j) * 0.1
          dy = (i + j) * 0.1
          d = Math.sqrt(dx * dx + dy * dy)
          if (d < minDist) {
            dx = 1
            dy = 0
            d = 1
          }
          distSq = d * d
        }

        // Coulomb's law: F = k / r^2, direction = unit vector * force
        const force = repulsionK / distSq
        const fx = (dx / d) * force
        const fy = (dy / d) * force

        const forceA = forces.get(nodes[i].id)!
        const forceB = forces.get(nodes[j].id)!
        forceA.fx += fx
        forceA.fy += fy
        forceB.fx -= fx
        forceB.fy -= fy
      }
    }

    // 2. Attraction — connected nodes attract (spring force)
    for (const edge of edges) {
      if (!nodeIdSet.has(edge.source) || !nodeIdSet.has(edge.target)) continue

      const posA = positions.get(edge.source)!
      const posB = positions.get(edge.target)!

      const dx = posB.x - posA.x
      const dy = posB.y - posA.y
      const d = Math.max(Math.sqrt(dx * dx + dy * dy), minDist)

      // Hooke's law: F = k * (distance - restLength)
      const displacement = d - idealEdgeLength
      const force = displacement * 0.1 // spring constant

      const fx = (dx / d) * force
      const fy = (dy / d) * force

      const forceA = forces.get(edge.source)!
      const forceB = forces.get(edge.target)!
      forceA.fx += fx
      forceA.fy += fy
      forceB.fx -= fx
      forceB.fy -= fy
    }

    // 3. Apply forces with temperature damping (pinned nodes don't move)
    for (const node of nodes) {
      if (isPinned.get(node.id)) continue

      const pos = positions.get(node.id)!
      const force = forces.get(node.id)!

      // Limit maximum displacement per iteration to prevent instability
      const fMag = Math.sqrt(force.fx * force.fx + force.fy * force.fy)
      const maxDisplacement = targetDist * 0.5
      let scale = temperature
      if (fMag * temperature > maxDisplacement) {
        scale = maxDisplacement / fMag
      }

      pos.x += force.fx * scale
      pos.y += force.fy * scale
    }
  }

  // ─── Build output ──────────────────────────────────────────────

  return nodes.map((node) => {
    const pos = positions.get(node.id)!
    return {
      id: node.id,
      x: pos.x,
      y: pos.y
    }
  })
}
