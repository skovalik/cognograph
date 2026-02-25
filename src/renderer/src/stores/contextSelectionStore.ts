/**
 * Context Selection Store — Transient (NOT persisted)
 *
 * When a user Ctrl+Clicks a node, it becomes a temporary context source
 * for the next ConversationNode message. This store tracks that selection
 * separately from React Flow's multi-select.
 *
 * PFD Phase 5B: Canvas Interaction Patterns
 */

import { create } from 'zustand'

interface ContextSelectionState {
  /** Node IDs selected as temporary context sources */
  selectedNodeIds: Set<string>

  /** Toggle a node in/out of context selection */
  toggle: (nodeId: string) => void

  /** Clear all context selections */
  clear: () => void

  /** Check if a node is context-selected */
  isSelected: (nodeId: string) => boolean
}

export const useContextSelectionStore = create<ContextSelectionState>()((set, get) => ({
  selectedNodeIds: new Set<string>(),

  toggle: (nodeId: string): void => {
    set((state) => {
      const next = new Set(state.selectedNodeIds)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return { selectedNodeIds: next }
    })
  },

  clear: (): void => {
    set({ selectedNodeIds: new Set<string>() })
  },

  isSelected: (nodeId: string): boolean => {
    return get().selectedNodeIds.has(nodeId)
  }
}))
