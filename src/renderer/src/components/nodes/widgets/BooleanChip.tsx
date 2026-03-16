// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { memo, useCallback } from 'react'

interface BooleanChipProps {
  value: boolean
  onChange: (value: boolean) => void
  fieldName?: string
}

export const BooleanChip = memo(function BooleanChip({
  value,
  onChange,
  fieldName,
}: BooleanChipProps) {
  const toggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    onChange(!value)
  }, [value, onChange])

  const color = value ? '#22c55e' : '#6b7280'

  return (
    <button
      onClick={toggle}
      onMouseDown={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 h-5 px-1.5 rounded text-[10px] font-medium transition-opacity hover:opacity-100"
      style={{
        backgroundColor: `${color}20`,
        color,
        opacity: 0.75,
      }}
      title={`${fieldName || 'Toggle'}: ${value ? 'on' : 'off'} (click to toggle)`}
    >
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      {value ? 'On' : 'Off'}
    </button>
  )
})
