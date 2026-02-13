/**
 * Layout Algorithms Utility
 *
 * Provides various automatic layout algorithms for arranging nodes on the canvas.
 * Uses dagre for hierarchical layouts and custom implementations for others.
 */

import dagre from 'dagre'
import type { Node, Edge } from '@xyflow/react'

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
  wide: { nodeGap: 120, edgeLength: 180 }
}

// Direction mapping for dagre
const DIRECTION_MAP: Record<string, 'TB' | 'LR' | 'BT' | 'RL'> = {
  'hierarchical-down': 'TB',
  'hierarchical-right': 'LR',
  'hierarchical-up': 'BT',
  'hierarchical-left': 'RL'
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
  spacing: { nodeGap: number; edgeLength: number } = SPACING_VALUES.default
): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph()
  g.setGraph({
    rankdir: direction,
    nodesep: spacing.nodeGap,
    ranksep: spacing.edgeLength,
    marginx: 50,
    marginy: 50
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
        y: layoutNode.y - height / 2
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
  options: LayoutOptions = {}
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
  options: LayoutOptions = {}
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
      y: center!.y + radius * Math.sin(angle) - height / 2
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
  options: LayoutOptions = {}
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
      icon: 'ArrowDown'
    },
    'hierarchical-right': {
      label: 'Hierarchical (Right)',
      description: 'Tree layout flowing left to right',
      icon: 'ArrowRight'
    },
    'hierarchical-up': {
      label: 'Hierarchical (Up)',
      description: 'Tree layout flowing bottom to top',
      icon: 'ArrowUp'
    },
    'hierarchical-left': {
      label: 'Hierarchical (Left)',
      description: 'Tree layout flowing right to left',
      icon: 'ArrowLeft'
    },
    force: {
      label: 'Force-directed',
      description: 'Organic clustering based on connections',
      icon: 'Sparkles'
    },
    circular: {
      label: 'Circular',
      description: 'Nodes arranged in a circle',
      icon: 'Circle'
    }
  }
