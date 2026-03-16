// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * TypographyTab -- Compact font controls for the SettingsPopover.
 *
 * 2 sections:
 *   1. Font Theme (4-option radio-style card grid, 2x2)
 *   2. Base Font Size (slider with px readout)
 *
 * All changes apply immediately via the workspace store -- no save button.
 */

import { memo, useCallback } from 'react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { cn } from '@/lib/utils'
import { FONT_THEMES } from '@shared/types'
import type { FontTheme } from '@shared/types'
import { Slider } from '@/components/ui/slider'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FONT_THEME_OPTIONS: FontTheme[] = [
  'space-grotesk',
  'satoshi',
  'instrument',
  'general-sans',
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function TypographyTabComponent(): JSX.Element {
  const fontTheme = useWorkspaceStore((s) => s.themeSettings.fontTheme)
  const fontSize = useWorkspaceStore((s) => s.themeSettings.fontSize)
  const updateThemeSettings = useWorkspaceStore((s) => s.updateThemeSettings)

  // --- Font theme selection ---
  const handleFontThemeChange = useCallback(
    (theme: FontTheme) => {
      updateThemeSettings({ fontTheme: theme })
    },
    [updateThemeSettings],
  )

  // --- Font size slider ---
  const handleFontSizeChange = useCallback(
    (value: number[]) => {
      updateThemeSettings({ fontSize: value[0] })
    },
    [updateThemeSettings],
  )

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------------------------ */}
      {/* 1. Font Theme                                                      */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <label className="block text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">
          Font Theme
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {FONT_THEME_OPTIONS.map((themeId) => {
            const theme = FONT_THEMES[themeId]
            const isActive = fontTheme === themeId
            return (
              <button
                key={themeId}
                onClick={() => handleFontThemeChange(themeId)}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 px-3 py-2.5 rounded-md',
                  'border transition-colors duration-[var(--duration-fast)]',
                  isActive
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--text-primary)]'
                    : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-default)]',
                )}
              >
                {/* Font preview rendered in its own typeface */}
                <span
                  className="text-lg leading-none"
                  style={{ fontFamily: theme.sans }}
                >
                  Aa
                </span>
                <span
                  className="text-[10px] leading-tight"
                  style={{ fontFamily: theme.sans }}
                >
                  {theme.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 2. Base Font Size                                                   */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wider">
            Font Size
          </label>
          <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
            {fontSize}px
          </span>
        </div>
        <Slider
          value={[fontSize]}
          onValueChange={handleFontSizeChange}
          min={10}
          max={16}
          step={1}
        />
      </div>
    </div>
  )
}

export const TypographyTab = memo(TypographyTabComponent)
TypographyTab.displayName = 'TypographyTab'
