// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { ArrowRight, ArrowUp, Minus } from 'lucide-react'
import { memo, useCallback } from 'react'

const PRIORITY_CYCLE = ['none', 'low', 'medium', 'high'] as const
const PRIORITY_COLORS: Record<string, string> = {
  none: '#6b7280',
  low: '#6b7280',
  medium: '#f59e0b',
  high: '#ef4444',
}

interface PriorityIconProps {
  value: string
  onChange: (value: string) => void
}

export const PriorityIcon = memo(function PriorityIcon({ value, onChange }: PriorityIconProps) {
  const color = PRIORITY_COLORS[value] || PRIORITY_COLORS.none

  const cycle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      const idx = PRIORITY_CYCLE.indexOf(value as (typeof PRIORITY_CYCLE)[number])
      const next = PRIORITY_CYCLE[(idx + 1) % PRIORITY_CYCLE.length]
      onChange(next)
    },
    [value, onChange],
  )

  const Icon =
    value === 'high' ? ArrowUp : value === 'medium' ? ArrowRight : value === 'low' ? Minus : null

  if (!Icon) {
    // 'none' — render an empty placeholder button
    return (
      <button
        onClick={cycle}
        onMouseDown={(e) => e.stopPropagation()}
        className="inline-flex items-center justify-center w-5 h-5 rounded transition-opacity hover:opacity-100 hover:bg-white/10"
        style={{ opacity: 0.4, color }}
        title="Priority: none (click to cycle)"
      >
        <Minus className="w-3 h-3" style={{ opacity: 0.3 }} />
      </button>
    )
  }

  return (
    <button
      onClick={cycle}
      onMouseDown={(e) => e.stopPropagation()}
      className="inline-flex items-center justify-center w-5 h-5 rounded transition-opacity hover:opacity-100"
      style={{ color, opacity: 0.75 }}
      title={`Priority: ${value} (click to cycle)`}
    >
      <Icon className="w-3 h-3" />
    </button>
  )
})
