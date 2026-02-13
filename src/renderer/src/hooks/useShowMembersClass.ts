/**
 * Hook to determine if a node should be dimmed in "Show Members" or "Focus" mode
 *
 * When a project is in "Show Members" mode, all nodes that are NOT direct
 * children of that project will be dimmed to highlight membership.
 *
 * When Focus Mode is active:
 * - The focused node is highlighted
 * - Connected nodes (neighbors) are lightly dimmed
 * - Unconnected nodes are fully dimmed
 * This "neighborhood dimming" keeps spatial context visible.
 */

import { useMemo } from 'react'
import { useWorkspaceStore } from '../stores/workspaceStore'

interface ShowMembersClassResult {
  /** CSS class to apply for dimming non-members or non-focused nodes */
  nonMemberClass: string
  /** CSS class to apply for highlighting members or focused node */
  memberHighlightClass: string
  /** Whether this node is dimmed */
  isDimmed: boolean
  /** Whether this node is highlighted */
  isHighlighted: boolean
  /** Whether this node is a neighbor of the focused node */
  isNeighbor: boolean
}

/**
 * Returns CSS classes for "Show Members" mode and "Focus" mode
 * @param nodeId The ID of the current node
 * @param parentId The parent project ID of the current node (if any)
 */
export function useShowMembersClass(nodeId: string, parentId?: string): ShowMembersClassResult {
  const showMembersProjectId = useWorkspaceStore(state => state.showMembersProjectId)
  const focusModeNodeId = useWorkspaceStore(state => state.focusModeNodeId)
  const edges = useWorkspaceStore(state => state.edges)

  return useMemo(() => {
    // Focus mode takes priority
    if (focusModeNodeId) {
      if (nodeId === focusModeNodeId) {
        return {
          nonMemberClass: '',
          memberHighlightClass: 'cognograph-node--member-highlight',
          isDimmed: false,
          isHighlighted: true,
          isNeighbor: false
        }
      }

      // Check if this node is connected to the focused node (neighbor)
      const isNeighbor = edges.some(
        edge =>
          (edge.source === focusModeNodeId && edge.target === nodeId) ||
          (edge.target === focusModeNodeId && edge.source === nodeId)
      )

      if (isNeighbor) {
        // Neighbors get lighter dimming - keep spatial context visible
        return {
          nonMemberClass: 'cognograph-node--focus-neighbor',
          memberHighlightClass: '',
          isDimmed: true,
          isHighlighted: false,
          isNeighbor: true
        }
      }

      // Non-connected nodes get enhanced focus dimming (more aggressive than show-members mode)
      return {
        nonMemberClass: 'cognograph-node--focus-unfocused',
        memberHighlightClass: '',
        isDimmed: true,
        isHighlighted: false,
        isNeighbor: false
      }
    }

    // If no project is in "show members" mode, no classes apply
    if (!showMembersProjectId) {
      return {
        nonMemberClass: '',
        memberHighlightClass: '',
        isDimmed: false,
        isHighlighted: false,
        isNeighbor: false
      }
    }

    // The project itself being viewed should not be dimmed
    if (nodeId === showMembersProjectId) {
      return {
        nonMemberClass: '',
        memberHighlightClass: '',
        isDimmed: false,
        isHighlighted: false,
        isNeighbor: false
      }
    }

    // Check if this node is a direct child of the focused project
    const isMember = parentId === showMembersProjectId

    if (isMember) {
      return {
        nonMemberClass: '',
        memberHighlightClass: 'cognograph-node--member-highlight',
        isDimmed: false,
        isHighlighted: true,
        isNeighbor: false
      }
    }

    // Non-member: dim it
    return {
      nonMemberClass: 'cognograph-node--non-member',
      memberHighlightClass: '',
      isDimmed: true,
      isHighlighted: false,
      isNeighbor: false
    }
  }, [nodeId, parentId, showMembersProjectId, focusModeNodeId, edges])
}

/**
 * Version for TextNode which uses different class names
 */
export function useShowMembersClassForTextNode(nodeId: string, parentId?: string): ShowMembersClassResult {
  const showMembersProjectId = useWorkspaceStore(state => state.showMembersProjectId)
  const focusModeNodeId = useWorkspaceStore(state => state.focusModeNodeId)
  const edges = useWorkspaceStore(state => state.edges)

  return useMemo(() => {
    // Focus mode takes priority
    if (focusModeNodeId) {
      if (nodeId === focusModeNodeId) {
        return {
          nonMemberClass: '',
          memberHighlightClass: '',
          isDimmed: false,
          isHighlighted: true,
          isNeighbor: false
        }
      }

      // Check if this node is connected to the focused node (neighbor)
      const isNeighbor = edges.some(
        edge =>
          (edge.source === focusModeNodeId && edge.target === nodeId) ||
          (edge.target === focusModeNodeId && edge.source === nodeId)
      )

      if (isNeighbor) {
        return {
          nonMemberClass: 'text-node--focus-neighbor',
          memberHighlightClass: '',
          isDimmed: true,
          isHighlighted: false,
          isNeighbor: true
        }
      }

      return {
        nonMemberClass: 'text-node--focus-unfocused',
        memberHighlightClass: '',
        isDimmed: true,
        isHighlighted: false,
        isNeighbor: false
      }
    }

    if (!showMembersProjectId) {
      return {
        nonMemberClass: '',
        memberHighlightClass: '',
        isDimmed: false,
        isHighlighted: false,
        isNeighbor: false
      }
    }

    if (nodeId === showMembersProjectId) {
      return {
        nonMemberClass: '',
        memberHighlightClass: '',
        isDimmed: false,
        isHighlighted: false,
        isNeighbor: false
      }
    }

    const isMember = parentId === showMembersProjectId

    if (isMember) {
      return {
        nonMemberClass: '',
        memberHighlightClass: '',
        isDimmed: false,
        isHighlighted: true,
        isNeighbor: false
      }
    }

    return {
      nonMemberClass: 'text-node--non-member',
      memberHighlightClass: '',
      isDimmed: true,
      isHighlighted: false,
      isNeighbor: false
    }
  }, [nodeId, parentId, showMembersProjectId, focusModeNodeId, edges])
}
