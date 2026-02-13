import { memo, useMemo, useCallback } from 'react'
import { FileText, CheckSquare, Sparkles, Trash2, Filter, X } from 'lucide-react'
import { useExtractionStore, useNodesStore } from '../stores'
import { PendingExtractionCard } from './PendingExtractionCard'
import type { PendingExtraction } from '@shared/types'

interface ExtractionsPanelProps {
  sidebarWidth?: number
}

function ExtractionsPanelComponent({ sidebarWidth = 260 }: ExtractionsPanelProps): JSX.Element {
  // Responsive thresholds based on sidebar width
  const isCompact = sidebarWidth < 220

  const pendingExtractions = useExtractionStore((s) => s.pendingExtractions)
  const extractionSourceFilter = useExtractionStore((s) => s.extractionSourceFilter)
  const isExtracting = useExtractionStore((s) => s.isExtracting)
  const nodes = useNodesStore((s) => s.nodes)
  const setExtractionSourceFilter = useExtractionStore((s) => s.setExtractionSourceFilter)
  const clearAllExtractions = useExtractionStore((s) => s.clearAllExtractions)
  const acceptExtraction = useExtractionStore((s) => s.acceptExtraction)
  const editExtraction = useExtractionStore((s) => s.editExtraction)
  const dismissExtraction = useExtractionStore((s) => s.dismissExtraction)

  // Filter extractions by source if filter is active
  const filteredExtractions = useMemo(() => {
    if (!extractionSourceFilter) return pendingExtractions
    return pendingExtractions.filter((e) => e.sourceNodeId === extractionSourceFilter)
  }, [pendingExtractions, extractionSourceFilter])

  // Group by source node for display
  const groupedExtractions = useMemo(() => {
    const groups = new Map<string, PendingExtraction[]>()

    filteredExtractions.forEach((extraction) => {
      const existing = groups.get(extraction.sourceNodeId) || []
      groups.set(extraction.sourceNodeId, [...existing, extraction])
    })

    return groups
  }, [filteredExtractions])

  // Get source node title
  const getSourceTitle = useCallback(
    (sourceNodeId: string): string => {
      const node = nodes.find((n) => n.id === sourceNodeId)
      return (node?.data.title as string) || 'Unknown'
    },
    [nodes]
  )

  const handleClearFilter = useCallback(() => {
    setExtractionSourceFilter(null)
  }, [setExtractionSourceFilter])

  const handleClearAll = useCallback(() => {
    clearAllExtractions(extractionSourceFilter || undefined)
  }, [clearAllExtractions, extractionSourceFilter])

  // Stats
  const noteCount = filteredExtractions.filter((e) => e.type === 'note').length
  const taskCount = filteredExtractions.filter((e) => e.type === 'task').length

  return (
    <div className="h-full flex flex-col glass-soft gui-panel">
      {/* Header with stats */}
      <div className="px-3 py-2 border-b gui-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs gui-text-secondary">
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" />
              {noteCount}
            </span>
            <span className="flex items-center gap-1">
              <CheckSquare className="w-3 h-3" />
              {taskCount}
            </span>
          </div>
          {filteredExtractions.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-xs gui-text-secondary hover:text-red-400 flex items-center gap-1"
              title="Dismiss all"
            >
              <Trash2 className="w-3 h-3" />
              {!isCompact && 'Clear'}
            </button>
          )}
        </div>

        {/* Active filter indicator */}
        {extractionSourceFilter && (
          <div className="mt-2 flex items-center gap-2 text-xs">
            <Filter className="w-3 h-3" style={{ color: 'var(--gui-accent-secondary)' }} />
            <span className="gui-text-secondary">From:</span>
            <span className="gui-text truncate flex-1">
              {getSourceTitle(extractionSourceFilter)}
            </span>
            <button onClick={handleClearFilter} className="p-0.5 gui-button rounded">
              <X className="w-3 h-3 gui-text-secondary" />
            </button>
          </div>
        )}
      </div>

      {/* Extraction loading indicator */}
      {isExtracting && (
        <div className="px-3 py-2 bg-blue-900/20 border-b border-blue-800/50">
          <div className="flex items-center gap-2 text-xs text-blue-400">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            <span>Extracting from {getSourceTitle(isExtracting)}...</span>
          </div>
        </div>
      )}

      {/* Extraction list */}
      <div className="flex-1 overflow-y-auto">
        {filteredExtractions.length === 0 ? (
          <div className="p-4 text-center text-[var(--text-muted)]">
            <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No pending extractions</p>
            <p className="text-xs mt-1">
              {extractionSourceFilter
                ? 'Try clearing the filter or run extraction'
                : 'Use the extract button on a conversation'}
            </p>
          </div>
        ) : (
          <div className="py-2 space-y-3">
            {Array.from(groupedExtractions.entries()).map(([sourceId, extractions]) => (
              <div key={sourceId} className="px-2">
                {/* Source header (only if not filtered) */}
                {!extractionSourceFilter && (
                  <div className="px-2 py-1 text-xs text-[var(--text-muted)] mb-1">
                    From: {getSourceTitle(sourceId)}
                  </div>
                )}

                {/* Extraction cards */}
                <div className="space-y-2">
                  {extractions.map((extraction) => (
                    <PendingExtractionCard
                      key={extraction.id}
                      extraction={extraction}
                      onAccept={acceptExtraction}
                      onEdit={editExtraction}
                      onDismiss={dismissExtraction}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export const ExtractionsPanel = memo(ExtractionsPanelComponent)
