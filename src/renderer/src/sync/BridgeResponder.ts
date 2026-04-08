// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import type { EdgeData, NodeData } from '@shared/types'
import type { Edge, Node } from '@xyflow/react'
import { useEffect } from 'react'
import { useWorkspaceStore } from '../stores/workspaceStore'

// Web build detection — bridge is Electron-only
const isWeb = import.meta.env.VITE_BUILD_TARGET === 'web'

/**
 * Strip React Flow internals from nodes before sending through the bridge.
 * Prevents leaking renderer-only fields (selected, dragging, __rf, measured, etc.)
 * through the MCP bridge to external consumers.
 */
function serializeNodeForBridge(node: Node<NodeData>): Record<string, unknown> {
  return {
    id: node.id,
    type: node.type,
    position: node.position,
    data: node.data,
    parentId: node.parentId,
    extent: node.extent,
    expandParent: node.expandParent,
    width: node.width,
    height: node.height,
  }
}

/**
 * Strip React Flow internals from edges before sending through the bridge.
 */
function serializeEdgeForBridge(edge: Edge<EdgeData>): Record<string, unknown> {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    type: edge.type,
    data: edge.data,
  }
}

/**
 * Substring search across node title + content, with optional type filter.
 * Matches existing search logic in MCP handlers.ts:handleSearchNodes.
 */
function searchNodes(
  nodes: Node<NodeData>[],
  query: string,
  typeFilter?: string,
): Record<string, unknown>[] {
  const q = query.toLowerCase()
  return nodes
    .filter((node) => {
      if (typeFilter && node.type !== typeFilter) return false
      const title = String((node.data as Record<string, unknown>)?.title ?? '').toLowerCase()
      const content = String((node.data as Record<string, unknown>)?.content ?? '').toLowerCase()
      return title.includes(q) || content.includes(q)
    })
    .map(serializeNodeForBridge)
}

/**
 * React hook that registers bridge query handlers for MCP→renderer communication.
 * The main process forwards MCP bridge HTTP requests as IPC queries; this hook
 * handles them by reading/mutating the Zustand store and sending responses back.
 *
 * No-op in web builds (no IPC available).
 *
 * MOUNT POINT: Must be called inside Canvas() component body (not App()),
 * near other initialization hooks. This ensures access to ReactFlowProvider context.
 */
export function useBridgeResponder(): void {
  useEffect(() => {
    if (isWeb || !window.api?.bridge?.onBridgeQuery) return

    window.api.bridge.onBridgeQuery(({ requestId, type, params }) => {
      const state = useWorkspaceStore.getState()
      let result: unknown = null

      try {
        switch (type) {
          case 'get-nodes':
            result = state.nodes.map(serializeNodeForBridge)
            break

          case 'get-node': {
            const node = state.nodes.find((n) => n.id === params.id)
            result = node ? serializeNodeForBridge(node) : null
            break
          }

          case 'create-node': {
            // CRITICAL: Use the caller-provided ID, NOT addNode()'s auto-generated UUID.
            // BridgeSyncProvider generates the ID locally and caches it. If the store
            // generates a different ID, all subsequent MCP operations (get/update/delete)
            // will reference the wrong node.
            const id = params.id as string
            // CRITICAL TYPE NOTE: `type` must be cast to `NodeData['type']` (discriminated union),
            // NOT `string`. The store's node factory uses this union to determine default data.
            state.addNodeWithId(
              id,
              params.type as NodeData['type'],
              (params.data as Record<string, unknown>) ?? {},
              (params.position as { x: number; y: number }) ?? { x: 0, y: 0 },
            )
            result = { id, success: true }
            break
          }

          case 'update-node': {
            const node = state.nodes.find((n) => n.id === params.id)
            if (!node) {
              result = { error: 'Node not found' }
              break
            }
            state.updateNode(params.id as string, params.changes as Partial<NodeData>)
            result = { success: true }
            break
          }

          case 'delete-node':
            // Store uses plural: deleteNodes(ids[])
            state.deleteNodes([params.id as string])
            result = { success: true }
            break

          case 'get-edges':
            result = state.edges.map(serializeEdgeForBridge)
            break

          case 'create-edge': {
            // addEdge takes Connection object, not (source, target, data)
            const connection = {
              source: params.source as string,
              target: params.target as string,
              sourceHandle: null,
              targetHandle: null,
            }
            const edgeCountBefore = state.edges.length
            state.addEdge(connection)
            // EDGE ID FORMAT: Store generates `${source}-${target}`, NOT `e-${uuid}`.
            // The actual store ID MUST be returned so BridgeSyncProvider can update its cache.
            const currentEdges = useWorkspaceStore.getState().edges
            const newEdge =
              currentEdges.length > edgeCountBefore
                ? currentEdges[currentEdges.length - 1]
                : currentEdges.find((e) => e.source === params.source && e.target === params.target)
            result = { id: newEdge?.id, success: true }
            break
          }

          case 'delete-edge':
            // Store uses plural: deleteEdges(ids[])
            state.deleteEdges([params.id as string])
            result = { success: true }
            break

          case 'get-workspace-meta':
            result = {
              id: state.workspaceId,
              name: state.workspaceName,
              nodeCount: state.nodes.length,
              edgeCount: state.edges.length,
            }
            break

          case 'search-nodes':
            result = searchNodes(
              state.nodes,
              params.query as string,
              params.type as string | undefined,
            )
            break

          case 'get-context':
            // Context chain is NOT handled in renderer — it requires BFS over the
            // full graph, which is done by buildContextForNode() in the main process.
            // Bridge routes GET /context/:nodeId directly in mcpBridge.ts.
            result = {
              error: 'get-context is handled by bridge server, not renderer',
            }
            break

          default:
            result = { error: `Unknown query type: ${type}` }
        }
      } catch (err) {
        result = { error: String(err) }
      }

      window.api.bridge.sendBridgeResponse(requestId, result)
    })

    // Cleanup handled by removeAllListeners in preload's onBridgeQuery
    // (same pattern as onSnapshotRequest)
  }, [])
}
