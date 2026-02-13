import { useEffect, useRef } from 'react'
import type { Node } from '@xyflow/react'
import type { NodeData } from '@shared/types'
import type { ActionEvent } from '@shared/actionTypes'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { useActionStore } from '../stores/actionStore'
import { useSpatialRegionStore } from '../stores/spatialRegionStore'

/**
 * Hook that subscribes to workspace store changes and emits events to the action store.
 * Should be called once at the top level of the app (in App.tsx).
 *
 * Watches for:
 * - Node data changes (property-change events)
 * - New nodes (node-created events)
 * - New edges (connection-made events)
 * - Edge removals (connection-removed events)
 */
export function useActionSubscription(): void {
  const prevNodesRef = useRef<Map<string, Node<NodeData>>>(new Map())
  const prevEdgeCountRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    // Sync action nodes on mount
    useActionStore.getState().syncActions()

    // Listen for manual trigger events from ActionNode's play button
    const handleManualTrigger = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.actionNodeId) {
        useActionStore.getState().triggerManual(detail.actionNodeId)
      }
    }
    window.addEventListener('action:manual-trigger', handleManualTrigger)

    // Subscribe to workspace store node changes
    const unsubNodes = useWorkspaceStore.subscribe(
      (state) => state.nodes,
      (nodes) => {
        const actionStore = useActionStore.getState()
        const prevMap = prevNodesRef.current
        const currentMap = new Map<string, Node<NodeData>>()

        // Build current node map
        for (const node of nodes) {
          currentMap.set(node.id, node)
        }

        // Detect new nodes
        for (const node of nodes) {
          if (!prevMap.has(node.id)) {
            // New node created
            const event: ActionEvent = {
              type: 'node-created',
              nodeId: node.id,
              timestamp: Date.now(),
              data: { nodeType: node.data.type }
            }
            actionStore.handleEvent(event)

            // If it's an action node, register it
            if (node.data.type === 'action' && (node.data as { enabled: boolean }).enabled) {
              actionStore.registerAction(node.id, node.data as never)
            }
          }
        }

        // Detect property changes on existing nodes
        for (const node of nodes) {
          const prev = prevMap.get(node.id)
          if (prev && prev.data !== node.data) {
            // Detect specific property changes
            const oldData = prev.data as Record<string, unknown>
            const newData = node.data as Record<string, unknown>

            for (const key of Object.keys(newData)) {
              if (key === 'updatedAt' || key === 'lastAccessedAt' || key === 'accessCount') continue
              if (oldData[key] !== newData[key]) {
                const event: ActionEvent = {
                  type: 'property-change',
                  nodeId: node.id,
                  timestamp: Date.now(),
                  data: {
                    property: key,
                    oldValue: oldData[key],
                    newValue: newData[key],
                    nodeType: node.data.type
                  }
                }
                actionStore.handleEvent(event)
              }
            }

            // Re-sync action node registration if it's an action node
            if (node.data.type === 'action') {
              const actionData = node.data as { enabled: boolean }
              if (actionData.enabled) {
                actionStore.registerAction(node.id, node.data as never)
              } else {
                actionStore.unregisterAction(node.id)
              }
            }
          }
        }

        // Detect removed nodes
        for (const [nodeId] of prevMap) {
          if (!currentMap.has(nodeId)) {
            actionStore.unregisterAction(nodeId)
          }
        }

        prevNodesRef.current = currentMap
      },
      { equalityFn: Object.is }
    )

    // Subscribe to edge changes
    const unsubEdges = useWorkspaceStore.subscribe(
      (state) => state.edges,
      (edges, prevEdges) => {
        const actionStore = useActionStore.getState()

        // Detect new edges
        const prevEdgeIds = new Set(prevEdges.map(e => e.id))
        const currentEdgeIds = new Set(edges.map(e => e.id))

        for (const edge of edges) {
          if (!prevEdgeIds.has(edge.id)) {
            // New connection made
            const nodes = useWorkspaceStore.getState().nodes
            const sourceNode = nodes.find(n => n.id === edge.source)
            const targetNode = nodes.find(n => n.id === edge.target)

            // Emit for source node
            if (sourceNode) {
              const event: ActionEvent = {
                type: 'connection-made',
                nodeId: edge.source,
                timestamp: Date.now(),
                data: {
                  direction: 'outgoing',
                  connectedNodeId: edge.target,
                  connectedNodeType: targetNode?.data.type,
                  connectionCount: edges.filter(e => e.source === edge.source || e.target === edge.source).length
                }
              }
              actionStore.handleEvent(event)
            }

            // Emit for target node
            if (targetNode) {
              const event: ActionEvent = {
                type: 'connection-made',
                nodeId: edge.target,
                timestamp: Date.now(),
                data: {
                  direction: 'incoming',
                  connectedNodeId: edge.source,
                  connectedNodeType: sourceNode?.data.type,
                  connectionCount: edges.filter(e => e.source === edge.target || e.target === edge.target).length
                }
              }
              actionStore.handleEvent(event)
            }
          }
        }

        // Detect removed edges
        for (const prevEdge of prevEdges) {
          if (!currentEdgeIds.has(prevEdge.id)) {
            // Connection removed - emit for both nodes
            const connectionCountSource = edges.filter(e => e.source === prevEdge.source || e.target === prevEdge.source).length
            const connectionCountTarget = edges.filter(e => e.source === prevEdge.target || e.target === prevEdge.target).length

            const eventSource: ActionEvent = {
              type: 'connection-removed',
              nodeId: prevEdge.source,
              timestamp: Date.now(),
              data: { connectionCount: connectionCountSource }
            }
            actionStore.handleEvent(eventSource)

            const eventTarget: ActionEvent = {
              type: 'connection-removed',
              nodeId: prevEdge.target,
              timestamp: Date.now(),
              data: { connectionCount: connectionCountTarget }
            }
            actionStore.handleEvent(eventTarget)
          }
        }

        // Update edge count refs for connection-count triggers
        const newCounts = new Map<string, number>()
        for (const edge of edges) {
          newCounts.set(edge.source, (newCounts.get(edge.source) || 0) + 1)
          newCounts.set(edge.target, (newCounts.get(edge.target) || 0) + 1)
        }
        prevEdgeCountRef.current = newCounts
      },
      { equalityFn: Object.is }
    )

    // Subscribe to node position changes for spatial triggers
    const prevPositionsRef = new Map<string, { x: number; y: number }>()
    const unsubPositions = useWorkspaceStore.subscribe(
      (state) => state.nodes,
      (nodes) => {
        const actionStore = useActionStore.getState()
        const spatialStore = useSpatialRegionStore.getState()

        // Only check if there are regions defined
        if (spatialStore.regions.length === 0) return

        for (const node of nodes) {
          const prevPos = prevPositionsRef.get(node.id)
          const currPos = node.position

          // Skip if position hasn't changed
          if (prevPos && prevPos.x === currPos.x && prevPos.y === currPos.y) continue

          prevPositionsRef.set(node.id, { x: currPos.x, y: currPos.y })

          // Skip initial population (no previous position)
          if (!prevPos) continue

          // Check spatial region membership changes
          const nodeWidth = (node.width as number) || node.measured?.width || 280
          const nodeHeight = (node.height as number) || node.measured?.height || 140
          const { entered, exited } = spatialStore.checkNodePosition(
            node.id, currPos.x, currPos.y, nodeWidth, nodeHeight
          )

          // Emit region-enter events
          for (const regionId of entered) {
            const event: ActionEvent = {
              type: 'node-position-change',
              nodeId: node.id,
              timestamp: Date.now(),
              data: { enteredRegion: regionId, nodeType: node.data.type }
            }
            actionStore.handleEvent(event)
          }

          // Emit region-exit events
          for (const regionId of exited) {
            const event: ActionEvent = {
              type: 'node-position-change',
              nodeId: node.id,
              timestamp: Date.now(),
              data: { exitedRegion: regionId, nodeType: node.data.type }
            }
            actionStore.handleEvent(event)
          }
        }

        // Prune entries for deleted nodes
        const currentNodeIds = new Set(nodes.map(n => n.id))
        for (const nodeId of prevPositionsRef.keys()) {
          if (!currentNodeIds.has(nodeId)) {
            prevPositionsRef.delete(nodeId)
          }
        }
      },
      { equalityFn: Object.is }
    )

    return () => {
      unsubNodes()
      unsubEdges()
      unsubPositions()
      window.removeEventListener('action:manual-trigger', handleManualTrigger)
    }
  }, [])
}
