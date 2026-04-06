// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * EditPermissionCard — specialized permission card for file edit operations.
 *
 * Renders the file path and a unified diff preview with:
 * - Green highlighting for added lines
 * - Red highlighting for deleted lines
 * - "Show more" toggle for long diffs
 */

import type { EditDisplay } from '@shared/transport/types'
import { ChevronDown, ChevronUp, FileText } from 'lucide-react'
import { memo, useMemo, useState } from 'react'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of diff lines to show before truncating. */
const MAX_VISIBLE_LINES = 8

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface DiffLine {
  text: string
  type: 'addition' | 'deletion' | 'context' | 'header'
}

/**
 * Parse a unified diff string into categorized lines.
 */
function parseDiff(diff: string): DiffLine[] {
  return diff.split('\n').map((line) => {
    if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) {
      return { text: line, type: 'header' as const }
    }
    if (line.startsWith('+')) {
      return { text: line, type: 'addition' as const }
    }
    if (line.startsWith('-')) {
      return { text: line, type: 'deletion' as const }
    }
    return { text: line, type: 'context' as const }
  })
}

/**
 * Get the short filename from a full path.
 */
function shortPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  const parts = normalized.split('/')
  // Show last 2-3 path segments for context
  return parts.slice(-3).join('/')
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface EditPermissionCardProps {
  display: EditDisplay
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const EditPermissionCard = memo(function EditPermissionCard({
  display,
}: EditPermissionCardProps) {
  const { filePath, diff } = display
  const [expanded, setExpanded] = useState(false)

  const lines = useMemo(() => parseDiff(diff), [diff])
  const needsTruncation = lines.length > MAX_VISIBLE_LINES
  const visibleLines = expanded ? lines : lines.slice(0, MAX_VISIBLE_LINES)

  return (
    <div className="mb-2">
      {/* File path */}
      <div className="flex items-center gap-1.5 mb-1">
        <FileText className="w-3 h-3 text-blue-400 flex-shrink-0" />
        <span className="text-[10px] font-mono text-blue-300 truncate" title={filePath}>
          {shortPath(filePath)}
        </span>
      </div>

      {/* Diff preview */}
      <div className="bg-black/30 rounded overflow-hidden text-[11px] font-mono leading-tight">
        <div className="max-h-48 overflow-y-auto">
          {visibleLines.map((line, i) => (
            <div
              key={i}
              className={`
                px-1.5 py-px
                ${
                  line.type === 'addition'
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : line.type === 'deletion'
                      ? 'bg-red-500/15 text-red-300'
                      : line.type === 'header'
                        ? 'text-white/30 bg-white/5'
                        : 'text-white/50'
                }
              `}
            >
              {line.text || '\u00A0'}
            </div>
          ))}
        </div>

        {/* Show more / Show less toggle */}
        {needsTruncation && (
          <button
            onClick={() => setExpanded((prev) => !prev)}
            className="
              flex items-center justify-center gap-1 w-full py-1
              text-[10px] text-white/40 hover:text-white/60
              bg-white/5 hover:bg-white/10
              transition-colors cursor-pointer border-t border-white/5
            "
          >
            {expanded ? (
              <>
                <ChevronUp className="w-2.5 h-2.5" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="w-2.5 h-2.5" />
                {lines.length - MAX_VISIBLE_LINES} more line
                {lines.length - MAX_VISIBLE_LINES !== 1 ? 's' : ''}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
})
