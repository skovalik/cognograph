// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

// useContextVisualization — PFD Phase 4: AI Context Transparency
// Called at canvas level. Watches for chat panel focus changes and
// triggers BFS traversal visualization via the store.
//
// Debounces at 500ms during active editing to avoid BFS on every keystroke.

import { useEffect, useRef, useCallback } from 'react'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { useContextVisualizationStore } from '../stores/contextVisualizationStore'

export function useContextVisualization() {
  const getContextTraversalForNode = useWorkspaceStore(
    (state) => state.getContextTraversalForNode
  )
  const activate = useContextVisualizationStore((state) => state.activate)
  const deactivate = useContextVisualizationStore((state) => state.deactivate)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeNodeRef = useRef<string | null>(null)

  const isTerminalRef = useRef(false)

  const updateVisualization = useCallback((nodeId: string) => {
    const traversal = getContextTraversalForNode(nodeId)
    activate(nodeId, traversal.nodes, traversal.edges, isTerminalRef.current)
  }, [getContextTraversalForNode, activate])

  const showContextScope = useCallback((nodeId: string, isTerminal = false) => {
    activeNodeRef.current = nodeId
    isTerminalRef.current = isTerminal

    // Debounce to 500ms to avoid BFS on every keystroke
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      // Only update if this node is still the active one
      if (activeNodeRef.current === nodeId) {
        updateVisualization(nodeId)
      }
    }, 500)
  }, [updateVisualization])

  const hideContextScope = useCallback(() => {
    activeNodeRef.current = null
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    deactivate()
  }, [deactivate])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  return { showContextScope, hideContextScope }
}
