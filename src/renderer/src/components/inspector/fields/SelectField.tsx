// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * SelectField — Compact dropdown for enum-type properties.
 *
 * Uses the existing Radix Select wrapper from `@/components/ui/select`.
 * Shows the current value with an optional color dot indicator.
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
  color?: string
}

export interface SelectFieldProps {
  nodeId: string
  fieldId: string
  label: string
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
}

export function SelectField({
  fieldId,
  label,
  value,
  options,
  onChange,
}: SelectFieldProps): JSX.Element {
  const current = options.find((o) => o.value === value)

  return (
    <div
      className="flex items-center justify-between gap-2"
      data-testid={`inspector-field-${fieldId}`}
    >
      <span className="text-[11px] text-[var(--text-secondary)] shrink-0">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          className={cn(
            'h-[26px] min-w-[100px] max-w-[180px] px-2 py-0',
            'text-[11px] text-[var(--text-primary)]',
            'border-[var(--border-subtle)] bg-transparent',
            'focus:ring-1 focus:ring-[var(--accent-primary)]',
            'rounded',
          )}
        >
          <span className="flex items-center gap-1.5 truncate">
            {current?.color && (
              <span
                className="inline-block w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: current.color }}
              />
            )}
            <SelectValue placeholder="Select..." />
          </span>
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-[11px]">
              <span className="flex items-center gap-1.5">
                {opt.color && (
                  <span
                    className="inline-block w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: opt.color }}
                  />
                )}
                {opt.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
