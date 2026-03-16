/**
 * CanvasTab — Compact canvas controls for the SettingsPopover.
 *
 * 3 sections, max 3 visible controls:
 *   1. Canvas Background (color swatch + hex input)
 *   2. Grid Style (3-option button group: Dots / Lines / None)
 *   3. Grid Color (color swatch + hex input)
 *
 * All changes apply immediately via the workspace store — no save button.
 */

import { memo, useCallback, useState } from 'react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { cn } from '@/lib/utils'
import type { GridStyle } from '@shared/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract a solid color from a value that may be a CSS gradient. */
function extractHexColor(value: string): string {
  const match = value.match(/#[0-9a-fA-F]{6}/)
  return match ? match[0] : value
}

/** Validate a hex color string. */
function isValidHex(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value.trim())
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Reusable color swatch + hex input row. */
function ColorInput({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (hex: string) => void
  label: string
}): JSX.Element {
  const displayHex = extractHexColor(value)
  const [inputValue, setInputValue] = useState(displayHex)

  // Sync local state when store value changes externally (e.g. preset switch)
  const prevDisplayRef = useState({ hex: displayHex })[0]
  if (prevDisplayRef.hex !== displayHex) {
    prevDisplayRef.hex = displayHex
    setInputValue(displayHex)
  }

  const applyHex = useCallback(
    (raw: string) => {
      const cleaned = raw.trim()
      if (isValidHex(cleaned)) {
        setInputValue(cleaned)
        onChange(cleaned)
      }
    },
    [onChange],
  )

  return (
    <div className="flex items-center gap-2">
      {/* Native color picker hidden behind a styled swatch */}
      <label className="relative flex-shrink-0 cursor-pointer" aria-label={`Pick ${label}`}>
        <div
          className="w-7 h-7 rounded-md border border-[var(--border-subtle)] transition-colors"
          style={{ backgroundColor: displayHex }}
        />
        <input
          type="color"
          value={displayHex}
          onChange={(e) => {
            const hex = e.target.value
            setInputValue(hex)
            onChange(hex)
          }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          tabIndex={-1}
        />
      </label>
      {/* Hex text input */}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            applyHex(inputValue)
          }
          // Prevent popover key handlers from intercepting typing
          e.stopPropagation()
        }}
        onBlur={() => applyHex(inputValue)}
        className={cn(
          'flex-1 h-7 px-2 text-xs rounded-md',
          'border border-[var(--border-subtle)]',
          'bg-[var(--surface-elevated)] text-[var(--text-primary)]',
          'placeholder:text-[var(--text-muted)]',
          'outline-none focus:border-[var(--accent-primary)]',
          'transition-colors duration-[var(--duration-fast)]',
        )}
        style={{ fontFamily: 'var(--font-mono, monospace)', minWidth: 0 }}
        placeholder="#000000"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Grid style options
// ---------------------------------------------------------------------------

const GRID_OPTIONS: { value: GridStyle; label: string }[] = [
  { value: 'dots', label: 'Dots' },
  { value: 'hash', label: 'Lines' },
  { value: 'none', label: 'None' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function CanvasTabComponent(): JSX.Element {
  const canvasBackground = useWorkspaceStore((s) => s.themeSettings.canvasBackground)
  const gridStyle = useWorkspaceStore((s) => s.themeSettings.gridStyle) ?? 'dots'
  const canvasGridColor = useWorkspaceStore((s) => s.themeSettings.canvasGridColor)
  const setCanvasBackground = useWorkspaceStore((s) => s.setCanvasBackground)
  const setCanvasGridColor = useWorkspaceStore((s) => s.setCanvasGridColor)
  const updateThemeSettings = useWorkspaceStore((s) => s.updateThemeSettings)

  const handleGridStyleChange = useCallback(
    (style: GridStyle) => {
      updateThemeSettings({ gridStyle: style })
    },
    [updateThemeSettings],
  )

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------------------------ */}
      {/* 1. Canvas Background                                               */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <label className="block text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">
          Background
        </label>
        <ColorInput
          value={canvasBackground}
          onChange={setCanvasBackground}
          label="canvas background"
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 2. Grid Style                                                      */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <label className="block text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">
          Grid Style
        </label>
        <div className="flex gap-1.5">
          {GRID_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleGridStyleChange(opt.value)}
              className={cn(
                'flex-1 flex items-center justify-center px-3 py-1.5 rounded-md text-xs font-medium',
                'border transition-colors duration-[var(--duration-fast)]',
                gridStyle === opt.value
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--text-primary)]'
                  : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-default)]',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 3. Grid Color                                                      */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <label className="block text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">
          Grid Color
        </label>
        <ColorInput
          value={canvasGridColor}
          onChange={setCanvasGridColor}
          label="grid color"
        />
      </div>
    </div>
  )
}

export const CanvasTab = memo(CanvasTabComponent)
CanvasTab.displayName = 'CanvasTab'
