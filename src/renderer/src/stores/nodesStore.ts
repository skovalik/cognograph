/**
 * Nodes Store
 *
 * Manages node CRUD operations, node data updates, and node-specific functionality.
 * Extracted from workspaceStore as part of Week 2 Stream B Track 2 Phase 2.2a.
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { subscribeWithSelector } from 'zustand/middleware'
import { v4 as uuid } from 'uuid'
import type { Node } from '@xyflow/react'
import type {
  NodeData,
  ConversationNodeData,
  ProjectNodeData,
  NoteNodeData,
  TaskNodeData,
  TextNodeData,
  ArtifactNodeData,
  WorkspaceNodeData,
  ActionNodeData,
  ContextMetadata,
  ArtifactContentType,
  ArtifactSource
} from '@shared/types'
import {
  createConversationData,
  createProjectData,
  createNoteData,
  createTaskData,
  createArtifactData,
  createWorkspaceData,
  createTextData,
  createOrchestratorData,
  DEFAULT_NODE_DIMENSIONS
} from './nodeFactories'

// =============================================================================
// Store State
// =============================================================================

interface NodesState {
  nodes: Node<NodeData>[]
  nodeUpdatedAt: Map<string, number> // Tracks last content-edit time per node (for warmth indicator)
  recentlySpawnedNodes: Set<string> // Set of nodeIds that were just created (for spawn animation)
  spawningNodeIds: string[] // Array of nodeIds currently spawning (for extraction animations)
}

// =============================================================================
// Store Actions
// =============================================================================

interface NodesActions {
  // Node CRUD
  addNode: (type: NodeData['type'], position: { x: number; y: number }) => string
  addAgentNode: (position: { x: number; y: number }) => string
  updateNode: (nodeId: string, data: Partial<NodeData>) => void
  updateBulkNodes: (nodeIds: string[], data: Partial<NodeData>) => void
  deleteNodes: (nodeIds: string[]) => void
  changeNodeType: (nodeId: string, newType: NodeData['type']) => void
  duplicateNode: (nodeId: string, offset?: { x: number; y: number }) => string

  // Node positioning and dimensions
  moveNode: (nodeId: string, position: { x: number; y: number }) => void
  resizeNode: (nodeId: string, dimensions: { width?: number; height?: number }) => void
  updateNodeDimensions: (nodeId: string, width: number, height: number) => void

  // Node properties
  setNodeProperty: (nodeId: string, propertyId: string, value: unknown) => void
  getNodeProperty: (nodeId: string, propertyId: string) => unknown

  // Node activation
  evaluateNodeActivation: (nodeId: string) => void
  evaluateAllNodeActivations: () => void

  // Project grouping
  addNodeToProject: (nodeId: string, projectId: string) => void
  removeNodeFromProject: (nodeId: string) => void
  getNodeParentId: (nodeId: string) => string | null
  getChildNodeIds: (nodeId: string) => string[]

  // Outgoing edge colors
  setOutgoingEdgeColor: (nodeId: string, color: string | undefined) => void

  // Visual feedback
  updateNodeTimestamp: (nodeId: string) => void
  addSpawningNode: (nodeId: string) => void
  removeSpawningNode: (nodeId: string) => void
  addRecentlySpawnedNode: (nodeId: string) => void
  removeRecentlySpawnedNode: (nodeId: string) => void

  // State management
  setNodes: (nodes: Node<NodeData>[]) => void
  getNodes: () => Node<NodeData>[]
  getNodeById: (nodeId: string) => Node<NodeData> | undefined
}

// =============================================================================
// Store Type
// =============================================================================

type NodesStore = NodesState & NodesActions

// =============================================================================
// Initial State
// =============================================================================

const initialState: NodesState = {
  nodes: [],
  nodeUpdatedAt: new Map(),
  recentlySpawnedNodes: new Set(),
  spawningNodeIds: []
}

// =============================================================================
// Store Implementation
// =============================================================================

export const useNodesStore = create<NodesStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      ...initialState,

      // ---------------------------------------------------------------------
      // Node CRUD
      // ---------------------------------------------------------------------

      addNode: (type, position) => {
        const id = uuid()
        let data: NodeData
        let dimensions = { width: 280, height: 120 }

        switch (type) {
          case 'conversation':
            data = createConversationData()
            dimensions = { width: 300, height: 140 }
            break
          case 'project': {
            const projectColor = '#64748b' // TODO: Get from theme settings
            data = createProjectData(projectColor)
            dimensions = { width: 400, height: 300 }
            break
          }
          case 'note':
            data = createNoteData()
            dimensions = { width: 280, height: 140 }
            break
          case 'task':
            data = createTaskData()
            dimensions = { width: 260, height: 140 }
            break
          case 'artifact':
            data = createArtifactData()
            dimensions = { width: 320, height: 200 }
            break
          case 'workspace':
            data = createWorkspaceData()
            dimensions = { width: 320, height: 220 }
            break
          case 'text':
            data = createTextData()
            dimensions = { width: 200, height: 60 }
            break
          case 'action':
            data = createActionData()
            dimensions = { width: 280, height: 140 }
            break
          case 'orchestrator':
            data = createOrchestratorData()
            dimensions = { width: 360, height: 280 }
            break
          default:
            throw new Error(`Unknown node type: ${type}`)
        }

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

          state.nodes.push(node)
          state.recentlySpawnedNodes.add(id)
        })

        // Auto-clear spawn state after animation completes
        setTimeout(() => {
          set((state) => {
            state.recentlySpawnedNodes.delete(id)
          })
        }, 300)

        return id
      },

      addAgentNode: (position) => {
        const id = get().addNode('conversation', position)
        // Immediately set mode to 'agent' and preset to 'general'
        get().updateNode(id, {
          mode: 'agent',
          agentPreset: 'general'
        } as Partial<NodeData>)
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
          for (const nodeId of nodeIds) {
            const node = state.nodes.find((n) => n.id === nodeId)
            if (node) {
              Object.assign(node.data, data, { updatedAt: now })
            }
          }
        })
      },

      deleteNodes: (nodeIds) => {
        set((state) => {
          state.nodes = state.nodes.filter((n) => !nodeIds.includes(n.id))
        })
      },

      changeNodeType: (nodeId, newType) => {
        set((state) => {
          const nodeIndex = state.nodes.findIndex((n) => n.id === nodeId)
          if (nodeIndex === -1) return

          const node = state.nodes[nodeIndex]!
          const oldData = node.data
          const oldType = oldData.type

          if (oldType === newType) return

          // Preserve common fields from ContextMetadata
          const commonFields = {
            title: oldData.title,
            color: oldData.color,
            parentId: oldData.parentId,
            createdAt: oldData.createdAt,
            updatedAt: Date.now(),
            properties: (oldData.properties || {}) as Record<string, unknown>,
            tags: oldData.tags,
            summary: oldData.summary,
            keyEntities: oldData.keyEntities,
            contextRole: oldData.contextRole,
            contextPriority: oldData.contextPriority,
            activationCondition: oldData.activationCondition,
            enabled: oldData.enabled,
            width: (oldData as { width?: number }).width,
            height: (oldData as { height?: number }).height
          }

          // Map content between types
          const oldDescription = (oldData as { description?: string }).description || ''
          const oldContent = (oldData as { content?: string }).content || ''
          const textContent = oldDescription || oldContent

          // Create new data based on target type
          let newData: NodeData
          switch (newType) {
            case 'note':
              newData = {
                ...commonFields,
                type: 'note',
                content: textContent
              } as NoteNodeData
              break
            case 'task':
              newData = {
                ...commonFields,
                type: 'task',
                description: textContent,
                status: 'todo',
                priority: 'none'
              } as TaskNodeData
              break
            case 'project':
              newData = {
                ...commonFields,
                type: 'project',
                description: textContent,
                collapsed: false,
                childNodeIds: [],
                color: oldData.color || '#8b5cf6'
              } as ProjectNodeData
              break
            case 'conversation':
              newData = {
                ...commonFields,
                type: 'conversation',
                messages: [],
                provider: 'anthropic'
              } as ConversationNodeData
              break
            case 'artifact':
              newData = {
                ...commonFields,
                type: 'artifact',
                content: textContent,
                contentType: 'markdown',
                source: { type: 'created', method: 'manual' } as ArtifactSource,
                version: 1
              } as ArtifactNodeData
              break
            case 'workspace':
              newData = {
                ...commonFields,
                type: 'workspace',
                description: textContent,
                memberNodeIds: [],
                workspaceId: null,
                workspacePath: null
              } as unknown as WorkspaceNodeData
              break
            case 'text':
              newData = {
                ...commonFields,
                type: 'text',
                content: textContent
              } as TextNodeData
              break
            case 'action':
              newData = {
                ...commonFields,
                type: 'action',
                description: textContent,
                enabled: true,
                trigger: { type: 'manual' },
                conditions: [],
                actions: [],
                runCount: 0,
                errorCount: 0
              } as ActionNodeData
              break
            default:
              return
          }

          node.type = newType
          node.data = newData as NodeData
        })
      },

      duplicateNode: (nodeId, offset = { x: 50, y: 50 }) => {
        const nodes = get().nodes
        const node = nodes.find((n) => n.id === nodeId)
        if (!node) return ''

        const newId = uuid()
        const newNode: Node<NodeData> = {
          ...JSON.parse(JSON.stringify(node)),
          id: newId,
          position: {
            x: node.position.x + offset.x,
            y: node.position.y + offset.y
          },
          selected: true,
          data: {
            ...JSON.parse(JSON.stringify(node.data)),
            title: `${node.data.title} (Copy)`,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        }

        set((state) => {
          state.nodes.push(newNode)
          state.recentlySpawnedNodes.add(newId)
        })

        setTimeout(() => {
          set((state) => {
            state.recentlySpawnedNodes.delete(newId)
          })
        }, 300)

        return newId
      },

      // ---------------------------------------------------------------------
      // Node positioning and dimensions
      // ---------------------------------------------------------------------

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
            if (dimensions.width) node.width = Math.max(150, dimensions.width)
            if (dimensions.height) node.height = Math.max(80, dimensions.height)
          }
        })
      },

      updateNodeDimensions: (nodeId, width, height) => {
        set((state) => {
          const node = state.nodes.find((n) => n.id === nodeId)
          if (node) {
            node.width = Math.max(150, width)
            node.height = Math.max(80, height)
            ;(node.data as ContextMetadata).width = node.width
            ;(node.data as ContextMetadata).height = node.height
          }
        })
      },

      // ---------------------------------------------------------------------
      // Node properties
      // ---------------------------------------------------------------------

      setNodeProperty: (nodeId, propertyId, value) => {
        set((state) => {
          const node = state.nodes.find((n) => n.id === nodeId)
          if (node) {
            if (!node.data.properties) {
              node.data.properties = {}
            }
            ;(node.data.properties as Record<string, unknown>)[propertyId] = value
            node.data.updatedAt = Date.now()
          }
        })
      },

      getNodeProperty: (nodeId, propertyId) => {
        const node = get().nodes.find((n) => n.id === nodeId)
        if (!node || !node.data.properties) return undefined
        return (node.data.properties as Record<string, unknown>)[propertyId]
      },

      // ---------------------------------------------------------------------
      // Node activation
      // ---------------------------------------------------------------------

      evaluateNodeActivation: (nodeId) => {
        // TODO: Implement activation condition evaluation
        // This would check the node's activationCondition and set enabled accordingly
      },

      evaluateAllNodeActivations: () => {
        // TODO: Evaluate all nodes with activation conditions
      },

      // ---------------------------------------------------------------------
      // Project grouping
      // ---------------------------------------------------------------------

      addNodeToProject: (nodeId, projectId) => {
        set((state) => {
          const node = state.nodes.find((n) => n.id === nodeId)
          const projectNode = state.nodes.find((n) => n.id === projectId)

          if (node && projectNode && projectNode.data.type === 'project') {
            node.data.parentId = projectId
            const projectData = projectNode.data as ProjectNodeData
            if (!projectData.childNodeIds.includes(nodeId)) {
              projectData.childNodeIds.push(nodeId)
            }
          }
        })
      },

      removeNodeFromProject: (nodeId) => {
        set((state) => {
          const node = state.nodes.find((n) => n.id === nodeId)
          if (node && node.data.parentId) {
            const projectNode = state.nodes.find((n) => n.id === node.data.parentId)
            if (projectNode && projectNode.data.type === 'project') {
              const projectData = projectNode.data as ProjectNodeData
              projectData.childNodeIds = projectData.childNodeIds.filter(id => id !== nodeId)
            }
            node.data.parentId = undefined
          }
        })
      },

      getNodeParentId: (nodeId) => {
        const node = get().nodes.find((n) => n.id === nodeId)
        return node?.data.parentId || null
      },

      getChildNodeIds: (nodeId) => {
        const node = get().nodes.find((n) => n.id === nodeId)
        if (node && node.data.type === 'project') {
          return (node.data as ProjectNodeData).childNodeIds || []
        }
        return []
      },

      // ---------------------------------------------------------------------
      // Outgoing edge colors
      // ---------------------------------------------------------------------

      setOutgoingEdgeColor: (nodeId, color) => {
        set((state) => {
          const node = state.nodes.find((n) => n.id === nodeId)
          if (node) {
            ;(node.data as ContextMetadata).outgoingEdgeColor = color
            node.data.updatedAt = Date.now()
          }
        })
      },

      // ---------------------------------------------------------------------
      // Visual feedback
      // ---------------------------------------------------------------------

      updateNodeTimestamp: (nodeId) => {
        set((state) => {
          const now = Date.now()
          state.nodeUpdatedAt = new Map(state.nodeUpdatedAt)
          state.nodeUpdatedAt.set(nodeId, now)
        })
      },

      addSpawningNode: (nodeId) => {
        set((state) => {
          if (!state.spawningNodeIds.includes(nodeId)) {
            state.spawningNodeIds.push(nodeId)
          }
        })
      },

      removeSpawningNode: (nodeId) => {
        set((state) => {
          state.spawningNodeIds = state.spawningNodeIds.filter(id => id !== nodeId)
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

      // ---------------------------------------------------------------------
      // State management
      // ---------------------------------------------------------------------

      setNodes: (nodes) => {
        set((state) => {
          state.nodes = nodes
        })
      },

      getNodes: () => {
        return get().nodes
      },

      getNodeById: (nodeId) => {
        return get().nodes.find((n) => n.id === nodeId)
      }
    }))
  )
)

// =============================================================================
// Selector Hooks
// =============================================================================

export const useNodes = (): Node<NodeData>[] => useNodesStore((state) => state.nodes)

export const useNodeById = (nodeId: string): Node<NodeData> | undefined =>
  useNodesStore((state) => state.nodes.find((n) => n.id === nodeId))

export const useNodeWarmth = (nodeId: string): 'hot' | 'warm' | 'cool' | null => {
  return useNodesStore((state) => {
    const lastUpdate = state.nodeUpdatedAt.get(nodeId)
    if (!lastUpdate) return null

    const elapsed = Date.now() - lastUpdate

    if (elapsed < 30000) return 'hot' // 30 seconds
    if (elapsed < 120000) return 'warm' // 2 minutes
    if (elapsed < 300000) return 'cool' // 5 minutes
    return null
  })
}

export const useIsSpawning = (nodeId: string): boolean =>
  useNodesStore((state) => state.recentlySpawnedNodes.has(nodeId))

export const useIsNodeSpawning = (nodeId: string): boolean =>
  useNodesStore((state) => state.spawningNodeIds.includes(nodeId))
