/**
 * TrashPanel - Shows recently deleted nodes with restore option
 *
 * ND-friendly feature: Reduces deletion anxiety. "I can always get it back"
 * makes deletion feel safe, enabling experimentation.
 */

import { memo, useCallback } from 'react'
import { Trash2, RotateCcw, X, Clock } from 'lucide-react'
import { useFeaturesStore, useWorkspaceStore } from '../stores'
import type { TrashedItem } from '../stores/types'

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

// Format relative time
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

interface TrashPanelProps {
  isOpen: boolean
  onClose: () => void
}

function TrashPanelComponent({ isOpen, onClose }: TrashPanelProps): JSX.Element | null {
  const trash = useFeaturesStore((s) => s.trash)
  const restoreFromTrash = useFeaturesStore((s) => s.restoreFromTrash)
  const permanentlyDelete = useWorkspaceStore((s) => s.permanentlyDelete) // Still in workspaceStore
  const emptyTrash = useFeaturesStore((s) => s.emptyTrash)

  const handleRestore = useCallback((index: number) => {
    restoreFromTrash(index)
  }, [restoreFromTrash])

  const handlePermanentDelete = useCallback((index: number) => {
    permanentlyDelete(index)
  }, [permanentlyDelete])

  const handleEmptyTrash = useCallback(() => {
    if (trash.length === 0) return
    // Could add confirmation dialog here
    emptyTrash()
  }, [trash.length, emptyTrash])

  if (!isOpen) return null

  // Show newest first
  const sortedTrash = [...trash].reverse()

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
          <Trash2 className="w-4 h-4" style={{ color: 'var(--gui-accent-primary)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--gui-text-primary)' }}>
            Trash
          </span>
          {trash.length > 0 && (
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: 'var(--gui-bg-tertiary)',
                color: 'var(--gui-text-muted)'
              }}
            >
              {trash.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {trash.length > 0 && (
            <button
              onClick={handleEmptyTrash}
              className="px-2 py-1 rounded text-xs hover:bg-white/10 transition-colors"
              style={{ color: 'var(--gui-text-muted)' }}
              title="Empty trash"
            >
              Empty
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

      {/* Trash list */}
      <div className="max-h-80 overflow-y-auto">
        {sortedTrash.length > 0 ? (
          sortedTrash.map((item, displayIndex) => {
            // Calculate actual index (reversed)
            const actualIndex = trash.length - 1 - displayIndex
            return (
              <TrashItem
                key={`${item.node.id}-${item.deletedAt}`}
                item={item}
                onRestore={() => handleRestore(actualIndex)}
                onDelete={() => handlePermanentDelete(actualIndex)}
              />
            )
          })
        ) : (
          <div
            className="flex flex-col items-center justify-center py-8 px-4"
            style={{ color: 'var(--gui-text-muted)' }}
          >
            <Trash2 className="w-8 h-8 mb-2 opacity-30" />
            <span className="text-sm">Trash is empty</span>
            <span className="text-xs mt-1 text-center opacity-70">
              Deleted nodes will appear here
            </span>
          </div>
        )}
      </div>

      {/* Footer hint */}
      {trash.length > 0 && (
        <div
          className="px-3 py-2 text-[10px] border-t"
          style={{ borderColor: 'var(--gui-border-subtle)', color: 'var(--gui-text-muted)' }}
        >
          Click restore to bring back a node
        </div>
      )}
    </div>
  )
}

interface TrashItemProps {
  item: TrashedItem
  onRestore: () => void
  onDelete: () => void
}

function TrashItem({ item, onRestore, onDelete }: TrashItemProps): JSX.Element {
  const nodeData = item.node.data
  const typeName = NODE_TYPE_NAMES[nodeData.type] || nodeData.type
  // Get title from node data - different node types have different structures
  const nodeTitle = 'title' in nodeData ? (nodeData.title as string) : undefined
  const nodeLabel = 'label' in nodeData ? (nodeData.label as string) : undefined
  const title = nodeTitle || nodeLabel || `Untitled ${typeName}`

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
          <span>·</span>
          <Clock className="w-2.5 h-2.5" />
          <span>{formatRelativeTime(item.deletedAt)}</span>
          {item.edges.length > 0 && (
            <>
              <span>·</span>
              <span>{item.edges.length} edge{item.edges.length !== 1 ? 's' : ''}</span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onRestore}
          className="p-1 rounded hover:bg-white/10 transition-colors"
          title="Restore"
        >
          <RotateCcw className="w-3.5 h-3.5" style={{ color: 'var(--gui-accent-primary)' }} />
        </button>
        <button
          onClick={onDelete}
          className="p-1 rounded hover:bg-red-500/20 transition-colors"
          title="Delete permanently"
        >
          <X className="w-3.5 h-3.5" style={{ color: 'var(--gui-text-muted)' }} />
        </button>
      </div>
    </div>
  )
}

export const TrashPanel = memo(TrashPanelComponent)
