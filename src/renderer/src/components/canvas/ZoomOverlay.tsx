/**
 * Z-Key Viewport Zoom Overlay
 *
 * Press and hold Z -> full-viewport bird's-eye minimap overlay.
 * Shows all nodes as tiny colored rectangles.
 * User can drag a rectangle to select a target area.
 * Release Z -> animate viewport to the selected area (300ms transition).
 * If Z released without selection, just close the overlay.
 *
 * PFD Phase 5B: Canvas Interaction Patterns
 */

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useWorkspaceStore } from '../../stores/workspaceStore'

interface SelectionRect {
  startX: number
  startY: number
  endX: number
  endY: number
}

/** Node type -> color for minimap dots */
const NODE_TYPE_COLORS: Record<string, string> = {
  conversation: '#3b82f6',
  note: '#22c55e',
  task: '#f59e0b',
  project: '#8b5cf6',
  artifact: '#ef4444',
  workspace: '#06b6d4',
  text: '#6b7280',
  action: '#ec4899',
  orchestrator: '#f97316'
}

function isTextInput(el: Element | null): boolean {
  if (!el) return false
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el.getAttribute('contenteditable') === 'true' ||
    el.closest?.('[contenteditable="true"]')
  ) {
    return true
  }
  return false
}

export const ZoomOverlay = memo(function ZoomOverlay(): JSX.Element | null {
  const [active, setActive] = useState(false)
  const [selection, setSelection] = useState<SelectionRect | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)
  const { setViewport, getViewport } = useReactFlow()
  const nodes = useWorkspaceStore((state) => state.nodes)

  // Compute the bounding box of all nodes (in flow coordinates)
  const computeFlowBounds = useCallback(() => {
    if (nodes.length === 0) return { minX: 0, minY: 0, maxX: 1000, maxY: 800 }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const node of nodes) {
      const w = (node.width as number) || 280
      const h = (node.height as number) || 140
      minX = Math.min(minX, node.position.x)
      minY = Math.min(minY, node.position.y)
      maxX = Math.max(maxX, node.position.x + w)
      maxY = Math.max(maxY, node.position.y + h)
    }
    // Add padding
    const padX = (maxX - minX) * 0.1
    const padY = (maxY - minY) * 0.1
    return {
      minX: minX - padX,
      minY: minY - padY,
      maxX: maxX + padX,
      maxY: maxY + padY
    }
  }, [nodes])

  // Convert overlay screen coordinates to flow coordinates
  const screenToFlow = useCallback(
    (screenX: number, screenY: number, overlayRect: DOMRect) => {
      const bounds = computeFlowBounds()
      const flowWidth = bounds.maxX - bounds.minX
      const flowHeight = bounds.maxY - bounds.minY
      const ratioX = (screenX - overlayRect.left) / overlayRect.width
      const ratioY = (screenY - overlayRect.top) / overlayRect.height
      return {
        x: bounds.minX + ratioX * flowWidth,
        y: bounds.minY + ratioY * flowHeight
      }
    },
    [computeFlowBounds]
  )

  // Handle Z key press/release
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'z' || e.key === 'Z') {
        if (isTextInput(document.activeElement)) return
        if (e.ctrlKey || e.metaKey || e.altKey) return // Don't hijack Ctrl+Z (undo)
        if (!active) {
          e.preventDefault()
          setActive(true)
        }
      }
      // Escape also closes
      if (e.key === 'Escape' && active) {
        setActive(false)
        setSelection(null)
        setIsDragging(false)
      }
    }

    const handleKeyUp = (e: KeyboardEvent): void => {
      if ((e.key === 'z' || e.key === 'Z') && active) {
        // If there was a drag selection, navigate to it
        if (selection && isDragging) {
          const overlay = overlayRef.current
          if (overlay) {
            const overlayRect = overlay.getBoundingClientRect()
            const topLeft = screenToFlow(
              Math.min(selection.startX, selection.endX),
              Math.min(selection.startY, selection.endY),
              overlayRect
            )
            const bottomRight = screenToFlow(
              Math.max(selection.startX, selection.endX),
              Math.max(selection.startY, selection.endY),
              overlayRect
            )

            const selectionWidth = bottomRight.x - topLeft.x
            const selectionHeight = bottomRight.y - topLeft.y

            if (selectionWidth > 10 && selectionHeight > 10) {
              const viewportWidth = window.innerWidth
              const viewportHeight = window.innerHeight

              const zoom = Math.min(
                viewportWidth / selectionWidth,
                viewportHeight / selectionHeight,
                4 // max zoom
              )

              const centerX = topLeft.x + selectionWidth / 2
              const centerY = topLeft.y + selectionHeight / 2

              setViewport(
                {
                  x: viewportWidth / 2 - centerX * zoom,
                  y: viewportHeight / 2 - centerY * zoom,
                  zoom
                },
                { duration: 300 }
              )
            }
          }
        }
        setActive(false)
        setSelection(null)
        setIsDragging(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [active, selection, isDragging, setViewport, screenToFlow])

  // Mouse handlers for drag-select
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
    setSelection({
      startX: e.clientX,
      startY: e.clientY,
      endX: e.clientX,
      endY: e.clientY
    })
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !selection) return
      setSelection((prev) =>
        prev ? { ...prev, endX: e.clientX, endY: e.clientY } : null
      )
    },
    [isDragging, selection]
  )

  const handleMouseUp = useCallback(() => {
    // Selection finalized; Z release will navigate
  }, [])

  if (!active) return null

  const bounds = computeFlowBounds()
  const flowWidth = bounds.maxX - bounds.minX
  const flowHeight = bounds.maxY - bounds.minY

  // Current viewport indicator
  const vp = getViewport()
  const vpFlowLeft = -vp.x / vp.zoom
  const vpFlowTop = -vp.y / vp.zoom
  const vpFlowWidth = window.innerWidth / vp.zoom
  const vpFlowHeight = window.innerHeight / vp.zoom

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[var(--gui-z-modals,50)] cursor-crosshair"
      style={{
        background: 'rgba(0, 0, 0, 0.75)',
        pointerEvents: 'auto'
      }}
      aria-label="Zoom navigation overlay"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Render nodes as minimap rectangles */}
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        {/* Current viewport rectangle */}
        <rect
          x={`${((vpFlowLeft - bounds.minX) / flowWidth) * 100}%`}
          y={`${((vpFlowTop - bounds.minY) / flowHeight) * 100}%`}
          width={`${(vpFlowWidth / flowWidth) * 100}%`}
          height={`${(vpFlowHeight / flowHeight) * 100}%`}
          fill="none"
          stroke="rgba(255, 255, 255, 0.4)"
          strokeWidth={1}
          strokeDasharray="4 2"
        />
        {/* Node rectangles */}
        {nodes.map((node) => {
          const w = (node.width as number) || 280
          const h = (node.height as number) || 140
          const nodeType = (node.data as { type?: string })?.type || 'text'
          const color = NODE_TYPE_COLORS[nodeType] || '#6b7280'
          return (
            <rect
              key={node.id}
              x={`${((node.position.x - bounds.minX) / flowWidth) * 100}%`}
              y={`${((node.position.y - bounds.minY) / flowHeight) * 100}%`}
              width={`${(w / flowWidth) * 100}%`}
              height={`${(h / flowHeight) * 100}%`}
              fill={color}
              opacity={0.7}
              rx={2}
            />
          )
        })}
      </svg>

      {/* Drag selection rectangle */}
      {selection && isDragging && (
        <div
          className="pointer-events-none absolute border-2 border-blue-400 bg-blue-400/20"
          style={{
            left: Math.min(selection.startX, selection.endX),
            top: Math.min(selection.startY, selection.endY),
            width: Math.abs(selection.endX - selection.startX),
            height: Math.abs(selection.endY - selection.startY)
          }}
        />
      )}

      {/* Instructions */}
      <div className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 rounded-lg bg-black/60 px-4 py-2 text-sm text-white/80 backdrop-blur-sm">
        Drag to select area, release Z to zoom in. Escape to cancel.
      </div>
    </div>
  )
})
