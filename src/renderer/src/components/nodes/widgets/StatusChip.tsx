// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { memo, useCallback } from 'react'

const STATUS_CYCLE = ['todo', 'in-progress', 'done'] as const
const STATUS_COLORS: Record<string, string> = {
  todo: '#6b7280',
  'in-progress': '#f59e0b',
  done: '#22c55e',
}
const STATUS_LABELS: Record<string, string> = {
  todo: 'To Do',
  'in-progress': 'In Progress',
  done: 'Done',
}

interface StatusChipProps {
  value: string
  onChange: (value: string) => void
}

export const StatusChip = memo(function StatusChip({ value, onChange }: StatusChipProps) {
  const color = STATUS_COLORS[value] || STATUS_COLORS.todo
  const label = STATUS_LABELS[value] || value

  const cycle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      const idx = STATUS_CYCLE.indexOf(value as (typeof STATUS_CYCLE)[number])
      const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
      onChange(next)
    },
    [value, onChange],
  )

  return (
    <button
      onClick={cycle}
      onMouseDown={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 h-5 px-1.5 rounded text-[10px] font-medium transition-opacity hover:opacity-100"
      style={{
        backgroundColor: `${color}20`,
        color,
        opacity: 0.75,
      }}
      title={`Status: ${label} (click to cycle)`}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      {label}
    </button>
  )
})
