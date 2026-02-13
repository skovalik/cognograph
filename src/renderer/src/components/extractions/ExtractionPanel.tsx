import { memo, useCallback, useState, useEffect, useRef } from 'react'
import { Sparkles, X } from 'lucide-react'
import { useReactFlow } from '@xyflow/react'
import type { PendingExtraction } from '@shared/types'
import {
  useExtractionStore,
  useNodesStore,
  useSortedExtractionsForNode,
  useOpenExtractionPanelNodeId
} from '../../stores'
import { ScrollArea } from '../ui'
import { ExtractionGhostCard } from './ExtractionGhostCard'
import { TetherLine } from './TetherLine'

const MAX_VISIBLE_CARDS = 3
const PANEL_WIDTH = 260
const PANEL_MARGIN = 20

function ExtractionPanelComponent(): JSX.Element | null {
  const openNodeId = useOpenExtractionPanelNodeId()
  const extractions = useSortedExtractionsForNode(openNodeId || '')
  const closeExtractionPanel = useExtractionStore((s) => s.closeExtractionPanel)
  const acceptAllExtractions = useExtractionStore((s) => s.acceptAllExtractions)
  const startExtractionDrag = useExtractionStore((s) => s.startExtractionDrag)
  const clearAllExtractions = useExtractionStore((s) => s.clearAllExtractions)
  const nodes = useNodesStore((s) => s.nodes)

  // Track previous extraction count to detect when they become empty
  const prevExtractionCount = useRef(extractions.length)

  const { getViewport, getNode } = useReactFlow()
  const panelRef = useRef<HTMLDivElement>(null)

  const [showAll, setShowAll] = useState(false)
  const [panelPosition, setPanelPosition] = useState({ x: 0, y: 0 })
  const [sourceAnchor, setSourceAnchor] = useState({ x: 0, y: 0 })

  // Calculate panel position based on source node
  useEffect(() => {
    if (!openNodeId) return

    const node = getNode(openNodeId)
    if (!node) return

    const viewport = getViewport()
    const nodeWidth = node.measured?.width || 320
    const nodeHeight = node.measured?.height || 200

    // Calculate screen position of node's right edge
    const screenX = (node.position.x + nodeWidth) * viewport.zoom + viewport.x + 20
    const screenY = node.position.y * viewport.zoom + viewport.y + nodeHeight / 2

    // Calculate source anchor point (right edge of node)
    const anchorX = (node.position.x + nodeWidth) * viewport.zoom + viewport.x
    const anchorY = screenY

    // Viewport-aware positioning
    let finalX = screenX
    let finalY = screenY - 100 // Center panel vertically

    // Clamp to viewport
    const panelHeight = Math.min(extractions.length * 60 + 100, 320)

    if (finalX + PANEL_WIDTH > window.innerWidth - PANEL_MARGIN) {
      // Position to left of node instead
      finalX = (node.position.x) * viewport.zoom + viewport.x - PANEL_WIDTH - 20
    }

    if (finalY < PANEL_MARGIN) {
      finalY = PANEL_MARGIN
    }

    if (finalY + panelHeight > window.innerHeight - PANEL_MARGIN) {
      finalY = window.innerHeight - panelHeight - PANEL_MARGIN
    }

    setPanelPosition({ x: finalX, y: finalY })
    setSourceAnchor({ x: anchorX, y: anchorY })
  }, [openNodeId, getNode, getViewport, extractions.length, nodes])

  // Close panel when clicking outside
  useEffect(() => {
    if (!openNodeId) return

    const handleClickOutside = (e: MouseEvent): void => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        // Check if click is on the badge (don't close if clicking badge)
        const target = e.target as HTMLElement
        if (target.closest('.extraction-badge')) return
        closeExtractionPanel()
      }
    }

    // Add slight delay to prevent immediate close
    const timeout = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 100)

    return () => {
      clearTimeout(timeout)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openNodeId, closeExtractionPanel])

  // Handle Escape key
  useEffect(() => {
    if (!openNodeId) return

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        closeExtractionPanel()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [openNodeId, closeExtractionPanel])

  // Auto-close panel when extractions become empty
  useEffect(() => {
    if (openNodeId && prevExtractionCount.current > 0 && extractions.length === 0) {
      // Small delay to show "empty" state briefly before closing
      const timeout = setTimeout(() => {
        closeExtractionPanel()
      }, 300)
      return () => clearTimeout(timeout)
    }
    prevExtractionCount.current = extractions.length
  }, [openNodeId, extractions.length, closeExtractionPanel])

  // Handle drag start
  const handleDragStart = useCallback(
    (e: React.DragEvent, extraction: PendingExtraction) => {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('application/extraction', extraction.id)

      // Create drag image
      const dragImage = document.createElement('div')
      dragImage.style.position = 'absolute'
      dragImage.style.top = '-1000px'
      dragImage.style.left = '-1000px'
      dragImage.style.padding = '8px 12px'
      dragImage.style.background = 'rgba(17, 24, 39, 0.95)'
      dragImage.style.border = '2px solid var(--gui-accent-primary, #8b5cf6)'
      dragImage.style.borderRadius = '8px'
      dragImage.style.color = 'white'
      dragImage.style.fontSize = '12px'
      dragImage.textContent = extraction.suggestedData.title.slice(0, 30)
      document.body.appendChild(dragImage)
      e.dataTransfer.setDragImage(dragImage, 0, 0)

      // Start drag in store
      startExtractionDrag(extraction.id, { x: e.clientX, y: e.clientY })

      // Cleanup drag image
      setTimeout(() => document.body.removeChild(dragImage), 0)
    },
    [startExtractionDrag]
  )

  const handleAcceptAll = useCallback(() => {
    if (openNodeId) {
      acceptAllExtractions(openNodeId)
    }
  }, [openNodeId, acceptAllExtractions])

  const handleClearAll = useCallback(() => {
    if (openNodeId) {
      clearAllExtractions(openNodeId)
      // Panel will auto-close via the effect when extractions become empty
    }
  }, [openNodeId, clearAllExtractions])

  // Don't render if no panel is open or no extractions
  if (!openNodeId || extractions.length === 0) return null

  const visibleExtractions = showAll ? extractions : extractions.slice(0, MAX_VISIBLE_CARDS)
  const hiddenCount = extractions.length - MAX_VISIBLE_CARDS

  // Calculate tether target point (left edge of panel)
  const tetherTargetX = panelPosition.x
  const tetherTargetY = panelPosition.y + 60

  return (
    <>
      {/* Tether line connecting to source node */}
      <TetherLine
        sourceX={sourceAnchor.x}
        sourceY={sourceAnchor.y}
        targetX={tetherTargetX}
        targetY={tetherTargetY}
      />

      {/* Floating panel */}
      <div
        ref={panelRef}
        className="extraction-panel"
        style={{
          left: panelPosition.x,
          top: panelPosition.y
        }}
      >
        <div className="extraction-panel__header">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" style={{ color: 'var(--gui-accent-primary)' }} />
            <span>{extractions.length} Extraction{extractions.length !== 1 ? 's' : ''}</span>
          </div>
          <button
            onClick={closeExtractionPanel}
            className="p-1 rounded hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <ScrollArea className="extraction-panel__content" style={{ maxHeight: 240 }}>
          {visibleExtractions.map((extraction) => (
            <ExtractionGhostCard
              key={extraction.id}
              extraction={extraction}
              onDragStart={handleDragStart}
            />
          ))}

          {!showAll && hiddenCount > 0 && (
            <div className="extraction-panel__more" onClick={() => setShowAll(true)}>
              +{hiddenCount} more
            </div>
          )}
        </ScrollArea>

        <div className="extraction-panel__footer">
          <button className="extraction-panel__btn extraction-panel__btn--accept" onClick={handleAcceptAll}>
            Accept All
          </button>
          <button className="extraction-panel__btn extraction-panel__btn--clear" onClick={handleClearAll}>
            Clear
          </button>
        </div>
      </div>
    </>
  )
}

export const ExtractionPanel = memo(ExtractionPanelComponent)
