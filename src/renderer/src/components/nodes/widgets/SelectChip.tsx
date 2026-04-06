// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { memo, useCallback } from 'react'

interface SelectChipProps {
  value: string
  options: string[]
  labels?: Record<string, string>
  onChange: (value: string) => void
  fieldName?: string
}

export const SelectChip = memo(function SelectChip({
  value,
  options,
  labels,
  onChange,
  fieldName,
}: SelectChipProps) {
  const displayLabel = labels?.[value] || value

  const cycle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      const idx = options.indexOf(value)
      const next = options[(idx + 1) % options.length]
      onChange(next)
    },
    [value, options, onChange],
  )

  return (
    <button
      onClick={cycle}
      onMouseDown={(e) => e.stopPropagation()}
      className="inline-flex items-center h-5 px-1.5 rounded text-[10px] font-medium transition-opacity hover:opacity-100"
      style={{
        backgroundColor: 'var(--node-bg-secondary, rgba(255,255,255,0.08))',
        color: 'var(--node-text-secondary, #9ca3af)',
        opacity: 0.75,
      }}
      title={`${fieldName || 'Field'}: ${displayLabel} (click to cycle)`}
    >
      {displayLabel}
    </button>
  )
})
