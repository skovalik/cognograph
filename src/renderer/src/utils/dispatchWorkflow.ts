// =============================================================================
// dispatchWorkflow.ts -- Pure functions for task-to-CLI dispatch pipeline
//
// Phase 6E: Rich Node Depth System - Dispatch Workflow Integration
//
// Right-click a TaskNode → system creates an adjacent ConversationNode in
// cc-session mode, links them with a dispatch edge, and prepares context.
//
// These are standalone pure functions — no store mutations, no side effects.
// Integration with ContextMenu and workspaceStore happens during merge.
// =============================================================================

import type { TaskNodeData, ConversationNodeData } from '@shared/types'
import type { EdgeData } from '@shared/types/edges'
import type { Edge } from '@xyflow/react'

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Horizontal offset (px) from the task node to the new conversation node */
const DISPATCH_OFFSET_X = 350

/** Vertical offset (px) from the task node to the new conversation node */
const DISPATCH_OFFSET_Y = 50

/** Default accent color for the dispatch edge */
const DISPATCH_EDGE_COLOR = 'var(--accent)'

// -----------------------------------------------------------------------------
// createDispatchNodeData
// -----------------------------------------------------------------------------

/**
 * Builds the data payload for a new ConversationNode spawned from a task dispatch.
 *
 * The node is positioned offset right+down from the source task, set to
 * cc-session mode, and carries a `dispatchedFrom` back-reference.
 *
 * @param taskNode  - The source task node's data
 * @param taskPosition - The source task node's canvas position {x, y}
 * @returns Object with `position` and `data` for the new ConversationNode
 */
export function createDispatchNodeData(
  taskNode: TaskNodeData,
  taskPosition: { x: number; y: number }
): {
  position: { x: number; y: number }
  data: Partial<ConversationNodeData> & { dispatchedFrom: string }
} {
  const now = Date.now()

  return {
    position: {
      x: taskPosition.x + DISPATCH_OFFSET_X,
      y: taskPosition.y + DISPATCH_OFFSET_Y,
    },
    data: {
      type: 'conversation',
      title: `CLI: ${taskNode.title}`,
      messages: [],
      provider: 'anthropic',
      mode: 'cc-session',
      createdAt: now,
      updatedAt: now,
      dispatchedFrom: (taskNode as TaskNodeData & { [key: string]: unknown }).title
        ? taskNode.title
        : '',
    } as Partial<ConversationNodeData> & { dispatchedFrom: string },
  }
}

// -----------------------------------------------------------------------------
// createDispatchEdge
// -----------------------------------------------------------------------------

/**
 * Builds the edge data linking a task node to its dispatched conversation node.
 *
 * The edge uses a 'dispatched-to' label, solid 2px styling, and the accent color.
 *
 * @param taskNodeId - Source node ID (the task)
 * @param conversationNodeId - Target node ID (the new conversation)
 * @returns A complete React Flow Edge object ready to be added to the graph
 */
export function createDispatchEdge(
  taskNodeId: string,
  conversationNodeId: string
): Edge<EdgeData> {
  return {
    id: `${taskNodeId}-${conversationNodeId}`,
    type: 'custom',
    source: taskNodeId,
    target: conversationNodeId,
    data: {
      direction: 'unidirectional',
      label: 'dispatched-to',
      strength: 'strong',
      active: true,
      lineStyle: 'solid',
      strokePreset: 'normal',
      arrowStyle: 'filled',
      color: DISPATCH_EDGE_COLOR,
      contextRole: 'dispatched-to',
    },
  }
}

// -----------------------------------------------------------------------------
// buildDispatchContext
// -----------------------------------------------------------------------------

/**
 * Formats the dispatch context string that will seed the CLI session.
 *
 * Combines the task's own description with the pre-gathered context chain
 * from connected upstream nodes.
 *
 * @param taskNode - The source task node's data
 * @param contextChain - Array of context strings from connected nodes
 * @returns Formatted context string
 */
export function buildDispatchContext(
  taskNode: TaskNodeData,
  contextChain: string[]
): string {
  const sections: string[] = []

  sections.push(`# Task: ${taskNode.title}`)
  sections.push('')

  if (taskNode.description) {
    sections.push(taskNode.description)
  }

  if (contextChain.length > 0) {
    sections.push('')
    sections.push('## Context')
    sections.push(contextChain.join('\n---\n'))
  }

  return sections.join('\n')
}
