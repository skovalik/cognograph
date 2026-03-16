// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * useSpatialNavigation — Keyboard-driven spatial canvas navigation
 *
 * Arrow keys move selection to the nearest node in a cardinal direction
 * (based on spatial position, not DOM order). Tab cycles through connected
 * nodes (follows edges). Shift+Arrow extends selection (multi-select).
 *
 * Algorithm: For each arrow direction, filter nodes in a 90-degree cone
 * from the current selection's center, score by distance + off-axis penalty,
 * and select the nearest match.
 *
 * Designed to coexist with React Flow's built-in keyboard handling (Delete,
 * etc.) — only captures Arrow keys, Tab, and Shift+Arrow.
 *
 * Task 26: Spatial Selection Infrastructure
 */

import { useCallback, useEffect, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { useUIStore } from '../stores/uiStore'

// =============================================================================
// Types
// =============================================================================

type Direction = 'up' | 'down' | 'left' | 'right'

interface NodeCandidate {
  id: string
  centerX: number
  centerY: number
}

// =============================================================================
// Geometry helpers
// =============================================================================

/**
 * Euclidean distance between two points.
 */
function dist(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1
  const dy = y2 - y1
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Find the nearest node in a cardinal direction from a given position.
 *
 * Filters to a 90-degree cone (the primary axis delta must exceed the
 * secondary axis delta) with a 10px dead-zone to avoid selecting nodes
 * that are essentially co-located. Scores by distance + 2x off-axis
 * penalty so nodes that are more aligned are preferred over closer
 * but off-angle candidates.
 */
function findNearestInDirection(
  currentX: number,
  currentY: number,
  candidates: NodeCandidate[],
  direction: Direction
): string | null {
  let bestId: string | null = null
  let bestScore = Infinity

  for (const c of candidates) {
    const dx = c.centerX - currentX
    const dy = c.centerY - currentY
    const distance = dist(currentX, currentY, c.centerX, c.centerY)

    let isInDirection = false
    let score = distance

    switch (direction) {
      case 'up':
        isInDirection = dy < -10 && Math.abs(dx) < Math.abs(dy)
        score = distance + Math.abs(dx) * 2
        break
      case 'down':
        isInDirection = dy > 10 && Math.abs(dx) < Math.abs(dy)
        score = distance + Math.abs(dx) * 2
        break
      case 'left':
        isInDirection = dx < -10 && Math.abs(dy) < Math.abs(dx)
        score = distance + Math.abs(dy) * 2
        break
      case 'right':
        isInDirection = dx > 10 && Math.abs(dy) < Math.abs(dx)
        score = distance + Math.abs(dy) * 2
        break
    }

    if (isInDirection && score < bestScore) {
      bestScore = score
      bestId = c.id
    }
  }

  return bestId
}

/**
 * Map an ArrowKey string to a Direction.
 */
function arrowToDirection(key: string): Direction | null {
  switch (key) {
    case 'ArrowUp': return 'up'
    case 'ArrowDown': return 'down'
    case 'ArrowLeft': return 'left'
    case 'ArrowRight': return 'right'
    default: return null
  }
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Spatial navigation hook for keyboard-driven canvas traversal.
 *
 * Must be called inside a ReactFlowProvider (uses useReactFlow).
 * Registers a window keydown listener that handles:
 *   - Arrow keys: move selection to nearest node in that direction
 *   - Shift+Arrow: extend selection (add nearest node in direction)
 *   - Tab: cycle through nodes connected by edges (Shift+Tab reverses)
 *
 * Sets `keyboardNavActive` flag in uiStore when navigation occurs,
 * clears it on mouse click.
 */
export function useSpatialNavigation(): { keyboardNavActive: boolean } {
  const { setCenter } = useReactFlow()
  const keyboardNavActive = useUIStore((s) => s.keyboardNavActive)
  const setKeyboardNavActive = useUIStore((s) => s.setKeyboardNavActive)

  // Use refs to avoid recreating the listener on every state change
  const nodesRef = useRef(useWorkspaceStore.getState().nodes)
  const edgesRef = useRef(useWorkspaceStore.getState().edges)
  const selectedNodeIdsRef = useRef(useWorkspaceStore.getState().selectedNodeIds)

  // Keep refs in sync via subscription (cheaper than dependency array re-renders)
  useEffect(() => {
    const unsub = useWorkspaceStore.subscribe((state) => {
      nodesRef.current = state.nodes
      edgesRef.current = state.edges
      selectedNodeIdsRef.current = state.selectedNodeIds
    })
    return unsub
  }, [])

  // Build a NodeCandidate array from current nodes (center positions)
  const buildCandidates = useCallback((): NodeCandidate[] => {
    return nodesRef.current.map((node) => ({
      id: node.id,
      centerX: node.position.x + ((node.width as number) || 280) / 2,
      centerY: node.position.y + ((node.height as number) || 140) / 2
    }))
  }, [])

  // Get the center position of the current "anchor" node (last selected)
  const getAnchorCenter = useCallback((): { x: number; y: number; id: string } | null => {
    const selectedIds = selectedNodeIdsRef.current
    if (selectedIds.length === 0) return null
    // Use the last selected node as anchor (most recently added to selection)
    const anchorId = selectedIds[selectedIds.length - 1]!
    const node = nodesRef.current.find((n) => n.id === anchorId)
    if (!node) return null
    return {
      x: node.position.x + ((node.width as number) || 280) / 2,
      y: node.position.y + ((node.height as number) || 140) / 2,
      id: anchorId
    }
  }, [])

  // Pan viewport to center on a node
  const panToNode = useCallback((nodeId: string) => {
    const node = nodesRef.current.find((n) => n.id === nodeId)
    if (!node) return
    const centerX = node.position.x + ((node.width as number) || 280) / 2
    const centerY = node.position.y + ((node.height as number) || 140) / 2
    setCenter(centerX, centerY, { duration: 200 })
  }, [setCenter])

  // Handle directional arrow navigation
  const handleArrowNav = useCallback((direction: Direction, extend: boolean) => {
    const anchor = getAnchorCenter()
    if (!anchor) return false

    const candidates = buildCandidates().filter((c) => c.id !== anchor.id)
    const targetId = findNearestInDirection(anchor.x, anchor.y, candidates, direction)
    if (!targetId) return false

    const { setSelectedNodes } = useWorkspaceStore.getState()

    if (extend) {
      // Shift+Arrow: add to selection without removing existing
      const currentIds = selectedNodeIdsRef.current
      if (!currentIds.includes(targetId)) {
        setSelectedNodes([...currentIds, targetId])
      }
    } else {
      // Plain arrow: replace selection
      setSelectedNodes([targetId])
    }

    panToNode(targetId)
    setKeyboardNavActive(true)
    return true
  }, [getAnchorCenter, buildCandidates, panToNode, setKeyboardNavActive])

  // Handle Tab: cycle through connected nodes (follow edges)
  const handleTabNav = useCallback((reverse: boolean) => {
    const selectedIds = selectedNodeIdsRef.current
    const allNodes = nodesRef.current
    const allEdges = edgesRef.current

    if (allNodes.length === 0) return false

    // No selection: select first node
    if (selectedIds.length === 0) {
      const { setSelectedNodes } = useWorkspaceStore.getState()
      setSelectedNodes([allNodes[0]!.id])
      panToNode(allNodes[0]!.id)
      setKeyboardNavActive(true)
      return true
    }

    // Single selection: try to cycle through connected nodes
    if (selectedIds.length === 1) {
      const currentId = selectedIds[0]!

      // Build list of connected node IDs (neighbors via edges)
      const connectedIds: string[] = []
      for (const edge of allEdges) {
        if (edge.source === currentId && !connectedIds.includes(edge.target)) {
          connectedIds.push(edge.target)
        }
        if (edge.target === currentId && !connectedIds.includes(edge.source)) {
          connectedIds.push(edge.source)
        }
      }

      if (connectedIds.length > 0) {
        // Find current position in connected list and cycle
        // Use a stable sort by position so cycling is predictable
        const sorted = connectedIds
          .map((id) => {
            const node = allNodes.find((n) => n.id === id)
            return node ? { id, x: node.position.x, y: node.position.y } : null
          })
          .filter(Boolean) as Array<{ id: string; x: number; y: number }>

        sorted.sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x)

        // No connected nodes found in current graph
        if (sorted.length === 0) return false

        const { setSelectedNodes } = useWorkspaceStore.getState()
        // Cycle: pick next connected node
        const nextId = reverse
          ? sorted[sorted.length - 1]!.id
          : sorted[0]!.id

        setSelectedNodes([nextId])
        panToNode(nextId)
        setKeyboardNavActive(true)
        return true
      }

      // No edges: fall back to array-order cycling (same as old behavior)
      const currentIndex = allNodes.findIndex((n) => n.id === currentId)
      const nextIndex = reverse
        ? (currentIndex <= 0 ? allNodes.length - 1 : currentIndex - 1)
        : (currentIndex >= allNodes.length - 1 ? 0 : currentIndex + 1)
      const nextNode = allNodes[nextIndex]
      if (nextNode) {
        const { setSelectedNodes } = useWorkspaceStore.getState()
        setSelectedNodes([nextNode.id])
        panToNode(nextNode.id)
        setKeyboardNavActive(true)
        return true
      }
    }

    return false
  }, [panToNode, setKeyboardNavActive])

  // Register keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      // Don't capture when focus is inside an input, textarea, or contenteditable
      const el = document.activeElement
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el?.getAttribute('contenteditable') === 'true' ||
        el?.closest?.('[contenteditable="true"]')
      ) {
        return
      }

      // Don't interfere when no nodes exist
      if (nodesRef.current.length === 0) return

      // Don't capture modified arrow keys (Alt+Arrow used elsewhere)
      if (e.altKey) return

      // Arrow keys: spatial navigation
      const direction = arrowToDirection(e.key)
      if (direction && !e.ctrlKey && !e.metaKey) {
        // Only handle if there's a selection to navigate from,
        // or if there are nodes to select
        if (selectedNodeIdsRef.current.length > 0) {
          e.preventDefault()
          handleArrowNav(direction, e.shiftKey)
          return
        }
      }

      // Tab: cycle through connected nodes (single selection or no selection only).
      // When multiple nodes are selected, Tab opens SelectionActionBar in App.tsx.
      if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (selectedNodeIdsRef.current.length <= 1) {
          e.preventDefault()
          handleTabNav(e.shiftKey)
        }
      }
    }

    // Clear keyboardNavActive on mouse click (user returned to mouse interaction)
    const handleMouseDown = (): void => {
      if (useUIStore.getState().keyboardNavActive) {
        setKeyboardNavActive(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('mousedown', handleMouseDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('mousedown', handleMouseDown)
    }
  }, [handleArrowNav, handleTabNav, setKeyboardNavActive])

  return { keyboardNavActive }
}
