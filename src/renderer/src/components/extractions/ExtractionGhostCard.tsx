import { memo, useCallback } from 'react'
import { FileText, CheckSquare, X } from 'lucide-react'
import type { PendingExtraction } from '@shared/types'
import { useWorkspaceStore } from '../../stores/workspaceStore'

interface ExtractionGhostCardProps {
  extraction: PendingExtraction
  onDragStart: (e: React.DragEvent, extraction: PendingExtraction) => void
}

function ExtractionGhostCardComponent({
  extraction,
  onDragStart
}: ExtractionGhostCardProps): JSX.Element {
  const dismissExtraction = useWorkspaceStore((state) => state.dismissExtraction)

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      onDragStart(e, extraction)
    },
    [extraction, onDragStart]
  )

  const handleDismiss = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      dismissExtraction(extraction.id)
    },
    [extraction.id, dismissExtraction]
  )

  const Icon = extraction.type === 'task' ? CheckSquare : FileText
  const iconClass =
    extraction.type === 'task'
      ? 'extraction-ghost-card__icon extraction-ghost-card__icon--task'
      : 'extraction-ghost-card__icon extraction-ghost-card__icon--note'

  // Truncate title to ~40 chars
  const displayTitle =
    extraction.suggestedData.title.length > 40
      ? extraction.suggestedData.title.slice(0, 40) + '...'
      : extraction.suggestedData.title

  const confidencePercent = Math.round(extraction.confidence * 100)

  return (
    <div
      className="extraction-ghost-card"
      draggable
      onDragStart={handleDragStart}
      title={extraction.suggestedData.title}
    >
      <div className={iconClass}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="extraction-ghost-card__content">
        <div className="extraction-ghost-card__title">{displayTitle}</div>
        <div className="extraction-ghost-card__confidence">{confidencePercent}% confidence</div>
      </div>
      <button
        className="extraction-ghost-card__dismiss"
        onClick={handleDismiss}
        title="Dismiss extraction"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export const ExtractionGhostCard = memo(ExtractionGhostCardComponent)
