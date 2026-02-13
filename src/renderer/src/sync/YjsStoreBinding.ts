/**
 * YjsStoreBinding — Bidirectional binding between Y.Doc and Zustand store.
 *
 * When Y.Doc changes (from remote peers or local transact):
 *   → applyYjsToStore() updates Zustand without triggering outbound sync
 *
 * When Zustand store changes (from UI actions):
 *   → applyStoreToYjs() updates Y.Doc without re-triggering inbound sync
 *
 * The `_syncSource` flag on the store prevents infinite observer loops.
 */

import * as Y from 'yjs'
import type { Node, Edge } from '@xyflow/react'
import type { NodeData, EdgeData } from '@shared/types'
import { useWorkspaceStore } from '../stores/workspaceStore'
import {
  nodeToYMap,
  yMapToNode,
  edgeToYMap,
  yMapToEdge,
  yMapToWorkspaceMeta,
  objectToYMap
} from './yjs-utils'

export class YjsStoreBinding {
  private doc: Y.Doc
  private yNodes: Y.Map<Y.Map<unknown>>
  private yEdges: Y.Array<Y.Map<unknown>>
  private yMeta: Y.Map<unknown>

  private suppressOutbound = false
  private storeUnsubscribe: (() => void) | null = null
  private observersBound = false

  constructor(doc: Y.Doc) {
    this.doc = doc
    this.yNodes = doc.getMap('nodes') as Y.Map<Y.Map<unknown>>
    this.yEdges = doc.getArray('edges') as Y.Array<Y.Map<unknown>>
    this.yMeta = doc.getMap('meta') as Y.Map<unknown>
  }

  /**
   * Start observing both Y.Doc and Zustand store for changes.
   */
  bind(): void {
    if (this.observersBound) return
    this.observersBound = true

    // Observe Y.Doc → Store
    this.yNodes.observeDeep(this.handleYNodesChange)
    this.yEdges.observeDeep(this.handleYEdgesChange)
    this.yMeta.observeDeep(this.handleYMetaChange)

    // Observe Store → Y.Doc
    // Subscribe to nodes and edges changes in store
    this.storeUnsubscribe = useWorkspaceStore.subscribe(
      (state) => ({ nodes: state.nodes, edges: state.edges }),
      (current, previous) => {
        if (this.suppressOutbound) return
        this.handleStoreChange(current.nodes, current.edges, previous.nodes, previous.edges)
      },
      { equalityFn: (a, b) => a.nodes === b.nodes && a.edges === b.edges }
    )
  }

  /**
   * Stop observing and clean up.
   */
  unbind(): void {
    if (!this.observersBound) return
    this.observersBound = false

    this.yNodes.unobserveDeep(this.handleYNodesChange)
    this.yEdges.unobserveDeep(this.handleYEdgesChange)
    this.yMeta.unobserveDeep(this.handleYMetaChange)

    if (this.storeUnsubscribe) {
      this.storeUnsubscribe()
      this.storeUnsubscribe = null
    }
  }

  /**
   * Destroy the binding completely.
   */
  destroy(): void {
    this.unbind()
  }

  // ---------------------------------------------------------------------------
  // Y.Doc → Store (inbound from remote peers)
  // ---------------------------------------------------------------------------

  private handleYNodesChange = (events: Y.YEvent<Y.Map<unknown>>[]): void => {
    // Skip if this change originated from our own store → Y.Doc flow
    if (events.some(e => e.transaction.origin === 'store-binding')) return

    this.suppressOutbound = true
    try {
      const nodes: Node<NodeData>[] = []
      this.yNodes.forEach((yNode) => {
        nodes.push(yMapToNode(yNode))
      })

      // observeDeep only fires on actual Y.Doc changes, so always apply.
      // suppressOutbound prevents store→Y.Doc loop back.
      useWorkspaceStore.setState({ nodes, _syncSource: 'yjs' } as any)
    } finally {
      this.suppressOutbound = false
    }
  }

  private handleYEdgesChange = (events: Y.YEvent<Y.Array<unknown>>[]): void => {
    if (events.some(e => e.transaction.origin === 'store-binding')) return

    this.suppressOutbound = true
    try {
      const edges: Edge<EdgeData>[] = []
      this.yEdges.forEach((yEdge) => {
        if (yEdge instanceof Y.Map) {
          edges.push(yMapToEdge(yEdge as Y.Map<unknown>))
        }
      })

      useWorkspaceStore.setState({ edges, _syncSource: 'yjs' } as any)
    } finally {
      this.suppressOutbound = false
    }
  }

  private handleYMetaChange = (events: Y.YEvent<Y.Map<unknown>>[]): void => {
    if (events.some(e => e.transaction.origin === 'store-binding')) return

    this.suppressOutbound = true
    try {
      const meta = yMapToWorkspaceMeta(this.yMeta)
      const updates: Record<string, unknown> = { _syncSource: 'yjs' }

      if (meta.name) updates.workspaceName = meta.name
      if (meta.viewport) updates.viewport = meta.viewport

      useWorkspaceStore.setState(updates as any)
    } finally {
      this.suppressOutbound = false
    }
  }

  // ---------------------------------------------------------------------------
  // Store → Y.Doc (outbound from local UI actions)
  // ---------------------------------------------------------------------------

  private handleStoreChange(
    currentNodes: Node<NodeData>[],
    currentEdges: Edge<EdgeData>[],
    previousNodes: Node<NodeData>[],
    previousEdges: Edge<EdgeData>[]
  ): void {
    this.doc.transact(() => {
      // --- Nodes diff ---
      const currentNodeIds = new Set(currentNodes.map(n => n.id))
      const previousNodeIds = new Set(previousNodes.map(n => n.id))

      // Added nodes
      for (const node of currentNodes) {
        if (!previousNodeIds.has(node.id)) {
          this.yNodes.set(node.id, nodeToYMap(node, this.doc))
        }
      }

      // Removed nodes
      for (const node of previousNodes) {
        if (!currentNodeIds.has(node.id)) {
          this.yNodes.delete(node.id)
        }
      }

      // Build Map for O(1) lookups
      const previousNodeMap = new Map(previousNodes.map(n => [n.id, n]))

      // Updated nodes (position or data changed)
      for (const node of currentNodes) {
        if (previousNodeIds.has(node.id)) {
          const prevNode = previousNodeMap.get(node.id)
          if (!prevNode) continue

          const yNode = this.yNodes.get(node.id)
          if (!yNode) continue

          // Update position if changed
          if (node.position.x !== prevNode.position.x || node.position.y !== prevNode.position.y) {
            const yPosition = yNode.get('position') as Y.Map<number>
            if (yPosition) {
              if (node.position.x !== prevNode.position.x) yPosition.set('x', node.position.x)
              if (node.position.y !== prevNode.position.y) yPosition.set('y', node.position.y)
            }
          }

          // Update data if changed — shallow diff individual fields to preserve
          // concurrent edits. Immer produces new references even for unchanged fields.
          if (node.data !== prevNode.data) {
            const yData = yNode.get('data') as Y.Map<unknown> | undefined
            if (yData && yData instanceof Y.Map) {
              const data = node.data as Record<string, unknown>
              const prevData = prevNode.data as Record<string, unknown>
              for (const key of Object.keys(data)) {
                const val = data[key]
                const prevVal = prevData[key]
                if (val !== prevVal) {
                  // For nested objects, serialize to avoid deep Y.Map issues
                  if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
                    yData.set(key, JSON.parse(JSON.stringify(val)))
                  } else {
                    yData.set(key, val)
                  }
                }
              }
              // Remove deleted keys
              for (const key of Object.keys(prevData)) {
                if (!(key in data)) {
                  yData.delete(key)
                }
              }
            } else {
              // No existing yData map, create fresh
              yNode.set('data', objectToYMap(node.data as Record<string, unknown>, this.doc))
            }
          }

          // Update dimensions if changed
          if (node.width !== prevNode.width && node.width !== undefined) {
            yNode.set('width', node.width)
          }
          if (node.height !== prevNode.height && node.height !== undefined) {
            yNode.set('height', node.height)
          }
          if (node.zIndex !== prevNode.zIndex && node.zIndex !== undefined) {
            yNode.set('zIndex', node.zIndex)
          }
        }
      }

      // --- Edges diff ---
      const currentEdgeIds = new Set(currentEdges.map(e => e.id))
      const previousEdgeIds = new Set(previousEdges.map(e => e.id))

      // Find edges to add/remove
      const edgesToAdd = currentEdges.filter(e => !previousEdgeIds.has(e.id))
      const edgeIdsToRemove = new Set(
        previousEdges.filter(e => !currentEdgeIds.has(e.id)).map(e => e.id)
      )

      // Remove edges (iterate backwards to maintain indices)
      if (edgeIdsToRemove.size > 0) {
        for (let i = this.yEdges.length - 1; i >= 0; i--) {
          const yEdge = this.yEdges.get(i) as Y.Map<unknown>
          if (yEdge && edgeIdsToRemove.has(yEdge.get('id') as string)) {
            this.yEdges.delete(i, 1)
          }
        }
      }

      // Add new edges
      for (const edge of edgesToAdd) {
        this.yEdges.push([edgeToYMap(edge)])
      }

      // Build index map for O(1) yEdge lookups by edge ID
      const yEdgeIndexMap = new Map<string, number>()
      for (let i = 0; i < this.yEdges.length; i++) {
        const yEdge = this.yEdges.get(i) as Y.Map<unknown>
        if (yEdge) {
          const id = yEdge.get('id') as string
          if (id) yEdgeIndexMap.set(id, i)
        }
      }

      // Build Map for O(1) previous edge lookups
      const previousEdgeMap = new Map(previousEdges.map(e => [e.id, e]))

      // Update existing edges (data changed)
      for (const edge of currentEdges) {
        if (previousEdgeIds.has(edge.id)) {
          const prevEdge = previousEdgeMap.get(edge.id)
          if (!prevEdge || edge.data === prevEdge.data) continue

          // Find and update the edge in yEdges via index map
          const yIdx = yEdgeIndexMap.get(edge.id)
          if (yIdx !== undefined) {
            const yEdge = this.yEdges.get(yIdx) as Y.Map<unknown>
            if (yEdge && edge.data) {
              const yData = new Y.Map<unknown>()
              for (const [key, value] of Object.entries(edge.data)) {
                yData.set(key, value)
              }
              yEdge.set('data', yData)
            }
          }
        }
      }
    }, 'store-binding')
  }

  // ---------------------------------------------------------------------------
  // Manual sync methods (for workspace meta changes)
  // ---------------------------------------------------------------------------

  /**
   * Push workspace name change to Y.Doc.
   */
  updateWorkspaceName(name: string): void {
    this.doc.transact(() => {
      this.yMeta.set('name', name)
      this.yMeta.set('updatedAt', Date.now())
    }, 'store-binding')
  }

  /**
   * Push workspace settings to Y.Doc.
   */
  updateWorkspaceMeta(data: Partial<{
    propertySchema: unknown
    contextSettings: unknown
    themeSettings: unknown
    workspacePreferences: unknown
    layersSortMode: string
    manualLayerOrder: string[] | null
  }>): void {
    this.doc.transact(() => {
      if (data.propertySchema !== undefined) {
        this.yMeta.set('propertySchema', JSON.stringify(data.propertySchema))
      }
      if (data.contextSettings !== undefined) {
        this.yMeta.set('contextSettings', JSON.stringify(data.contextSettings))
      }
      if (data.themeSettings !== undefined) {
        this.yMeta.set('themeSettings', JSON.stringify(data.themeSettings))
      }
      if (data.workspacePreferences !== undefined) {
        this.yMeta.set('workspacePreferences', JSON.stringify(data.workspacePreferences))
      }
      if (data.layersSortMode !== undefined) {
        this.yMeta.set('layersSortMode', data.layersSortMode)
      }
      if (data.manualLayerOrder !== undefined) {
        this.yMeta.set('manualLayerOrder', JSON.stringify(data.manualLayerOrder))
      }
      this.yMeta.set('updatedAt', Date.now())
    }, 'store-binding')
  }
}
