import { memo, useMemo } from 'react'
import { useViewport } from '@xyflow/react'
import { useSpatialRegionStore } from '../../stores/spatialRegionStore'

/**
 * Renders spatial regions as dashed-border overlays on the canvas.
 * These regions are used by Action Node spatial triggers (region-enter, region-exit, cluster-size).
 */
function SpatialRegionOverlayComponent(): JSX.Element | null {
  const regions = useSpatialRegionStore((state) => state.regions)
  const viewport = useViewport()

  // Don't render if no regions
  if (regions.length === 0) return null

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    >
      {regions.map((region) => (
        <RegionRect
          key={region.id}
          x={region.bounds.x}
          y={region.bounds.y}
          width={region.bounds.width}
          height={region.bounds.height}
          color={region.color}
          name={region.name}
          viewport={viewport}
        />
      ))}
    </div>
  )
}

interface RegionRectProps {
  x: number
  y: number
  width: number
  height: number
  color: string
  name: string
  viewport: { x: number; y: number; zoom: number }
}

const RegionRect = memo(function RegionRect({ x, y, width, height, color, name, viewport }: RegionRectProps): JSX.Element {
  const style = useMemo(() => ({
    position: 'absolute' as const,
    left: x * viewport.zoom + viewport.x,
    top: y * viewport.zoom + viewport.y,
    width: width * viewport.zoom,
    height: height * viewport.zoom,
    borderWidth: '2px',
    borderStyle: 'dashed',
    borderColor: color,
    backgroundColor: `${color}08`,
    borderRadius: '8px',
    pointerEvents: 'none' as const
  }), [x, y, width, height, color, viewport])

  const labelStyle = useMemo(() => ({
    position: 'absolute' as const,
    top: -20 * viewport.zoom,
    left: 4,
    fontSize: `${Math.max(10, 12 * viewport.zoom)}px`,
    color: color,
    opacity: 0.8,
    whiteSpace: 'nowrap' as const,
    fontWeight: 500
  }), [color, viewport.zoom])

  return (
    <div style={style}>
      <span style={labelStyle}>{name}</span>
    </div>
  )
})

export const SpatialRegionOverlay = memo(SpatialRegionOverlayComponent)
