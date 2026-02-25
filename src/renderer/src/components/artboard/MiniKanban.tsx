/**
 * MiniKanban — 3-column Kanban board (Todo | In Progress | Done).
 *
 * Used inside the ProjectNode artboard to display child TaskNodes grouped by
 * status.  Supports HTML5 drag-and-drop between columns to change status.
 *
 * Phase 3B artboard panel.
 */

import React, { memo, useCallback, useMemo, useState } from 'react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import type { NodeData } from '@shared/types'
import type { Node } from '@xyflow/react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MiniKanbanProps {
  childNodeIds: string[]
  onStatusChange?: (nodeId: string, newStatus: string) => void
  nodeColor: string
  className?: string
}

interface KanbanCard {
  id: string
  title: string
  priority?: string
  status: string
}

// ---------------------------------------------------------------------------
// Column configuration
// ---------------------------------------------------------------------------

const COLUMNS: { id: string; label: string; color: string }[] = [
  { id: 'todo', label: 'Todo', color: '#6b7280' },
  { id: 'in-progress', label: 'In Progress', color: '#f59e0b' },
  { id: 'done', label: 'Done', color: '#10b981' },
]

const PRIORITY_COLORS: Record<string, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#6b7280',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function MiniKanbanComponent({
  childNodeIds,
  onStatusChange,
  nodeColor,
  className,
}: MiniKanbanProps): JSX.Element {
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)

  // Derive card data from store — only pick the fields we need
  const cards: KanbanCard[] = useWorkspaceStore(
    useCallback(
      (state: { nodes: Node<NodeData>[] }) => {
        return childNodeIds.map((cid) => {
          const node = state.nodes.find((n) => n.id === cid)
          if (!node) return null
          const d = node.data as Record<string, unknown>
          return {
            id: cid,
            title: (d.title as string) || 'Untitled',
            priority: d.priority as string | undefined,
            status: (d.status as string) || 'todo',
          }
        }).filter(Boolean) as KanbanCard[]
      },
      [childNodeIds],
    ),
  )

  // Group cards by column
  const grouped = useMemo(() => {
    const map: Record<string, KanbanCard[]> = { todo: [], 'in-progress': [], done: [] }
    for (const card of cards) {
      const bucket = map[card.status] ? card.status : 'todo'
      ;(map[bucket] ??= []).push(card)
    }
    return map
  }, [cards])

  // Drag handlers
  const handleDragStart = useCallback(
    (cardId: string) => (e: React.DragEvent) => {
      e.dataTransfer.setData('text/plain', cardId)
      e.dataTransfer.effectAllowed = 'move'
    },
    [],
  )

  const handleDragOver = useCallback(
    (columnId: string) => (e: React.DragEvent) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setDragOverColumn(columnId)
    },
    [],
  )

  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null)
  }, [])

  const handleDrop = useCallback(
    (columnId: string) => (e: React.DragEvent) => {
      e.preventDefault()
      setDragOverColumn(null)
      const cardId = e.dataTransfer.getData('text/plain')
      if (cardId && onStatusChange) {
        onStatusChange(cardId, columnId)
      }
    },
    [onStatusChange],
  )

  return (
    <div
      className={`mini-kanban flex gap-1.5 h-full p-2 overflow-hidden ${className ?? ''}`}
      aria-label="Kanban board"
    >
      {COLUMNS.map((col) => {
        const colCards = grouped[col.id] ?? []
        const isOver = dragOverColumn === col.id
        return (
          <div
            key={col.id}
            className="mini-kanban__column flex flex-col flex-1 min-w-0 rounded overflow-hidden"
            style={{
              backgroundColor: isOver ? `${col.color}15` : 'var(--surface-sunken, #0d0d1a)',
              border: isOver ? `1px dashed ${col.color}` : '1px solid transparent',
              transition: 'background-color 150ms, border-color 150ms',
            }}
            onDragOver={handleDragOver(col.id)}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop(col.id)}
          >
            {/* Column header */}
            <div
              className="flex items-center justify-between px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: col.color }}
            >
              <span>{col.label}</span>
              <span
                className="rounded-full px-1.5 py-0.5 text-[9px]"
                style={{ backgroundColor: `${col.color}20` }}
              >
                {colCards.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 overflow-y-auto px-1 pb-1 space-y-1">
              {colCards.map((card) => (
                <div
                  key={card.id}
                  className="mini-kanban__card rounded px-2 py-1.5 text-xs cursor-grab active:cursor-grabbing hover:bg-white/5 transition-colors"
                  style={{
                    backgroundColor: 'var(--surface-panel, #1a1a2e)',
                    borderLeft: `3px solid ${nodeColor}`,
                  }}
                  draggable
                  onDragStart={handleDragStart(card.id)}
                >
                  <div className="truncate" style={{ color: 'var(--text-primary, #e0e0e0)' }}>
                    {card.title}
                  </div>
                  {card.priority && (
                    <span
                      className="inline-block mt-0.5 px-1 py-0 rounded text-[9px] font-medium"
                      style={{
                        backgroundColor: `${PRIORITY_COLORS[card.priority] ?? '#6b7280'}20`,
                        color: PRIORITY_COLORS[card.priority] ?? '#6b7280',
                      }}
                    >
                      {card.priority}
                    </span>
                  )}
                </div>
              ))}
              {colCards.length === 0 && (
                <div
                  className="text-center text-[10px] py-3"
                  style={{ color: 'var(--text-muted, #666)' }}
                >
                  Drop here
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export const MiniKanban = memo(MiniKanbanComponent)
