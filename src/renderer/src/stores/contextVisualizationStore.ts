// Context Visualization Store — PFD Phase 4: AI Context Transparency
// Manages the visual state of context scope highlighting on the canvas.
// Activated when chat input is focused on a node.
//
// Phase 6A: Depth-of-Field rings — BFS graph distance from a focus node
// reduces visual detail of distant nodes, creating a focal gradient.

import { create } from 'zustand'
import type { ContextTraversalNode, ContextTraversalEdge } from '../utils/contextCache'

// --- DoF Types (Phase 6A) -------------------------------------------------

/** Minimal edge representation for BFS traversal */
export interface DofEdge {
  id: string
  source: string
  target: string
}

/** Minimal node representation for BFS traversal */
export interface DofNode {
  id: string
}

/** Maximum ring number — nodes 3+ hops away are capped at ring 3 */
export const DOF_MAX_RING = 3

/** Sentinel value for disconnected nodes */
export const DOF_DISCONNECTED = -1

// --- Pure BFS function (exported for testing) -----------------------------

/**
 * Computes the depth-of-field ring for every node relative to a focus node.
 * Uses BFS on an undirected interpretation of the edge graph.
 *
 * @returns Map where key = nodeId, value = ring number (0–3) or -1 for disconnected.
 *          Ring 0 = focus node, Ring 1 = 1-hop neighbors, etc.
 *          Rings > DOF_MAX_RING are capped to DOF_MAX_RING.
 */
export function computeDepthOfField(
  focusNodeId: string,
  nodes: DofNode[],
  edges: DofEdge[]
): Map<string, number> {
  const result = new Map<string, number>()

  // Initialize all nodes as disconnected
  for (const node of nodes) {
    result.set(node.id, DOF_DISCONNECTED)
  }

  // If focus node is not in the node list, still mark it as ring 0
  result.set(focusNodeId, 0)

  // Build adjacency list (undirected)
  const adjacency = new Map<string, string[]>()
  for (const edge of edges) {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, [])
    if (!adjacency.has(edge.target)) adjacency.set(edge.target, [])
    adjacency.get(edge.source)!.push(edge.target)
    adjacency.get(edge.target)!.push(edge.source)
  }

  // BFS from focus node
  const queue: string[] = [focusNodeId]
  const visited = new Set<string>([focusNodeId])

  while (queue.length > 0) {
    const current = queue.shift()!
    const currentRing = result.get(current)!
    const neighbors = adjacency.get(current) ?? []

    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) continue
      visited.add(neighbor)

      const neighborRing = Math.min(currentRing + 1, DOF_MAX_RING)
      result.set(neighbor, neighborRing)

      // Only continue BFS if we haven't hit the cap — nodes beyond cap are all ring 3
      if (neighborRing < DOF_MAX_RING) {
        queue.push(neighbor)
      } else {
        // Still need to traverse further to mark remaining connected nodes as ring 3
        queue.push(neighbor)
      }
    }
  }

  return result
}

// --- Store ----------------------------------------------------------------

interface ContextVisualizationState {
  // Is the context visualization active?
  active: boolean

  // The node whose context scope is being visualized
  targetNodeId: string | null

  // BFS traversal results for rendering
  includedNodeIds: Map<string, { depth: number; role: string; priority: string }>
  includedEdgeIds: Set<string>
  nodeCount: number

  // --- DoF state (Phase 6A) ---
  dofEnabled: boolean
  dofFocusNodeId: string | null
  /** Map of nodeId -> ring number (0-3) or -1 for disconnected */
  dofRings: Map<string, number>

  // Actions
  activate: (nodeId: string, nodes: ContextTraversalNode[], edges: ContextTraversalEdge[]) => void
  deactivate: () => void

  // DoF actions (Phase 6A)
  setDofFocus: (nodeId: string | null) => void
  setDofEnabled: (enabled: boolean) => void
  updateDofRings: (focusNodeId: string, nodes: DofNode[], edges: DofEdge[]) => void
}

export const useContextVisualizationStore = create<ContextVisualizationState>()((set) => ({
  active: false,
  targetNodeId: null,
  includedNodeIds: new Map(),
  includedEdgeIds: new Set(),
  nodeCount: 0,

  // DoF defaults
  dofEnabled: false,
  dofFocusNodeId: null,
  dofRings: new Map(),

  activate: (nodeId, nodes, edges) => {
    const nodeMap = new Map<string, { depth: number; role: string; priority: string }>()
    for (const n of nodes) {
      nodeMap.set(n.id, { depth: n.depth, role: n.role, priority: n.priority })
    }

    const edgeSet = new Set<string>()
    for (const e of edges) {
      edgeSet.add(e.id)
    }

    set({
      active: true,
      targetNodeId: nodeId,
      includedNodeIds: nodeMap,
      includedEdgeIds: edgeSet,
      nodeCount: nodes.length
    })
  },

  deactivate: () => {
    set({
      active: false,
      targetNodeId: null,
      includedNodeIds: new Map(),
      includedEdgeIds: new Set(),
      nodeCount: 0
    })
  },

  setDofFocus: (nodeId) => {
    set({ dofFocusNodeId: nodeId })
  },

  setDofEnabled: (enabled) => {
    set({ dofEnabled: enabled })
  },

  updateDofRings: (focusNodeId, nodes, edges) => {
    const rings = computeDepthOfField(focusNodeId, nodes, edges)
    set({ dofRings: rings, dofFocusNodeId: focusNodeId })
  }
}))

// --- Selectors (Phase 6A) -------------------------------------------------

/**
 * Returns the depth-of-field ring for a given node.
 * Ring 0 = focus, 1-3 = distance, -1 = disconnected.
 * Returns -1 if DoF is not active or node is not in the ring map.
 */
export function selectNodeDepthRing(nodeId: string): number {
  const state = useContextVisualizationStore.getState()
  if (!state.dofEnabled || !state.dofFocusNodeId) return DOF_DISCONNECTED
  return state.dofRings.get(nodeId) ?? DOF_DISCONNECTED
}
