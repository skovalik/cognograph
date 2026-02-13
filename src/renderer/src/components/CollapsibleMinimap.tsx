/**
 * Collapsible Minimap Component
 *
 * A draggable and collapsible wrapper around React Flow's MiniMap.
 * Can be positioned anywhere on the canvas and collapsed to save space.
 */

import { memo, useState, useCallback, useRef, useEffect } from 'react'
import { MiniMap } from '@xyflow/react'
import { ChevronDown, ChevronUp, GripHorizontal, Map } from 'lucide-react'
import { useUIStore, selectThemeSettings } from '../stores'

interface Position {
  x: number
  y: number
}

// Helper to get the ReactFlow container bounds
function getContainerBounds(): { left: number; top: number; width: number; height: number } {
  const container = document.querySelector('.react-flow')
  if (container) {
    const rect = container.getBoundingClientRect()
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
  }
  return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
}

// Corner positions for snapping
type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

interface CollapsibleMinimapProps {
  defaultCorner?: Corner
}

function CollapsibleMinimapComponent({ defaultCorner = 'bottom-right' }: CollapsibleMinimapProps): JSX.Element {
  const themeSettings = useUIStore(selectThemeSettings)

  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [corner, setCorner] = useState<Corner>(defaultCorner)
  const [customPosition, setCustomPosition] = useState<Position | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const dragStartPos = useRef<Position>({ x: 0, y: 0 })
  const dragStartCorner = useRef<Position>({ x: 0, y: 0 })

  // Calculate position based on corner or custom position
  const getPositionStyle = useCallback((): React.CSSProperties => {
    if (customPosition) {
      return {
        left: customPosition.x,
        top: customPosition.y,
        right: 'auto',
        bottom: 'auto'
      }
    }

    const offset = 16 // Distance from edge
    switch (corner) {
      case 'top-left':
        return { left: offset, top: offset + 60 } // Account for toolbar
      case 'top-right':
        return { right: offset, top: offset + 60 }
      case 'bottom-left':
        return { left: offset, bottom: offset }
      case 'bottom-right':
      default:
        return { right: offset, bottom: offset }
    }
  }, [corner, customPosition])

  // Handle drag start
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const containerBounds = getContainerBounds()

    dragStartPos.current = { x: e.clientX, y: e.clientY }
    // Store position relative to the ReactFlow container, not the window
    dragStartCorner.current = {
      x: rect.left - containerBounds.left,
      y: rect.top - containerBounds.top
    }
    setIsDragging(true)
  }, [])

  // Handle drag move and end
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent): void => {
      const containerBounds = getContainerBounds()
      const deltaX = e.clientX - dragStartPos.current.x
      const deltaY = e.clientY - dragStartPos.current.y

      // Calculate new position relative to container
      const newX = Math.max(0, Math.min(containerBounds.width - 200, dragStartCorner.current.x + deltaX))
      const newY = Math.max(0, Math.min(containerBounds.height - 150, dragStartCorner.current.y + deltaY))

      setCustomPosition({ x: newX, y: newY })
    }

    const handleMouseUp = (): void => {
      setIsDragging(false)

      // Snap to nearest corner if close to edge
      const containerBounds = getContainerBounds()
      const snapThreshold = 100
      const pos = customPosition || { x: 0, y: 0 }

      const nearLeft = pos.x < snapThreshold
      const nearRight = pos.x > containerBounds.width - snapThreshold - 200
      const nearTop = pos.y < snapThreshold + 60
      const nearBottom = pos.y > containerBounds.height - snapThreshold - 150

      if (nearLeft && nearTop) {
        setCorner('top-left')
        setCustomPosition(null)
      } else if (nearRight && nearTop) {
        setCorner('top-right')
        setCustomPosition(null)
      } else if (nearLeft && nearBottom) {
        setCorner('bottom-left')
        setCustomPosition(null)
      } else if (nearRight && nearBottom) {
        setCorner('bottom-right')
        setCustomPosition(null)
      }
      // Otherwise keep custom position
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, customPosition])

  // Toggle collapsed state
  const toggleCollapsed = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsCollapsed((prev) => !prev)
  }, [])

  // Theme-aware styling using GUI theme CSS variables
  const isLightMode = themeSettings.mode === 'light'

  return (
    <div
      ref={containerRef}
      className="absolute z-10 transition-all duration-200"
      style={{
        ...getPositionStyle(),
        transition: isDragging ? 'none' : 'all 0.2s ease-out'
      }}
    >
      <div
        className="rounded-lg overflow-hidden shadow-lg gui-border"
        style={{
          backgroundColor: 'var(--gui-panel-bg)',
          borderWidth: '1px'
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-2 py-1.5 cursor-move select-none gui-border"
          style={{
            backgroundColor: 'var(--gui-panel-bg-secondary)',
            borderBottomWidth: '1px'
          }}
          onMouseDown={handleDragStart}
        >
          <div className="flex items-center gap-1.5">
            <GripHorizontal className="w-3 h-3 gui-text-secondary" />
            <Map className="w-3.5 h-3.5 gui-text-secondary" />
            <span className="text-xs gui-text-secondary">Map</span>
          </div>
          <button
            onClick={toggleCollapsed}
            className="p-0.5 gui-button rounded transition-colors"
            title={isCollapsed ? 'Expand minimap' : 'Collapse minimap'}
          >
            {isCollapsed ? (
              <ChevronUp className="w-3.5 h-3.5 gui-text-secondary" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 gui-text-secondary" />
            )}
          </button>
        </div>

        {/* Minimap content */}
        {!isCollapsed && (
          <div className="relative">
            <MiniMap
              key={JSON.stringify(themeSettings.nodeColors)} // Force re-render on theme change
              nodeColor={(node) => {
                const nodeType = node.type as keyof typeof themeSettings.nodeColors
                return themeSettings.nodeColors[nodeType] || '#6b7280'
              }}
              maskColor={isLightMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)'}
              style={{
                width: 180,
                height: 120,
                backgroundColor: 'transparent'
              }}
              className="!static !bg-transparent !border-0 !rounded-none !shadow-none"
            />
          </div>
        )}
      </div>
    </div>
  )
}

export const CollapsibleMinimap = memo(CollapsibleMinimapComponent)
