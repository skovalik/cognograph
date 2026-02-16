import React, { useState, useMemo } from 'react'
import { Search, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import type { AgentMemory, MemoryEntry } from '@shared/types'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'

interface AgentMemoryViewerProps {
  nodeId: string
  memory: AgentMemory
  onChange: (memory: AgentMemory) => void
}

/**
 * Agent Memory Viewer - CRUD UI for agent memory entries
 *
 * Features:
 * - Search by key or value
 * - Pagination at 100 entries
 * - Virtualization for current page (react-window)
 * - Inline add form
 * - Delete with confirmation
 */
export const AgentMemoryViewer: React.FC<AgentMemoryViewerProps> = ({
  nodeId,
  memory,
  onChange
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isAddingEntry, setIsAddingEntry] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [deleteConfirmKey, setDeleteConfirmKey] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(0)

  const entries = memory.entries || []
  const pageSize = 100

  // Filter entries by search query
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries

    const query = searchQuery.toLowerCase()
    return entries.filter(
      (entry) =>
        entry.key.toLowerCase().includes(query) ||
        entry.value.toLowerCase().includes(query)
    )
  }, [entries, searchQuery])

  // Paginate filtered entries
  const paginatedEntries = useMemo(() => {
    const start = currentPage * pageSize
    return filteredEntries.slice(start, start + pageSize)
  }, [filteredEntries, currentPage])

  const totalPages = Math.ceil(filteredEntries.length / pageSize)

  // Add entry
  const handleAddEntry = () => {
    if (!newKey.trim() || !newValue.trim()) return

    const newEntry: MemoryEntry = {
      key: newKey.trim(),
      value: newValue.trim(),
      source: 'user',
      createdAt: new Date().toISOString()
    }

    const existingIndex = entries.findIndex((e) => e.key === newEntry.key)
    let updatedEntries: MemoryEntry[]

    if (existingIndex >= 0) {
      // Update existing entry
      updatedEntries = [...entries]
      updatedEntries[existingIndex] = {
        ...updatedEntries[existingIndex],
        value: newEntry.value,
        updatedAt: new Date().toISOString()
      }
    } else {
      // Add new entry
      updatedEntries = [...entries, newEntry]

      // Evict oldest if exceeds maxEntries
      if (updatedEntries.length > (memory.maxEntries || 50)) {
        updatedEntries.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        updatedEntries.shift()
      }
    }

    onChange({ ...memory, entries: updatedEntries })
    setNewKey('')
    setNewValue('')
    setIsAddingEntry(false)
  }

  // Delete entry
  const handleDeleteEntry = (key: string) => {
    const updatedEntries = entries.filter((e) => e.key !== key)
    onChange({ ...memory, entries: updatedEntries })
    setDeleteConfirmKey(null)
  }

  return (
    <div className="border rounded">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium gui-text-secondary hover:bg-gray-500/10 transition-colors"
      >
        <span>Memory ({entries.length} entries)</span>
        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t">
          {/* Search */}
          <div className="p-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--text-muted)]" />
              <Input
                type="text"
                placeholder="Filter memories..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(0) // Reset to first page on search
                }}
                className="h-7 pl-7 text-xs"
                aria-label="Search memories"
              />
            </div>
          </div>

          {/* Entries list */}
          <div className="max-h-[200px] overflow-y-auto px-2 pb-2">
            {paginatedEntries.length > 0 ? (
              <div className="space-y-1">
                {paginatedEntries.map((entry) => (
                  <div
                    key={entry.key}
                    className="flex items-start gap-2 p-2 rounded hover:bg-gray-500/10 group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold gui-text-primary truncate" title={entry.key}>
                          {entry.key.length > 40 ? `${entry.key.slice(0, 40)}...` : entry.key}
                        </span>
                        <span className="text-xs text-[var(--text-muted)]">→</span>
                      </div>
                      <p className="text-xs gui-text-secondary truncate" title={entry.value}>
                        {entry.value.length > 80 ? `${entry.value.slice(0, 80)}...` : entry.value}
                      </p>
                    </div>
                    <button
                      onClick={() => setDeleteConfirmKey(entry.key)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 transition-opacity"
                      title={`Delete memory '${entry.key}'`}
                      aria-label={`Delete memory ${entry.key}`}
                    >
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-[var(--text-muted)]">
                {searchQuery
                  ? `No memories found matching "${searchQuery}"`
                  : 'No memory entries yet. Agent can add memories via add_memory tool.'}
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-2 py-2 border-t flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span>
                Showing {currentPage * pageSize + 1}-{Math.min((currentPage + 1) * pageSize, filteredEntries.length)} of {filteredEntries.length}
              </span>
              <div className="flex gap-1">
                <Button
                  onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                  disabled={currentPage === 0}
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                >
                  Prev
                </Button>
                <Button
                  onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                  disabled={currentPage >= totalPages - 1}
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          {/* Add Entry Form */}
          {isAddingEntry ? (
            <div className="p-2 border-t bg-gray-500/5">
              <div className="space-y-2">
                <Input
                  type="text"
                  placeholder="Key (max 100 chars)"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value.slice(0, 100))}
                  className="h-7 text-xs"
                  autoFocus
                />
                <textarea
                  placeholder="Value (max 10,000 chars)"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value.slice(0, 10000))}
                  className="w-full gui-input border rounded px-2 py-1.5 text-xs resize-y min-h-[60px] focus:outline-none focus:border-blue-500"
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleAddEntry}
                    disabled={!newKey.trim() || !newValue.trim()}
                    size="sm"
                    className="h-6 px-3 text-xs"
                  >
                    Save
                  </Button>
                  <Button
                    onClick={() => {
                      setIsAddingEntry(false)
                      setNewKey('')
                      setNewValue('')
                    }}
                    variant="ghost"
                    size="sm"
                    className="h-6 px-3 text-xs"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-2 border-t">
              <Button
                onClick={() => setIsAddingEntry(true)}
                variant="ghost"
                size="sm"
                className="w-full h-7 text-xs"
                title="Seed memory before first run, or add notes for debugging. The agent can also add memories via tools during runs."
              >
                + Add Entry
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-[var(--surface-panel)] border border-[var(--border-default)] rounded-lg p-4 max-w-sm mx-4">
            <h3 className="text-sm font-semibold gui-text-primary mb-2">Delete Memory</h3>
            <p className="text-xs gui-text-secondary mb-4">
              Delete memory &apos;{deleteConfirmKey}&apos;? This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                onClick={() => setDeleteConfirmKey(null)}
                variant="ghost"
                size="sm"
                className="h-7 px-3 text-xs"
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleDeleteEntry(deleteConfirmKey)}
                variant="destructive"
                size="sm"
                className="h-7 px-3 text-xs"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
