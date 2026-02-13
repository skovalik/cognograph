/**
 * SavedViewsPanel - Manage and switch between saved views
 *
 * ND-friendly feature: Quick context switching without manual setup.
 * "Show me my task view" → instant consistent workspace state.
 */

import { memo, useState, useCallback } from 'react'
import { Bookmark, Plus, Trash2, X, Edit2, Eye, Check } from 'lucide-react'
import { useReactFlow } from '@xyflow/react'
import { useSavedViewsStore, SavedView } from '../stores/savedViewsStore'
import { useWorkspaceStore } from '../stores/workspaceStore'
import type { NodeData } from '@shared/types'

interface SavedViewsPanelProps {
  isOpen: boolean
  onClose: () => void
}

function SavedViewsPanelComponent({ isOpen, onClose }: SavedViewsPanelProps): JSX.Element | null {
  const { setViewport, getViewport } = useReactFlow()
  const [newViewName, setNewViewName] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  // Saved views store
  const views = useSavedViewsStore((s) => s.views)
  const activeViewId = useSavedViewsStore((s) => s.activeViewId)
  const saveCurrentView = useSavedViewsStore((s) => s.saveCurrentView)
  const updateView = useSavedViewsStore((s) => s.updateView)
  const deleteView = useSavedViewsStore((s) => s.deleteView)
  const setActiveView = useSavedViewsStore((s) => s.setActiveView)

  // Workspace store
  const hiddenNodeTypes = useWorkspaceStore((s) => s.hiddenNodeTypes)
  const setHiddenNodeTypes = useWorkspaceStore((s) => s.setHiddenNodeTypes)
  const focusModeNodeId = useWorkspaceStore((s) => s.focusModeNodeId)
  const setFocusModeNode = useWorkspaceStore((s) => s.setFocusModeNode)
  const selectedNodeIds = useWorkspaceStore((s) => s.selectedNodeIds)
  const setSelectedNodes = useWorkspaceStore((s) => s.setSelectedNodes)

  // Save current view
  const handleSaveView = useCallback(() => {
    if (!newViewName.trim()) return

    const viewport = getViewport()
    saveCurrentView(
      newViewName.trim(),
      viewport,
      hiddenNodeTypes,
      focusModeNodeId,
      selectedNodeIds
    )

    setNewViewName('')
    setIsAdding(false)
  }, [newViewName, getViewport, saveCurrentView, hiddenNodeTypes, focusModeNodeId, selectedNodeIds])

  // Apply a saved view
  const handleApplyView = useCallback((view: SavedView) => {
    // Apply viewport
    setViewport(view.viewport, { duration: 300 })

    // Apply hidden node types
    setHiddenNodeTypes(new Set(view.hiddenNodeTypes as NodeData['type'][]))

    // Apply focus mode
    setFocusModeNode(view.focusModeNodeId)

    // Apply selection if saved
    if (view.selectedNodeIds) {
      setSelectedNodes(view.selectedNodeIds)
    }

    setActiveView(view.id)
  }, [setViewport, setHiddenNodeTypes, setFocusModeNode, setSelectedNodes, setActiveView])

  // Start editing
  const handleStartEdit = useCallback((view: SavedView) => {
    setEditingId(view.id)
    setEditingName(view.name)
  }, [])

  // Save edit
  const handleSaveEdit = useCallback(() => {
    if (editingId && editingName.trim()) {
      updateView(editingId, { name: editingName.trim() })
    }
    setEditingId(null)
    setEditingName('')
  }, [editingId, editingName, updateView])

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
          <Bookmark className="w-4 h-4" style={{ color: 'var(--gui-accent-primary)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--gui-text-primary)' }}>
            Saved Views
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            title="Save current view"
          >
            <Plus className="w-4 h-4" style={{ color: 'var(--gui-text-secondary)' }} />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10"
            title="Close"
          >
            <X className="w-4 h-4" style={{ color: 'var(--gui-text-muted)' }} />
          </button>
        </div>
      </div>

      {/* Add new view form */}
      {isAdding && (
        <div
          className="px-3 py-2 border-b flex items-center gap-2"
          style={{ borderColor: 'var(--gui-border-subtle)', backgroundColor: 'var(--gui-bg-tertiary)' }}
        >
          <input
            type="text"
            value={newViewName}
            onChange={(e) => setNewViewName(e.target.value)}
            placeholder="View name..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveView()
              if (e.key === 'Escape') {
                setIsAdding(false)
                setNewViewName('')
              }
            }}
            className="flex-1 px-2 py-1 rounded text-sm bg-transparent border"
            style={{
              borderColor: 'var(--gui-border-subtle)',
              color: 'var(--gui-text-primary)'
            }}
          />
          <button
            onClick={handleSaveView}
            disabled={!newViewName.trim()}
            className="p-1 rounded hover:bg-white/10 disabled:opacity-30"
          >
            <Check className="w-4 h-4" style={{ color: 'var(--gui-accent-primary)' }} />
          </button>
        </div>
      )}

      {/* Views list */}
      <div className="max-h-80 overflow-y-auto">
        {views.length > 0 ? (
          views.map((view) => (
            <div
              key={view.id}
              className={`flex items-center gap-2 px-3 py-2 hover:bg-white/5 group transition-colors ${
                activeViewId === view.id ? 'bg-white/5' : ''
              }`}
              style={{ borderBottom: '1px solid var(--gui-border-subtle)' }}
            >
              {editingId === view.id ? (
                // Edit mode
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit()
                    if (e.key === 'Escape') {
                      setEditingId(null)
                      setEditingName('')
                    }
                  }}
                  onBlur={handleSaveEdit}
                  className="flex-1 px-2 py-0.5 rounded text-sm bg-transparent border"
                  style={{
                    borderColor: 'var(--gui-border-subtle)',
                    color: 'var(--gui-text-primary)'
                  }}
                />
              ) : (
                // Display mode
                <>
                  <button
                    onClick={() => handleApplyView(view)}
                    className="flex-1 text-left flex items-center gap-2 min-w-0"
                  >
                    <Eye
                      className="w-3.5 h-3.5 flex-shrink-0"
                      style={{
                        color: activeViewId === view.id
                          ? 'var(--gui-accent-primary)'
                          : 'var(--gui-text-muted)'
                      }}
                    />
                    <span
                      className="text-sm truncate"
                      style={{ color: 'var(--gui-text-primary)' }}
                    >
                      {view.name}
                    </span>
                  </button>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleStartEdit(view)}
                      className="p-1 rounded hover:bg-white/10"
                      title="Rename"
                    >
                      <Edit2 className="w-3 h-3" style={{ color: 'var(--gui-text-muted)' }} />
                    </button>
                    <button
                      onClick={() => deleteView(view.id)}
                      className="p-1 rounded hover:bg-red-500/20"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" style={{ color: 'var(--gui-text-muted)' }} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        ) : (
          <div
            className="flex flex-col items-center justify-center py-8 px-4"
            style={{ color: 'var(--gui-text-muted)' }}
          >
            <Bookmark className="w-8 h-8 mb-2 opacity-30" />
            <span className="text-sm">No saved views</span>
            <span className="text-xs mt-1 text-center opacity-70">
              Click + to save current view
            </span>
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div
        className="px-3 py-2 text-[10px] border-t"
        style={{ borderColor: 'var(--gui-border-subtle)', color: 'var(--gui-text-muted)' }}
      >
        Views save viewport, filters, and focus state
      </div>
    </div>
  )
}

export const SavedViewsPanel = memo(SavedViewsPanelComponent)
