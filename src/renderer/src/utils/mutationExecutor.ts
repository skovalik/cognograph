/**
 * Mutation Executor
 *
 * Executes a MutationPlan against the workspace store.
 * Uses two-pass execution for dependency resolution.
 * Creates a single BATCH history action for atomic undo.
 */

import { v4 as uuid } from 'uuid'
import type { Node, Edge } from '@xyflow/react'
import type {
  MutationPlan,
  NodeData,
  EdgeData,
  HistoryAction,
  ConversationNodeData,
  NoteNodeData,
  TaskNodeData,
  ProjectNodeData,
  ArtifactNodeData,
  WorkspaceNodeData,
  TextNodeData
} from '@shared/types'
import type { ActionNodeData } from '@shared/actionTypes'
import {
  resolvePosition,
  sortOperationsByPositionDependency,
  calculateSelectionBounds,
  calculateOptimalHandles,
  DEFAULT_NODE_DIMENSIONS,
  type PositionResolutionContext
} from './positionResolver'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { useAIEditorStore } from '../stores/aiEditorStore'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ExecutionResult {
  success: boolean
  error?: string
  createdNodeIds: string[]
  deletedNodeIds: string[]
  modifiedNodeIds: string[]
  createdEdgeIds: string[]
  deletedEdgeIds: string[]
}

// -----------------------------------------------------------------------------
// Node Creation Helpers
// -----------------------------------------------------------------------------

function createNodeData(
  type: NodeData['type'],
  partialData: Partial<NodeData>
): NodeData {
  const now = Date.now()

  switch (type) {
    case 'conversation':
      return {
        type: 'conversation',
        title: 'New Conversation',
        messages: [],
        provider: 'anthropic',
        createdAt: now,
        updatedAt: now,
        ...partialData
      } as ConversationNodeData

    case 'note':
      return {
        type: 'note',
        title: 'New Note',
        content: '',
        createdAt: now,
        updatedAt: now,
        ...partialData
      } as NoteNodeData

    case 'task':
      return {
        type: 'task',
        title: 'New Task',
        description: '',
        status: 'todo',
        priority: 'medium',
        createdAt: now,
        updatedAt: now,
        ...partialData
      } as TaskNodeData

    case 'project':
      return {
        type: 'project',
        title: 'New Project',
        description: '',
        collapsed: false,
        childNodeIds: [],
        color: '#8b5cf6',
        createdAt: now,
        updatedAt: now,
        ...partialData
      } as ProjectNodeData

    case 'artifact':
      return {
        type: 'artifact',
        title: 'New Artifact',
        content: '',
        contentType: 'text',
        source: { type: 'created', method: 'manual' },
        version: 1,
        versionHistory: [],
        versioningMode: 'update',
        injectionFormat: 'full',
        collapsed: false,
        previewLines: 10,
        createdAt: now,
        updatedAt: now,
        ...partialData
      } as ArtifactNodeData

    case 'workspace':
      return {
        type: 'workspace',
        title: 'New Workspace',
        description: '',
        showOnCanvas: true,
        showLinks: false,
        linkColor: '#ef4444',
        linkDirection: 'to-members',
        llmSettings: {
          provider: 'anthropic',
          temperature: 0.7,
          maxTokens: 4096
        },
        contextRules: {
          maxTokens: 8000,
          maxDepth: 2,
          traversalMode: 'all',
          includeDisabledNodes: false
        },
        themeDefaults: {},
        includedNodeIds: [],
        excludedNodeIds: [],
        createdAt: now,
        updatedAt: now,
        ...partialData
      } as WorkspaceNodeData

    case 'text':
      return {
        type: 'text',
        content: '',
        contentFormat: 'html',
        createdAt: now,
        updatedAt: now,
        ...partialData
      } as TextNodeData

    case 'action':
      return {
        type: 'action',
        title: 'New Action',
        description: '',
        enabled: true,
        trigger: { type: 'manual' },
        conditions: [],
        actions: [],
        runCount: 0,
        errorCount: 0,
        createdAt: now,
        updatedAt: now,
        ...partialData
      } as ActionNodeData

    case 'orchestrator':
      return {
        type: 'orchestrator',
        title: 'New Orchestrator',
        description: '',
        strategy: 'sequential',
        failurePolicy: { type: 'retry-and-continue', maxRetries: 1, retryDelayMs: 2000 },
        budget: {},
        connectedAgents: [],
        runHistory: [],
        maxHistoryRuns: 20,
        createdAt: now,
        updatedAt: now,
        ...partialData
      } as unknown as NodeData

    default:
      throw new Error(`Unknown node type: ${type}`)
  }
}

// -----------------------------------------------------------------------------
// Main Execution Function
// -----------------------------------------------------------------------------

/**
 * Execute a MutationPlan and return the result.
 * This function directly manipulates the workspace store state.
 */
export async function executeMutationPlan(plan: MutationPlan): Promise<ExecutionResult> {
  const workspaceStore = useWorkspaceStore.getState()
  const aiEditorStore = useAIEditorStore.getState()

  const result: ExecutionResult = {
    success: true,
    createdNodeIds: [],
    deletedNodeIds: [],
    modifiedNodeIds: [],
    createdEdgeIds: [],
    deletedEdgeIds: []
  }

  // Track all history actions for BATCH
  const historyActions: HistoryAction[] = []

  // Build position resolution context
  const { nodes, edges, selectedNodeIds, viewport } = workspaceStore
  const selectionInfo = calculateSelectionBounds(nodes, selectedNodeIds)

  const positionContext: PositionResolutionContext = {
    nodes: [...nodes],
    resolvedPositions: new Map(),
    viewport,
    viewportBounds: { width: window.innerWidth, height: window.innerHeight },
    selectedNodeIds,
    selectionCenter: selectionInfo?.center,
    selectionBounds: selectionInfo?.bounds
  }

  // Sort operations by position dependencies
  const sortedOps = sortOperationsByPositionDependency(plan.operations)

  // Separate operations by type for two-pass execution
  const createNodeOps = sortedOps.filter((op) => op.op === 'create-node')
  const otherOps = sortedOps.filter((op) => op.op !== 'create-node')

  try {
    aiEditorStore.startExecution()

    // -------------------------------------------------------------------------
    // Pass 1: Create all nodes first (to establish tempId -> realId mapping)
    // -------------------------------------------------------------------------

    for (const op of createNodeOps) {
      if (op.op !== 'create-node') continue

      const realId = uuid()
      const resolvedPos = resolvePosition(op.position, positionContext)

      // Register mapping
      aiEditorStore.registerTempIdMapping(op.tempId, realId)
      positionContext.resolvedPositions.set(op.tempId, resolvedPos)

      // Create the node
      const nodeData = createNodeData(op.type, op.data)
      const dimensions = op.dimensions || DEFAULT_NODE_DIMENSIONS[op.type]

      const newNode: Node<NodeData> = {
        id: realId,
        type: op.type,
        position: resolvedPos,
        data: nodeData,
        width: dimensions.width,
        height: dimensions.height,
        selected: false
      }

      // Track for result
      result.createdNodeIds.push(realId)

      // Track for history
      historyActions.push({
        type: 'ADD_NODE',
        node: JSON.parse(JSON.stringify(newNode))
      })

      // Also add to position context nodes for subsequent position resolution
      positionContext.nodes.push(newNode)
    }

    // -------------------------------------------------------------------------
    // Pass 2: Execute all other operations
    // -------------------------------------------------------------------------

    for (const op of otherOps) {
      switch (op.op) {
        case 'delete-node': {
          const node = nodes.find((n) => n.id === op.nodeId)
          if (node) {
            result.deletedNodeIds.push(op.nodeId)
            historyActions.push({
              type: 'DELETE_NODE',
              node: JSON.parse(JSON.stringify(node))
            })

            // Also delete edges connected to this node
            const connectedEdges = edges.filter(
              (e) => e.source === op.nodeId || e.target === op.nodeId
            )
            for (const edge of connectedEdges) {
              result.deletedEdgeIds.push(edge.id)
              historyActions.push({
                type: 'DELETE_EDGE',
                edge: JSON.parse(JSON.stringify(edge))
              })
            }
          }
          break
        }

        case 'update-node': {
          const node = nodes.find((n) => n.id === op.nodeId)
          if (node) {
            const before = JSON.parse(JSON.stringify(node.data))
            result.modifiedNodeIds.push(op.nodeId)
            historyActions.push({
              type: 'UPDATE_NODE',
              nodeId: op.nodeId,
              before,
              after: op.data
            })
          }
          break
        }

        case 'move-node': {
          const node = nodes.find((n) => n.id === op.nodeId)
          if (node) {
            const resolvedPos = resolvePosition(op.position, positionContext)
            result.modifiedNodeIds.push(op.nodeId)
            historyActions.push({
              type: 'MOVE_NODE',
              nodeId: op.nodeId,
              before: { x: node.position.x, y: node.position.y },
              after: resolvedPos
            })
          }
          break
        }

        case 'create-edge': {
          // Resolve tempIds to real IDs
          const sourceId = aiEditorStore.resolveId(op.source)
          const targetId = aiEditorStore.resolveId(op.target)

          // Get source/target positions and dimensions for handle calculation
          const sourceNode = nodes.find((n) => n.id === sourceId)
          const targetNode = nodes.find((n) => n.id === targetId)

          // Check for newly created nodes in this plan
          const sourcePos = positionContext.resolvedPositions.get(op.source) || sourceNode?.position
          const targetPos = positionContext.resolvedPositions.get(op.target) || targetNode?.position

          // Determine dimensions from existing nodes or context nodes (for new nodes)
          const getNodeDimensions = (nodeId: string, tempId: string): { width: number; height: number } => {
            const existingNode = nodes.find((n) => n.id === nodeId)
            if (existingNode) {
              return { width: existingNode.width || 280, height: existingNode.height || 140 }
            }
            const contextNode = positionContext.nodes.find((n) => n.id === tempId || n.id === nodeId)
            if (contextNode) {
              const nodeType = contextNode.type as NodeData['type']
              return DEFAULT_NODE_DIMENSIONS[nodeType] || { width: 280, height: 140 }
            }
            return { width: 280, height: 140 }
          }

          const sourceDim = getNodeDimensions(sourceId, op.source)
          const targetDim = getNodeDimensions(targetId, op.target)

          // Calculate optimal handles based on positions
          const { sourceHandle, targetHandle } = sourcePos && targetPos
            ? calculateOptimalHandles(sourcePos, sourceDim, targetPos, targetDim)
            : { sourceHandle: 'bottom-source', targetHandle: 'top-target' }

          const edgeId = `${sourceId}-${targetId}`
          const newEdge: Edge<EdgeData> = {
            id: edgeId,
            source: sourceId,
            target: targetId,
            sourceHandle,
            targetHandle,
            data: {
              direction: 'unidirectional',
              strength: 'normal',
              active: true,
              ...op.data
            }
          }

          result.createdEdgeIds.push(edgeId)
          historyActions.push({
            type: 'ADD_EDGE',
            edge: JSON.parse(JSON.stringify(newEdge))
          })
          break
        }

        case 'delete-edge': {
          const edge = edges.find((e) => e.id === op.edgeId)
          if (edge) {
            result.deletedEdgeIds.push(op.edgeId)
            historyActions.push({
              type: 'DELETE_EDGE',
              edge: JSON.parse(JSON.stringify(edge))
            })
          }
          break
        }

        case 'update-edge': {
          const edge = edges.find((e) => e.id === op.edgeId)
          if (edge) {
            historyActions.push({
              type: 'UPDATE_EDGE',
              edgeId: op.edgeId,
              before: JSON.parse(JSON.stringify(edge.data)),
              after: op.data
            })
          }
          break
        }
      }
    }

    // -------------------------------------------------------------------------
    // Apply all changes to the store atomically
    // -------------------------------------------------------------------------

    useWorkspaceStore.setState((state) => {
      // Apply node creations
      for (const action of historyActions) {
        if (action.type === 'ADD_NODE') {
          state.nodes.push(action.node as Node<NodeData>)
        }
      }

      // Apply node deletions
      const nodesToDelete = new Set(result.deletedNodeIds)
      state.nodes = state.nodes.filter((n) => !nodesToDelete.has(n.id))

      // Apply node updates
      for (const action of historyActions) {
        if (action.type === 'UPDATE_NODE') {
          const node = state.nodes.find((n) => n.id === action.nodeId)
          if (node) {
            Object.assign(node.data, action.after)
            node.data.updatedAt = Date.now()
          }
        }
      }

      // Apply node moves
      for (const action of historyActions) {
        if (action.type === 'MOVE_NODE') {
          const node = state.nodes.find((n) => n.id === action.nodeId)
          if (node) {
            node.position = action.after
          }
        }
      }

      // Apply edge creations
      for (const action of historyActions) {
        if (action.type === 'ADD_EDGE') {
          state.edges.push(action.edge as Edge<EdgeData>)
        }
      }

      // Apply edge deletions
      const edgesToDelete = new Set(result.deletedEdgeIds)
      state.edges = state.edges.filter((e) => !edgesToDelete.has(e.id))

      // Apply edge updates
      for (const action of historyActions) {
        if (action.type === 'UPDATE_EDGE') {
          const edge = state.edges.find((e) => e.id === action.edgeId)
          if (edge && edge.data) {
            Object.assign(edge.data, action.after)
          }
        }
      }

      // Push BATCH history action for undo
      state.history = state.history.slice(0, state.historyIndex + 1)
      state.history.push({ type: 'BATCH', actions: historyActions })
      state.historyIndex++

      // Trim history if needed
      if (state.history.length > 100) {
        state.history = state.history.slice(-100)
        state.historyIndex = state.history.length - 1
      }

      // Mark dirty
      state.isDirty = true

      return state
    })

    aiEditorStore.completeExecution()
    return result

  } catch (error) {
    const errorMsg = String(error)
    result.success = false
    result.error = errorMsg
    aiEditorStore.failExecution(errorMsg)
    return result
  }
}

// -----------------------------------------------------------------------------
// Dry Run (for preview)
// -----------------------------------------------------------------------------

/**
 * Simulate execution without actually modifying the store.
 * Returns the positions that would be calculated.
 */
export function dryRunMutationPlan(
  plan: MutationPlan,
  nodes: Node<NodeData>[],
  _edges: Edge<EdgeData>[],
  selectedNodeIds: string[],
  viewport: { x: number; y: number; zoom: number }
): {
  resolvedPositions: Map<string, { x: number; y: number }>
  tempIdToType: Map<string, NodeData['type']>
} {
  const selectionInfo = calculateSelectionBounds(nodes, selectedNodeIds)

  const positionContext: PositionResolutionContext = {
    nodes: [...nodes],
    resolvedPositions: new Map(),
    viewport,
    viewportBounds: { width: window.innerWidth, height: window.innerHeight },
    selectedNodeIds,
    selectionCenter: selectionInfo?.center,
    selectionBounds: selectionInfo?.bounds
  }

  const tempIdToType = new Map<string, NodeData['type']>()

  // Sort and process operations
  const sortedOps = sortOperationsByPositionDependency(plan.operations)

  for (const op of sortedOps) {
    if (op.op === 'create-node') {
      const resolvedPos = resolvePosition(op.position, positionContext)
      positionContext.resolvedPositions.set(op.tempId, resolvedPos)
      tempIdToType.set(op.tempId, op.type)

      // Add mock node to context for subsequent position resolution
      const dimensions = op.dimensions || DEFAULT_NODE_DIMENSIONS[op.type]
      positionContext.nodes.push({
        id: op.tempId,
        type: op.type,
        position: resolvedPos,
        data: { type: op.type } as NodeData,
        width: dimensions.width,
        height: dimensions.height
      } as Node<NodeData>)
    } else if (op.op === 'move-node') {
      const resolvedPos = resolvePosition(op.position, positionContext)
      positionContext.resolvedPositions.set(op.nodeId, resolvedPos)
    }
  }

  return {
    resolvedPositions: positionContext.resolvedPositions,
    tempIdToType
  }
}
