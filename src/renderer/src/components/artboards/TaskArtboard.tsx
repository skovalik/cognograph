// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * TaskArtboard — Expanded task editing panel for ArtboardOverlay.
 *
 * Shows the full description editor, status/priority/complexity controls,
 * due date, and checklist — everything from L3 but with room to breathe.
 */

import { memo, useCallback, useMemo } from 'react'
import { CheckSquare, Calendar, Flag, Layers, AlertCircle } from 'lucide-react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useNodesStore } from '../../stores/nodesStore'
import { RichTextEditor } from '../RichTextEditor'
import type { TaskNodeData } from '@shared/types'

interface TaskArtboardProps {
  nodeId: string
}

// Status options with colors
const STATUS_OPTIONS = [
  { value: 'todo', label: 'To Do', color: '#6b7280' },
  { value: 'in-progress', label: 'In Progress', color: '#f59e0b' },
  { value: 'done', label: 'Done', color: '#22c55e' },
] as const

// Priority options
const PRIORITY_OPTIONS = [
  { value: 'none', label: 'None', color: '#6b7280' },
  { value: 'low', label: 'Low', color: '#3b82f6' },
  { value: 'medium', label: 'Medium', color: '#f59e0b' },
  { value: 'high', label: 'High', color: '#ef4444' },
] as const

// Complexity options
const COMPLEXITY_OPTIONS = [
  { value: 'trivial', label: 'Trivial' },
  { value: 'simple', label: 'Simple' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'complex', label: 'Complex' },
  { value: 'very-complex', label: 'Very Complex' },
] as const

function TaskArtboardComponent({ nodeId }: TaskArtboardProps): JSX.Element {
  const nodes = useNodesStore((s) => s.nodes)
  const updateNode = useWorkspaceStore((s) => s.updateNode)

  const node = nodes.find((n) => n.id === nodeId)
  const nodeData = node?.data as TaskNodeData | undefined

  const handleDescriptionChange = useCallback(
    (html: string) => {
      updateNode(nodeId, { description: html })
    },
    [nodeId, updateNode]
  )

  const handleStatusChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateNode(nodeId, { status: e.target.value as TaskNodeData['status'] })
    },
    [nodeId, updateNode]
  )

  const handlePriorityChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateNode(nodeId, { priority: e.target.value as TaskNodeData['priority'] })
    },
    [nodeId, updateNode]
  )

  const handleComplexityChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateNode(nodeId, { complexity: e.target.value as TaskNodeData['complexity'] })
    },
    [nodeId, updateNode]
  )

  const handleDueDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      updateNode(nodeId, { dueDate: value ? new Date(value).getTime() : undefined })
    },
    [nodeId, updateNode]
  )

  // Format due date for input
  const dueDateValue = useMemo(() => {
    if (!nodeData?.dueDate) return ''
    const d = new Date(nodeData.dueDate)
    return d.toISOString().split('T')[0]
  }, [nodeData?.dueDate])

  const isOverdue = nodeData?.dueDate ? nodeData.dueDate < Date.now() && nodeData.status !== 'done' : false

  // Status color for progress bar
  const statusColor = nodeData?.status === 'done' ? '#22c55e' : nodeData?.status === 'in-progress' ? '#f59e0b' : '#6b7280'
  const progressPct = nodeData?.status === 'done' ? 100 : nodeData?.status === 'in-progress' ? 50 : 0

  if (!nodeData) {
    return (
      <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--gui-text-muted)' }}>
        Node not found
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Controls bar */}
      <div
        className="flex items-center gap-4 px-5 py-3 flex-wrap shrink-0"
        style={{ borderBottom: '1px solid var(--gui-border)' }}
      >
        {/* Status */}
        <label className="flex items-center gap-1.5 text-xs">
          <CheckSquare className="w-3.5 h-3.5" style={{ color: statusColor }} />
          <span style={{ color: 'var(--gui-text-muted)' }}>Status</span>
          <select
            value={nodeData.status}
            onChange={handleStatusChange}
            className="text-xs px-2 py-1 rounded-md border-0 outline-none"
            style={{
              backgroundColor: 'var(--gui-bg-secondary)',
              color: 'var(--gui-text-primary)',
              cursor: 'pointer'
            }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        {/* Priority */}
        <label className="flex items-center gap-1.5 text-xs">
          <Flag className="w-3.5 h-3.5" style={{ color: 'var(--gui-text-muted)' }} />
          <span style={{ color: 'var(--gui-text-muted)' }}>Priority</span>
          <select
            value={nodeData.priority || 'none'}
            onChange={handlePriorityChange}
            className="text-xs px-2 py-1 rounded-md border-0 outline-none"
            style={{
              backgroundColor: 'var(--gui-bg-secondary)',
              color: 'var(--gui-text-primary)',
              cursor: 'pointer'
            }}
          >
            {PRIORITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        {/* Complexity */}
        <label className="flex items-center gap-1.5 text-xs">
          <Layers className="w-3.5 h-3.5" style={{ color: 'var(--gui-text-muted)' }} />
          <span style={{ color: 'var(--gui-text-muted)' }}>Complexity</span>
          <select
            value={nodeData.complexity || 'moderate'}
            onChange={handleComplexityChange}
            className="text-xs px-2 py-1 rounded-md border-0 outline-none"
            style={{
              backgroundColor: 'var(--gui-bg-secondary)',
              color: 'var(--gui-text-primary)',
              cursor: 'pointer'
            }}
          >
            {COMPLEXITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        {/* Due Date */}
        <label className="flex items-center gap-1.5 text-xs">
          <Calendar className="w-3.5 h-3.5" style={{ color: isOverdue ? '#ef4444' : 'var(--gui-text-muted)' }} />
          <span style={{ color: isOverdue ? '#ef4444' : 'var(--gui-text-muted)' }}>Due</span>
          <input
            type="date"
            value={dueDateValue}
            onChange={handleDueDateChange}
            className="text-xs px-2 py-1 rounded-md border-0 outline-none"
            style={{
              backgroundColor: 'var(--gui-bg-secondary)',
              color: isOverdue ? '#ef4444' : 'var(--gui-text-primary)',
              cursor: 'pointer'
            }}
          />
          {isOverdue && (
            <AlertCircle className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
          )}
        </label>
      </div>

      {/* Description editor — main content area */}
      <div className="flex-1 overflow-auto px-5 py-4">
        <RichTextEditor
          value={nodeData.description || ''}
          onChange={handleDescriptionChange}
          placeholder="Add a detailed description..."
          enableLists={true}
          enableFormatting={true}
          enableHeadings={true}
          showToolbar={true}
          minHeight={200}
        />
      </div>

      {/* Progress bar at bottom */}
      <div className="h-1 shrink-0" style={{ backgroundColor: 'var(--gui-bg-secondary)' }}>
        <div
          className="h-full transition-all duration-300"
          style={{
            width: `${progressPct}%`,
            backgroundColor: statusColor,
          }}
        />
      </div>
    </div>
  )
}

export const TaskArtboard = memo(TaskArtboardComponent)
