// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * AttachmentsSection — File attachment management for nodes.
 *
 * Extracted from PropertiesPanel.tsx for reuse in AdvancedSettingsModal.
 * Renders a collapsible list of attached files with add/delete/open controls.
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight, FileText, Paperclip, Plus, Trash2 } from 'lucide-react'
import { useWorkspaceStore } from '../../../stores/workspaceStore'
import { useAttachments } from '../../../hooks/useAttachments'
import type { Attachment, ContextMetadata } from '@shared/types'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AttachmentsSectionProps {
  nodeId: string
  /** When true, the section starts expanded (useful in modal context) */
  defaultExpanded?: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AttachmentsSection({
  nodeId,
  defaultExpanded = false,
}: AttachmentsSectionProps): JSX.Element | null {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const { addAttachment, deleteAttachment, openAttachment, isLoading } = useAttachments()

  const nodeData = useWorkspaceStore(
    (state) => state.nodes.find((n) => n.id === nodeId)?.data,
  )

  if (!nodeData) return null

  const attachments: Attachment[] = (nodeData as ContextMetadata).attachments || []

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="pt-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1 text-xs font-medium gui-text mb-2 w-full"
      >
        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <Paperclip className="w-3 h-3" />
        Attachments
        {attachments.length > 0 && (
          <span className="ml-auto px-1.5 py-0.5 bg-blue-600/30 text-blue-300 rounded text-[10px]">
            {attachments.length}
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="space-y-2">
          {/* Attachment list */}
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center gap-2 p-1.5 rounded text-xs group gui-button"
            >
              {/* Thumbnail for images */}
              {attachment.thumbnail ? (
                <img
                  src={attachment.thumbnail}
                  alt={attachment.filename}
                  className="w-8 h-8 rounded object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 gui-panel-secondary">
                  <FileText className="w-4 h-4 gui-text-secondary" />
                </div>
              )}

              {/* File info */}
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => openAttachment(attachment.storedPath)}
                  className="block text-left truncate w-full gui-text hover:text-blue-400"
                  title={`Open ${attachment.filename}`}
                >
                  {attachment.filename}
                </button>
                <span className="text-[10px] gui-text-secondary">
                  {formatSize(attachment.size)}
                </span>
              </div>

              {/* Delete button */}
              <button
                onClick={() => deleteAttachment(nodeId, attachment.id)}
                className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-900/50 text-red-400"
                title="Remove attachment"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}

          {/* Add button */}
          <button
            onClick={() => addAttachment(nodeId)}
            disabled={isLoading}
            className={`flex items-center gap-1.5 w-full px-2 py-1.5 rounded text-xs transition-colors gui-text-secondary gui-button ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Plus className="w-3 h-3" />
            {isLoading ? 'Adding...' : 'Add File'}
          </button>
        </div>
      )}
    </div>
  )
}
