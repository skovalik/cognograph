import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { useViewport } from '@xyflow/react'
import { useWorkspaceStore } from '../../stores/workspaceStore'

interface NodeArtboardProps {
  nodeId: string
  nodeColor: string
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
}

/**
 * NodeArtboard - Shared artboard wrapper for expanded node editing.
 *
 * When a user zooms into ultra-close on a node, or triggers via hotkey,
 * the node expands into this artboard layout with a header bar preserving
 * card identity, and a body area for tabbed/split content panels.
 *
 * Phase 3C: Header ALWAYS shows node type icon, title, accent color bar
 * (left border), and close button with Escape hint. Card identity persists
 * from card-level to artboard-level — same accent color, same icon.
 *
 * Dimensions: min(nodeWidth * 2.5, viewportWidth * 0.7) x viewportHeight * 0.85
 * Hard cap: 2400 x 1800px
 *
 * Exit triggers: Escape key, zoom-out below 0.97x, close button click.
 */
export const NodeArtboard = memo(function NodeArtboard({
  nodeId,
  nodeColor,
  title,
  icon,
  children,
  className
}: NodeArtboardProps): React.JSX.Element {
  const viewport = useViewport()
  const containerRef = useRef<HTMLDivElement>(null)

  const collapseInPlaceExpansion = useWorkspaceStore(
    (state) => state.collapseInPlaceExpansion
  )

  // Calculate artboard dimensions based on viewport
  const dimensions = useMemo(() => {
    // Viewport dimensions in screen pixels
    const vpWidth = window.innerWidth
    const vpHeight = window.innerHeight

    const width = Math.min(vpWidth * 0.7, 2400)
    const height = Math.min(vpHeight * 0.85, 1800)

    return { width, height }
  }, [])

  // Exit artboard on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        collapseInPlaceExpansion()
      }
    },
    [collapseInPlaceExpansion]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true })
    }
  }, [handleKeyDown])

  // Exit artboard if zoom drops below 0.97
  useEffect(() => {
    if (viewport.zoom < 0.97) {
      collapseInPlaceExpansion()
    }
  }, [viewport.zoom, collapseInPlaceExpansion])

  // Focus trap: focus container on mount
  useEffect(() => {
    containerRef.current?.focus()
  }, [])

  const handleClose = useCallback(() => {
    collapseInPlaceExpansion()
  }, [collapseInPlaceExpansion])

  return (
    <div
      ref={containerRef}
      className={`node-artboard artboard-primary artboard-transition ${className ?? ''}`}
      style={
        {
          width: dimensions.width,
          height: dimensions.height,
          '--node-accent': nodeColor
        } as React.CSSProperties
      }
      role="dialog"
      aria-label={`Artboard: ${title}`}
      tabIndex={-1}
      data-artboard-node-id={nodeId}
    >
      <div className="node-artboard__header node-artboard__header--accented">
        {icon && <span className="node-artboard__header-icon">{icon}</span>}
        <span className="node-artboard__header-title">{title}</span>
        <button
          className="node-artboard__header-close"
          onClick={handleClose}
          aria-label="Close artboard"
          type="button"
        >
          <span aria-hidden="true">&times;</span>
          <span className="node-artboard__header-close-hint">Esc</span>
        </button>
      </div>
      <div className="node-artboard__body">{children}</div>
    </div>
  )
})
