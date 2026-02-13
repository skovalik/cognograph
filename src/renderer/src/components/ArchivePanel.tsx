/**
 * ArchivePanel - Shows archived nodes with restore/trash options
 *
 * Archived nodes stay in the workspace data but are hidden from the canvas.
 * This panel lets users browse, search, restore, or permanently trash archived nodes.
 */

import { memo, useCallback, useMemo, useState } from 'react'
import { Archive, RotateCcw, Trash2, X, Clock, Search } from 'lucide-react'
import { useWorkspaceStore, useNodesStore } from '../stores'
import type { Node } from '@xyflow/react'
import type { NodeData } from '@shared/types'

// Map node types to display names
const NODE_TYPE_NAMES: Record<string, string> = {
  conversation: 'Conversation',
  note: 'Note',
  task: 'Task',
  project: 'Project',
  artifact: 'Artifact',
  workspace: 'Workspace',
  text: 'Text',
  action: 'Action'
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diffMs = now - timestamp
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

interface ArchivePanelProps {
  isOpen: boolean
  onClose: () => void
}

function ArchivePanelComponent({ isOpen, onClose }: ArchivePanelProps): JSX.Element | null {
  const getArchivedNodes = useWorkspaceStore((s) => s.getArchivedNodes)
  const restoreFromArchive = useWorkspaceStore((s) => s.restoreFromArchive)
  const deleteNodes = useNodesStore((s) => s.deleteNodes)
  const [searchQuery, setSearchQuery] = useState('')

  const archivedNodes = getArchivedNodes()

  // Filter and sort: search by title, newest first
  const filteredNodes = useMemo(() => {
    let result = archivedNodes
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(n => {
        const title = ('title' in n.data ? n.data.title as string : '') || ''
        return title.toLowerCase().includes(q)
      })
    }
    return result.sort((a, b) => (b.data.archivedAt || 0) - (a.data.archivedAt || 0))
  }, [archivedNodes, searchQuery])

  const handleRestore = useCallback((nodeId: string) => {
    restoreFromArchive([nodeId])
  }, [restoreFromArchive])

  const handleMoveToTrash = useCallback((nodeId: string) => {
    deleteNodes([nodeId])
  }, [deleteNodes])

  const handleRestoreAll = useCallback(() => {
    if (archivedNodes.length === 0) return
    restoreFromArchive(archivedNodes.map(n => n.id))
  }, [archivedNodes, restoreFromArchive])

  if (!isOpen) return null

  return (
    <div
      className="absolute top-20 right-4 gui-z-panels w-72 rounded-lg overflow-hidden shadow-xl animate-fade-in"
      style={{
        backgroundColor: 'var(--gui-bg-secondary)',
        border: '1px solid var(--gui-border-subtle)'
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: 'var(--gui-border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <Archive className="w-4 h-4" style={{ color: 'var(--gui-accent-secondary)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--gui-text-primary)' }}>
            Archive
          </span>
          {archivedNodes.length > 0 && (
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: 'var(--gui-bg-tertiary)',
                color: 'var(--gui-text-muted)'
              }}
            >
              {archivedNodes.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {archivedNodes.length > 0 && (
            <button
              onClick={handleRestoreAll}
              className="px-2 py-1 rounded text-xs hover:bg-white/10 transition-colors"
              style={{ color: 'var(--gui-text-muted)' }}
              title="Restore all"
            >
              Restore All
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 ml-1"
            title="Close"
          >
            <X className="w-4 h-4" style={{ color: 'var(--gui-text-muted)' }} />
          </button>
        </div>
      </div>

      {/* Search */}
      {archivedNodes.length > 3 && (
        <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--gui-border-subtle)' }}>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--gui-text-muted)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search archive..."
              className="w-full pl-7 pr-2 py-1.5 text-xs rounded gui-input"
              style={{ backgroundColor: 'var(--gui-bg-tertiary)' }}
            />
          </div>
        </div>
      )}

      {/* Archived nodes list */}
      <div className="max-h-80 overflow-y-auto">
        {filteredNodes.length > 0 ? (
          filteredNodes.map((node) => (
            <ArchiveItem
              key={node.id}
              node={node}
              onRestore={() => handleRestore(node.id)}
              onTrash={() => handleMoveToTrash(node.id)}
            />
          ))
        ) : (
          <div
            className="flex flex-col items-center justify-center py-8 px-4"
            style={{ color: 'var(--gui-text-muted)' }}
          >
            <Archive className="w-8 h-8 mb-2 opacity-30" />
            <span className="text-sm">
              {searchQuery ? 'No matches found' : 'No archived nodes'}
            </span>
            <span className="text-xs mt-1 text-center opacity-70">
              {searchQuery ? 'Try a different search term' : 'Right-click a node and select "Archive" to move it here'}
            </span>
          </div>
        )}
      </div>

      {/* Footer hint */}
      {filteredNodes.length > 0 && (
        <div
          className="px-3 py-2 text-[10px] border-t"
          style={{ borderColor: 'var(--gui-border-subtle)', color: 'var(--gui-text-muted)' }}
        >
          Archived nodes are hidden from the canvas but preserved in workspace data
        </div>
      )}
    </div>
  )
}

interface ArchiveItemProps {
  node: Node<NodeData>
  onRestore: () => void
  onTrash: () => void
}

function ArchiveItem({ node, onRestore, onTrash }: ArchiveItemProps): JSX.Element {
  const nodeData = node.data
  const typeName = NODE_TYPE_NAMES[nodeData.type] || nodeData.type
  const nodeTitle = 'title' in nodeData ? (nodeData.title as string) : undefined
  const title = nodeTitle || `Untitled ${typeName}`

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 hover:bg-white/5 group transition-colors"
      style={{ borderBottom: '1px solid var(--gui-border-subtle)' }}
    >
      {/* Node type indicator */}
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: `var(--node-${nodeData.type})` }}
      />

      {/* Node info */}
      <div className="flex-1 min-w-0">
        <div
          className="text-sm truncate"
          style={{ color: 'var(--gui-text-primary)' }}
          title={title}
        >
          {title}
        </div>
        <div className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--gui-text-muted)' }}>
          <span>{typeName}</span>
          {nodeData.archivedAt && (
            <>
              <span>·</span>
              <Clock className="w-2.5 h-2.5" />
              <span>{formatRelativeTime(nodeData.archivedAt)}</span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onRestore}
          className="p-1 rounded hover:bg-white/10 transition-colors"
          title="Restore to canvas"
        >
          <RotateCcw className="w-3.5 h-3.5" style={{ color: 'var(--gui-accent-primary)' }} />
        </button>
        <button
          onClick={onTrash}
          className="p-1 rounded hover:bg-red-500/20 transition-colors"
          title="Move to trash"
        >
          <Trash2 className="w-3.5 h-3.5" style={{ color: 'var(--gui-text-muted)' }} />
        </button>
      </div>
    </div>
  )
}

export const ArchivePanel = memo(ArchivePanelComponent)
