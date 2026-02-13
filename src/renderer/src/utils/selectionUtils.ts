// Selection utilities for parent-child aware selection filtering
import type { Node } from '@xyflow/react'

/**
 * Filters out project nodes that have selected children.
 * When a user marquee-selects inside a project, this prevents
 * the project container from being selected along with its contents.
 *
 * Rule: If a project node AND any of its direct children are both
 * in the selection, the project should be deselected.
 *
 * @param selectedNodes - Array of currently selected nodes
 * @returns Array of project node IDs that should be deselected
 */
export function filterParentProjects(selectedNodes: Node[]): string[] {
  const projectsToDeselect: string[] = []

  for (const node of selectedNodes) {
    // Only process project nodes
    if (node.data.type !== 'project') continue

    // Check if ANY selected node is a direct child of this project
    const hasSelectedChild = selectedNodes.some(
      (child) => child.id !== node.id && child.data.parentId === node.id
    )

    if (hasSelectedChild) {
      projectsToDeselect.push(node.id)
    }
  }

  return projectsToDeselect
}

export interface XYPosition {
  x: number
  y: number
}

/**
 * Checks if a point is inside a node's bounding box.
 * Used for origin-tracking selection (Phase 2).
 *
 * @param point - The point to check
 * @param node - The node to check against
 * @returns true if point is inside node bounds
 */
export function isPointInsideNodeBounds(point: XYPosition, node: Node): boolean {
  const { x, y } = node.position
  const width = node.width ?? (node.measured?.width as number | undefined) ?? 300
  const height = node.height ?? (node.measured?.height as number | undefined) ?? 200

  return point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height
}
