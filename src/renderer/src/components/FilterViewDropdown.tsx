// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * FilterViewDropdown - Filter which node types are visible on canvas
 *
 * ND-friendly feature: Reduces visual overwhelm by hiding irrelevant nodes.
 * "Just show me the tasks" or "Hide all notes" for focused work.
 */

import type { NodeData } from '@shared/types'
import { ChevronUp, Eye, EyeOff, Filter } from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { EscapePriority, escapeManager } from '../utils/EscapeManager'

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
  { type: 'orchestrator', label: 'Orchestrators', color: 'var(--node-orchestrator)' },
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
  const nodeCounts = nodes.reduce(
    (acc, node) => {
      acc[node.data.type] = (acc[node.data.type] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

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
    const closeDropdown = () => setIsOpen(false)
    escapeManager.register('popover-filter-view', EscapePriority.POPOVER, closeDropdown)
    return () => escapeManager.unregister('popover-filter-view')
  }, [isOpen])

  const handleToggle = useCallback(
    (type: NodeData['type']) => {
      toggleNodeTypeVisibility(type)
    },
    [toggleNodeTypeVisibility],
  )

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button — matches AgentLogBadge (canvas-badge glass-soft). */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="canvas-badge glass-soft"
        style={
          hasHidden
            ? {
                color: 'var(--gui-accent-secondary)',
                borderColor: 'color-mix(in srgb, var(--gui-accent-secondary) 40%, transparent)',
              }
            : undefined
        }
        title={
          hasHidden
            ? `${hiddenCount} type${hiddenCount !== 1 ? 's' : ''} hidden`
            : 'Filter node types'
        }
      >
        <Filter className="w-3.5 h-3.5" />
        Filter
        {hasHidden && <span style={{ color: 'var(--accent-glow)' }}>({hiddenCount})</span>}
        {/* ChevronUp because the menu opens above the button — when open,
            the rotate-180 flips it to point down toward the collapse direction. */}
        <ChevronUp className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown menu - opens ABOVE since button is at bottom of screen.
          Outer wrapper owns positioning; inner div owns glass styling. The
          html[data-glass-style="fluid-glass"] override in glass.css:295
          forces .glass-soft to `position: relative`, which would drop our
          absolute positioning. Keeping them on separate elements avoids
          that collision. */}
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-1 w-52 gui-z-dropdowns">
          <div
            className="glass-soft rounded-lg overflow-hidden shadow-xl animate-fade-in"
            style={{
              border: '1px solid var(--gui-border-subtle)',
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
                        color: 'var(--gui-text-muted)',
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
        </div>
      )}
    </div>
  )
}

export const FilterViewDropdown = memo(FilterViewDropdownComponent)
