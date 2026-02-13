/**
 * Edges Store
 *
 * Manages edge CRUD operations, edge properties, and edge-related functionality.
 * Extracted from workspaceStore as part of Week 2 Stream B Track 2 Phase 2.2a.
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { subscribeWithSelector } from 'zustand/middleware'
import { v4 as uuid } from 'uuid'
import type { Edge, Connection } from '@xyflow/react'
import type { EdgeData, EdgeWaypoint, ContextMetadata } from '@shared/types'
import { DEFAULT_EDGE_DATA } from '@shared/types'

// =============================================================================
// Store State
// =============================================================================

interface EdgesState {
  edges: Edge<EdgeData>[]
}

// =============================================================================
// Store Actions
// =============================================================================

interface EdgesActions {
  // Edge CRUD
  addEdge: (connection: Connection) => string
  updateEdge: (edgeId: string, data: Partial<EdgeData>, options?: { skipHistory?: boolean }) => void
  deleteEdges: (edgeIds: string[]) => void
  reverseEdge: (edgeId: string) => void
  reconnectEdge: (oldEdge: Edge<EdgeData>, newConnection: Connection) => void

  // Waypoint operations
  commitEdgeWaypointDrag: (
    edgeId: string,
    beforeWaypoints: EdgeWaypoint[] | undefined,
    afterWaypoints: EdgeWaypoint[] | undefined
  ) => void

  // Bulk edge operations
  linkSelectedNodes: (nodeIds: string[]) => void
  linkAllNodes: (nodeIds: string[]) => void
  unlinkSelectedNodes: (nodeIds: string[]) => void

  // Outgoing edge color operations
  updateAllOutgoingEdges: (nodeId: string, color: string) => void
  resetOutgoingEdges: (nodeId: string) => void

  // State management
  setEdges: (edges: Edge<EdgeData>[]) => void
  getEdges: () => Edge<EdgeData>[]
  getEdgeById: (edgeId: string) => Edge<EdgeData> | undefined
}

// =============================================================================
// Store Type
// =============================================================================

type EdgesStore = EdgesState & EdgesActions

// =============================================================================
// Initial State
// =============================================================================

const initialState: EdgesState = {
  edges: []
}

// =============================================================================
// Store Implementation
// =============================================================================

export const useEdgesStore = create<EdgesStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      ...initialState,

      // ---------------------------------------------------------------------
      // Edge CRUD
      // ---------------------------------------------------------------------

      addEdge: (connection) => {
        if (!connection.source || !connection.target) return ''

        const edgeId = `${connection.source}-${connection.target}`

        set((state) => {
          // Prevent duplicate edges
          const exists = state.edges.some(
            (e) => e.source === connection.source && e.target === connection.target
          )
          if (!exists) {
            const edge: Edge<EdgeData> = {
              id: edgeId,
              type: 'custom',
              source: connection.source,
              target: connection.target,
              sourceHandle: connection.sourceHandle,
              targetHandle: connection.targetHandle,
              className: 'edge-new', // Animation class
              data: { ...DEFAULT_EDGE_DATA }
            }
            state.edges.push(edge)
          }
        })

        // Remove edge-new class after animation completes (400ms animation duration)
        setTimeout(() => {
          set((state) => {
            const edgeIndex = state.edges.findIndex((e) => e.id === edgeId)
            const edge = state.edges[edgeIndex]
            if (edgeIndex !== -1 && edge && edge.className === 'edge-new') {
              state.edges[edgeIndex] = { ...edge, className: undefined }
            }
          })
        }, 450)

        return edgeId
      },

      updateEdge: (edgeId, data, options) => {
        set((state) => {
          const edgeIndex = state.edges.findIndex((e) => e.id === edgeId)
          const edge = state.edges[edgeIndex]
          if (edgeIndex !== -1 && edge) {
            // Create new edge object to ensure React Flow detects the change
            const updatedEdge = {
              ...edge,
              data: { ...(edge.data || DEFAULT_EDGE_DATA), ...data }
            }
            state.edges[edgeIndex] = updatedEdge
          }
        })
      },

      deleteEdges: (edgeIds) => {
        set((state) => {
          state.edges = state.edges.filter((e) => !edgeIds.includes(e.id))
        })
      },

      reverseEdge: (edgeId) => {
        set((state) => {
          const edgeIndex = state.edges.findIndex((e) => e.id === edgeId)
          if (edgeIndex === -1) return

          const edge = state.edges[edgeIndex]
          if (!edge) return

          // Swap source/target/handles
          const newSourceHandle = edge.targetHandle?.replace('-target', '-source') || null
          const newTargetHandle = edge.sourceHandle?.replace('-source', '-target') || null

          const reversedEdge = {
            ...edge,
            source: edge.target,
            target: edge.source,
            sourceHandle: newSourceHandle,
            targetHandle: newTargetHandle,
            data: edge.data ? { ...edge.data } : undefined
          }

          state.edges = [
            ...state.edges.slice(0, edgeIndex),
            reversedEdge,
            ...state.edges.slice(edgeIndex + 1)
          ]
        })
      },

      reconnectEdge: (oldEdge, newConnection) => {
        set((state) => {
          const edgeIndex = state.edges.findIndex((e) => e.id === oldEdge.id)
          if (edgeIndex === -1) return

          // Calculate new ID based on new connection
          const newId = `${newConnection.source}-${newConnection.target}`

          // Check if this edge already exists (prevent duplicate)
          const existingEdge = state.edges.find((e) => e.id === newId && e.id !== oldEdge.id)
          if (existingEdge) {
            // Edge already exists, just delete the old one
            state.edges.splice(edgeIndex, 1)
            return
          }

          // Create reconnected edge
          const reconnectedEdge: Edge<EdgeData> = {
            ...oldEdge,
            id: newId,
            source: newConnection.source!,
            target: newConnection.target!,
            sourceHandle: newConnection.sourceHandle,
            targetHandle: newConnection.targetHandle
          }

          state.edges[edgeIndex] = reconnectedEdge
        })
      },

      // ---------------------------------------------------------------------
      // Waypoint operations
      // ---------------------------------------------------------------------

      commitEdgeWaypointDrag: (edgeId, beforeWaypoints, afterWaypoints) => {
        // Waypoint changes are committed for history tracking
        // The actual state update happens via updateEdge
        const before = beforeWaypoints ? [...beforeWaypoints] : undefined
        const after = afterWaypoints ? [...afterWaypoints] : undefined
        const changed = JSON.stringify(before) !== JSON.stringify(after)

        if (changed) {
          set((state) => {
            const edge = state.edges.find((e) => e.id === edgeId)
            if (edge && edge.data) {
              edge.data.waypoints = after
            }
          })
        }
      },

      // ---------------------------------------------------------------------
      // Bulk edge operations
      // ---------------------------------------------------------------------

      linkSelectedNodes: (nodeIds) => {
        if (nodeIds.length < 2) return

        // Create edges between consecutive nodes in spatial order
        // (This requires access to node positions, which should come from nodesStore)
        // For now, we'll create sequential connections
        for (let i = 0; i < nodeIds.length - 1; i++) {
          const source = nodeIds[i]!
          const target = nodeIds[i + 1]!
          const edgeId = `${source}-${target}`

          // Check if edge already exists
          const exists = get().edges.some(
            (e) => e.id === edgeId || (e.source === source && e.target === target)
          )
          if (!exists) {
            get().addEdge({
              source,
              target,
              sourceHandle: null,
              targetHandle: null
            })
          }
        }
      },

      linkAllNodes: (nodeIds) => {
        if (nodeIds.length < 2) return

        const edges = get().edges
        const newEdges: Edge<EdgeData>[] = []

        // Create all-to-all edges (N*(N-1)/2 pairs)
        for (let i = 0; i < nodeIds.length; i++) {
          for (let j = i + 1; j < nodeIds.length; j++) {
            const sourceId = nodeIds[i]!
            const targetId = nodeIds[j]!
            const edgeId = `${sourceId}-${targetId}`
            const reverseId = `${targetId}-${sourceId}`

            // Check if edge already exists in either direction
            const exists = edges.some(
              (e) =>
                e.id === edgeId ||
                e.id === reverseId ||
                (e.source === sourceId && e.target === targetId) ||
                (e.source === targetId && e.target === sourceId)
            )

            if (!exists) {
              newEdges.push({
                id: edgeId,
                type: 'custom',
                source: sourceId,
                target: targetId,
                sourceHandle: null,
                targetHandle: null,
                data: { ...DEFAULT_EDGE_DATA }
              })
            }
          }
        }

        if (newEdges.length > 0) {
          set((state) => {
            for (const edge of newEdges) {
              state.edges.push(edge)
            }
          })
        }
      },

      unlinkSelectedNodes: (nodeIds) => {
        if (nodeIds.length < 2) return

        const nodeIdSet = new Set(nodeIds)

        // Find all edges between selected nodes
        const edgesToDelete = get()
          .edges.filter((e) => nodeIdSet.has(e.source) && nodeIdSet.has(e.target))
          .map((e) => e.id)

        if (edgesToDelete.length > 0) {
          get().deleteEdges(edgesToDelete)
        }
      },

      // ---------------------------------------------------------------------
      // Outgoing edge color operations
      // ---------------------------------------------------------------------

      updateAllOutgoingEdges: (nodeId, color) => {
        set((state) => {
          // Find all edges where this node is the source
          const outgoingEdges = state.edges.filter((e) => e.source === nodeId)
          outgoingEdges.forEach((edge) => {
            if (!edge.data) {
              edge.data = { ...DEFAULT_EDGE_DATA }
            }
            edge.data.color = color
          })
        })
      },

      resetOutgoingEdges: (nodeId) => {
        set((state) => {
          // Find all edges where this node is the source
          const outgoingEdges = state.edges.filter((e) => e.source === nodeId)
          outgoingEdges.forEach((edge) => {
            if (edge.data) {
              edge.data.color = undefined // Reset to default
            }
          })
        })
      },

      // ---------------------------------------------------------------------
      // State management
      // ---------------------------------------------------------------------

      setEdges: (edges) => {
        set((state) => {
          state.edges = edges
        })
      },

      getEdges: () => {
        return get().edges
      },

      getEdgeById: (edgeId) => {
        return get().edges.find((e) => e.id === edgeId)
      }
    }))
  )
)

// =============================================================================
// Selector Hooks
// =============================================================================

export const useEdges = (): Edge<EdgeData>[] => useEdgesStore((state) => state.edges)

export const useEdgeById = (edgeId: string): Edge<EdgeData> | undefined =>
  useEdgesStore((state) => state.edges.find((e) => e.id === edgeId))
