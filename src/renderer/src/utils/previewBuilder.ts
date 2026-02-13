/**
 * Preview Builder
 *
 * Builds MutationPreviewState from a MutationPlan for visual preview.
 * Used to show ghost nodes, deletion overlays, and movement paths.
 */

import type { Node, Edge } from '@xyflow/react'
import type {
  MutationPlan,
  MutationPreviewState,
  GhostNodePreview,
  DeletionOverlayPreview,
  MovementPathPreview,
  EdgePreview,
  NodeData,
  EdgeData
} from '@shared/types'
import { dryRunMutationPlan } from './mutationExecutor'
import { DEFAULT_NODE_DIMENSIONS } from './positionResolver'

// -----------------------------------------------------------------------------
// Main Preview Builder Function
// -----------------------------------------------------------------------------

/**
 * Build a MutationPreviewState from a MutationPlan.
 * This resolves all positions and prepares visual preview data.
 */
export function buildPreviewState(
  plan: MutationPlan,
  nodes: Node<NodeData>[],
  edges: Edge<EdgeData>[],
  selectedNodeIds: string[],
  viewport: { x: number; y: number; zoom: number }
): MutationPreviewState {
  // Run dry execution to get resolved positions
  const { resolvedPositions, tempIdToType: _tempIdToType } = dryRunMutationPlan(
    plan,
    nodes,
    edges,
    selectedNodeIds,
    viewport
  )

  const ghostNodes: GhostNodePreview[] = []
  const deletionOverlays: DeletionOverlayPreview[] = []
  const movementPaths: MovementPathPreview[] = []
  const edgePreviews: EdgePreview[] = []
  const nodeUpdates: Array<{ nodeId: string; changes: Partial<NodeData> }> = []

  // Track which nodes have content being preserved (for delete operations)
  const contentPreservationMap = new Map<string, string>() // deletedNodeId -> preservingNodeTitle

  // First pass: look for create operations that reference deleted node content
  for (const op of plan.operations) {
    if (op.op === 'create-node' && op.data) {
      // Check if this new node's content references a deleted node
      const dataStr = JSON.stringify(op.data)
      for (const otherOp of plan.operations) {
        if (otherOp.op === 'delete-node') {
          const deletedNode = nodes.find((n) => n.id === otherOp.nodeId)
          if (deletedNode) {
            const deletedTitle = getNodeTitle(deletedNode.data)
            // If the new node mentions the deleted node's title or appears related
            if (dataStr.includes(deletedTitle) || (op.data as any)?.title?.includes('Merged')) {
              contentPreservationMap.set(otherOp.nodeId, (op.data as any)?.title || 'New Node')
            }
          }
        }
      }
    }
  }

  // Also check update operations for merged content
  for (const op of plan.operations) {
    if (op.op === 'update-node' && op.data) {
      const targetNode = nodes.find((n) => n.id === op.nodeId)
      const targetTitle = targetNode ? getNodeTitle(targetNode.data) : 'Updated Node'

      for (const otherOp of plan.operations) {
        if (otherOp.op === 'delete-node') {
          // Mark deleted nodes as preserved in the updated node
          contentPreservationMap.set(otherOp.nodeId, targetTitle)
        }
      }
    }
  }

  // Process each operation
  for (const op of plan.operations) {
    switch (op.op) {
      case 'create-node': {
        const resolvedPos = resolvedPositions.get(op.tempId)
        if (resolvedPos) {
          const dimensions = op.dimensions || DEFAULT_NODE_DIMENSIONS[op.type]

          ghostNodes.push({
            tempId: op.tempId,
            type: op.type,
            position: resolvedPos,
            dimensions,
            data: op.data
          })
        }
        break
      }

      case 'delete-node': {
        const node = nodes.find((n) => n.id === op.nodeId)
        const nodeTitle = node ? getNodeTitle(node.data) : undefined
        const preservedIn = contentPreservationMap.get(op.nodeId)

        deletionOverlays.push({
          nodeId: op.nodeId,
          reason: op.reason,
          nodeTitle,
          preservedIn,
          preservedData: node ? node.data : undefined
        })
        break
      }

      case 'update-node': {
        nodeUpdates.push({
          nodeId: op.nodeId,
          changes: op.data
        })
        break
      }

      case 'move-node': {
        const node = nodes.find((n) => n.id === op.nodeId)
        const resolvedPos = resolvedPositions.get(op.nodeId)
        const nodeTitle = node ? getNodeTitle(node.data) : undefined

        if (node && resolvedPos) {
          movementPaths.push({
            nodeId: op.nodeId,
            from: { x: node.position.x, y: node.position.y },
            to: resolvedPos,
            nodeTitle
          })
        }
        break
      }

      case 'create-edge': {
        edgePreviews.push({
          tempId: op.tempId,
          source: op.source,
          target: op.target,
          data: op.data,
          isNew: true
        })
        break
      }

      case 'delete-edge': {
        const edge = edges.find((e) => e.id === op.edgeId)
        if (edge) {
          edgePreviews.push({
            source: edge.source,
            target: edge.target,
            data: edge.data,
            isNew: false,
            isDeleted: true
          })
        }
        break
      }
    }
  }

  return {
    planId: plan.id,
    ghostNodes,
    deletionOverlays,
    movementPaths,
    edgePreviews,
    nodeUpdates
  }
}

// -----------------------------------------------------------------------------
// Preview Summary
// -----------------------------------------------------------------------------

export interface PreviewSummary {
  nodesCreated: number
  nodesDeleted: number
  nodesUpdated: number
  nodesMoved: number
  edgesCreated: number
  edgesDeleted: number
  totalChanges: number
}

/**
 * Generate a summary of changes from the preview state.
 */
export function getPreviewSummary(preview: MutationPreviewState): PreviewSummary {
  const nodesCreated = preview.ghostNodes.length
  const nodesDeleted = preview.deletionOverlays.length
  const nodesUpdated = preview.nodeUpdates.length
  const nodesMoved = preview.movementPaths.length
  const edgesCreated = preview.edgePreviews.filter((e) => e.isNew).length
  const edgesDeleted = preview.edgePreviews.filter((e) => e.isDeleted).length

  return {
    nodesCreated,
    nodesDeleted,
    nodesUpdated,
    nodesMoved,
    edgesCreated,
    edgesDeleted,
    totalChanges: nodesCreated + nodesDeleted + nodesUpdated + nodesMoved + edgesCreated + edgesDeleted
  }
}

/**
 * Format preview summary as a human-readable string.
 */
export function formatPreviewSummary(summary: PreviewSummary): string {
  const parts: string[] = []

  if (summary.nodesCreated > 0) {
    parts.push(`${summary.nodesCreated} node${summary.nodesCreated > 1 ? 's' : ''} created`)
  }
  if (summary.nodesDeleted > 0) {
    parts.push(`${summary.nodesDeleted} node${summary.nodesDeleted > 1 ? 's' : ''} deleted`)
  }
  if (summary.nodesUpdated > 0) {
    parts.push(`${summary.nodesUpdated} node${summary.nodesUpdated > 1 ? 's' : ''} updated`)
  }
  if (summary.nodesMoved > 0) {
    parts.push(`${summary.nodesMoved} node${summary.nodesMoved > 1 ? 's' : ''} moved`)
  }
  if (summary.edgesCreated > 0) {
    parts.push(`${summary.edgesCreated} edge${summary.edgesCreated > 1 ? 's' : ''} created`)
  }
  if (summary.edgesDeleted > 0) {
    parts.push(`${summary.edgesDeleted} edge${summary.edgesDeleted > 1 ? 's' : ''} deleted`)
  }

  if (parts.length === 0) {
    return 'No changes'
  }

  return parts.join(', ')
}

// -----------------------------------------------------------------------------
// Preview Validation
// -----------------------------------------------------------------------------

export interface PreviewValidation {
  isValid: boolean
  warnings: string[]
  errors: string[]
}

/**
 * Validate a preview state before execution.
 */
export function validatePreview(
  preview: MutationPreviewState,
  nodes: Node<NodeData>[],
  edges: Edge<EdgeData>[]
): PreviewValidation {
  const warnings: string[] = []
  const errors: string[] = []

  // Check for deletion of nodes that are targets of other nodes
  for (const deletion of preview.deletionOverlays) {
    const incomingEdges = edges.filter((e) => e.target === deletion.nodeId)
    if (incomingEdges.length > 0) {
      const sourceNodeIds = incomingEdges.map((e) => e.source)
      const sourceNodes = nodes.filter((n) => sourceNodeIds.includes(n.id))
      const titles = sourceNodes.map((n) => getNodeTitle(n.data)).join(', ')
      warnings.push(
        `Deleting "${getNodeTitle(nodes.find((n) => n.id === deletion.nodeId)?.data)}" will break connections from: ${titles}`
      )
    }
  }

  // Check for ghost nodes with overlapping positions
  const positionMap = new Map<string, string[]>()
  for (const ghost of preview.ghostNodes) {
    const key = `${Math.round(ghost.position.x / 50) * 50},${Math.round(ghost.position.y / 50) * 50}`
    const existing = positionMap.get(key) || []
    existing.push(ghost.tempId)
    positionMap.set(key, existing)
  }

  for (const [_, ids] of positionMap) {
    if (ids.length > 1) {
      warnings.push(`${ids.length} new nodes will be placed at the same position`)
    }
  }

  // Check for circular edge creation
  const newEdges = preview.edgePreviews.filter((e) => e.isNew)
  for (const edge of newEdges) {
    if (edge.source === edge.target) {
      errors.push('Cannot create self-referencing edge')
    }
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors
  }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function getNodeTitle(data: NodeData | undefined): string {
  if (!data) return 'Unknown'

  switch (data.type) {
    case 'conversation':
      return (data as any).title || 'Untitled Conversation'
    case 'note':
      return (data as any).title || 'Untitled Note'
    case 'task':
      return (data as any).title || 'Untitled Task'
    case 'project':
      return (data as any).title || 'Untitled Project'
    case 'artifact':
      return (data as any).title || 'Untitled Artifact'
    case 'workspace':
      return (data as any).title || 'Untitled Workspace'
    case 'orchestrator':
      return (data as any).title || 'Untitled Orchestrator'
    default:
      return 'Untitled'
  }
}
