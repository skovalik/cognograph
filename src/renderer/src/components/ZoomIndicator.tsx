import { useState, useEffect, useRef, memo } from 'react'
import { ZoomIn, ZoomOut } from 'lucide-react'

/**
 * Zoom level indicator component
 *
 * Shows current zoom level when user zooms the canvas.
 * Displays briefly and fades out after 1 second of no zoom changes.
 * Receives zoom as a prop from App.tsx (event-driven, no polling).
 */

interface ZoomIndicatorProps {
  zoom: number
}

function ZoomIndicatorComponent({ zoom }: ZoomIndicatorProps): JSX.Element | null {
  const [visible, setVisible] = useState(false)
  const [fading, setFading] = useState(false)
  const lastZoomRef = useRef(zoom)
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (Math.abs(zoom - lastZoomRef.current) > 0.01) {
      lastZoomRef.current = zoom
      setVisible(true)
      setFading(false)

      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }

      hideTimeoutRef.current = setTimeout(() => {
        setFading(true)
        setTimeout(() => {
          setVisible(false)
          setFading(false)
        }, 500)
      }, 1000)
    }

    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }
    }
  }, [zoom])

  if (!visible) return null

  const zoomPercent = Math.round(zoom * 100)
  const isZoomingIn = zoom > 1
  const ZoomIcon = isZoomingIn ? ZoomIn : ZoomOut

  // Map zoom to marker position (0.25 to 2.0 range)
  const markerPosition = Math.min(100, Math.max(0, ((zoom - 0.25) / 1.75) * 100))

  const className = [
    'zoom-indicator',
    visible && !fading && 'visible',
    fading && 'fading'
  ].filter(Boolean).join(' ')

  return (
    <div className={className}>
      <ZoomIcon className="zoom-indicator__icon" />
      <span className="zoom-indicator__value">{zoomPercent}%</span>
      <div className="zoom-indicator__bar">
        <div
          className="zoom-indicator__marker"
          style={{ left: `${markerPosition}%` }}
        />
      </div>
    </div>
  )
}

export const ZoomIndicator = memo(ZoomIndicatorComponent)
