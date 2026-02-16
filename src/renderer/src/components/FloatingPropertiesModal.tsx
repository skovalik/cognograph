/**
 * Floating Properties Modal
 *
 * A draggable modal window for viewing/editing node properties.
 * Supports multiple instances for pinned modals.
 */

import { memo, useState, useCallback, useRef, useEffect } from 'react'
import { X, GripHorizontal, Minimize2, Maximize2, Pin, PinOff } from 'lucide-react'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { PropertiesPanel } from './PropertiesPanel'
import { createFocusTrap } from '../utils/accessibility'

interface Position {
  x: number
  y: number
}

interface FloatingPropertiesModalProps {
  nodeId: string
  index: number // Used to offset multiple modals
}

// Store positions per nodeId to persist between renders
const modalPositions = new Map<string, Position>()

function FloatingPropertiesModalComponent({ nodeId, index }: FloatingPropertiesModalProps): JSX.Element | null {
  const closeFloatingProperties = useWorkspaceStore((state) => state.closeFloatingProperties)
  const nodes = useWorkspaceStore((state) => state.nodes)
  const setSelectedNodes = useWorkspaceStore((state) => state.setSelectedNodes)
  const selectedNodeIds = useWorkspaceStore((state) => state.selectedNodeIds)

  // Each modal tracks its own pinned state
  const [isPinned, setIsPinned] = useState(false)

  const [position, setPosition] = useState<Position>(() => {
    // Use last position if available, otherwise calculate offset position
    if (modalPositions.has(nodeId)) {
      return modalPositions.get(nodeId)!
    }
    // Offset each new modal to prevent stacking directly on top
    const offsetX = index * 30
    const offsetY = index * 30
    return {
      x: Math.max(50, (window.innerWidth - 320) / 2 + offsetX),
      y: Math.max(50, (window.innerHeight - 600) / 2 + offsetY)
    }
  })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [size, setSize] = useState({ width: 320, height: 600 })

  const dragStartPos = useRef<Position>({ x: 0, y: 0 })
  const modalRef = useRef<HTMLDivElement>(null)

  // Get the node data for this modal
  const node = nodes.find((n) => n.id === nodeId)

  // Update stored position when position changes
  useEffect(() => {
    modalPositions.set(nodeId, position)
  }, [position, nodeId])

  // Focus trap for accessibility
  useEffect(() => {
    if (!modalRef.current) return

    const trap = createFocusTrap(modalRef.current)
    trap.activate()

    return () => {
      trap.deactivate()
    }
  }, [])

  // Ensure the displayed node is selected when modal opens (only if not pinned)
  useEffect(() => {
    if (nodeId && !isPinned) {
      setSelectedNodes([nodeId])
    }
  }, [nodeId, setSelectedNodes, isPinned])

  // Close modal when no nodes are selected (unless pinned)
  useEffect(() => {
    if (nodeId && selectedNodeIds.length === 0 && !isPinned) {
      closeFloatingProperties(nodeId)
    }
  }, [selectedNodeIds, nodeId, closeFloatingProperties, isPinned])

  // Handle drag start
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    dragStartPos.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    }
  }, [position])

  // Handle drag move
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent): void => {
      const newX = Math.max(0, Math.min(window.innerWidth - 100, e.clientX - dragStartPos.current.x))
      const newY = Math.max(0, Math.min(window.innerHeight - 50, e.clientY - dragStartPos.current.y))
      setPosition({ x: newX, y: newY })
    }

    const handleMouseUp = (): void => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  // Handle close - close this specific modal
  const handleClose = useCallback(() => {
    modalPositions.delete(nodeId)
    closeFloatingProperties(nodeId)
  }, [closeFloatingProperties, nodeId])

  // Handle minimize toggle
  const toggleMinimize = useCallback(() => {
    setIsMinimized((prev) => !prev)
  }, [])

  // Handle pin toggle
  const togglePin = useCallback(() => {
    setIsPinned((prev) => !prev)
  }, [])

  // If node doesn't exist, close this modal
  if (!node) {
    return null
  }

  const titleId = `floating-props-modal-title-${nodeId}`

  return (
    <div
      ref={modalRef}
      className="fixed z-[100] bg-[var(--surface-panel)] glass-fluid border border-[var(--border-subtle)] rounded-lg shadow-2xl"
      style={{
        position: 'fixed', // Override glass-fluid's position: relative
        overflow: 'visible', // Prevent glass-fluid from clipping dropdowns
        left: position.x,
        top: position.y,
        width: size.width,
        height: isMinimized ? 44 : size.height,
        transition: isDragging || isResizing ? 'none' : 'height 0.2s ease-out'
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {/* Title Bar */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-[var(--surface-panel-secondary)] border-b border-[var(--border-subtle)] select-none"
      >
        {/* Draggable area - only the left portion */}
        <div
          className="flex items-center gap-2 flex-1 cursor-move"
          onMouseDown={handleDragStart}
        >
          <GripHorizontal className="w-4 h-4 text-[var(--text-muted)]" />
          <span id={titleId} className="text-sm font-medium text-[var(--text-primary)] truncate max-w-[180px]">
            {node.data.title as string}
          </span>
          <span className="text-xs text-[var(--text-muted)] capitalize">
            ({node.data.type})
          </span>
        </div>
        {/* Buttons - separate from drag area */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={togglePin}
            className={`p-1.5 hover:bg-[var(--surface-panel)] rounded transition-colors ${isPinned ? 'bg-[var(--surface-panel)]' : ''}`}
            title={isPinned ? 'Unpin (will close when deselected)' : 'Pin (keep open when deselected)'}
          >
            {isPinned ? (
              <Pin className="w-3.5 h-3.5 text-blue-400" />
            ) : (
              <PinOff className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
            )}
          </button>
          <button
            type="button"
            onClick={toggleMinimize}
            className="p-1.5 hover:bg-[var(--surface-panel)] rounded transition-colors"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? (
              <Maximize2 className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
            ) : (
              <Minimize2 className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
            )}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 hover:bg-[var(--surface-panel)] rounded transition-colors"
            title="Close"
          >
            <X className="w-4 h-4 text-[var(--text-secondary)]" />
          </button>
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
        <div className="h-[calc(100%-44px)] overflow-hidden">
          <PropertiesPanel compact hideHeader nodeId={nodeId} />
        </div>
      )}

      {/* Resize Handles (all 4 corners + all 4 edges) */}
      {!isMinimized && (
        <>
          {/* Left edge - starts below title bar */}
          <div
            className="absolute left-0 top-[48px] bottom-4 w-1 cursor-ew-resize hover:bg-blue-500/30"
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIsResizing(true)
              const startX = e.clientX
              const startWidth = size.width
              const startPosX = position.x

              const handleResize = (moveE: MouseEvent): void => {
                const deltaX = moveE.clientX - startX
                const newWidth = Math.max(280, startWidth - deltaX)
                const newX = startPosX + (startWidth - newWidth)
                setSize((prev) => ({ ...prev, width: newWidth }))
                setPosition((prev) => ({ ...prev, x: Math.max(0, newX) }))
              }

              const handleResizeEnd = (): void => {
                setIsResizing(false)
                document.removeEventListener('mousemove', handleResize)
                document.removeEventListener('mouseup', handleResizeEnd)
              }

              document.addEventListener('mousemove', handleResize)
              document.addEventListener('mouseup', handleResizeEnd)
            }}
          />

          {/* Right edge - starts below title bar */}
          <div
            className="absolute right-0 top-[48px] bottom-4 w-1 cursor-ew-resize hover:bg-blue-500/30"
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIsResizing(true)
              const startX = e.clientX
              const startWidth = size.width

              const handleResize = (moveE: MouseEvent): void => {
                const deltaX = moveE.clientX - startX
                const newWidth = Math.max(280, startWidth + deltaX)
                setSize((prev) => ({ ...prev, width: newWidth }))
              }

              const handleResizeEnd = (): void => {
                setIsResizing(false)
                document.removeEventListener('mousemove', handleResize)
                document.removeEventListener('mouseup', handleResizeEnd)
              }

              document.addEventListener('mousemove', handleResize)
              document.addEventListener('mouseup', handleResizeEnd)
            }}
          />

          {/* Top edge - at very top of modal */}
          <div
            className="absolute top-0 left-4 right-[100px] h-2 cursor-ns-resize hover:bg-blue-500/30"
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIsResizing(true)
              const startY = e.clientY
              const startHeight = size.height
              const startPosY = position.y

              const handleResize = (moveE: MouseEvent): void => {
                const deltaY = moveE.clientY - startY
                const newHeight = Math.max(200, startHeight - deltaY)
                const newY = startPosY + (startHeight - newHeight)
                setSize((prev) => ({ ...prev, height: newHeight }))
                setPosition((prev) => ({ ...prev, y: Math.max(0, newY) }))
              }

              const handleResizeEnd = (): void => {
                setIsResizing(false)
                document.removeEventListener('mousemove', handleResize)
                document.removeEventListener('mouseup', handleResizeEnd)
              }

              document.addEventListener('mousemove', handleResize)
              document.addEventListener('mouseup', handleResizeEnd)
            }}
          />

          {/* Bottom edge */}
          <div
            className="absolute bottom-0 left-4 right-4 h-1 cursor-ns-resize hover:bg-blue-500/30"
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIsResizing(true)
              const startY = e.clientY
              const startHeight = size.height

              const handleResize = (moveE: MouseEvent): void => {
                const deltaY = moveE.clientY - startY
                const newHeight = Math.max(200, startHeight + deltaY)
                setSize((prev) => ({ ...prev, height: newHeight }))
              }

              const handleResizeEnd = (): void => {
                setIsResizing(false)
                document.removeEventListener('mousemove', handleResize)
                document.removeEventListener('mouseup', handleResizeEnd)
              }

              document.addEventListener('mousemove', handleResize)
              document.addEventListener('mouseup', handleResizeEnd)
            }}
          />

          {/* Top-left corner (invisible) - at very top */}
          <div
            className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize"
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIsResizing(true)
              const startX = e.clientX
              const startY = e.clientY
              const startWidth = size.width
              const startHeight = size.height
              const startPosX = position.x
              const startPosY = position.y

              const handleResize = (moveE: MouseEvent): void => {
                const deltaX = moveE.clientX - startX
                const deltaY = moveE.clientY - startY
                const newWidth = Math.max(280, startWidth - deltaX)
                const newHeight = Math.max(200, startHeight - deltaY)
                // Move position to keep bottom-right corner fixed
                const newX = startPosX + (startWidth - newWidth)
                const newY = startPosY + (startHeight - newHeight)
                setSize({ width: newWidth, height: newHeight })
                setPosition({ x: Math.max(0, newX), y: Math.max(0, newY) })
              }

              const handleResizeEnd = (): void => {
                setIsResizing(false)
                document.removeEventListener('mousemove', handleResize)
                document.removeEventListener('mouseup', handleResizeEnd)
              }

              document.addEventListener('mousemove', handleResize)
              document.addEventListener('mouseup', handleResizeEnd)
            }}
          />

          {/* Top-right corner - at very top for resize */}
          <div
            className="absolute top-0 right-0 w-4 h-4 cursor-ne-resize z-[300]"
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIsResizing(true)
              const startX = e.clientX
              const startY = e.clientY
              const startWidth = size.width
              const startHeight = size.height
              const startPosY = position.y

              const handleResize = (moveE: MouseEvent): void => {
                const deltaX = moveE.clientX - startX
                const deltaY = moveE.clientY - startY
                const newWidth = Math.max(280, startWidth + deltaX)
                const newHeight = Math.max(200, startHeight - deltaY)
                // Move Y position to keep bottom edge fixed
                const newY = startPosY + (startHeight - newHeight)
                setSize({ width: newWidth, height: newHeight })
                setPosition((prev) => ({ ...prev, y: Math.max(0, newY) }))
              }

              const handleResizeEnd = (): void => {
                setIsResizing(false)
                document.removeEventListener('mousemove', handleResize)
                document.removeEventListener('mouseup', handleResizeEnd)
              }

              document.addEventListener('mousemove', handleResize)
              document.addEventListener('mouseup', handleResizeEnd)
            }}
          />

          {/* Bottom-left corner (invisible) */}
          <div
            className="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize"
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIsResizing(true)
              const startX = e.clientX
              const startY = e.clientY
              const startWidth = size.width
              const startHeight = size.height
              const startPosX = position.x

              const handleResize = (moveE: MouseEvent): void => {
                const deltaX = moveE.clientX - startX
                const deltaY = moveE.clientY - startY
                const newWidth = Math.max(280, startWidth - deltaX)
                const newHeight = Math.max(200, startHeight + deltaY)
                // Move X position to keep right edge fixed
                const newX = startPosX + (startWidth - newWidth)
                setSize({ width: newWidth, height: newHeight })
                setPosition((prev) => ({ ...prev, x: Math.max(0, newX) }))
              }

              const handleResizeEnd = (): void => {
                setIsResizing(false)
                document.removeEventListener('mousemove', handleResize)
                document.removeEventListener('mouseup', handleResizeEnd)
              }

              document.addEventListener('mousemove', handleResize)
              document.addEventListener('mouseup', handleResizeEnd)
            }}
          />

          {/* Bottom-right corner (visible indicator) */}
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIsResizing(true)
              const startX = e.clientX
              const startY = e.clientY
              const startWidth = size.width
              const startHeight = size.height

              const handleResize = (moveE: MouseEvent): void => {
                const newWidth = Math.max(280, startWidth + (moveE.clientX - startX))
                const newHeight = Math.max(200, startHeight + (moveE.clientY - startY))
                setSize({ width: newWidth, height: newHeight })
              }

              const handleResizeEnd = (): void => {
                setIsResizing(false)
                document.removeEventListener('mousemove', handleResize)
                document.removeEventListener('mouseup', handleResizeEnd)
              }

              document.addEventListener('mousemove', handleResize)
              document.addEventListener('mouseup', handleResizeEnd)
            }}
          >
            <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-[var(--border-subtle)]" />
          </div>
        </>
      )}
    </div>
  )
}

export const FloatingPropertiesModal = memo(FloatingPropertiesModalComponent)
