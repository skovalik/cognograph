// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * FilePreviewSection — compact file listing for node body.
 * Shows top N entries from the folder listing cache. Collapsible.
 * Used by ProjectNode and ArtifactNode.
 */

import { memo, useCallback, useEffect, useMemo } from 'react'
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import { useFileListingStore, EXPAND_THRESHOLD_MS } from '../stores/fileListingStore'
import { normalizeFileFilter, matchesFileFilter } from '../utils/fileIconMap'
import { FileEntryRow } from './FileEntryRow'
import { cn } from '../lib/utils'
import * as path from 'path'

interface FilePreviewSectionProps {
  folderPath: string
  fileFilter?: string
  fileListVisible: boolean
  highlightedFile?: string
  maxEntries?: number
  compact?: boolean
  onToggleVisible: () => void
  onExpandInLayers?: () => void
}

function FilePreviewSectionComponent({
  folderPath,
  fileFilter,
  fileListVisible,
  highlightedFile,
  maxEntries = 8,
  compact = false,
  onToggleVisible,
  onExpandInLayers,
}: FilePreviewSectionProps): JSX.Element | null {
  const listing = useFileListingStore((s) => s.listings[folderPath])
  const fetchListing = useFileListingStore((s) => s.fetchListing)
  const isStale = useFileListingStore((s) => s.isStale)

  // Fetch on expand if stale
  useEffect(() => {
    if (fileListVisible && folderPath && isStale(folderPath, EXPAND_THRESHOLD_MS)) {
      fetchListing(folderPath)
    }
  }, [fileListVisible, folderPath, fetchListing, isStale])

  const handleRefresh = useCallback(() => {
    if (folderPath) fetchListing(folderPath)
  }, [folderPath, fetchListing])

  const normalizedFilter = useMemo(
    () => normalizeFileFilter(fileFilter),
    [fileFilter]
  )

  const filteredEntries = useMemo(() => {
    if (!listing?.entries) return []
    return listing.entries.filter((e) =>
      e.type === 'directory' || matchesFileFilter(e.name, normalizedFilter)
    )
  }, [listing?.entries, normalizedFilter])

  const displayEntries = filteredEntries.slice(0, maxEntries)
  const remaining = filteredEntries.length - displayEntries.length
  const totalLabel = normalizedFilter.length > 0
    ? `${filteredEntries.length} of ${listing?.total ?? 0}`
    : `${listing?.total ?? 0}`

  if (!folderPath) return null

  return (
    <div className={cn('border-t border-[var(--border-subtle,rgba(255,255,255,0.06))]', compact ? 'mt-1' : 'mt-2')}>
      {/* Header */}
      <button
        className="flex items-center gap-1 w-full px-2 py-1 text-[10px] gui-text-secondary hover:gui-text transition-colors"
        onClick={onToggleVisible}
        aria-label={fileListVisible ? 'Collapse file listing' : 'Expand file listing'}
      >
        {fileListVisible ? (
          <ChevronDown className="w-3 h-3 shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 shrink-0" />
        )}
        <span className="truncate">Files ({totalLabel})</span>
        {fileListVisible && (
          <button
            className="ml-auto p-0.5 gui-button rounded hover:gui-text"
            onClick={(e) => { e.stopPropagation(); handleRefresh() }}
            aria-label="Refresh file listing"
          >
            <RefreshCw className={cn('w-2.5 h-2.5', listing?.loading && 'animate-spin')} />
          </button>
        )}
      </button>

      {/* Listing */}
      {fileListVisible && (
        <div
          className="overflow-y-auto"
          style={{ maxHeight: compact ? '160px' : '200px' }}
          onWheel={(e) => e.stopPropagation()}
          role="list"
          aria-label="Project files"
        >
          {listing?.loading && !listing.entries.length ? (
            <div className="px-2 py-3 text-[10px] gui-text-secondary text-center">
              Loading files...
            </div>
          ) : listing?.error ? (
            <div className="px-2 py-3 text-[10px] text-red-400 text-center">
              {listing.error}
            </div>
          ) : displayEntries.length === 0 ? (
            <div className="px-2 py-3 text-[10px] gui-text-secondary text-center">
              {listing?.entries.length === 0 ? 'Empty folder' : 'No matching files'}
            </div>
          ) : (
            <>
              {displayEntries.map((entry) => (
                <FileEntryRow
                  key={entry.name}
                  name={entry.name}
                  type={entry.type}
                  fullPath={path.join(folderPath, entry.name)}
                  highlighted={highlightedFile ? path.join(folderPath, entry.name) === highlightedFile : false}
                  compact={compact}
                />
              ))}
              {remaining > 0 && (
                <button
                  className="w-full px-2 py-1 text-[10px] gui-text-secondary hover:gui-text text-center transition-colors"
                  onClick={onExpandInLayers}
                >
                  ⋯ {remaining} more{normalizedFilter.length > 0 ? ` (${normalizedFilter.join(', ')})` : ''}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export const FilePreviewSection = memo(FilePreviewSectionComponent)
