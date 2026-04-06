// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * BooleanField — Toggle for boolean properties.
 *
 * Compact inline toggle using a styled checkbox appearance
 * that fits the 26px row height of the inspector.
 */

import { useCallback } from 'react'
import { cn } from '@/lib/utils'

export interface BooleanFieldProps {
  label: string
  value: boolean
  onChange: (value: boolean) => void
}

export function BooleanField({ label, value, onChange }: BooleanFieldProps): JSX.Element {
  const handleToggle = useCallback(() => {
    onChange(!value)
  }, [value, onChange])

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-[var(--text-secondary)] shrink-0">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={handleToggle}
        className={cn(
          'relative inline-flex h-[18px] w-[32px] shrink-0',
          'items-center rounded-full',
          'border-2 border-transparent',
          'transition-colors duration-[var(--duration-fast)]',
          'cursor-pointer',
          'focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]',
          value ? 'bg-[var(--accent-primary)]' : 'bg-[var(--border-subtle)]',
        )}
      >
        <span
          className={cn(
            'inline-block h-[14px] w-[14px] rounded-full bg-white shadow-sm',
            'transition-transform duration-[var(--duration-fast)]',
            value ? 'translate-x-[14px]' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  )
}
