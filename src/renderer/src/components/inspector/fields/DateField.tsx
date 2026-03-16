/**
 * DateField — Native date input for date-type properties.
 *
 * Displays the formatted date string; clicking opens the native date picker.
 * Uses `<input type="date">` for zero-dependency simplicity.
 */

import { useCallback } from 'react'
import { cn } from '@/lib/utils'

export interface DateFieldProps {
  label: string
  value: string | number | undefined
  onChange: (value: string | undefined) => void
}

/** Convert a timestamp (ms), ISO string, or YYYY-MM-DD to an input-compatible YYYY-MM-DD string. */
function toInputDate(value: string | number | undefined): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'number') {
    // Unix timestamp in milliseconds
    const d = new Date(value)
    return d.toISOString().slice(0, 10)
  }
  // Already a date string — pass through (handles both ISO and YYYY-MM-DD)
  if (typeof value === 'string' && value.length >= 10) {
    return value.slice(0, 10)
  }
  return String(value)
}

export function DateField({ label, value, onChange }: DateFieldProps): JSX.Element {
  const inputValue = toInputDate(value)

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value
      onChange(v || undefined)
    },
    [onChange],
  )

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-[var(--text-secondary)] shrink-0">
        {label}
      </span>
      <input
        type="date"
        value={inputValue}
        onChange={handleChange}
        className={cn(
          'h-[26px] max-w-[140px] px-2 py-0',
          'text-[11px] text-[var(--text-primary)]',
          'bg-transparent border border-[var(--border-subtle)] rounded',
          'outline-none',
          'focus:ring-1 focus:ring-[var(--accent-primary)]',
          'transition-shadow duration-[var(--duration-fast)]',
          // Style the native date picker to match dark themes
          '[color-scheme:dark]',
        )}
      />
    </div>
  )
}
