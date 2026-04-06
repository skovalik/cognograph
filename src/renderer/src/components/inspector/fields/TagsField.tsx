// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * TagsField — Multi-select tag pills with inline add.
 *
 * Shows existing tags as pills. Click a tag to remove it.
 * The "+" button reveals a text input for adding a new tag.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export interface TagsFieldProps {
  label: string
  value: string[]
  onChange: (tags: string[]) => void
}

export function TagsField({ label, value, onChange }: TagsFieldProps): JSX.Element {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus the input when add mode is activated
  useEffect(() => {
    if (adding && inputRef.current) {
      inputRef.current.focus()
    }
  }, [adding])

  const handleRemove = useCallback(
    (tag: string) => {
      onChange(value.filter((t) => t !== tag))
    },
    [value, onChange],
  )

  const handleAdd = useCallback(() => {
    const trimmed = draft.trim()
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed])
    }
    setDraft('')
    setAdding(false)
  }, [draft, value, onChange])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleAdd()
      } else if (e.key === 'Escape') {
        setDraft('')
        setAdding(false)
      }
    },
    [handleAdd],
  )

  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-[11px] text-[var(--text-secondary)] shrink-0 pt-1">{label}</span>
      <div className="flex flex-wrap items-center gap-1 justify-end max-w-[200px]">
        {value.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => handleRemove(tag)}
            title={`Remove "${tag}"`}
            className={cn(
              'inline-flex items-center gap-0.5 px-1.5 py-0.5',
              'text-[10px] leading-tight rounded',
              'bg-[var(--accent-primary)]/15 text-[var(--text-primary)]',
              'hover:bg-[var(--accent-primary)]/30',
              'transition-colors duration-[var(--duration-fast)]',
              'cursor-pointer',
            )}
          >
            {tag}
            <span className="text-[var(--text-secondary)] ml-0.5">&times;</span>
          </button>
        ))}

        {adding ? (
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={handleAdd}
            onKeyDown={handleKeyDown}
            placeholder="tag"
            className={cn(
              'h-[22px] w-[60px] px-1 py-0',
              'text-[10px] text-[var(--text-primary)]',
              'bg-transparent border border-[var(--border-subtle)] rounded',
              'outline-none',
              'focus:ring-1 focus:ring-[var(--accent-primary)]',
            )}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className={cn(
              'inline-flex items-center justify-center',
              'w-[20px] h-[20px] rounded',
              'text-[12px] text-[var(--text-secondary)]',
              'border border-dashed border-[var(--border-subtle)]',
              'hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)]',
              'transition-colors duration-[var(--duration-fast)]',
              'cursor-pointer',
            )}
            title="Add tag"
          >
            +
          </button>
        )}

        {value.length === 0 && !adding && (
          <span className="text-[11px] text-[var(--text-secondary)]">{'\u2014'}</span>
        )}
      </div>
    </div>
  )
}
