/**
 * Collapsible Minimap Component
 *
 * A draggable and collapsible wrapper around React Flow's MiniMap.
 * Can be positioned anywhere on the canvas and collapsed to save space.
 *
 * Phase 1C enhancements:
 * - District boundary overlays (colored rectangles at 20% opacity)
 * - Landmark node markers (filled circle with glow effect)
 * - CC session pulse animation on streaming conversation nodes
 */

import { memo, useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { MiniMap, useStore as useRFStore } from '@xyflow/react'
import { ChevronDown, ChevronUp, GripHorizontal, Map } from 'lucide-react'
import { useUIStore, selectThemeSettings, useCanvasStore } from '../stores'
import { useSpatialRegionStore, selectDistricts } from '../stores/spatialRegionStore'
import type { NoteMode } from '@shared/types'
import type { SpatialRegion } from '@shared/actionTypes'

// PFD Phase 6A: NoteMode badge colors for minimap node coloring
const NOTE_MODE_MINIMAP_COLORS: Record<NoteMode, string> = {
  general: '',
  persona: '#8b5cf6',
  reference: '#3b82f6',
  examples: '#f59e0b',
  background: '#6b7280',
  'design-tokens': '#ec4899',
  page: '#3b82f6',
  component: '#8b5cf6',
  'content-model': '#f97316',
  'wp-config': '#21759b'
}

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

// --------------------------------------------------------------------------
// Phase 1C: Custom MiniMap node component
// Renders landmark nodes with a distinctive filled circle marker and applies
// a pulse CSS class to streaming conversation nodes (CC session pulse).
// --------------------------------------------------------------------------
interface CustomMiniMapNodeProps {
  id: string
  x: number
  y: number
  width: number
  height: number
  style?: React.CSSProperties
  color?: string
  strokeColor?: string
  strokeWidth?: number
  className?: string
  borderRadius?: number
  shapeRendering?: string
  selected?: boolean
  onClick?: (event: React.MouseEvent, id: string) => void
}

const CustomMiniMapNodeComponent = ({
  id,
  x,
  y,
  width,
  height,
  style,
  color,
  strokeColor,
  strokeWidth,
  className,
  borderRadius = 5,
  shapeRendering,
  selected,
  onClick
}: CustomMiniMapNodeProps): JSX.Element => {
  const { background, backgroundColor } = style || {}
  const fill = color || (background as string) || (backgroundColor as string)

  // Check landmark + streaming status via data attributes on the group
  // We look up these from the node data that was passed via className conventions
  const isLandmark = className?.includes('minimap-landmark') ?? false
  const isStreaming = className?.includes('minimap-streaming') ?? false

  const handleClick = onClick
    ? (event: React.MouseEvent<SVGElement>): void => onClick(event as unknown as React.MouseEvent, id)
    : undefined

  if (isLandmark) {
    // Landmark nodes: render as a filled circle with a glow ring
    const cx = x + width / 2
    const cy = y + height / 2
    const radius = Math.max(width, height) * 0.6

    return (
      <g
        className={[
          'react-flow__minimap-node',
          selected ? 'selected' : '',
          className,
          isStreaming ? 'minimap-node-streaming' : ''
        ].filter(Boolean).join(' ')}
        onClick={handleClick}
      >
        {/* Glow ring */}
        <circle
          cx={cx}
          cy={cy}
          r={radius + 2}
          fill="none"
          stroke={fill || '#6b7280'}
          strokeWidth={1.5}
          opacity={0.4}
          shapeRendering={shapeRendering}
        />
        {/* Filled landmark dot */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill={fill || '#6b7280'}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          shapeRendering={shapeRendering}
        />
      </g>
    )
  }

  // Standard node: render as a rect (same as default MiniMapNode)
  return (
    <rect
      className={[
        'react-flow__minimap-node',
        selected ? 'selected' : '',
        className,
        isStreaming ? 'minimap-node-streaming' : ''
      ].filter(Boolean).join(' ')}
      x={x}
      y={y}
      rx={borderRadius}
      ry={borderRadius}
      width={width}
      height={height}
      style={{
        fill: fill || undefined,
        stroke: strokeColor,
        strokeWidth
      }}
      shapeRendering={shapeRendering}
      onClick={handleClick}
    />
  )
}

const CustomMiniMapNode = memo(CustomMiniMapNodeComponent)

// --------------------------------------------------------------------------
// Phase 1C: District overlay component
// Renders semi-transparent colored rectangles for each district region.
// Uses the same coordinate space as the MiniMap SVG.
// --------------------------------------------------------------------------
interface DistrictOverlayProps {
  districts: SpatialRegion[]
}

const DistrictOverlayComponent = ({ districts }: DistrictOverlayProps): JSX.Element | null => {
  if (districts.length === 0) return null

  return (
    <>
      {districts.map((district) => (
        <rect
          key={district.id}
          x={district.bounds.x}
          y={district.bounds.y}
          width={district.bounds.width}
          height={district.bounds.height}
          rx={4}
          ry={4}
          fill={district.color || '#6b7280'}
          fillOpacity={0.2}
          stroke={district.color || '#6b7280'}
          strokeOpacity={0.35}
          strokeWidth={1}
          pointerEvents="none"
          className="minimap-district"
        />
      ))}
    </>
  )
}

const DistrictOverlay = memo(DistrictOverlayComponent)

// --------------------------------------------------------------------------
// Phase 1C: Minimap district SVG overlay
// Positioned absolutely on top of the MiniMap, sharing the same viewBox
// computed from React Flow's internal bounding rect state.
// --------------------------------------------------------------------------

// Selector that mirrors React Flow MiniMap's internal viewBox calculation
const OFFSET_SCALE = 5

const selectMinimapViewBox = (s: {
  nodes: Array<{ hidden?: boolean; measured?: { width?: number; height?: number }; internals?: { positionAbsolute: { x: number; y: number } } }>
  nodeLookup: Map<string, { internals: { positionAbsolute: { x: number; y: number }; userNode: { hidden?: boolean; measured?: { width?: number; height?: number } } } }>
}): { x: number; y: number; width: number; height: number } | null => {
  // Build bounding rect of all visible nodes
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  let hasNodes = false

  s.nodeLookup.forEach((entry) => {
    const node = entry.internals.userNode
    if (node.hidden) return
    const { x: nx, y: ny } = entry.internals.positionAbsolute
    const w = node.measured?.width ?? 0
    const h = node.measured?.height ?? 0
    if (w === 0 && h === 0) return

    hasNodes = true
    minX = Math.min(minX, nx)
    minY = Math.min(minY, ny)
    maxX = Math.max(maxX, nx + w)
    maxY = Math.max(maxY, ny + h)
  })

  if (!hasNodes) return null

  const bw = maxX - minX
  const bh = maxY - minY

  // MiniMap defaults: 180 width, 120 height
  const elementWidth = 180
  const elementHeight = 120
  const scaledWidth = bw / elementWidth
  const scaledHeight = bh / elementHeight
  const viewScale = Math.max(scaledWidth, scaledHeight)
  const viewWidth = viewScale * elementWidth
  const viewHeight = viewScale * elementHeight
  const offset = OFFSET_SCALE * viewScale

  return {
    x: minX - (viewWidth - bw) / 2 - offset,
    y: minY - (viewHeight - bh) / 2 - offset,
    width: viewWidth + offset * 2,
    height: viewHeight + offset * 2
  }
}

// --------------------------------------------------------------------------
// Main component
// --------------------------------------------------------------------------

interface CollapsibleMinimapProps {
  defaultCorner?: Corner
}

function CollapsibleMinimapComponent({ defaultCorner = 'bottom-right' }: CollapsibleMinimapProps): JSX.Element {
  const themeSettings = useUIStore(selectThemeSettings)
  const districts = useSpatialRegionStore(selectDistricts)
  const streamingConversations = useCanvasStore((s) => s.streamingConversations)

  // Phase 1C: Compute the same viewBox the MiniMap uses internally
  const viewBox = useRFStore(selectMinimapViewBox)

  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [corner, setCorner] = useState<Corner>(defaultCorner)
  const [customPosition, setCustomPosition] = useState<Position | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const dragStartPos = useRef<Position>({ x: 0, y: 0 })
  const dragStartCorner = useRef<Position>({ x: 0, y: 0 })

  // Memoize streaming set for className callback stability
  const streamingSet = useMemo(
    () => new Set(streamingConversations),
    [streamingConversations]
  )

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

  // Phase 1C: nodeClassName — adds landmark / streaming CSS classes
  // React Flow's nodeClassName receives the full node object including .id
  const nodeClassNameFn = useCallback(
    (node: { id?: string; type?: string; data?: Record<string, unknown> }): string => {
      const classes: string[] = []
      if ((node.data as { isLandmark?: boolean })?.isLandmark) {
        classes.push('minimap-landmark')
      }
      if (node.type === 'conversation' && node.id && streamingSet.has(node.id)) {
        classes.push('minimap-streaming')
      }
      return classes.join(' ')
    },
    [streamingSet]
  )

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
            {/* Phase 1C: District boundary overlay SVG */}
            {districts.length > 0 && viewBox && (
              <svg
                width={180}
                height={120}
                viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
                className="absolute inset-0 pointer-events-none"
                style={{ zIndex: 0 }}
              >
                <DistrictOverlay districts={districts} />
              </svg>
            )}

            <MiniMap
              key={JSON.stringify(themeSettings.nodeColors)} // Force re-render on theme change
              nodeColor={(node) => {
                // PFD Phase 6A: Note nodes colored by NoteMode (badge color), others by type
                if (node.type === 'note') {
                  const noteMode = (node.data as { noteMode?: NoteMode })?.noteMode
                  if (noteMode && NOTE_MODE_MINIMAP_COLORS[noteMode]) {
                    return NOTE_MODE_MINIMAP_COLORS[noteMode]
                  }
                }
                const nodeType = node.type as keyof typeof themeSettings.nodeColors
                return themeSettings.nodeColors[nodeType] || '#6b7280'
              }}
              nodeStrokeWidth={(node) => {
                // PFD Phase 6B: Landmark nodes get thicker stroke in minimap
                return (node.data as { isLandmark?: boolean })?.isLandmark ? 4 : 2
              }}
              nodeClassName={nodeClassNameFn}
              nodeComponent={CustomMiniMapNode}
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
