/**
 * UndoHistoryPanel - Shows recent undo/redo history
 *
 * ND-friendly feature: Reduces "did I do that?" anxiety by showing
 * what actions can be undone. Visual history reduces memory load.
 */

import { memo, useCallback } from 'react'
import { History, RotateCcw, RotateCw, Trash2, Plus, Move, Link } from 'lucide-react'
import { useWorkspaceStore } from '../stores/workspaceStore'

// Map history action types to icons and labels
const ACTION_CONFIG: Record<string, { icon: typeof History; label: string }> = {
  ADD_NODE: { icon: Plus, label: 'Add node' },
  DELETE_NODE: { icon: Trash2, label: 'Delete node' },
  UPDATE_NODE: { icon: History, label: 'Update node' },
  MOVE_NODE: { icon: Move, label: 'Move node' },
  ADD_EDGE: { icon: Link, label: 'Add connection' },
  DELETE_EDGE: { icon: Trash2, label: 'Delete connection' },
  BATCH_MOVE: { icon: Move, label: 'Move nodes' },
  ALIGN_NODES: { icon: Move, label: 'Align nodes' },
  DISTRIBUTE_NODES: { icon: Move, label: 'Distribute nodes' }
}

interface UndoHistoryPanelProps {
  isOpen: boolean
  onClose: () => void
}

function UndoHistoryPanelComponent({ isOpen, onClose }: UndoHistoryPanelProps): JSX.Element | null {
  const history = useWorkspaceStore((state) => state.history)
  const historyIndex = useWorkspaceStore((state) => state.historyIndex)
  const undo = useWorkspaceStore((state) => state.undo)
  const redo = useWorkspaceStore((state) => state.redo)
  const canUndo = useWorkspaceStore((state) => state.canUndo)
  const canRedo = useWorkspaceStore((state) => state.canRedo)

  const handleUndo = useCallback(() => {
    if (canUndo()) undo()
  }, [canUndo, undo])

  const handleRedo = useCallback(() => {
    if (canRedo()) redo()
  }, [canRedo, redo])

  if (!isOpen) return null

  // Show last 10 history items
  const visibleHistory = history.slice(Math.max(0, historyIndex - 9), historyIndex + 1).reverse()
  const futureHistory = history.slice(historyIndex + 1, historyIndex + 6)

  return (
    <div
      className="absolute top-20 left-4 gui-z-panels w-64 rounded-lg overflow-hidden shadow-xl animate-fade-in"
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
          <History className="w-4 h-4" style={{ color: 'var(--gui-accent-primary)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--gui-text-primary)' }}>
            History
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleUndo}
            disabled={!canUndo()}
            className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Undo (Ctrl+Z)"
          >
            <RotateCcw className="w-4 h-4" style={{ color: 'var(--gui-text-secondary)' }} />
          </button>
          <button
            onClick={handleRedo}
            disabled={!canRedo()}
            className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Redo (Ctrl+Shift+Z)"
          >
            <RotateCw className="w-4 h-4" style={{ color: 'var(--gui-text-secondary)' }} />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 ml-2"
            title="Close"
          >
            <span style={{ color: 'var(--gui-text-muted)' }}>×</span>
          </button>
        </div>
      </div>

      {/* History list */}
      <div className="max-h-64 overflow-y-auto p-2">
        {/* Future actions (can redo) */}
        {futureHistory.length > 0 && (
          <>
            <div className="text-[10px] uppercase px-2 py-1" style={{ color: 'var(--gui-text-muted)' }}>
              Redo available
            </div>
            {futureHistory.map((action, i) => {
              const config = ACTION_CONFIG[action.type] || { icon: History, label: action.type }
              const Icon = config.icon
              return (
                <div
                  key={`future-${i}`}
                  className="flex items-center gap-2 px-2 py-1.5 rounded text-xs opacity-50"
                  style={{ color: 'var(--gui-text-secondary)' }}
                >
                  <Icon className="w-3 h-3" />
                  <span>{config.label}</span>
                </div>
              )
            })}
            <div className="h-px my-2" style={{ backgroundColor: 'var(--gui-border-subtle)' }} />
          </>
        )}

        {/* Past actions (can undo) */}
        {visibleHistory.length > 0 ? (
          visibleHistory.map((action, i) => {
            const config = ACTION_CONFIG[action.type] || { icon: History, label: action.type }
            const Icon = config.icon
            const isCurrent = i === 0
            return (
              <div
                key={`past-${i}`}
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${
                  isCurrent ? 'bg-white/5' : ''
                }`}
                style={{ color: isCurrent ? 'var(--gui-text-primary)' : 'var(--gui-text-secondary)' }}
              >
                <Icon className="w-3 h-3" style={isCurrent ? { color: 'var(--gui-accent-primary)' } : undefined} />
                <span>{config.label}</span>
                {isCurrent && (
                  <span className="ml-auto text-[10px]" style={{ color: 'var(--gui-text-muted)' }}>
                    current
                  </span>
                )}
              </div>
            )
          })
        ) : (
          <div className="text-center py-4 text-xs" style={{ color: 'var(--gui-text-muted)' }}>
            No history yet
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div
        className="px-3 py-2 text-[10px] border-t"
        style={{ borderColor: 'var(--gui-border-subtle)', color: 'var(--gui-text-muted)' }}
      >
        Ctrl+Z to undo • Ctrl+Shift+Z to redo
      </div>
    </div>
  )
}

export const UndoHistoryPanel = memo(UndoHistoryPanelComponent)
