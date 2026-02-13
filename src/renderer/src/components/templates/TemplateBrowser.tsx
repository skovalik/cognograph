/**
 * Template Browser Modal
 *
 * Browse, search, and manage templates.
 * Allows pasting templates and organizing them into folders.
 */

import { memo, useState, useCallback, useMemo, useEffect } from 'react'
import {
  X,
  Search,
  Folder,
  FolderPlus,
  Star,
  Clock,
  Trash2,
  Copy,
  Layers,
  Grid,
  List,
  ChevronRight,
  ChevronDown
} from 'lucide-react'
import {
  useTemplateStore,
  useTemplates,
  useFolders,
  useFavoriteIds,
  useIsBrowserOpen,
  useSelectedFolderId,
  useTemplateSearchQuery
} from '../../stores/templateStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import type { Node } from '@xyflow/react'
import type { NodeData } from '@shared/types'
import { TemplatePreview } from './TemplatePreview'
import type { NodeTemplate, TemplateFolder } from '@shared/types'

// -----------------------------------------------------------------------------
// Template Card Component
// -----------------------------------------------------------------------------

interface TemplateCardProps {
  template: NodeTemplate
  isSelected: boolean
  isFavorite: boolean
  viewMode: 'grid' | 'list'
  onSelect: () => void
  onPaste: () => void
  onToggleFavorite: () => void
  onDuplicate: () => void
  onDelete: () => void
}

function TemplateCard({
  template,
  isSelected,
  isFavorite,
  viewMode,
  onSelect,
  onPaste,
  onToggleFavorite,
  onDuplicate,
  onDelete
}: TemplateCardProps): JSX.Element {
  const totalNodes = template.nodes.length

  if (viewMode === 'list') {
    return (
      <div
        onClick={onSelect}
        onDoubleClick={onPaste}
        className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-all ${
          isSelected
            ? 'bg-blue-500/20 border-blue-500'
            : 'bg-[var(--surface-panel-secondary)]/50 border-[var(--border-subtle)] hover:border-[var(--border-subtle)]'
        }`}
      >
        <div className="w-16 h-12 flex-shrink-0">
          <TemplatePreview template={template} maxWidth={64} maxHeight={48} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-white truncate">{template.name}</h3>
            {isFavorite && <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />}
          </div>
          <p className="text-xs text-[var(--text-muted)] truncate">
            {totalNodes} node{totalNodes !== 1 ? 's' : ''}
            {template.placeholders.length > 0 && (
              <> · {template.placeholders.length} placeholder{template.placeholders.length !== 1 ? 's' : ''}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleFavorite()
            }}
            className="p-1.5 text-[var(--text-muted)] hover:text-yellow-400 hover:bg-[var(--surface-panel-secondary)] rounded transition-colors"
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star className={`w-4 h-4 ${isFavorite ? 'fill-current text-yellow-400' : ''}`} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onPaste()
            }}
            className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
          >
            Paste
          </button>
        </div>
      </div>
    )
  }

  // Grid view
  return (
    <div
      onClick={onSelect}
      onDoubleClick={onPaste}
      className={`p-3 rounded border cursor-pointer transition-all ${
        isSelected
          ? 'bg-blue-500/20 border-blue-500'
          : 'bg-[var(--surface-panel-secondary)]/50 border-[var(--border-subtle)] hover:border-[var(--border-subtle)]'
      }`}
    >
      <div className="mb-2">
        <TemplatePreview template={template} maxWidth={160} maxHeight={100} />
      </div>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-white truncate">{template.name}</h3>
          <p className="text-xs text-[var(--text-muted)]">
            {totalNodes} node{totalNodes !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleFavorite()
          }}
          className="p-1 text-[var(--text-muted)] hover:text-yellow-400 transition-colors"
        >
          <Star className={`w-4 h-4 ${isFavorite ? 'fill-current text-yellow-400' : ''}`} />
        </button>
      </div>
      {isSelected && (
        <div className="flex gap-1 mt-2 pt-2 border-t border-[var(--border-subtle)]">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onPaste()
            }}
            className="flex-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
          >
            Paste
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDuplicate()
            }}
            className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-panel-secondary)] rounded transition-colors"
            title="Duplicate"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="p-1 text-[var(--text-secondary)] hover:text-red-400 hover:bg-[var(--surface-panel-secondary)] rounded transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Folder Item Component
// -----------------------------------------------------------------------------

interface FolderItemProps {
  folder: TemplateFolder
  isSelected: boolean
  isExpanded: boolean
  level: number
  onSelect: () => void
  onToggleExpand: () => void
  childFolders: TemplateFolder[]
  templateCount: number
}

function FolderItem({
  folder,
  isSelected,
  isExpanded,
  level,
  onSelect,
  onToggleExpand,
  childFolders,
  templateCount
}: FolderItemProps): JSX.Element {
  const hasChildren = childFolders.length > 0

  return (
    <div>
      <div
        onClick={onSelect}
        className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
          isSelected
            ? 'bg-blue-500/20 text-blue-400'
            : 'text-[var(--text-secondary)] hover:bg-[var(--surface-panel-secondary)]'
        }`}
        style={{ paddingLeft: `${8 + level * 16}px` }}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpand()
            }}
            className="p-0.5"
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <Folder className="w-4 h-4" style={{ color: folder.color }} />
        <span className="text-sm flex-1 truncate">{folder.name}</span>
        <span className="text-xs text-[var(--text-muted)]">{templateCount}</span>
      </div>
      {isExpanded &&
        childFolders.map((childFolder) => (
          <FolderItemWrapper key={childFolder.id} folder={childFolder} level={level + 1} />
        ))}
    </div>
  )
}

// Wrapper to access store
function FolderItemWrapper({
  folder,
  level
}: {
  folder: TemplateFolder
  level: number
}): JSX.Element {
  const selectedFolderId = useSelectedFolderId()
  const setSelectedFolder = useTemplateStore((s) => s.setSelectedFolder)
  const folders = useFolders()
  const templates = useTemplates()
  const [isExpanded, setIsExpanded] = useState(false)

  const childFolders = useMemo(
    () => folders.filter((f) => f.parentId === folder.id),
    [folders, folder.id]
  )

  const templateCount = useMemo(
    () => templates.filter((t) => t.folderId === folder.id).length,
    [templates, folder.id]
  )

  return (
    <FolderItem
      folder={folder}
      isSelected={selectedFolderId === folder.id}
      isExpanded={isExpanded}
      level={level}
      onSelect={() => setSelectedFolder(folder.id)}
      onToggleExpand={() => setIsExpanded(!isExpanded)}
      childFolders={childFolders}
      templateCount={templateCount}
    />
  )
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function calculateSelectionBounds(nodes: Node<NodeData>[]): {
  minX: number
  minY: number
  maxX: number
  maxY: number
  centerX: number
  centerY: number
} {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, centerX: 0, centerY: 0 }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const node of nodes) {
    const w = node.width || 280
    const h = node.height || 120
    minX = Math.min(minX, node.position.x)
    minY = Math.min(minY, node.position.y)
    maxX = Math.max(maxX, node.position.x + w)
    maxY = Math.max(maxY, node.position.y + h)
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2
  }
}

function getPastePosition(): { x: number; y: number } {
  const { lastCanvasClick, selectedNodeIds, nodes, viewport } = useWorkspaceStore.getState()

  // Priority 1: Recent click (within 2 seconds)
  if (lastCanvasClick && Date.now() - lastCanvasClick.time < 2000) {
    return { x: lastCanvasClick.x, y: lastCanvasClick.y }
  }

  // Priority 2: Below selection center
  if (selectedNodeIds.length > 0) {
    const selectedNodes = nodes.filter((n) => selectedNodeIds.includes(n.id))
    if (selectedNodes.length > 0) {
      const bounds = calculateSelectionBounds(selectedNodes)
      return { x: bounds.centerX - 150, y: bounds.maxY + 50 }
    }
  }

  // Priority 3: Viewport center
  // Convert screen center to flow coordinates
  return {
    x: -viewport.x / viewport.zoom + 400 / viewport.zoom,
    y: -viewport.y / viewport.zoom + 300 / viewport.zoom
  }
}

// -----------------------------------------------------------------------------
// Main Browser Component
// -----------------------------------------------------------------------------

function TemplateBrowserComponent(): JSX.Element | null {
  const isOpen = useIsBrowserOpen()
  const closeBrowser = useTemplateStore((s) => s.closeBrowser)
  const loadLibrary = useTemplateStore((s) => s.loadLibrary)
  const isLoaded = useTemplateStore((s) => s.isLoaded)

  const templates = useTemplates()
  const folders = useFolders()
  const favoriteIds = useFavoriteIds()
  const selectedFolderId = useSelectedFolderId()
  const searchQuery = useTemplateSearchQuery()

  const setSelectedFolder = useTemplateStore((s) => s.setSelectedFolder)
  const setSelectedTemplate = useTemplateStore((s) => s.setSelectedTemplate)
  const setSearchQuery = useTemplateStore((s) => s.setSearchQuery)
  const selectedTemplateId = useTemplateStore((s) => s.selectedTemplateId)
  const viewMode = useTemplateStore((s) => s.viewMode)
  const setViewMode = useTemplateStore((s) => s.setViewMode)

  const toggleFavorite = useTemplateStore((s) => s.toggleFavorite)
  const duplicateTemplate = useTemplateStore((s) => s.duplicateTemplate)
  const deleteTemplate = useTemplateStore((s) => s.deleteTemplate)
  const openPasteModal = useTemplateStore((s) => s.openPasteModal)
  const addFolder = useTemplateStore((s) => s.addFolder)

  const [showSection, setShowSection] = useState<'all' | 'favorites' | 'recent'>('all')
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  // Load library on mount
  useEffect(() => {
    if (isOpen && !isLoaded) {
      loadLibrary()
    }
  }, [isOpen, isLoaded, loadLibrary])

  // Root folders
  const rootFolders = useMemo(() => folders.filter((f) => !f.parentId), [folders])

  // Displayed templates based on selection
  const displayedTemplates = useMemo(() => {
    let result: NodeTemplate[] = []

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = templates.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.tags?.some((tag) => tag.toLowerCase().includes(q))
      )
    } else if (showSection === 'favorites') {
      result = templates.filter((t) => favoriteIds.includes(t.id))
    } else if (showSection === 'recent') {
      const lastUsedIds = useTemplateStore.getState().library.lastUsedTemplateIds
      result = lastUsedIds
        .map((id) => templates.find((t) => t.id === id))
        .filter((t): t is NodeTemplate => t !== undefined)
    } else if (selectedFolderId) {
      result = templates.filter((t) => t.folderId === selectedFolderId)
    } else {
      result = templates.filter((t) => !t.folderId)
    }

    return result
  }, [templates, searchQuery, showSection, selectedFolderId, favoriteIds])

  // Handlers
  const handleClose = useCallback(() => {
    closeBrowser()
  }, [closeBrowser])

  const handlePaste = useCallback(
    (templateId: string) => {
      const position = getPastePosition()
      openPasteModal({
        templateId,
        position
      })
      handleClose()
    },
    [openPasteModal, handleClose]
  )

  const handleCreateFolder = useCallback(() => {
    if (newFolderName.trim()) {
      addFolder(newFolderName.trim(), selectedFolderId || undefined)
      setNewFolderName('')
      setIsCreatingFolder(false)
    }
  }, [newFolderName, selectedFolderId, addFolder])

  const handleDeleteTemplate = useCallback(
    (templateId: string) => {
      if (confirm('Are you sure you want to delete this template?')) {
        deleteTemplate(templateId)
      }
    },
    [deleteTemplate]
  )

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-[800px] h-[600px] bg-[var(--surface-panel)] border border-[var(--border-subtle)] rounded-lg shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)] flex-shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-400" />
            <h2 className="font-semibold text-white">Template Browser</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-[var(--surface-panel-secondary)] rounded transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div className="w-48 border-r border-[var(--border-subtle)] flex flex-col">
            {/* Section buttons */}
            <div className="p-2 space-y-1 border-b border-[var(--border-subtle)]">
              <button
                onClick={() => {
                  setShowSection('all')
                  setSelectedFolder(null)
                }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                  showSection === 'all' && !selectedFolderId
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-panel-secondary)]'
                }`}
              >
                <Layers className="w-4 h-4" />
                All Templates
              </button>
              <button
                onClick={() => setShowSection('favorites')}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                  showSection === 'favorites'
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-panel-secondary)]'
                }`}
              >
                <Star className="w-4 h-4" />
                Favorites
              </button>
              <button
                onClick={() => setShowSection('recent')}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                  showSection === 'recent'
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-panel-secondary)]'
                }`}
              >
                <Clock className="w-4 h-4" />
                Recent
              </button>
            </div>

            {/* Folders */}
            <div className="flex-1 overflow-y-auto p-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-[var(--text-muted)] uppercase">Folders</span>
                <button
                  onClick={() => setIsCreatingFolder(true)}
                  className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-panel-secondary)] rounded transition-colors"
                  title="New folder"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                </button>
              </div>

              {isCreatingFolder && (
                <div className="mb-2">
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateFolder()
                      if (e.key === 'Escape') setIsCreatingFolder(false)
                    }}
                    placeholder="Folder name"
                    autoFocus
                    className="w-full bg-[var(--surface-panel-secondary)] border border-[var(--border-subtle)] rounded px-2 py-1 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              {rootFolders.map((folder) => (
                <FolderItemWrapper key={folder.id} folder={folder} level={0} />
              ))}

              {rootFolders.length === 0 && !isCreatingFolder && (
                <p className="text-xs text-[var(--text-muted)] italic">No folders yet</p>
              )}
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center gap-2 p-3 border-b border-[var(--border-subtle)]">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search templates..."
                  className="w-full bg-[var(--surface-panel-secondary)] border border-[var(--border-subtle)] rounded pl-9 pr-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex border border-[var(--border-subtle)] rounded">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-[var(--surface-panel-secondary)] text-[var(--text-primary)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 transition-colors ${
                    viewMode === 'list'
                      ? 'bg-[var(--surface-panel-secondary)] text-[var(--text-primary)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Templates */}
            <div className="flex-1 overflow-y-auto p-3">
              {displayedTemplates.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Layers className="w-12 h-12 text-[var(--text-muted)] mb-3" />
                  <p className="text-[var(--text-secondary)]">No templates found</p>
                  <p className="text-sm text-[var(--text-muted)] mt-1">
                    Select nodes on the canvas and save them as a template
                  </p>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-3 gap-3">
                  {displayedTemplates.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      isSelected={selectedTemplateId === template.id}
                      isFavorite={favoriteIds.includes(template.id)}
                      viewMode="grid"
                      onSelect={() => setSelectedTemplate(template.id)}
                      onPaste={() => handlePaste(template.id)}
                      onToggleFavorite={() => toggleFavorite(template.id)}
                      onDuplicate={() => duplicateTemplate(template.id)}
                      onDelete={() => handleDeleteTemplate(template.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {displayedTemplates.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      isSelected={selectedTemplateId === template.id}
                      isFavorite={favoriteIds.includes(template.id)}
                      viewMode="list"
                      onSelect={() => setSelectedTemplate(template.id)}
                      onPaste={() => handlePaste(template.id)}
                      onToggleFavorite={() => toggleFavorite(template.id)}
                      onDuplicate={() => duplicateTemplate(template.id)}
                      onDelete={() => handleDeleteTemplate(template.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export const TemplateBrowser = memo(TemplateBrowserComponent)
