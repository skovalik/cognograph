/**
 * Pinned Window Component
 *
 * A draggable, resizable floating window that displays a node's content
 * detached from the canvas. Follows the same pattern as FloatingPropertiesModal.
 */

import { memo, useState, useCallback, useRef, useEffect } from 'react'
import { X, GripHorizontal, Minimize2, Maximize2, Pin } from 'lucide-react'
import type { Node } from '@xyflow/react'
import type { NodeData } from '@shared/types'
import { useWorkspaceStore, type PinnedWindow as PinnedWindowState } from '../../stores/workspaceStore'
import { EditableTitle } from '../EditableTitle'
import { PinnedNodeContent } from './PinnedNodeContent'

interface PinnedWindowProps {
  window: PinnedWindowState
  node: Node<NodeData>
}

function PinnedWindowComponent({ window: win, node }: PinnedWindowProps): JSX.Element {
  const unpinNode = useWorkspaceStore((state) => state.unpinNode)
  const updatePinnedWindow = useWorkspaceStore((state) => state.updatePinnedWindow)
  const bringPinnedToFront = useWorkspaceStore((state) => state.bringPinnedToFront)
  const updateNode = useWorkspaceStore((state) => state.updateNode)

  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [position, setPosition] = useState(win.position)
  const [size, setSize] = useState(win.size)

  const dragStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  // Sync local state when store changes (e.g. cascade repositioning)
  useEffect(() => {
    setPosition(win.position)
    setSize(win.size)
  }, [win.position.x, win.position.y, win.size.width, win.size.height])

  // Commit position to store when drag ends
  const commitPosition = useCallback((pos: { x: number; y: number }) => {
    updatePinnedWindow(node.id, { position: pos })
  }, [node.id, updatePinnedWindow])

  // Commit size to store when resize ends
  const commitSize = useCallback((newSize: { width: number; height: number }, pos?: { x: number; y: number }) => {
    const updates: Partial<PinnedWindowState> = { size: newSize }
    if (pos) updates.position = pos
    updatePinnedWindow(node.id, updates)
  }, [node.id, updatePinnedWindow])

  // Handle drag start
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    bringPinnedToFront(node.id)
    setIsDragging(true)
    dragStartPos.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    }
  }, [position, node.id, bringPinnedToFront])

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
      setPosition(prev => {
        commitPosition(prev)
        return prev
      })
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, commitPosition])

  // Handle close
  const handleClose = useCallback(() => {
    unpinNode(node.id)
  }, [unpinNode, node.id])

  // Handle minimize toggle
  const toggleMinimize = useCallback(() => {
    updatePinnedWindow(node.id, { minimized: !win.minimized })
  }, [node.id, win.minimized, updatePinnedWindow])

  // Handle mouse down (bring to front)
  const handleMouseDown = useCallback(() => {
    bringPinnedToFront(node.id)
  }, [node.id, bringPinnedToFront])

  // Resize handler factory
  const createResizeHandler = useCallback((
    direction: 'right' | 'bottom' | 'left' | 'top' | 'br' | 'bl' | 'tr' | 'tl'
  ) => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    bringPinnedToFront(node.id)
    const startX = e.clientX
    const startY = e.clientY
    const startWidth = size.width
    const startHeight = size.height
    const startPosX = position.x
    const startPosY = position.y

    const handleResize = (moveE: MouseEvent): void => {
      const deltaX = moveE.clientX - startX
      const deltaY = moveE.clientY - startY
      let newWidth = startWidth
      let newHeight = startHeight
      let newX = startPosX
      let newY = startPosY

      if (direction.includes('right') || direction === 'br' || direction === 'tr') {
        newWidth = Math.max(300, startWidth + deltaX)
      }
      if (direction.includes('left') || direction === 'bl' || direction === 'tl') {
        newWidth = Math.max(300, startWidth - deltaX)
        newX = startPosX + (startWidth - newWidth)
      }
      if (direction.includes('bottom') || direction === 'br' || direction === 'bl') {
        newHeight = Math.max(150, startHeight + deltaY)
      }
      if (direction.includes('top') || direction === 'tr' || direction === 'tl') {
        newHeight = Math.max(150, startHeight - deltaY)
        newY = startPosY + (startHeight - newHeight)
      }

      setSize({ width: newWidth, height: newHeight })
      setPosition({ x: Math.max(0, newX), y: Math.max(0, newY) })
    }

    const handleResizeEnd = (): void => {
      setIsResizing(false)
      // Read current size/position from state at end
      setSize(prev => {
        setPosition(posPrev => {
          commitSize(prev, posPrev)
          return posPrev
        })
        return prev
      })
      document.removeEventListener('mousemove', handleResize)
      document.removeEventListener('mouseup', handleResizeEnd)
    }

    document.addEventListener('mousemove', handleResize)
    document.addEventListener('mouseup', handleResizeEnd)
  }, [size, position, node.id, bringPinnedToFront, commitSize])

  // Get node color for theming
  const nodeColor = node.data.color || '#6b7280'

  return (
    <div
      className="fixed bg-[var(--surface-panel)] border border-[var(--border-subtle)] rounded-lg shadow-2xl overflow-hidden flex flex-col"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: win.minimized ? 44 : size.height,
        zIndex: win.zIndex + 1000,
        transition: isDragging || isResizing ? 'none' : 'height 0.2s ease-out',
        borderTopColor: nodeColor
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Title Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[var(--surface-panel)] border-b border-[var(--border-subtle)] select-none flex-shrink-0">
        {/* Draggable area */}
        <div
          className="flex items-center gap-2 flex-1 cursor-move min-w-0"
          onMouseDown={handleDragStart}
        >
          <GripHorizontal className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
          <Pin className="w-3 h-3 flex-shrink-0" style={{ color: nodeColor }} />
          <EditableTitle
            value={node.data.title as string}
            onChange={(newTitle) => updateNode(node.id, { title: newTitle })}
            className="text-sm font-medium text-[var(--text-primary)] truncate flex-1"
            placeholder="Untitled"
          />
        </div>
        {/* Window controls */}
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          <button
            type="button"
            onClick={toggleMinimize}
            className="p-1.5 hover:bg-[var(--surface-panel-secondary)] rounded transition-colors"
            title={win.minimized ? 'Expand' : 'Minimize'}
          >
            {win.minimized ? (
              <Maximize2 className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
            ) : (
              <Minimize2 className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
            )}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 hover:bg-red-500/20 rounded transition-colors group"
            title="Unpin and close"
          >
            <X className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-red-400" />
          </button>
        </div>
      </div>

      {/* Content */}
      {!win.minimized && (
        <div className="flex-1 overflow-auto p-3">
          <PinnedNodeContent node={node} />
        </div>
      )}

      {/* Resize Handles */}
      {!win.minimized && (
        <>
          {/* Right edge */}
          <div
            className="absolute right-0 top-[48px] bottom-4 w-1 cursor-ew-resize hover:bg-blue-500/30"
            onMouseDown={createResizeHandler('right')}
          />
          {/* Left edge */}
          <div
            className="absolute left-0 top-[48px] bottom-4 w-1 cursor-ew-resize hover:bg-blue-500/30"
            onMouseDown={createResizeHandler('left')}
          />
          {/* Bottom edge */}
          <div
            className="absolute bottom-0 left-4 right-4 h-1 cursor-ns-resize hover:bg-blue-500/30"
            onMouseDown={createResizeHandler('bottom')}
          />
          {/* Top edge */}
          <div
            className="absolute top-0 left-4 right-[80px] h-1 cursor-ns-resize hover:bg-blue-500/30"
            onMouseDown={createResizeHandler('top')}
          />
          {/* Bottom-right corner */}
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
            onMouseDown={createResizeHandler('br')}
          >
            <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-[var(--border-subtle)]" />
          </div>
          {/* Bottom-left corner */}
          <div
            className="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize"
            onMouseDown={createResizeHandler('bl')}
          />
          {/* Top-right corner */}
          <div
            className="absolute top-0 right-0 w-4 h-4 cursor-ne-resize"
            onMouseDown={createResizeHandler('tr')}
          />
          {/* Top-left corner */}
          <div
            className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize"
            onMouseDown={createResizeHandler('tl')}
          />
        </>
      )}
    </div>
  )
}

export const PinnedWindow = memo(PinnedWindowComponent)
