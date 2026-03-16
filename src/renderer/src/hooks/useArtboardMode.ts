/**
 * useArtboardMode — Artboard Mode Infrastructure Hook
 *
 * Handles keyboard shortcuts for entering/exiting artboard mode:
 * - Cmd/Ctrl+Enter on a single selected node: enter artboard mode
 * - Escape: exit artboard mode
 *
 * Artboard mode expands a node into a 60% viewport-width editing panel
 * with a glassmorphic overlay dimming surrounding content.
 * Only one artboard can be active at a time.
 */

import { useEffect, useCallback } from 'react'
import { useUIStore } from '../stores/uiStore'
import { useSelectionStore } from '../stores/selectionStore'

export function useArtboardMode() {
  const artboardNodeId = useUIStore((s) => s.artboardNodeId)
  const enterArtboard = useUIStore((s) => s.enterArtboard)
  const exitArtboard = useUIStore((s) => s.exitArtboard)

  const isArtboardActive = artboardNodeId !== null

  const handleEnterArtboard = useCallback(
    (nodeId: string) => {
      enterArtboard(nodeId)
    },
    [enterArtboard]
  )

  const handleExitArtboard = useCallback(() => {
    exitArtboard()
  }, [exitArtboard])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      // Escape exits artboard mode
      if (e.key === 'Escape' && isArtboardActive) {
        e.preventDefault()
        e.stopPropagation()
        handleExitArtboard()
        return
      }

      // Cmd/Ctrl+Enter enters artboard mode on single selected node
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        // Don't activate if typing in an input
        const target = e.target as HTMLElement
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable
        ) {
          return
        }

        const selectedNodeIds = useSelectionStore.getState().selectedNodeIds
        if (selectedNodeIds.length === 1 && !isArtboardActive) {
          e.preventDefault()
          handleEnterArtboard(selectedNodeIds[0]!)
        }
      }
    }

    // Use capture phase so artboard Escape takes priority
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [isArtboardActive, handleEnterArtboard, handleExitArtboard])

  return {
    isArtboardActive,
    artboardNodeId,
    enterArtboard: handleEnterArtboard,
    exitArtboard: handleExitArtboard
  }
}
