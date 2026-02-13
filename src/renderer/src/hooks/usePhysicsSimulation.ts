/**
 * Real-Time Spring Physics Simulation Hook
 *
 * Provides continuous spring physics for edge length smoothing.
 * Edges act as springs pulling connected nodes toward ideal distances.
 * Nodes repel each other to prevent overlap.
 */

import { useEffect, useRef, useCallback } from 'react'
import type { Node, Edge } from '@xyflow/react'
import type { NodeData } from '@shared/types'

export interface PhysicsConfig {
  enabled: boolean
  idealEdgeLength: number      // Edge gap between node borders (default 80)
  repulsionStrength: number    // Coulomb repulsion constant (default 12000)
  attractionStrength: number   // Spring attraction constant (default 0.08)
  damping: number              // Velocity damping (default 0.9)
  alphaDecay: number           // Energy decay rate (default 0.995)
  alphaMin: number             // Minimum alpha before stopping (default 0.001)
  velocityThreshold: number    // Min velocity to consider "moving" (default 0.1)
}

export const DEFAULT_PHYSICS_CONFIG: PhysicsConfig = {
  enabled: false,
  idealEdgeLength: 80,
  repulsionStrength: 12000,
  attractionStrength: 0.08,
  damping: 0.9,
  alphaDecay: 0.995,
  alphaMin: 0.001,
  velocityThreshold: 0.1
}

/**
 * Physics strength presets
 * - gentle: Lower forces, higher damping - slower, more gradual movement
 * - medium: Balanced forces - default behavior
 * - strong: Higher forces, lower damping - snappy, responsive physics
 */
export const PHYSICS_STRENGTH_PRESETS = {
  gentle: {
    repulsionStrength: 6000,
    attractionStrength: 0.05,
    damping: 0.95,
    alphaDecay: 0.998
  },
  medium: {
    repulsionStrength: 12000,
    attractionStrength: 0.08,
    damping: 0.9,
    alphaDecay: 0.995
  },
  strong: {
    repulsionStrength: 18000,
    attractionStrength: 0.15,
    damping: 0.85,
    alphaDecay: 0.99
  }
} as const

export type PhysicsStrengthPreset = keyof typeof PHYSICS_STRENGTH_PRESETS

/**
 * Helper to create physics config with a strength preset
 */
export function getPhysicsConfigForStrength(
  strength: PhysicsStrengthPreset = 'medium'
): Partial<PhysicsConfig> {
  return PHYSICS_STRENGTH_PRESETS[strength]
}

interface SimulationState {
  velocities: Map<string, { x: number; y: number }>
  positions: Map<string, { x: number; y: number }>
  alpha: number
  isRunning: boolean
}

/**
 * Hook for real-time spring physics simulation
 *
 * @param nodes - React Flow nodes
 * @param edges - React Flow edges
 * @param config - Physics configuration
 * @param onPositionsChange - Callback when positions update
 * @param isDragging - Whether user is currently dragging (pauses physics for dragged nodes)
 */
export function usePhysicsSimulation(
  nodes: Node<NodeData>[],
  edges: Edge[],
  config: PhysicsConfig,
  onPositionsChange: (positions: Map<string, { x: number; y: number }>) => void,
  isDragging: boolean = false
): {
  reheat: () => void
  isSettled: boolean
} {
  const stateRef = useRef<SimulationState>({
    velocities: new Map(),
    positions: new Map(),
    alpha: 1,
    isRunning: false
  })

  const rafIdRef = useRef<number | null>(null)
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  const configRef = useRef(config)
  const onPositionsChangeRef = useRef(onPositionsChange)
  const isDraggingRef = useRef(isDragging)

  // Keep refs updated
  nodesRef.current = nodes
  edgesRef.current = edges
  configRef.current = config
  onPositionsChangeRef.current = onPositionsChange
  isDraggingRef.current = isDragging

  // Initialize/update positions when nodes change
  useEffect(() => {
    const state = stateRef.current

    // Add new nodes, preserve existing velocities
    nodes.forEach(node => {
      if (!state.positions.has(node.id)) {
        state.positions.set(node.id, { ...node.position })
        state.velocities.set(node.id, { x: 0, y: 0 })
      } else {
        // Update position if node was moved externally (e.g., by drag)
        const currentPos = state.positions.get(node.id)!
        const nodePos = node.position
        // If position changed significantly, update it (node was dragged)
        if (Math.abs(currentPos.x - nodePos.x) > 1 || Math.abs(currentPos.y - nodePos.y) > 1) {
          state.positions.set(node.id, { ...nodePos })
          // Reset velocity for dragged node
          state.velocities.set(node.id, { x: 0, y: 0 })
        }
      }
    })

    // Remove nodes that no longer exist
    const nodeIds = new Set(nodes.map(n => n.id))
    for (const id of state.positions.keys()) {
      if (!nodeIds.has(id)) {
        state.positions.delete(id)
        state.velocities.delete(id)
      }
    }
  }, [nodes])

  // Build adjacency list for quick edge lookup
  const getAdjacency = useCallback(() => {
    const adjacency = new Map<string, Set<string>>()
    const currentNodes = nodesRef.current
    const currentEdges = edgesRef.current

    currentNodes.forEach(n => adjacency.set(n.id, new Set()))

    currentEdges.forEach(e => {
      const sourceExists = adjacency.has(e.source)
      const targetExists = adjacency.has(e.target)
      if (sourceExists && targetExists) {
        adjacency.get(e.source)!.add(e.target)
        adjacency.get(e.target)!.add(e.source)
      }
    })

    return adjacency
  }, [])

  // Physics tick function
  const tick = useCallback(() => {
    const state = stateRef.current
    const config = configRef.current
    const nodes = nodesRef.current
    const adjacency = getAdjacency()

    const {
      repulsionStrength,
      attractionStrength,
      idealEdgeLength,
      damping,
      velocityThreshold
    } = config

    const minDistance = 10
    const COLLISION_PADDING = 20
    const COLLISION_STRENGTH = 0.35
    let totalMovement = 0

    // Read node dimensions live from nodesRef (avoids stale cached values)
    function getNodeDims(nodeId: string): { width: number; height: number } {
      const n = nodes.find(nd => nd.id === nodeId)
      return {
        width: n?.measured?.width ?? 280,
        height: n?.measured?.height ?? 140
      }
    }

    // Calculate forces for each node
    nodes.forEach(node => {
      const pos = state.positions.get(node.id)
      if (!pos) return

      let fx = 0
      let fy = 0

      // Combined repulsion + collision (single O(n^2) pass)
      nodes.forEach(other => {
        if (other.id === node.id) return
        const otherPos = state.positions.get(other.id)
        if (!otherPos) return

        const dimA = getNodeDims(node.id)
        const dimB = getNodeDims(other.id)

        // Center-to-center distance
        const cxA = pos.x + dimA.width / 2
        const cyA = pos.y + dimA.height / 2
        const cxB = otherPos.x + dimB.width / 2
        const cyB = otherPos.y + dimB.height / 2

        const dx = cxA - cxB
        const dy = cyA - cyB
        const distSq = dx * dx + dy * dy
        const dist = Math.max(Math.sqrt(distSq), minDistance)

        // Layer 1: Coulomb repulsion (alpha-modulated — settling force)
        const coulombForce = (repulsionStrength * state.alpha) / (dist * dist)
        fx += (dx / dist) * coulombForce
        fy += (dy / dist) * coulombForce

        // Layer 2: Rectangular collision (NOT alpha-modulated — hard constraint)
        const halfWidthSum = (dimA.width + dimB.width) / 2 + COLLISION_PADDING
        const halfHeightSum = (dimA.height + dimB.height) / 2 + COLLISION_PADDING
        const overlapX = halfWidthSum - Math.abs(dx)
        const overlapY = halfHeightSum - Math.abs(dy)

        if (overlapX > 0 && overlapY > 0) {
          // Push apart on axis of least overlap
          if (overlapX < overlapY) {
            fx += Math.sign(dx || 1) * overlapX * COLLISION_STRENGTH
          } else {
            fy += Math.sign(dy || 1) * overlapY * COLLISION_STRENGTH
          }
        }
      })

      // Attraction along edges (Hooke's law with direction-aware rest length)
      const neighbors = adjacency.get(node.id)
      if (neighbors) {
        neighbors.forEach(neighborId => {
          const neighborPos = state.positions.get(neighborId)
          if (!neighborPos) return

          const dimA = getNodeDims(node.id)
          const dimB = getNodeDims(neighborId)

          // Center-to-center
          const cxA = pos.x + dimA.width / 2
          const cyA = pos.y + dimA.height / 2
          const cxB = neighborPos.x + dimB.width / 2
          const cyB = neighborPos.y + dimB.height / 2

          const dx = cxB - cxA
          const dy = cyB - cyA
          const dist = Math.sqrt(dx * dx + dy * dy)

          // Direction-aware rest length: blend width/height by displacement angle
          // Horizontal -> use widths, vertical -> use heights, diagonal -> blend
          const absDx = Math.abs(dx)
          const absDy = Math.abs(dy)
          const total = absDx + absDy || 1
          const hRatio = absDx / total
          const vRatio = absDy / total

          const nodeExtent =
            hRatio * (dimA.width + dimB.width) / 2 +
            vRatio * (dimA.height + dimB.height) / 2

          const restLength = idealEdgeLength + nodeExtent
          const displacement = dist - restLength
          const force = attractionStrength * displacement * state.alpha

          if (dist > minDistance) {
            fx += (dx / dist) * force
            fy += (dy / dist) * force
          }
        })
      }

      // Update velocity with damping
      const vel = state.velocities.get(node.id)!
      vel.x = (vel.x + fx) * damping
      vel.y = (vel.y + fy) * damping

      // Clamp velocity to prevent explosions
      const maxVel = 50
      vel.x = Math.max(-maxVel, Math.min(maxVel, vel.x))
      vel.y = Math.max(-maxVel, Math.min(maxVel, vel.y))

      totalMovement += Math.abs(vel.x) + Math.abs(vel.y)
    })

    // Update positions
    nodes.forEach(node => {
      const pos = state.positions.get(node.id)
      const vel = state.velocities.get(node.id)
      if (!pos || !vel) return

      // Only move if velocity is above threshold
      if (Math.abs(vel.x) > velocityThreshold || Math.abs(vel.y) > velocityThreshold) {
        pos.x += vel.x
        pos.y += vel.y
      }
    })

    // Decay alpha (energy)
    state.alpha *= config.alphaDecay

    return totalMovement
  }, [getAdjacency])

  // Animation loop
  const animate = useCallback(() => {
    const state = stateRef.current
    const config = configRef.current

    if (!config.enabled || !state.isRunning) {
      rafIdRef.current = null
      return
    }

    // Skip physics calculation if dragging (but keep loop running)
    if (!isDraggingRef.current) {
      const movement = tick()

      // Check if simulation has settled
      if (state.alpha > config.alphaMin && movement > 0.1) {
        // Notify of position changes
        const cloned = new Map<string, { x: number; y: number }>()
        for (const [id, pos] of state.positions) {
          cloned.set(id, { x: pos.x, y: pos.y })
        }
        onPositionsChangeRef.current(cloned)
      }
    }

    // Continue loop if alpha is still significant
    if (state.alpha > config.alphaMin) {
      rafIdRef.current = requestAnimationFrame(animate)
    } else {
      state.isRunning = false
      rafIdRef.current = null
    }
  }, [tick])

  // Start/stop simulation based on enabled state
  useEffect(() => {
    const state = stateRef.current

    if (config.enabled && !state.isRunning) {
      state.isRunning = true
      state.alpha = 1 // Reheat on enable
      rafIdRef.current = requestAnimationFrame(animate)
    } else if (!config.enabled && state.isRunning) {
      state.isRunning = false
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
    }

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
    }
  }, [config.enabled, animate])

  // Reheat function - restart simulation with full energy
  const reheat = useCallback(() => {
    const state = stateRef.current
    state.alpha = 1

    if (configRef.current.enabled && !state.isRunning) {
      state.isRunning = true
      rafIdRef.current = requestAnimationFrame(animate)
    }
  }, [animate])

  // Reheat when edges change (new connections)
  useEffect(() => {
    if (config.enabled) {
      reheat()
    }
  }, [edges.length, config.enabled, reheat])

  return {
    reheat,
    isSettled: stateRef.current.alpha <= config.alphaMin
  }
}

export default usePhysicsSimulation
