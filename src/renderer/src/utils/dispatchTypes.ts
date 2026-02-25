// =============================================================================
// dispatchTypes.ts -- Type definitions for task-to-CLI dispatch workflow
//
// Phase 6E: Rich Node Depth System - Dispatch Workflow Integration
// Defines the request/result/config types used by dispatchWorkflow utilities.
// =============================================================================

import type { TaskNodeData } from '@shared/types'

// -----------------------------------------------------------------------------
// Dispatch Request / Result
// -----------------------------------------------------------------------------

/** Request payload for dispatching a task to an embedded CLI session */
export interface DispatchRequest {
  /** ID of the source task node */
  taskNodeId: string
  /** Full data of the task node */
  taskData: TaskNodeData
  /** Current canvas position of the task node */
  taskPosition: { x: number; y: number }
  /** Pre-built context chain strings from connected nodes */
  contextChain: string[]
}

/** Result returned after a dispatch workflow completes */
export interface DispatchResult {
  /** ID of the newly created conversation node */
  conversationNodeId: string
  /** ID of the edge linking task → conversation */
  edgeId: string
  /** Formatted context string prepared for the CLI session */
  contextFile: string
}

// -----------------------------------------------------------------------------
// Menu Item Config
// -----------------------------------------------------------------------------

/** Configuration for a dispatch-related context menu item */
export interface DispatchMenuItemConfig {
  /** Display label shown in the context menu */
  label: string
  /** Lucide icon name */
  icon: string
  /** Whether the menu item is currently actionable */
  enabled: boolean
  /** Node type this menu item applies to */
  nodeType: 'task'
}
