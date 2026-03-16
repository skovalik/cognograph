/**
 * TextField — Inline text input with debounced onChange.
 *
 * For free-text properties like assignee, model, provider, etc.
 * Debounces updates to 300ms to avoid excessive store writes.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'

export interface TextFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
}

export function TextField({ label, value, onChange }: TextFieldProps): JSX.Element {
  const [local, setLocal] = useState(value)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync external value changes
  useEffect(() => {
    setLocal(value)
  }, [value])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value
      setLocal(next)

      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        onChange(next)
      }, 300)
    },
    [onChange],
  )

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-[var(--text-secondary)] shrink-0">
        {label}
      </span>
      <input
        type="text"
        value={local}
        onChange={handleChange}
        placeholder="\u2014"
        className={cn(
          'h-[26px] max-w-[180px] px-2 py-0',
          'text-[11px] text-[var(--text-primary)] text-right',
          'bg-transparent border border-[var(--border-subtle)] rounded',
          'outline-none',
          'focus:ring-1 focus:ring-[var(--accent-primary)]',
          'placeholder:text-[var(--text-secondary)]',
          'transition-shadow duration-[var(--duration-fast)]',
        )}
      />
    </div>
  )
}
