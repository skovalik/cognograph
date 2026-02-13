/**
 * Context Menu Store
 *
 * Zustand store for managing context menu state.
 * Handles right-click menus on canvas, nodes, and edges.
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type ContextMenuTarget =
  | { type: 'canvas'; position: { x: number; y: number } }
  | { type: 'node'; nodeId: string }
  | { type: 'nodes'; nodeIds: string[] }
  | { type: 'edge'; edgeId: string; position?: { x: number; y: number } }
  | { type: 'waypoint'; edgeId: string; waypointIndex: number }
  | { type: 'project-body'; projectId: string; position: { x: number; y: number } }

interface ContextMenuState {
  isOpen: boolean
  screenPosition: { x: number; y: number }
  target: ContextMenuTarget | null
}

interface ContextMenuActions {
  open: (screenPosition: { x: number; y: number }, target: ContextMenuTarget) => void
  close: () => void
}

type ContextMenuStore = ContextMenuState & ContextMenuActions

// -----------------------------------------------------------------------------
// Store Implementation
// -----------------------------------------------------------------------------

export const useContextMenuStore = create<ContextMenuStore>()(
  subscribeWithSelector((set) => ({
    // Initial state
    isOpen: false,
    screenPosition: { x: 0, y: 0 },
    target: null,

    // Actions
    open: (screenPosition, target) => {
      set({
        isOpen: true,
        screenPosition,
        target
      })
    },

    close: () => {
      set({
        isOpen: false,
        target: null
      })
    }
  }))
)

// -----------------------------------------------------------------------------
// Selectors
// -----------------------------------------------------------------------------

export const useIsContextMenuOpen = (): boolean =>
  useContextMenuStore((s) => s.isOpen)

export const useContextMenuTarget = (): ContextMenuTarget | null =>
  useContextMenuStore((s) => s.target)

export const useContextMenuPosition = (): { x: number; y: number } =>
  useContextMenuStore((s) => s.screenPosition)
