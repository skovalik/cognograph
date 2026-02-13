/**
 * Save Template Modal
 *
 * Modal for saving selected nodes as a template.
 * Allows configuring template name, description, folder, and placeholder detection.
 */

import { memo, useState, useCallback, useMemo, useEffect } from 'react'
import { X, Save, FolderPlus, Tag, Layers } from 'lucide-react'
import { useTemplateStore, useSaveModalState, useFolders } from '../../stores/templateStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { createTemplateFromSelection, suggestTemplateName } from '../../utils/templateUtils'
import { TemplatePreview } from './TemplatePreview'
import type { Node, Edge } from '@xyflow/react'
import type { NodeData, EdgeData } from '@shared/types'

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

function SaveTemplateModalComponent(): JSX.Element | null {
  const { open, context } = useSaveModalState()
  const closeSaveModal = useTemplateStore((s) => s.closeSaveModal)
  const addTemplate = useTemplateStore((s) => s.addTemplate)
  const addFolder = useTemplateStore((s) => s.addFolder)
  const folders = useFolders()

  // Get nodes and edges from workspace
  const nodes = useWorkspaceStore((s) => s.nodes)
  const edges = useWorkspaceStore((s) => s.edges)

  // Local form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [includeContent, setIncludeContent] = useState(true)
  const [detectPlaceholders, setDetectPlaceholders] = useState(true)
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Get selected nodes and edges
  const selectedNodes = useMemo(() => {
    if (!context) return []
    return nodes.filter((n) => context.nodeIds.includes(n.id))
  }, [nodes, context])

  const selectedEdges = useMemo(() => {
    if (!context) return []
    return edges.filter((e) => context.edgeIds.includes(e.id))
  }, [edges, context])

  // Create template preview data
  const templatePreview = useMemo(() => {
    if (selectedNodes.length === 0) return null
    try {
      return createTemplateFromSelection(selectedNodes as Node<NodeData>[], selectedEdges as Edge<EdgeData>[], {
        includeContent,
        detectPlaceholders
      })
    } catch {
      return null
    }
  }, [selectedNodes, selectedEdges, includeContent, detectPlaceholders])

  // Initialize form when context changes
  useEffect(() => {
    if (context) {
      setName(context.suggestedName || suggestTemplateName(selectedNodes as Node<NodeData>[]))
      setDescription('')
      setSelectedFolderId(null)
      setTags([])
      setIncludeContent(true)
      setDetectPlaceholders(true)
      setError(null)
    }
  }, [context, selectedNodes])

  // Handlers
  const handleClose = useCallback(() => {
    closeSaveModal()
  }, [closeSaveModal])

  const handleAddTag = useCallback(() => {
    const tag = tagInput.trim().toLowerCase()
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag])
    }
    setTagInput('')
  }, [tagInput, tags])

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove))
  }, [tags])

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleAddTag()
      }
    },
    [handleAddTag]
  )

  const handleCreateFolder = useCallback(() => {
    if (newFolderName.trim()) {
      const folderId = addFolder(newFolderName.trim())
      setSelectedFolderId(folderId)
      setNewFolderName('')
      setIsCreatingFolder(false)
    }
  }, [newFolderName, addFolder])

  const handleSave = useCallback(() => {
    if (!templatePreview) {
      setError('Cannot create template - no valid nodes selected')
      return
    }

    if (!name.trim()) {
      setError('Template name is required')
      return
    }

    try {
      addTemplate({
        name: name.trim(),
        description: description.trim() || undefined,
        folderId: selectedFolderId || undefined,
        tags: tags.length > 0 ? tags : undefined,
        nodes: templatePreview.nodes,
        edges: templatePreview.edges,
        bounds: templatePreview.bounds,
        rootNodeId: templatePreview.rootNodeId,
        placeholders: templatePreview.placeholders,
        includesContent: includeContent,
        source: 'user',
        icon: undefined,
        color: undefined,
        thumbnail: null
      })

      handleClose()
    } catch (err) {
      setError(`Failed to save template: ${err}`)
    }
  }, [
    name,
    description,
    selectedFolderId,
    tags,
    templatePreview,
    includeContent,
    addTemplate,
    handleClose
  ])

  if (!open || !context) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-[600px] max-h-[80vh] bg-[var(--surface-panel)] glass-fluid border border-[var(--border-subtle)] rounded-lg shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)] flex-shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-400" />
            <h2 className="font-semibold text-white">Save as Template</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-[var(--surface-panel-secondary)] rounded transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Preview */}
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              {templatePreview && (
                <TemplatePreview
                  template={templatePreview}
                  maxWidth={160}
                  maxHeight={120}
                />
              )}
            </div>
            <div className="flex-1 text-sm text-[var(--text-secondary)]">
              <p>
                <strong className="text-[var(--text-primary)]">{selectedNodes.length}</strong>{' '}
                node{selectedNodes.length !== 1 ? 's' : ''} and{' '}
                <strong className="text-[var(--text-primary)]">{selectedEdges.length}</strong>{' '}
                edge{selectedEdges.length !== 1 ? 's' : ''} selected
              </p>
              {templatePreview && templatePreview.placeholders.length > 0 && (
                <p className="mt-1">
                  <strong style={{ color: 'var(--gui-accent-primary)' }}>
                    {templatePreview.placeholders.length}
                  </strong>{' '}
                  placeholder{templatePreview.placeholders.length !== 1 ? 's' : ''} detected
                </p>
              )}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              Template Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Template"
              className="w-full bg-[var(--surface-panel-secondary)] border border-[var(--border-subtle)] rounded px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this template for?"
              rows={2}
              className="w-full bg-[var(--surface-panel-secondary)] border border-[var(--border-subtle)] rounded px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {/* Folder */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              Folder
            </label>
            {isCreatingFolder ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="New folder name"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateFolder()
                    if (e.key === 'Escape') setIsCreatingFolder(false)
                  }}
                  className="flex-1 bg-[var(--surface-panel-secondary)] border border-[var(--border-subtle)] rounded px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleCreateFolder}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded transition-colors"
                >
                  Create
                </button>
                <button
                  onClick={() => setIsCreatingFolder(false)}
                  className="px-3 py-2 bg-[var(--surface-panel-secondary)] hover:bg-[var(--surface-panel-secondary)] text-[var(--text-secondary)] text-sm rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <select
                  value={selectedFolderId || ''}
                  onChange={(e) => setSelectedFolderId(e.target.value || null)}
                  className="flex-1 bg-[var(--surface-panel-secondary)] border border-[var(--border-subtle)] rounded px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
                >
                  <option value="">No folder (root)</option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setIsCreatingFolder(true)}
                  className="px-3 py-2 bg-[var(--surface-panel-secondary)] hover:bg-[var(--surface-panel-secondary)] text-[var(--text-secondary)] rounded transition-colors"
                  title="Create new folder"
                >
                  <FolderPlus className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              Tags
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-[var(--surface-panel-secondary)] rounded text-xs text-[var(--text-secondary)]"
                >
                  <Tag className="w-3 h-3" />
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-red-400 ml-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Add a tag..."
                className="flex-1 bg-[var(--surface-panel-secondary)] border border-[var(--border-subtle)] rounded px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleAddTag}
                disabled={!tagInput.trim()}
                className="px-3 py-2 bg-[var(--surface-panel-secondary)] hover:bg-[var(--surface-panel-secondary)] text-[var(--text-secondary)] rounded transition-colors disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3 pt-2 border-t border-[var(--border-subtle)]">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeContent}
                onChange={(e) => setIncludeContent(e.target.checked)}
                className="w-4 h-4 rounded border-[var(--border-subtle)] bg-[var(--surface-panel-secondary)] text-blue-500 focus:ring-blue-500 focus:ring-offset-[var(--surface-panel)]"
              />
              <div>
                <span className="text-sm text-[var(--text-secondary)]">Include content</span>
                <p className="text-xs text-[var(--text-muted)]">
                  Save node titles, messages, and text. Uncheck to save structure only.
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={detectPlaceholders}
                onChange={(e) => setDetectPlaceholders(e.target.checked)}
                className="w-4 h-4 rounded border-[var(--border-subtle)] bg-[var(--surface-panel-secondary)] text-blue-500 focus:ring-blue-500 focus:ring-offset-[var(--surface-panel)]"
              />
              <div>
                <span className="text-sm text-[var(--text-secondary)]">Detect placeholders</span>
                <p className="text-xs text-[var(--text-muted)]">
                  Auto-detect {'{{placeholder}}'} patterns in content.
                </p>
              </div>
            </label>
          </div>

          {/* Detected Placeholders */}
          {templatePreview && templatePreview.placeholders.length > 0 && (
            <div
              className="p-3 rounded"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--gui-accent-primary) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--gui-accent-primary) 20%, transparent)'
              }}
            >
              <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--gui-accent-primary)' }}>
                Detected Placeholders
              </h3>
              <div className="flex flex-wrap gap-2">
                {templatePreview.placeholders.map((p) => (
                  <span
                    key={p.key}
                    className="px-2 py-1 rounded text-xs"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--gui-accent-primary) 20%, transparent)',
                      color: 'color-mix(in srgb, var(--gui-accent-primary) 70%, white)'
                    }}
                  >
                    {'{{'}{p.key}{'}}'}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-[var(--border-subtle)] flex-shrink-0">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || selectedNodes.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            Save Template
          </button>
        </div>
      </div>
    </div>
  )
}

export const SaveTemplateModal = memo(SaveTemplateModalComponent)
