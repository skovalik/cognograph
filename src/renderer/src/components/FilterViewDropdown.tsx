/**
 * FilterViewDropdown - Filter which node types are visible on canvas
 *
 * ND-friendly feature: Reduces visual overwhelm by hiding irrelevant nodes.
 * "Just show me the tasks" or "Hide all notes" for focused work.
 */

import { memo, useState, useCallback, useRef, useEffect } from 'react'
import { Filter, Eye, EyeOff, ChevronDown } from 'lucide-react'
import { useWorkspaceStore } from '../stores/workspaceStore'
import type { NodeData } from '@shared/types'

// Node type display info
const NODE_TYPES: Array<{ type: NodeData['type']; label: string; color: string }> = [
  { type: 'conversation', label: 'Conversations', color: 'var(--node-conversation)' },
  { type: 'note', label: 'Notes', color: 'var(--node-note)' },
  { type: 'task', label: 'Tasks', color: 'var(--node-task)' },
  { type: 'project', label: 'Projects', color: 'var(--node-project)' },
  { type: 'artifact', label: 'Artifacts', color: 'var(--node-artifact)' },
  { type: 'workspace', label: 'Workspaces', color: 'var(--node-workspace)' },
  { type: 'text', label: 'Text', color: 'var(--node-text)' },
  { type: 'action', label: 'Actions', color: 'var(--node-action)' },
  { type: 'orchestrator', label: 'Orchestrators', color: 'var(--node-orchestrator)' }
]

function FilterViewDropdownComponent(): JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const hiddenNodeTypes = useWorkspaceStore((state) => state.hiddenNodeTypes)
  const toggleNodeTypeVisibility = useWorkspaceStore((state) => state.toggleNodeTypeVisibility)
  const showAllNodeTypes = useWorkspaceStore((state) => state.showAllNodeTypes)
  const hideAllNodeTypes = useWorkspaceStore((state) => state.hideAllNodeTypes)
  const nodes = useWorkspaceStore((state) => state.nodes)

  // Count nodes by type
  const nodeCounts = nodes.reduce((acc, node) => {
    acc[node.data.type] = (acc[node.data.type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // How many types are hidden
  const hiddenCount = hiddenNodeTypes.size
  const hasHidden = hiddenCount > 0

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent): void => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as globalThis.Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Close on escape
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const handleToggle = useCallback((type: NodeData['type']) => {
    toggleNodeTypeVisibility(type)
  }, [toggleNodeTypeVisibility])

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs transition-colors border gui-panel-bg"
        style={{
          color: hasHidden ? 'var(--gui-accent-secondary)' : 'var(--gui-text-secondary)',
          backgroundColor: hasHidden ? 'color-mix(in srgb, var(--gui-accent-secondary) 15%, transparent)' : undefined,
          borderColor: hasHidden ? 'color-mix(in srgb, var(--gui-accent-secondary) 40%, transparent)' : 'var(--gui-border-subtle)'
        }}
        onMouseEnter={(e) => {
          if (!hasHidden) {
            e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--gui-text-primary) 5%, transparent)'
          }
        }}
        onMouseLeave={(e) => {
          if (!hasHidden) {
            e.currentTarget.style.backgroundColor = ''
          }
        }}
        title={hasHidden ? `${hiddenCount} type${hiddenCount !== 1 ? 's' : ''} hidden` : 'Filter node types'}
      >
        <Filter className="w-3.5 h-3.5" style={{ color: 'inherit' }} />
        <span className="hidden sm:inline" style={{ color: 'inherit' }}>Filter</span>
        {hasHidden && (
          <span
            className="px-1 py-0.5 rounded text-[10px] font-medium"
            style={{ backgroundColor: 'var(--gui-bg-tertiary)' }}
          >
            {hiddenCount}
          </span>
        )}
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} style={{ color: 'inherit' }} />
      </button>

      {/* Dropdown menu - opens ABOVE since button is at bottom of screen */}
      {isOpen && (
        <div
          className="absolute bottom-full left-0 mb-1 w-52 glass-fluid rounded-lg overflow-hidden shadow-xl animate-fade-in gui-z-dropdowns"
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
            <span className="text-xs font-medium" style={{ color: 'var(--gui-text-primary)' }}>
              Show Node Types
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={showAllNodeTypes}
                className="px-1.5 py-0.5 rounded text-[10px] hover:bg-white/10 transition-colors"
                style={{ color: 'var(--gui-text-muted)' }}
                title="Show all"
              >
                All
              </button>
              <button
                onClick={hideAllNodeTypes}
                className="px-1.5 py-0.5 rounded text-[10px] hover:bg-white/10 transition-colors"
                style={{ color: 'var(--gui-text-muted)' }}
                title="Hide all"
              >
                None
              </button>
            </div>
          </div>

          {/* Type list */}
          <div className="p-1">
            {NODE_TYPES.map(({ type, label, color }) => {
              const isHidden = hiddenNodeTypes.has(type)
              const count = nodeCounts[type] || 0

              return (
                <button
                  key={type}
                  onClick={() => handleToggle(type)}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-left hover:bg-white/5 transition-colors"
                >
                  {/* Visibility toggle */}
                  {isHidden ? (
                    <EyeOff className="w-3.5 h-3.5" style={{ color: 'var(--gui-text-muted)' }} />
                  ) : (
                    <Eye className="w-3.5 h-3.5" style={{ color: 'var(--gui-accent-primary)' }} />
                  )}

                  {/* Type indicator */}
                  <div
                    className={`w-2 h-2 rounded-full ${isHidden ? 'opacity-30' : ''}`}
                    style={{ backgroundColor: color }}
                  />

                  {/* Label */}
                  <span
                    className={`flex-1 text-xs ${isHidden ? 'line-through opacity-50' : ''}`}
                    style={{ color: 'var(--gui-text-primary)' }}
                  >
                    {label}
                  </span>

                  {/* Count */}
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: 'var(--gui-bg-tertiary)',
                      color: 'var(--gui-text-muted)'
                    }}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Footer hint */}
          {hasHidden && (
            <div
              className="px-3 py-2 text-[10px] border-t"
              style={{ borderColor: 'var(--gui-border-subtle)', color: 'var(--gui-text-muted)' }}
            >
              Hidden nodes are preserved but not visible
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export const FilterViewDropdown = memo(FilterViewDropdownComponent)
