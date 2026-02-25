// =============================================================================
// dispatchMenuItems.ts -- Context menu items for task dispatch workflow
//
// Phase 6E: Rich Node Depth System - Dispatch Workflow Integration
//
// Returns dispatch-related context menu item configurations based on node type.
// Only TaskNodes get the "Run in Embedded CLI" option.
// =============================================================================

import type { NodeData } from '@shared/types'
import type { DispatchMenuItemConfig } from './dispatchTypes'

// -----------------------------------------------------------------------------
// getDispatchMenuItems
// -----------------------------------------------------------------------------

/**
 * Returns dispatch-related context menu item configurations for a given node.
 *
 * Only TaskNode types receive dispatch menu items. All other node types
 * return an empty array, keeping the context menu clean.
 *
 * @param _nodeId   - The node's ID (reserved for future per-node checks)
 * @param nodeType  - The node's discriminated type string
 * @param _nodeData - The full node data (reserved for future conditional logic)
 * @returns Array of dispatch menu item configs (empty for non-task nodes)
 */
export function getDispatchMenuItems(
  _nodeId: string,
  nodeType: string,
  _nodeData: NodeData
): DispatchMenuItemConfig[] {
  if (nodeType !== 'task') {
    return []
  }

  return [
    {
      label: 'Run in Embedded CLI',
      icon: 'Terminal',
      enabled: true,
      nodeType: 'task',
    },
  ]
}
