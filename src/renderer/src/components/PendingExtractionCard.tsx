import { memo, useState, useCallback } from 'react'
import { FileText, CheckSquare, Check, Edit2, X, ChevronDown, ChevronUp } from 'lucide-react'
import type { PendingExtraction, NoteNodeData, TaskNodeData } from '@shared/types'

interface PendingExtractionCardProps {
  extraction: PendingExtraction
  onAccept: (id: string, position?: { x: number; y: number }) => void
  onEdit: (id: string, data: Partial<PendingExtraction['suggestedData']>) => void
  onDismiss: (id: string) => void
}

function PendingExtractionCardComponent({
  extraction,
  onAccept,
  onEdit,
  onDismiss
}: PendingExtractionCardProps): JSX.Element {
  const [isEditing, setIsEditing] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [editedTitle, setEditedTitle] = useState(extraction.suggestedData.title || '')
  const [editedContent, setEditedContent] = useState(
    extraction.type === 'note'
      ? (extraction.suggestedData as Partial<NoteNodeData>).content || ''
      : (extraction.suggestedData as Partial<TaskNodeData>).description || ''
  )

  const isTask = extraction.type === 'task'
  const Icon = isTask ? CheckSquare : FileText
  const iconColor = isTask ? 'text-emerald-400' : 'text-amber-400'

  // Confidence badge color
  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'bg-green-500/20 text-green-400'
    if (confidence >= 0.6) return 'bg-yellow-500/20 text-yellow-400'
    return 'bg-orange-500/20 text-orange-400'
  }

  const handleAccept = useCallback(() => {
    onAccept(extraction.id)
  }, [extraction.id, onAccept])

  const handleDismiss = useCallback(() => {
    onDismiss(extraction.id)
  }, [extraction.id, onDismiss])

  const handleSaveEdit = useCallback(() => {
    const updatedData: Partial<NoteNodeData | TaskNodeData> = {
      title: editedTitle
    }

    if (isTask) {
      ;(updatedData as Partial<TaskNodeData>).description = editedContent
    } else {
      ;(updatedData as Partial<NoteNodeData>).content = editedContent
    }

    onEdit(extraction.id, updatedData)
    setIsEditing(false)
    // Auto-accept after editing
    onAccept(extraction.id)
  }, [extraction.id, editedTitle, editedContent, isTask, onEdit, onAccept])

  const handleCancelEdit = useCallback(() => {
    setEditedTitle(extraction.suggestedData.title || '')
    setEditedContent(
      extraction.type === 'note'
        ? (extraction.suggestedData as Partial<NoteNodeData>).content || ''
        : (extraction.suggestedData as Partial<TaskNodeData>).description || ''
    )
    setIsEditing(false)
  }, [extraction])

  const handleStartEdit = useCallback(() => {
    setIsEditing(true)
    setIsExpanded(true)
  }, [])

  // Get display content
  const displayContent = isTask
    ? (extraction.suggestedData as Partial<TaskNodeData>).description
    : (extraction.suggestedData as Partial<NoteNodeData>).content

  return (
    <div className="bg-[var(--surface-panel-secondary)] border border-[var(--border-subtle)] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 flex items-start gap-2">
        <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${iconColor}`} />

        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              className="w-full bg-[var(--surface-panel)] border border-[var(--border-subtle)] rounded px-2 py-1 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
              autoFocus
            />
          ) : (
            <div
              className="text-sm text-[var(--text-primary)] cursor-pointer hover:text-white truncate"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {extraction.suggestedData.title || 'Untitled'}
            </div>
          )}

          {/* Tags and metadata */}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span
              className={`text-xs px-1.5 py-0.5 rounded ${getConfidenceColor(extraction.confidence)}`}
            >
              {Math.round(extraction.confidence * 100)}%
            </span>

            {isTask && (extraction.suggestedData as Partial<TaskNodeData>).priority && (
              <span className="text-xs px-1.5 py-0.5 bg-[var(--surface-panel)] rounded text-[var(--text-secondary)]">
                {(extraction.suggestedData as Partial<TaskNodeData>).priority}
              </span>
            )}

            {extraction.suggestedData.tags?.slice(0, 2).map((tag) => (
              <span key={tag} className="text-xs px-1.5 py-0.5 bg-[var(--surface-panel)] rounded text-[var(--text-secondary)]">
                {tag}
              </span>
            ))}
            {extraction.suggestedData.tags && extraction.suggestedData.tags.length > 2 && (
              <span className="text-xs text-[var(--text-muted)]">
                +{extraction.suggestedData.tags.length - 2}
              </span>
            )}
          </div>
        </div>

        {/* Expand/collapse */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 text-[var(--text-muted)] hover:text-[var(--text-secondary)] flex-shrink-0"
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-3 py-2 border-t border-[var(--border-subtle)]">
          {isEditing ? (
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              rows={4}
              className="w-full bg-[var(--surface-panel)] border border-[var(--border-subtle)] rounded px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none focus:border-blue-500 resize-none"
            />
          ) : (
            <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap line-clamp-4">
              {displayContent || 'No content'}
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="px-3 py-2 border-t border-[var(--border-subtle)] flex items-center justify-end gap-2">
        {isEditing ? (
          <>
            <button
              onClick={handleCancelEdit}
              className="px-2 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded"
            >
              Save & Accept
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleDismiss}
              className="p-1.5 text-[var(--text-muted)] hover:text-red-400 hover:bg-red-900/20 rounded"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              onClick={handleStartEdit}
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-panel)] rounded"
              title="Edit"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleAccept}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded"
            >
              <Check className="w-3.5 h-3.5" />
              Accept
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export const PendingExtractionCard = memo(PendingExtractionCardComponent)
