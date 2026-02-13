// =============================================================================
// PROMPT HISTORY DROPDOWN
// =============================================================================
// Shows history of previously used prompts for quick reuse

import { memo, useState, useMemo, useCallback, useEffect } from 'react'
import { History, Search, Trash2, Clock, X } from 'lucide-react'
import { aiConfigLearning, type PromptHistoryEntry } from '../../services/aiConfigLearning'

interface PromptHistoryDropdownProps {
  onSelect: (prompt: string) => void
  isOpen: boolean
  onToggle: () => void
}

function PromptHistoryDropdownComponent({
  onSelect,
  isOpen,
  onToggle
}: PromptHistoryDropdownProps): JSX.Element {
  const [search, setSearch] = useState('')

  const history = useMemo(() => aiConfigLearning.getPromptHistory(), [isOpen])

  const filteredHistory = useMemo(() => {
    if (!search.trim()) return history
    const lower = search.toLowerCase()
    return history.filter(h => h.prompt.toLowerCase().includes(lower))
  }, [history, search])

  const handleSelect = useCallback(
    (entry: PromptHistoryEntry) => {
      onSelect(entry.prompt)
      onToggle()
    },
    [onSelect, onToggle]
  )

  const handleDelete = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    aiConfigLearning.deletePromptEntry(id)
  }, [])

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.prompt-history-dropdown')) {
        onToggle()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onToggle])

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        title="Prompt history"
      >
        <History className="w-3 h-3" />
      </button>
    )
  }

  return (
    <div className="prompt-history-dropdown absolute top-full right-0 mt-1 w-72 glass-fluid gui-panel-bg border border-[var(--border-subtle)] rounded-lg shadow-xl z-50 overflow-hidden">
      {/* Header with search */}
      <div className="p-2 border-b border-[var(--border-subtle)] flex items-center gap-2">
        <Search className="w-3 h-3 text-[var(--text-muted)] flex-shrink-0" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search history..."
          className="flex-1 bg-transparent text-xs gui-text outline-none"
          autoFocus
        />
        <button onClick={onToggle} className="p-1 hover:bg-[var(--surface-panel-secondary)] rounded">
          <X className="w-3 h-3 text-[var(--text-muted)]" />
        </button>
      </div>

      {/* History list */}
      <div className="max-h-64 overflow-y-auto">
        {filteredHistory.length === 0 ? (
          <div className="p-4 text-xs text-[var(--text-muted)] text-center">
            {history.length === 0 ? 'No history yet' : 'No matching prompts'}
          </div>
        ) : (
          <div className="p-1 space-y-0.5">
            {filteredHistory.map(entry => (
              <HistoryItem
                key={entry.id}
                entry={entry}
                onSelect={handleSelect}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface HistoryItemProps {
  entry: PromptHistoryEntry
  onSelect: (entry: PromptHistoryEntry) => void
  onDelete: (id: string, e: React.MouseEvent) => void
}

function HistoryItem({ entry, onSelect, onDelete }: HistoryItemProps): JSX.Element {
  const timeAgo = formatTimeAgo(entry.lastUsed)

  return (
    <button
      onClick={() => onSelect(entry)}
      className="w-full flex items-start gap-2 p-2 hover:bg-[var(--surface-panel-secondary)] rounded text-left group"
    >
      <Clock className="w-3 h-3 text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs gui-text line-clamp-2">{entry.prompt}</div>
        <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
          {timeAgo} &bull; Used {entry.appliedCount}x
          {entry.triggerType && ` \u2022 ${entry.triggerType}`}
        </div>
      </div>
      <button
        onClick={e => onDelete(entry.id, e)}
        className="p-1 opacity-0 group-hover:opacity-100 hover:bg-[var(--surface-panel-secondary)] rounded"
      >
        <Trash2 className="w-3 h-3 text-[var(--text-secondary)]" />
      </button>
    </button>
  )
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export const PromptHistoryDropdown = memo(PromptHistoryDropdownComponent)
