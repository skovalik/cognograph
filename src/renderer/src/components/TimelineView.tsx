/**
 * TimelineView - Alternative view showing nodes arranged by time
 *
 * ND-friendly feature: "Show me what I did this week"
 * Time-based spatial memory complement to free-form canvas.
 *
 * Displays nodes on a horizontal timeline based on creation/modification date.
 * Does NOT modify actual node positions - purely a visualization overlay.
 */

import { memo, useState, useMemo, useCallback } from 'react'
import { Clock, X, Calendar, Activity, ChevronLeft, ChevronRight } from 'lucide-react'
import { useReactFlow } from '@xyflow/react'
import { useWorkspaceStore } from '../stores/workspaceStore'
import type { Node } from '@xyflow/react'
import type { NodeData } from '@shared/types'

// Time groupings
type TimeGroup = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'older'

const TIME_GROUP_LABELS: Record<TimeGroup, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  thisWeek: 'This Week',
  lastWeek: 'Last Week',
  thisMonth: 'This Month',
  older: 'Older'
}

// Node type colors
const NODE_COLORS: Record<string, string> = {
  conversation: 'var(--node-conversation)',
  note: 'var(--node-note)',
  task: 'var(--node-task)',
  project: 'var(--node-project)',
  artifact: 'var(--node-artifact)',
  workspace: 'var(--node-workspace)',
  text: 'var(--node-text)',
  action: 'var(--node-action)'
}

interface TimelineViewProps {
  isOpen: boolean
  onClose: () => void
}

function getTimeGroup(timestamp: number): TimeGroup {
  const now = new Date()
  const date = new Date(timestamp)

  // Today
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (date >= today) return 'today'

  // Yesterday
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date >= yesterday) return 'yesterday'

  // This week (last 7 days)
  const thisWeekStart = new Date(today)
  thisWeekStart.setDate(thisWeekStart.getDate() - 7)
  if (date >= thisWeekStart) return 'thisWeek'

  // Last week (7-14 days ago)
  const lastWeekStart = new Date(today)
  lastWeekStart.setDate(lastWeekStart.getDate() - 14)
  if (date >= lastWeekStart) return 'lastWeek'

  // This month
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  if (date >= thisMonthStart) return 'thisMonth'

  return 'older'
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function TimelineViewComponent({ isOpen, onClose }: TimelineViewProps): JSX.Element | null {
  const { setCenter } = useReactFlow()
  const nodes = useWorkspaceStore((state) => state.nodes)
  const setSelectedNodes = useWorkspaceStore((state) => state.setSelectedNodes)
  const nodeUpdatedAt = useWorkspaceStore((state) => state.nodeUpdatedAt)

  const [sortBy, setSortBy] = useState<'modified' | 'created'>('modified')
  const [expandedGroup, setExpandedGroup] = useState<TimeGroup | null>('today')

  // Get timestamp for sorting
  const getTimestamp = useCallback((node: Node<NodeData>): number => {
    if (sortBy === 'modified') {
      // Check nodeUpdatedAt map first
      const updated = nodeUpdatedAt.get(node.id)
      if (updated) return updated
      // Fall back to data timestamps
      const data = node.data as { updatedAt?: number; createdAt?: number }
      return data.updatedAt || data.createdAt || 0
    }
    // Created time
    const data = node.data as { createdAt?: number }
    return data.createdAt || 0
  }, [sortBy, nodeUpdatedAt])

  // Group and sort nodes by time
  const groupedNodes = useMemo(() => {
    const groups: Record<TimeGroup, Array<{ node: Node<NodeData>; timestamp: number }>> = {
      today: [],
      yesterday: [],
      thisWeek: [],
      lastWeek: [],
      thisMonth: [],
      older: []
    }

    nodes.forEach(node => {
      const timestamp = getTimestamp(node)
      if (timestamp === 0) return // Skip nodes without timestamps

      const group = getTimeGroup(timestamp)
      groups[group].push({ node, timestamp })
    })

    // Sort each group by timestamp (most recent first)
    Object.keys(groups).forEach(key => {
      groups[key as TimeGroup].sort((a, b) => b.timestamp - a.timestamp)
    })

    return groups
  }, [nodes, getTimestamp])

  // Navigate to node on canvas
  const handleNodeClick = useCallback((node: Node<NodeData>) => {
    const x = node.position.x + ((node.width || 280) / 2)
    const y = node.position.y + ((node.height || 120) / 2)
    setCenter(x, y, { duration: 300, zoom: 1 })
    setSelectedNodes([node.id])
    onClose()
  }, [setCenter, setSelectedNodes, onClose])

  // Toggle group expansion
  const toggleGroup = useCallback((group: TimeGroup) => {
    setExpandedGroup(prev => prev === group ? null : group)
  }, [])

  if (!isOpen) return null

  const groupOrder: TimeGroup[] = ['today', 'yesterday', 'thisWeek', 'lastWeek', 'thisMonth', 'older']
  const hasNodes = nodes.some(n => getTimestamp(n) > 0)

  return (
    <div
      className="fixed inset-0 gui-z-modals flex items-center justify-center animate-fade-in"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-[700px] max-h-[80vh] rounded-lg overflow-hidden animate-scale-in"
        style={{
          backgroundColor: 'var(--gui-bg-secondary)',
          border: '1px solid var(--gui-border-subtle)'
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'var(--gui-border-subtle)' }}
        >
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5" style={{ color: 'var(--gui-accent-primary)' }} />
            <h2 className="text-lg font-medium" style={{ color: 'var(--gui-text-primary)' }}>
              Timeline View
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Sort toggle */}
            <div className="flex items-center gap-1 text-xs">
              <button
                onClick={() => setSortBy('modified')}
                className={`px-2 py-1 rounded transition-colors ${
                  sortBy === 'modified' ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
                style={{ color: sortBy === 'modified' ? 'var(--gui-accent-primary)' : 'var(--gui-text-muted)' }}
              >
                <Activity className="w-3.5 h-3.5 inline mr-1" />
                Modified
              </button>
              <button
                onClick={() => setSortBy('created')}
                className={`px-2 py-1 rounded transition-colors ${
                  sortBy === 'created' ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
                style={{ color: sortBy === 'created' ? 'var(--gui-accent-primary)' : 'var(--gui-text-muted)' }}
              >
                <Calendar className="w-3.5 h-3.5 inline mr-1" />
                Created
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-white/10 transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" style={{ color: 'var(--gui-text-muted)' }} />
            </button>
          </div>
        </div>

        {/* Timeline content */}
        <div className="p-4 overflow-y-auto max-h-[calc(80vh-60px)]">
          {hasNodes ? (
            <div className="space-y-2">
              {groupOrder.map(group => {
                const items = groupedNodes[group]
                if (items.length === 0) return null

                const isExpanded = expandedGroup === group

                return (
                  <div key={group}>
                    {/* Group header */}
                    <button
                      onClick={() => toggleGroup(group)}
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-white/5 transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronLeft className="w-4 h-4 rotate-[-90deg]" style={{ color: 'var(--gui-text-muted)' }} />
                      ) : (
                        <ChevronRight className="w-4 h-4" style={{ color: 'var(--gui-text-muted)' }} />
                      )}
                      <span className="text-sm font-medium" style={{ color: 'var(--gui-text-primary)' }}>
                        {TIME_GROUP_LABELS[group]}
                      </span>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: 'var(--gui-bg-tertiary)',
                          color: 'var(--gui-text-muted)'
                        }}
                      >
                        {items.length}
                      </span>
                    </button>

                    {/* Group items */}
                    {isExpanded && (
                      <div className="ml-6 mt-1 space-y-1">
                        {items.map(({ node, timestamp }) => {
                          const data = node.data
                          const title = 'title' in data ? (data.title as string) : `Untitled ${data.type}`

                          return (
                            <button
                              key={node.id}
                              onClick={() => handleNodeClick(node)}
                              className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-white/5 transition-colors text-left"
                            >
                              {/* Node type indicator */}
                              <div
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: NODE_COLORS[data.type] || '#666' }}
                              />

                              {/* Title */}
                              <span
                                className="flex-1 text-sm truncate"
                                style={{ color: 'var(--gui-text-primary)' }}
                              >
                                {title}
                              </span>

                              {/* Time */}
                              <span
                                className="text-[10px] flex-shrink-0"
                                style={{ color: 'var(--gui-text-muted)' }}
                              >
                                {group === 'today' || group === 'yesterday'
                                  ? formatTime(timestamp)
                                  : formatDate(timestamp)}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div
              className="flex flex-col items-center justify-center py-12"
              style={{ color: 'var(--gui-text-muted)' }}
            >
              <Clock className="w-12 h-12 mb-3 opacity-30" />
              <span className="text-sm">No timestamped nodes</span>
              <span className="text-xs mt-1 opacity-70">
                Nodes will appear here as you create them
              </span>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div
          className="px-4 py-2 text-[10px] border-t text-center"
          style={{ borderColor: 'var(--gui-border-subtle)', color: 'var(--gui-text-muted)' }}
        >
          Click a node to navigate to its position on the canvas
        </div>
      </div>
    </div>
  )
}

export const TimelineView = memo(TimelineViewComponent)
