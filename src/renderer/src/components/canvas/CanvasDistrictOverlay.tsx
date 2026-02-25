// CanvasDistrictOverlay — PFD Phase 3B: Canvas Districts
// Renders user-designated regions as grayscale background tints
// Spec: COGNOGRAPH-PFD-IMPLEMENTATION-PLAN.md Phase 3B
//
// Design decisions:
// - Grayscale tints ONLY — hue is reserved for NoteMode type (bracket color)
// - Labels visible at far + mid zoom, hidden only below 0.08 (effective invisibility)
// - Districts render BEHIND SpatialRegionOverlay (action trigger dashed borders)
// - pointer-events: none — districts don't constrain node placement

import { memo, useMemo } from 'react'
import { useViewport } from '@xyflow/react'
import { useSpatialRegionStore } from '../../stores/spatialRegionStore'
import type { SpatialRegion } from '@shared/actionTypes'

function CanvasDistrictOverlayComponent(): JSX.Element | null {
  const regions = useSpatialRegionStore((state) => state.regions)
  const viewport = useViewport()

  // Filter to district-type regions only
  const districts = useMemo(
    () => regions.filter(r => r.isDistrict),
    [regions]
  )

  if (districts.length === 0) return null

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: -1 }}
    >
      {districts.map((district) => (
        <DistrictRect
          key={district.id}
          region={district}
          viewport={viewport}
        />
      ))}
    </div>
  )
}

interface DistrictRectProps {
  region: SpatialRegion
  viewport: { x: number; y: number; zoom: number }
}

const DistrictRect = memo(function DistrictRect({ region, viewport }: DistrictRectProps): JSX.Element {
  const { bounds, name, districtStyle, districtOpacity } = region
  const opacity = districtOpacity ?? 0.04

  const containerStyle = useMemo(() => ({
    position: 'absolute' as const,
    left: bounds.x * viewport.zoom + viewport.x,
    top: bounds.y * viewport.zoom + viewport.y,
    width: bounds.width * viewport.zoom,
    height: bounds.height * viewport.zoom,
    borderRadius: '12px',
    pointerEvents: 'none' as const,
    transition: 'opacity 200ms ease'
  }), [bounds, viewport])

  const fillStyle = useMemo(() => {
    if (districtStyle === 'hatching') {
      return {
        ...containerStyle,
        backgroundImage: `repeating-linear-gradient(
          -45deg,
          transparent,
          transparent 8px,
          rgba(128, 128, 128, ${opacity}) 8px,
          rgba(128, 128, 128, ${opacity}) 9px
        )`,
        border: `1px solid rgba(128, 128, 128, ${opacity * 3})`
      }
    }

    // Default: tint
    return {
      ...containerStyle,
      backgroundColor: `rgba(128, 128, 128, ${opacity})`,
      border: `1px solid rgba(128, 128, 128, ${opacity * 3})`
    }
  }, [containerStyle, districtStyle, opacity])

  // Label sizing: scales with zoom but clamps to readable range
  const labelFontSize = Math.max(10, Math.min(14, 13 * viewport.zoom))
  const labelVisible = viewport.zoom >= 0.08

  const labelStyle = useMemo(() => ({
    position: 'absolute' as const,
    top: -labelFontSize - 6,
    left: 8,
    fontSize: `${labelFontSize}px`,
    color: 'rgba(128, 128, 128, 0.6)',
    whiteSpace: 'nowrap' as const,
    fontWeight: 500,
    letterSpacing: '0.03em',
    textTransform: 'uppercase' as const,
    opacity: labelVisible ? 1 : 0,
    transition: 'opacity 200ms ease'
  }), [labelFontSize, labelVisible])

  return (
    <div style={fillStyle}>
      <span style={labelStyle}>{name}</span>
    </div>
  )
})

export const CanvasDistrictOverlay = memo(CanvasDistrictOverlayComponent)
