import { memo, useCallback, useRef, useState, useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import {
  useExtractionStore,
  useExtractionCountForNode,
  useIsExtractionPanelOpen
} from '../../stores'

interface ExtractionBadgeProps {
  nodeId: string
  nodeColor: string
}

function ExtractionBadgeComponent({ nodeId, nodeColor }: ExtractionBadgeProps): JSX.Element | null {
  const extractionCount = useExtractionCountForNode(nodeId)
  const isPanelOpen = useIsExtractionPanelOpen(nodeId)
  const openExtractionPanel = useExtractionStore((s) => s.openExtractionPanel)
  const closeExtractionPanel = useExtractionStore((s) => s.closeExtractionPanel)

  // Track previous count to detect new extractions
  const prevCountRef = useRef(extractionCount)
  const [isPulsing, setIsPulsing] = useState(false)

  // Hover timeout for 500ms delay
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Pulse animation when new extractions arrive
  useEffect(() => {
    if (extractionCount > prevCountRef.current) {
      setIsPulsing(true)
      const timeout = setTimeout(() => setIsPulsing(false), 1500)
      prevCountRef.current = extractionCount
      return () => clearTimeout(timeout)
    }
    prevCountRef.current = extractionCount
  }, [extractionCount])

  // Handle mouse enter with 500ms delay
  const handleMouseEnter = useCallback(() => {
    if (isPanelOpen) return
    hoverTimeoutRef.current = setTimeout(() => {
      openExtractionPanel(nodeId)
    }, 500)
  }, [nodeId, isPanelOpen, openExtractionPanel])

  // Handle mouse leave - clear timeout
  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
  }, [])

  // Handle click - immediate toggle
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
        hoverTimeoutRef.current = null
      }
      if (isPanelOpen) {
        closeExtractionPanel()
      } else {
        openExtractionPanel(nodeId)
      }
    },
    [nodeId, isPanelOpen, openExtractionPanel, closeExtractionPanel]
  )

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
    }
  }, [])

  // Don't render if no extractions
  if (extractionCount === 0) return null

  return (
    <button
      className={`extraction-badge ${isPulsing ? 'extraction-badge--pulsing' : ''} ${isPanelOpen ? 'extraction-badge--active' : ''}`}
      style={{
        '--badge-color': nodeColor
      } as React.CSSProperties}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      title={`${extractionCount} extraction${extractionCount > 1 ? 's' : ''} pending`}
    >
      <Sparkles className="w-3 h-3" />
      <span className="extraction-badge__count">{extractionCount}</span>
    </button>
  )
}

export const ExtractionBadge = memo(ExtractionBadgeComponent)
