/**
 * Canvas Store
 *
 * Manages canvas-related state: nodes, edges, viewport, selection, clipboard.
 * This store is being extracted from workspaceStore as part of the store split.
 *
 * Created as part of Batch 0B: Split workspaceStore
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { subscribeWithSelector } from 'zustand/middleware'
import { enableMapSet } from 'immer'
import { v4 as uuid } from 'uuid'
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react'
import type { Node, Edge, NodeChange, EdgeChange, Connection } from '@xyflow/react'
import type { NodeData, EdgeData } from '@shared/types'
import type { CanvasState } from './types'
import { createNodeData, DEFAULT_NODE_DIMENSIONS } from './nodeFactories'
import { DEFAULT_EDGE_DATA } from '@shared/types'

// Enable Immer support for Map and Set
enableMapSet()

// =============================================================================
// Action Types
// =============================================================================

type AlignmentType = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'

interface CanvasActions {
  // Node CRUD
  addNode: (type: NodeData['type'], position: { x: number; y: number }) => string
  updateNode: (nodeId: string, data: Partial<NodeData>) => void
  updateBulkNodes: (nodeIds: string[], data: Partial<NodeData>) => void
  deleteNodes: (nodeIds: string[]) => void
  moveNode: (nodeId: string, position: { x: number; y: number }) => void
  resizeNode: (nodeId: string, dimensions: { width?: number; height?: number }) => void
  changeNodeType: (nodeId: string, newType: NodeData['type']) => void

  // Edge CRUD
  addEdge: (source: string, target: string) => string
  updateEdge: (edgeId: string, data: Partial<EdgeData>) => void
  deleteEdges: (edgeIds: string[]) => void
  reverseEdge: (edgeId: string) => void
  reconnectEdge: (oldEdge: Edge<EdgeData>, newConnection: Connection) => void

  // Selection
  setSelectedNodes: (ids: string[]) => void
  setSelectedEdges: (ids: string[]) => void
  clearSelection: () => void
  selectAll: () => void

  // Clipboard
  copyNodes: (ids: string[]) => void
  cutNodes: (ids: string[]) => void
  pasteNodes: (position: { x: number; y: number }) => string[]
  clearClipboard: () => void

  // Viewport
  setViewport: (viewport: { x: number; y: number; zoom: number }) => void

  // Alignment & Distribution
  alignNodes: (ids: string[], alignment: AlignmentType) => void
  distributeNodes: (ids: string[], direction: 'horizontal' | 'vertical') => void

  // Linking
  linkSelectedNodes: (nodeIds: string[]) => void
  unlinkSelectedNodes: (nodeIds: string[]) => void

  // React Flow callbacks
  onNodesChange: (changes: NodeChange<Node<NodeData>>[]) => void
  onEdgesChange: (changes: EdgeChange<Edge<EdgeData>>[]) => void
  onConnect: (connection: Connection) => void

  // Drag/resize tracking
  startDrag: (nodeId: string, position: { x: number; y: number }) => void
  endDrag: () => void
  startResize: (nodeId: string, dimensions: { width: number; height: number }) => void
  endResize: () => void

  // Visual feedback
  setStreamingConversation: (nodeId: string, isStreaming: boolean) => void
  addRecentlySpawnedNode: (nodeId: string) => void
  removeRecentlySpawnedNode: (nodeId: string) => void
  updateNodeTimestamp: (nodeId: string) => void
}

// =============================================================================
// Store Type
// =============================================================================

type CanvasStore = CanvasState & CanvasActions

// =============================================================================
// Initial State
// =============================================================================

const initialCanvasState: CanvasState = {
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  selectedNodeIds: [],
  selectedEdgeIds: [],
  clipboardNodes: [],
  clipboardEdges: [],
  clipboardState: null,
  lastCanvasClick: null,
  lastCreatedNodeId: null,
  dragStartPositions: new Map(),
  resizeStartDimensions: new Map(),
  streamingConversations: new Set(),
  recentlySpawnedNodes: new Set(),
  spawningNodeIds: [],
  nodeUpdatedAt: new Map()
}

// =============================================================================
// Store Creation
// =============================================================================

/**
 * Canvas store - manages nodes, edges, viewport, selection, clipboard.
 *
 * NOTE: During migration, these actions are stubs that delegate to workspaceStore.
 * Once migration is complete, the full implementations will live here.
 */
export const useCanvasStore = create<CanvasStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      ...initialCanvasState,

      // -------------------------------------------------------------------------
      // Node CRUD - Core canvas operations
      // NOTE: These handle pure canvas state. History/dirty tracking done by workspaceStore.
      // -------------------------------------------------------------------------

      addNode: (type, position) => {
        const id = uuid()
        const data = createNodeData(type)
        const dimensions = DEFAULT_NODE_DIMENSIONS[type] || { width: 280, height: 120 }

        set((state) => {
          // Compute zIndex higher than all existing nodes
          const maxZ = state.nodes.reduce((max, n) => Math.max(max, n.zIndex || 0), 0)

          const node: Node<NodeData> = {
            id,
            type,
            position,
            data,
            width: dimensions.width,
            height: dimensions.height,
            selected: true,
            zIndex: maxZ + 1
          }

          // Deselect all other nodes
          state.nodes.forEach((n) => {
            n.selected = false
          })
          state.nodes.push(node)
          state.selectedNodeIds = [id]
          state.lastCreatedNodeId = id

          // Track spawned node for animation
          state.recentlySpawnedNodes.add(id)
        })

        // Auto-clear spawn animation state
        setTimeout(() => {
          set((state) => {
            state.recentlySpawnedNodes.delete(id)
          })
        }, 300)

        return id
      },

      updateNode: (nodeId, data) => {
        set((state) => {
          const node = state.nodes.find((n) => n.id === nodeId)
          if (node) {
            const now = Date.now()
            Object.assign(node.data, data, { updatedAt: now })
            // Update warmth tracking
            state.nodeUpdatedAt = new Map(state.nodeUpdatedAt)
            state.nodeUpdatedAt.set(nodeId, now)
          }
        })
      },

      updateBulkNodes: (nodeIds, data) => {
        set((state) => {
          const now = Date.now()
          state.nodeUpdatedAt = new Map(state.nodeUpdatedAt)
          for (const nodeId of nodeIds) {
            const node = state.nodes.find((n) => n.id === nodeId)
            if (node) {
              Object.assign(node.data, data, { updatedAt: now })
              state.nodeUpdatedAt.set(nodeId, now)
            }
          }
        })
      },

      deleteNodes: (nodeIds) => {
        set((state) => {
          // Remove nodes
          state.nodes = state.nodes.filter((n) => !nodeIds.includes(n.id))
          // Remove connected edges
          state.edges = state.edges.filter(
            (e) => !nodeIds.includes(e.source) && !nodeIds.includes(e.target)
          )
          // Update selection
          state.selectedNodeIds = state.selectedNodeIds.filter((id) => !nodeIds.includes(id))
        })
      },

      moveNode: (nodeId, position) => {
        set((state) => {
          const node = state.nodes.find((n) => n.id === nodeId)
          if (node) {
            node.position = position
          }
        })
      },

      resizeNode: (nodeId, dimensions) => {
        set((state) => {
          const node = state.nodes.find((n) => n.id === nodeId)
          if (node) {
            if (dimensions.width !== undefined) node.width = dimensions.width
            if (dimensions.height !== undefined) node.height = dimensions.height
          }
        })
      },

      changeNodeType: (nodeId, newType) => {
        set((state) => {
          const node = state.nodes.find((n) => n.id === nodeId)
          if (node) {
            const newData = createNodeData(newType)
            const newDimensions = DEFAULT_NODE_DIMENSIONS[newType]
            // Preserve common fields
            if ('title' in node.data && 'title' in newData) {
              ;(newData as { title: string }).title = (node.data as { title: string }).title
            }
            node.type = newType
            node.data = newData
            node.width = newDimensions.width
            node.height = newDimensions.height
          }
        })
      },

      // -------------------------------------------------------------------------
      // Edge CRUD - Core canvas operations
      // -------------------------------------------------------------------------

      addEdge: (source, target) => {
        const id = uuid()
        set((state) => {
          // Prevent duplicate edges
          const exists = state.edges.some(
            (e) => e.source === source && e.target === target
          )
          if (!exists) {
            const edge: Edge<EdgeData> = {
              id,
              source,
              target,
              data: {
                ...DEFAULT_EDGE_DATA,
                createdAt: Date.now(),
                updatedAt: Date.now()
              }
            }
            state.edges.push(edge)
          }
        })
        return id
      },

      updateEdge: (edgeId, data) => {
        set((state) => {
          const edge = state.edges.find((e) => e.id === edgeId)
          if (edge && edge.data) {
            Object.assign(edge.data, data, { updatedAt: Date.now() })
          }
        })
      },

      deleteEdges: (edgeIds) => {
        set((state) => {
          state.edges = state.edges.filter((e) => !edgeIds.includes(e.id))
          state.selectedEdgeIds = state.selectedEdgeIds.filter((id) => !edgeIds.includes(id))
        })
      },

      reverseEdge: (edgeId) => {
        set((state) => {
          const edge = state.edges.find((e) => e.id === edgeId)
          if (edge) {
            const temp = edge.source
            edge.source = edge.target
            edge.target = temp
            if (edge.data) edge.data.updatedAt = Date.now()
          }
        })
      },

      reconnectEdge: (oldEdge, newConnection) => {
        set((state) => {
          const edgeIndex = state.edges.findIndex((e) => e.id === oldEdge.id)
          if (edgeIndex !== -1 && newConnection.source && newConnection.target) {
            state.edges[edgeIndex] = {
              ...state.edges[edgeIndex],
              source: newConnection.source,
              target: newConnection.target,
              sourceHandle: newConnection.sourceHandle ?? undefined,
              targetHandle: newConnection.targetHandle ?? undefined,
              data: {
                ...state.edges[edgeIndex].data,
                updatedAt: Date.now()
              } as EdgeData
            }
          }
        })
      },

      // -------------------------------------------------------------------------
      // Selection - Core canvas operations
      // -------------------------------------------------------------------------

      setSelectedNodes: (ids) => {
        set((state) => {
          state.selectedNodeIds = ids
          // Sync with node.selected property
          state.nodes.forEach((n) => {
            n.selected = ids.includes(n.id)
          })
        })
      },

      setSelectedEdges: (ids) => {
        set((state) => {
          state.selectedEdgeIds = ids
          // Sync with edge.selected property
          state.edges.forEach((e) => {
            e.selected = ids.includes(e.id)
          })
        })
      },

      clearSelection: () => {
        set((state) => {
          state.selectedNodeIds = []
          state.selectedEdgeIds = []
          state.nodes.forEach((n) => {
            n.selected = false
          })
          state.edges.forEach((e) => {
            e.selected = false
          })
        })
      },

      selectAll: () => {
        set((state) => {
          state.selectedNodeIds = state.nodes.map((n) => n.id)
          state.selectedEdgeIds = state.edges.map((e) => e.id)
          state.nodes.forEach((n) => {
            n.selected = true
          })
          state.edges.forEach((e) => {
            e.selected = true
          })
        })
      },

      // -------------------------------------------------------------------------
      // Clipboard - Core canvas operations
      // -------------------------------------------------------------------------

      copyNodes: (ids) => {
        set((state) => {
          const nodesToCopy = state.nodes.filter((n) => ids.includes(n.id))
          const edgesToCopy = state.edges.filter(
            (e) => ids.includes(e.source) && ids.includes(e.target)
          )
          state.clipboardNodes = JSON.parse(JSON.stringify(nodesToCopy))
          state.clipboardEdges = JSON.parse(JSON.stringify(edgesToCopy))
          state.clipboardState = { mode: 'copy', nodeIds: ids }
        })
      },

      cutNodes: (ids) => {
        set((state) => {
          const nodesToCut = state.nodes.filter((n) => ids.includes(n.id))
          const edgesToCut = state.edges.filter(
            (e) => ids.includes(e.source) && ids.includes(e.target)
          )
          state.clipboardNodes = JSON.parse(JSON.stringify(nodesToCut))
          state.clipboardEdges = JSON.parse(JSON.stringify(edgesToCut))
          state.clipboardState = { mode: 'cut', nodeIds: ids }
        })
      },

      pasteNodes: (position) => {
        const state = get()
        if (state.clipboardNodes.length === 0) return []

        const newIds: string[] = []
        const idMap = new Map<string, string>()

        // Calculate offset from first node to paste position
        const firstNode = state.clipboardNodes[0]
        const offsetX = position.x - firstNode.position.x
        const offsetY = position.y - firstNode.position.y

        set((st) => {
          // Get max zIndex
          const maxZ = st.nodes.reduce((max, n) => Math.max(max, n.zIndex || 0), 0)

          // Create new nodes with new IDs
          for (const node of state.clipboardNodes) {
            const newId = uuid()
            idMap.set(node.id, newId)
            newIds.push(newId)

            const newNode: Node<NodeData> = {
              ...JSON.parse(JSON.stringify(node)),
              id: newId,
              position: {
                x: node.position.x + offsetX,
                y: node.position.y + offsetY
              },
              selected: true,
              zIndex: maxZ + 1 + newIds.length
            }
            st.nodes.push(newNode)
          }

          // Create new edges with remapped IDs
          for (const edge of state.clipboardEdges) {
            const newSource = idMap.get(edge.source)
            const newTarget = idMap.get(edge.target)
            if (newSource && newTarget) {
              const newEdge: Edge<EdgeData> = {
                ...JSON.parse(JSON.stringify(edge)),
                id: uuid(),
                source: newSource,
                target: newTarget
              }
              st.edges.push(newEdge)
            }
          }

          // Deselect previous selection, select pasted nodes
          st.nodes.forEach((n) => {
            n.selected = newIds.includes(n.id)
          })
          st.selectedNodeIds = newIds
        })

        return newIds
      },

      clearClipboard: () => {
        set((state) => {
          state.clipboardNodes = []
          state.clipboardEdges = []
          state.clipboardState = null
        })
      },

      // -------------------------------------------------------------------------
      // Viewport (can implement directly - simple state update)
      // -------------------------------------------------------------------------

      setViewport: (viewport) => {
        set((state) => {
          state.viewport = viewport
        })
      },

      // -------------------------------------------------------------------------
      // Alignment & Distribution - Core canvas operations
      // -------------------------------------------------------------------------

      alignNodes: (ids, alignment) => {
        set((state) => {
          const nodesToAlign = state.nodes.filter((n) => ids.includes(n.id))
          if (nodesToAlign.length < 2) return

          switch (alignment) {
            case 'left': {
              const minX = Math.min(...nodesToAlign.map((n) => n.position.x))
              nodesToAlign.forEach((n) => {
                n.position.x = minX
              })
              break
            }
            case 'center': {
              const centerX =
                nodesToAlign.reduce((sum, n) => sum + n.position.x + (n.width || 0) / 2, 0) /
                nodesToAlign.length
              nodesToAlign.forEach((n) => {
                n.position.x = centerX - (n.width || 0) / 2
              })
              break
            }
            case 'right': {
              const maxX = Math.max(...nodesToAlign.map((n) => n.position.x + (n.width || 0)))
              nodesToAlign.forEach((n) => {
                n.position.x = maxX - (n.width || 0)
              })
              break
            }
            case 'top': {
              const minY = Math.min(...nodesToAlign.map((n) => n.position.y))
              nodesToAlign.forEach((n) => {
                n.position.y = minY
              })
              break
            }
            case 'middle': {
              const centerY =
                nodesToAlign.reduce((sum, n) => sum + n.position.y + (n.height || 0) / 2, 0) /
                nodesToAlign.length
              nodesToAlign.forEach((n) => {
                n.position.y = centerY - (n.height || 0) / 2
              })
              break
            }
            case 'bottom': {
              const maxY = Math.max(...nodesToAlign.map((n) => n.position.y + (n.height || 0)))
              nodesToAlign.forEach((n) => {
                n.position.y = maxY - (n.height || 0)
              })
              break
            }
          }
        })
      },

      distributeNodes: (ids, direction) => {
        set((state) => {
          const nodesToDistribute = state.nodes.filter((n) => ids.includes(n.id))
          if (nodesToDistribute.length < 3) return

          if (direction === 'horizontal') {
            nodesToDistribute.sort((a, b) => a.position.x - b.position.x)
            const first = nodesToDistribute[0]
            const last = nodesToDistribute[nodesToDistribute.length - 1]
            const totalSpace = last.position.x - first.position.x
            const gap = totalSpace / (nodesToDistribute.length - 1)
            nodesToDistribute.forEach((n, i) => {
              n.position.x = first.position.x + gap * i
            })
          } else {
            nodesToDistribute.sort((a, b) => a.position.y - b.position.y)
            const first = nodesToDistribute[0]
            const last = nodesToDistribute[nodesToDistribute.length - 1]
            const totalSpace = last.position.y - first.position.y
            const gap = totalSpace / (nodesToDistribute.length - 1)
            nodesToDistribute.forEach((n, i) => {
              n.position.y = first.position.y + gap * i
            })
          }
        })
      },

      // -------------------------------------------------------------------------
      // Linking - Core canvas operations
      // -------------------------------------------------------------------------

      linkSelectedNodes: (nodeIds) => {
        if (nodeIds.length < 2) return

        set((state) => {
          // Link nodes in a chain
          for (let i = 0; i < nodeIds.length - 1; i++) {
            const source = nodeIds[i]
            const target = nodeIds[i + 1]
            // Check if edge already exists
            const exists = state.edges.some(
              (e) => e.source === source && e.target === target
            )
            if (!exists) {
              const edge: Edge<EdgeData> = {
                id: uuid(),
                source,
                target,
                data: {
                  ...DEFAULT_EDGE_DATA,
                  createdAt: Date.now(),
                  updatedAt: Date.now()
                }
              }
              state.edges.push(edge)
            }
          }
        })
      },

      unlinkSelectedNodes: (nodeIds) => {
        set((state) => {
          // Remove edges between any of the selected nodes
          state.edges = state.edges.filter(
            (e) => !(nodeIds.includes(e.source) && nodeIds.includes(e.target))
          )
        })
      },

      // -------------------------------------------------------------------------
      // React Flow callbacks - Core canvas operations
      // -------------------------------------------------------------------------

      onNodesChange: (changes) => {
        set((state) => {
          state.nodes = applyNodeChanges(changes, state.nodes) as Node<NodeData>[]

          // Keep selectedNodeIds in sync with node.selected
          const newSelectedIds = state.nodes.filter((n) => n.selected).map((n) => n.id)
          if (
            newSelectedIds.length !== state.selectedNodeIds.length ||
            !newSelectedIds.every((id) => state.selectedNodeIds.includes(id))
          ) {
            state.selectedNodeIds = newSelectedIds
          }
        })
      },

      onEdgesChange: (changes) => {
        set((state) => {
          state.edges = applyEdgeChanges(changes, state.edges) as Edge<EdgeData>[]

          // Keep selectedEdgeIds in sync with edge.selected
          const newSelectedIds = state.edges.filter((e) => e.selected).map((e) => e.id)
          if (
            newSelectedIds.length !== state.selectedEdgeIds.length ||
            !newSelectedIds.every((id) => state.selectedEdgeIds.includes(id))
          ) {
            state.selectedEdgeIds = newSelectedIds
          }
        })
      },

      onConnect: (connection) => {
        if (!connection.source || !connection.target) return
        // Prevent self-loops
        if (connection.source === connection.target) return

        set((state) => {
          // Check if edge already exists
          const exists = state.edges.some(
            (e) => e.source === connection.source && e.target === connection.target
          )
          if (!exists) {
            const edge: Edge<EdgeData> = {
              id: uuid(),
              source: connection.source!,
              target: connection.target!,
              sourceHandle: connection.sourceHandle ?? undefined,
              targetHandle: connection.targetHandle ?? undefined,
              data: {
                ...DEFAULT_EDGE_DATA,
                createdAt: Date.now(),
                updatedAt: Date.now()
              }
            }
            state.edges.push(edge)
          }
        })
      },

      // -------------------------------------------------------------------------
      // Drag/resize tracking (can implement directly - simple state updates)
      // -------------------------------------------------------------------------

      startDrag: (nodeId, position) => {
        set((state) => {
          state.dragStartPositions.set(nodeId, position)
        })
      },

      endDrag: () => {
        set((state) => {
          state.dragStartPositions.clear()
        })
      },

      startResize: (nodeId, dimensions) => {
        set((state) => {
          state.resizeStartDimensions.set(nodeId, dimensions)
        })
      },

      endResize: () => {
        set((state) => {
          state.resizeStartDimensions.clear()
        })
      },

      // -------------------------------------------------------------------------
      // Visual feedback (can implement directly - simple state updates)
      // -------------------------------------------------------------------------

      setStreamingConversation: (nodeId, isStreaming) => {
        set((state) => {
          if (isStreaming) {
            state.streamingConversations.add(nodeId)
          } else {
            state.streamingConversations.delete(nodeId)
          }
        })
      },

      addRecentlySpawnedNode: (nodeId) => {
        set((state) => {
          state.recentlySpawnedNodes.add(nodeId)
        })
      },

      removeRecentlySpawnedNode: (nodeId) => {
        set((state) => {
          state.recentlySpawnedNodes.delete(nodeId)
        })
      },

      updateNodeTimestamp: (nodeId) => {
        set((state) => {
          state.nodeUpdatedAt.set(nodeId, Date.now())
        })
      }
    }))
  )
)

// =============================================================================
// Selectors
// =============================================================================

/**
 * Get all nodes
 */
export const selectNodes = (state: CanvasStore) => state.nodes

/**
 * Get all edges
 */
export const selectEdges = (state: CanvasStore) => state.edges

/**
 * Get selected node IDs
 */
export const selectSelectedNodeIds = (state: CanvasStore) => state.selectedNodeIds

/**
 * Get selected edge IDs
 */
export const selectSelectedEdgeIds = (state: CanvasStore) => state.selectedEdgeIds

/**
 * Get viewport
 */
export const selectViewport = (state: CanvasStore) => state.viewport

/**
 * Check if a node is streaming
 */
export const selectIsNodeStreaming = (nodeId: string) => (state: CanvasStore) =>
  state.streamingConversations.has(nodeId)

/**
 * Check if a node was recently spawned
 */
export const selectIsRecentlySpawned = (nodeId: string) => (state: CanvasStore) =>
  state.recentlySpawnedNodes.has(nodeId)
