// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { useViewport, ViewportPortal } from '@xyflow/react'
import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { useSpatialRegionStore } from '../../stores/spatialRegionStore'

/**
 * Renders spatial regions as interactive dashed-border overlays on the canvas.
 * Regions can be clicked to select, dragged to move, and resized via edge handles.
 * Districts (isDistrict=true) are rendered by CanvasDistrictOverlay instead.
 *
 * Rendered inside React Flow's ViewportPortal so regions sit in the viewport
 * coordinate space alongside nodes. z-index: -1 keeps regions below nodes,
 * so nodes remain clickable on top of regions.
 */
function SpatialRegionOverlayComponent(): JSX.Element | null {
  const regions = useSpatialRegionStore((state) => state.regions)
  const selectedRegionId = useSpatialRegionStore((state) => state.selectedRegionId)
  const selectRegion = useSpatialRegionStore((state) => state.selectRegion)
  const updateRegion = useSpatialRegionStore((state) => state.updateRegion)
  const viewport = useViewport()

  // Filter out districts — those are rendered by CanvasDistrictOverlay
  const actionRegions = useMemo(() => regions.filter((r) => !r.isDistrict), [regions])

  // Don't render if no action regions
  if (actionRegions.length === 0) return null

  return (
    <ViewportPortal>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: -1,
        }}
      >
        {actionRegions.map((region) => (
          <RegionRect
            key={region.id}
            id={region.id}
            x={region.bounds.x}
            y={region.bounds.y}
            width={region.bounds.width}
            height={region.bounds.height}
            color={region.color}
            name={region.name}
            zoom={viewport.zoom}
            selected={region.id === selectedRegionId}
            onSelect={selectRegion}
            onUpdateBounds={(bounds) => updateRegion(region.id, { bounds })}
          />
        ))}
      </div>
    </ViewportPortal>
  )
}

interface RegionRectProps {
  id: string
  x: number
  y: number
  width: number
  height: number
  color: string
  name: string
  zoom: number
  selected: boolean
  onSelect: (id: string | null) => void
  onUpdateBounds: (bounds: { x: number; y: number; width: number; height: number }) => void
}

const MIN_REGION_SIZE = 50
const BORDER_HIT_WIDTH = 12 // px in canvas space — clickable border strip width

const RegionRect = memo(function RegionRect({
  id,
  x,
  y,
  width,
  height,
  color,
  name,
  zoom,
  selected,
  onSelect,
  onUpdateBounds,
}: RegionRectProps): JSX.Element {
  const dragRef = useRef<{
    startMouseX: number
    startMouseY: number
    startX: number
    startY: number
    startW: number
    startH: number
    mode:
      | 'move'
      | 'resize-se'
      | 'resize-sw'
      | 'resize-ne'
      | 'resize-nw'
      | 'resize-n'
      | 'resize-s'
      | 'resize-e'
      | 'resize-w'
  } | null>(null)
  const [dragging, setDragging] = useState(false)

  // Canvas coordinates — viewport transform is applied by ViewportPortal's parent
  const style = useMemo(
    () => ({
      position: 'absolute' as const,
      left: x,
      top: y,
      width: width,
      height: height,
      borderWidth: selected ? '3px' : '2px',
      borderStyle: 'dashed',
      borderColor: color,
      backgroundColor: selected ? `${color}15` : `${color}08`,
      borderRadius: '8px',
      pointerEvents: 'none' as const, // Background area passes through to nodes
      boxSizing: 'border-box' as const,
    }),
    [x, y, width, height, color, selected],
  )

  const labelStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      top: -20,
      left: 4,
      fontSize: '12px',
      color: color,
      opacity: 0.8,
      whiteSpace: 'nowrap' as const,
      fontWeight: 500,
      pointerEvents: 'none' as const,
    }),
    [color],
  )

  const startDrag = useCallback(
    (mode: NonNullable<typeof dragRef.current>['mode'], e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      onSelect(id)

      dragRef.current = {
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startX: x,
        startY: y,
        startW: width,
        startH: height,
        mode,
      }
      setDragging(true)

      const handleMouseMove = (ev: MouseEvent) => {
        if (!dragRef.current) return
        const dx = (ev.clientX - dragRef.current.startMouseX) / zoom
        const dy = (ev.clientY - dragRef.current.startMouseY) / zoom
        applyDrag(dragRef.current, dx, dy, onUpdateBounds)
      }
      const handleMouseUp = () => {
        dragRef.current = null
        setDragging(false)
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    },
    [id, x, y, width, height, zoom, onSelect, onUpdateBounds],
  )

  const handleBorderClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      onSelect(id)
    },
    [id, onSelect],
  )

  return (
    <div style={style}>
      <span style={labelStyle}>{name}</span>

      {/* Clickable border strips — thin hit areas along each edge */}
      <BorderStrip
        side="top"
        width={width}
        height={height}
        hitWidth={BORDER_HIT_WIDTH}
        cursor={selected ? 'move' : 'pointer'}
        onMouseDown={selected ? (e) => startDrag('move', e) : handleBorderClick}
      />
      <BorderStrip
        side="bottom"
        width={width}
        height={height}
        hitWidth={BORDER_HIT_WIDTH}
        cursor={selected ? 'move' : 'pointer'}
        onMouseDown={selected ? (e) => startDrag('move', e) : handleBorderClick}
      />
      <BorderStrip
        side="left"
        width={width}
        height={height}
        hitWidth={BORDER_HIT_WIDTH}
        cursor={selected ? 'move' : 'pointer'}
        onMouseDown={selected ? (e) => startDrag('move', e) : handleBorderClick}
      />
      <BorderStrip
        side="right"
        width={width}
        height={height}
        hitWidth={BORDER_HIT_WIDTH}
        cursor={selected ? 'move' : 'pointer'}
        onMouseDown={selected ? (e) => startDrag('move', e) : handleBorderClick}
      />

      {/* Resize handles — only when selected */}
      {selected && !dragging && (
        <>
          <ResizeHandle
            position="nw"
            color={color}
            onMouseDown={(e) => startDrag('resize-nw', e)}
          />
          <ResizeHandle
            position="ne"
            color={color}
            onMouseDown={(e) => startDrag('resize-ne', e)}
          />
          <ResizeHandle
            position="sw"
            color={color}
            onMouseDown={(e) => startDrag('resize-sw', e)}
          />
          <ResizeHandle
            position="se"
            color={color}
            onMouseDown={(e) => startDrag('resize-se', e)}
          />
          <ResizeHandle position="n" color={color} onMouseDown={(e) => startDrag('resize-n', e)} />
          <ResizeHandle position="s" color={color} onMouseDown={(e) => startDrag('resize-s', e)} />
          <ResizeHandle position="e" color={color} onMouseDown={(e) => startDrag('resize-e', e)} />
          <ResizeHandle position="w" color={color} onMouseDown={(e) => startDrag('resize-w', e)} />
        </>
      )}
    </div>
  )
})

/** Thin clickable strip along one edge of the region */
function BorderStrip({
  side,
  width,
  height,
  hitWidth,
  cursor,
  onMouseDown,
}: {
  side: 'top' | 'bottom' | 'left' | 'right'
  width: number
  height: number
  hitWidth: number
  cursor: string
  onMouseDown: (e: React.MouseEvent) => void
}) {
  const style: React.CSSProperties = {
    position: 'absolute',
    pointerEvents: 'auto',
    cursor,
  }
  switch (side) {
    case 'top':
      style.top = -hitWidth / 2
      style.left = 0
      style.width = width
      style.height = hitWidth
      break
    case 'bottom':
      style.bottom = -hitWidth / 2
      style.left = 0
      style.width = width
      style.height = hitWidth
      break
    case 'left':
      style.top = 0
      style.left = -hitWidth / 2
      style.width = hitWidth
      style.height = height
      break
    case 'right':
      style.top = 0
      style.right = -hitWidth / 2
      style.width = hitWidth
      style.height = height
      break
  }
  return <div style={style} onMouseDown={onMouseDown} />
}

/** Apply drag delta based on mode */
function applyDrag(
  ref: { startX: number; startY: number; startW: number; startH: number; mode: string },
  dx: number,
  dy: number,
  onUpdateBounds: (bounds: { x: number; y: number; width: number; height: number }) => void,
) {
  let { startX: nx, startY: ny, startW: nw, startH: nh } = ref
  switch (ref.mode) {
    case 'move':
      nx += dx
      ny += dy
      break
    case 'resize-se':
      nw = Math.max(MIN_REGION_SIZE, nw + dx)
      nh = Math.max(MIN_REGION_SIZE, nh + dy)
      break
    case 'resize-sw':
      nx += dx
      nw = Math.max(MIN_REGION_SIZE, nw - dx)
      nh = Math.max(MIN_REGION_SIZE, nh + dy)
      break
    case 'resize-ne':
      nw = Math.max(MIN_REGION_SIZE, nw + dx)
      ny += dy
      nh = Math.max(MIN_REGION_SIZE, nh - dy)
      break
    case 'resize-nw':
      nx += dx
      ny += dy
      nw = Math.max(MIN_REGION_SIZE, nw - dx)
      nh = Math.max(MIN_REGION_SIZE, nh - dy)
      break
    case 'resize-n':
      ny += dy
      nh = Math.max(MIN_REGION_SIZE, nh - dy)
      break
    case 'resize-s':
      nh = Math.max(MIN_REGION_SIZE, nh + dy)
      break
    case 'resize-e':
      nw = Math.max(MIN_REGION_SIZE, nw + dx)
      break
    case 'resize-w':
      nx += dx
      nw = Math.max(MIN_REGION_SIZE, nw - dx)
      break
  }
  onUpdateBounds({ x: nx, y: ny, width: nw, height: nh })
}

const HANDLE_SIZE = 10
const HANDLE_POSITIONS: Record<string, React.CSSProperties> = {
  nw: { top: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2, cursor: 'nwse-resize' },
  ne: { top: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2, cursor: 'nesw-resize' },
  sw: { bottom: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2, cursor: 'nesw-resize' },
  se: { bottom: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2, cursor: 'nwse-resize' },
  n: { top: -HANDLE_SIZE / 2, left: '50%', marginLeft: -HANDLE_SIZE / 2, cursor: 'ns-resize' },
  s: { bottom: -HANDLE_SIZE / 2, left: '50%', marginLeft: -HANDLE_SIZE / 2, cursor: 'ns-resize' },
  e: { top: '50%', right: -HANDLE_SIZE / 2, marginTop: -HANDLE_SIZE / 2, cursor: 'ew-resize' },
  w: { top: '50%', left: -HANDLE_SIZE / 2, marginTop: -HANDLE_SIZE / 2, cursor: 'ew-resize' },
}

function ResizeHandle({
  position,
  color,
  onMouseDown,
}: {
  position: string
  color: string
  onMouseDown: (e: React.MouseEvent) => void
}) {
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute',
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
        background: color,
        borderRadius: 2,
        opacity: 0.8,
        pointerEvents: 'auto',
        ...HANDLE_POSITIONS[position],
      }}
    />
  )
}

export const SpatialRegionOverlay = memo(SpatialRegionOverlayComponent)
