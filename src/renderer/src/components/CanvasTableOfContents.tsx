// CanvasTableOfContents — PFD Phase 7A: Non-Spatial Retrieval
// Flat searchable list of all nodes. Parallel access method for when
// spatial memory fails ("I know I wrote it but can't find it on canvas").
// Triggered by Ctrl+Shift+T or command palette.

import { memo, useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useReactFlow } from '@xyflow/react'
import { X, Search, ArrowUpDown } from 'lucide-react'
import { useWorkspaceStore } from '../stores/workspaceStore'
import type { NoteMode } from '@shared/types'

type SortMode = 'recent' | 'alpha' | 'type'

const NOTE_MODE_LABELS: Record<NoteMode, string> = {
  general: 'General',
  persona: 'Persona',
  reference: 'Reference',
  examples: 'Examples',
  background: 'Background',
  'design-tokens': 'Design Tokens',
  page: 'Page',
  component: 'Component',
  'content-model': 'Content Model',
  'wp-config': 'WP Config'
}

interface CanvasTableOfContentsProps {
  onClose: () => void
}

function CanvasTableOfContentsComponent({ onClose }: CanvasTableOfContentsProps): JSX.Element {
  const nodes = useWorkspaceStore((state) => state.nodes)
  const setSelectedNodes = useWorkspaceStore((state) => state.setSelectedNodes)
  const recordInteraction = useWorkspaceStore((state) => state.recordInteraction)
  const { setCenter } = useReactFlow()
  const [search, setSearch] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('recent')
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Auto-focus search on mount
  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Filter and sort nodes
  const filteredNodes = useMemo(() => {
    const searchLower = search.toLowerCase()

    return nodes
      .filter(n => !n.data.isArchived)
      .filter(n => {
        if (typeFilter && n.data.type !== typeFilter) return false
        if (!search) return true
        const title = ((n.data as { title?: string }).title || '').toLowerCase()
        const tags = ((n.data as { tags?: string[] }).tags || []).join(' ').toLowerCase()
        return title.includes(searchLower) || tags.includes(searchLower)
      })
      .sort((a, b) => {
        if (sortMode === 'recent') {
          const aTime = (a.data as { updatedAt?: number }).updatedAt || 0
          const bTime = (b.data as { updatedAt?: number }).updatedAt || 0
          return bTime - aTime
        }
        if (sortMode === 'alpha') {
          const aTitle = (a.data as { title?: string }).title || ''
          const bTitle = (b.data as { title?: string }).title || ''
          return aTitle.localeCompare(bTitle)
        }
        // type
        return a.data.type.localeCompare(b.data.type)
      })
  }, [nodes, search, sortMode, typeFilter])

  // Unique types for filter
  const availableTypes = useMemo(() => {
    const types = new Set(nodes.filter(n => !n.data.isArchived).map(n => n.data.type))
    return Array.from(types).sort()
  }, [nodes])

  const handleJumpToNode = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId)
    if (!node?.position) return

    const width = (node.data as { width?: number }).width || 280
    const height = (node.data as { height?: number }).height || 140
    setCenter(
      node.position.x + width / 2,
      node.position.y + height / 2,
      { zoom: 1, duration: 300 }
    )
    setSelectedNodes([nodeId])
    recordInteraction(nodeId, 'select')
    onClose()
  }, [nodes, setCenter, setSelectedNodes, recordInteraction, onClose])

  const cycleSortMode = useCallback(() => {
    setSortMode(prev => prev === 'recent' ? 'alpha' : prev === 'alpha' ? 'type' : 'recent')
  }, [])

  return (
    <div className="canvas-toc">
      <div className="canvas-toc__header">
        <span className="canvas-toc__title">Canvas Contents</span>
        <span className="canvas-toc__count">{filteredNodes.length} nodes</span>
        <button className="canvas-toc__close" onClick={onClose} aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="canvas-toc__controls">
        <div className="canvas-toc__search-wrap">
          <Search className="w-3.5 h-3.5 canvas-toc__search-icon" />
          <input
            ref={searchRef}
            className="canvas-toc__search"
            placeholder="Search nodes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="canvas-toc__filters">
          <button className="canvas-toc__sort-btn" onClick={cycleSortMode} title={`Sort: ${sortMode}`}>
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>{sortMode === 'recent' ? 'Recent' : sortMode === 'alpha' ? 'A-Z' : 'Type'}</span>
          </button>
          <select
            className="canvas-toc__type-filter"
            value={typeFilter || ''}
            onChange={(e) => setTypeFilter(e.target.value || null)}
          >
            <option value="">All types</option>
            {availableTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="canvas-toc__list">
        {filteredNodes.map(node => {
          const title = (node.data as { title?: string }).title || 'Untitled'
          const noteMode = (node.data as { noteMode?: NoteMode }).noteMode
          const wordCount = (() => {
            const content = (node.data as { content?: string }).content || ''
            const plain = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
            return plain ? plain.split(/\s+/).length : 0
          })()

          return (
            <button
              key={node.id}
              className="canvas-toc__item"
              onClick={() => handleJumpToNode(node.id)}
            >
              <span className="canvas-toc__item-type" data-type={node.data.type}>
                {node.data.type}
              </span>
              <span className="canvas-toc__item-title">{title}</span>
              {noteMode && noteMode !== 'general' && (
                <span className="canvas-toc__item-mode">
                  {NOTE_MODE_LABELS[noteMode] || noteMode}
                </span>
              )}
              {wordCount > 0 && (
                <span className="canvas-toc__item-words">{wordCount}w</span>
              )}
            </button>
          )
        })}
        {filteredNodes.length === 0 && (
          <div className="canvas-toc__empty">No nodes match your search</div>
        )}
      </div>
    </div>
  )
}

export const CanvasTableOfContents = memo(CanvasTableOfContentsComponent)
