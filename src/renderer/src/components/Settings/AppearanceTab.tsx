// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * AppearanceTab — Compact appearance controls for the SettingsPopover.
 *
 * 3 sections, max 4-5 visible controls:
 *   1. Dark / Light toggle (segmented button pair with Sun/Moon icons)
 *   2. Theme preset grid (2x4 color swatches, active = gold ring)
 *   3. Per-preset accent color swatches (5 harmonized options + custom hex)
 *
 * All changes apply immediately via the workspace store — no save button.
 * This is the popover-optimized version; the full modal version lives in
 * AppearanceSettings.tsx (includes font picker, font size, grid style).
 */

import { memo, useCallback, useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { THEME_PRESETS } from '../../constants/themePresets'
import { performThemeTransition, performPresetTransition } from '../../utils/themeTransition'
import { PRESET_ACCENT_PALETTES, type AccentTheme } from '@shared/types'
import { lightenColor } from '../../utils/colorUtils'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract a solid color from a preset's canvasBackground (which may be a gradient). */
function extractSwatchColor(bg: string): string {
  // If it's a gradient, grab the first color stop
  const match = bg.match(/#[0-9a-fA-F]{6}/)
  return match ? match[0] : bg
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function AppearanceTabComponent(): JSX.Element {
  const themeMode = useWorkspaceStore((s) => s.themeSettings.mode)
  const currentPresetId = useWorkspaceStore((s) => s.themeSettings.currentPresetId)
  const accentTheme = useWorkspaceStore((s) => s.themeSettings.accentTheme || 'aurochs-gold')
  const accentIndex = useWorkspaceStore((s) => s.themeSettings.accentIndex ?? 0)
  const customAccentColor = useWorkspaceStore((s) => s.themeSettings.customAccentColor)
  const updateThemeSettings = useWorkspaceStore((s) => s.updateThemeSettings)

  const [customHexInput, setCustomHexInput] = useState(customAccentColor || '')

  // Current palette based on active preset
  const palette = PRESET_ACCENT_PALETTES[currentPresetId || 'default'] || PRESET_ACCENT_PALETTES.default

  // --- Dark/Light toggle ---
  const handleModeToggle = useCallback(
    (mode: 'dark' | 'light', event?: React.MouseEvent) => {
      if (mode !== themeMode) {
        performThemeTransition(mode, event)
      }
    },
    [themeMode],
  )

  // --- Theme preset selection ---
  const handlePresetSelect = useCallback((presetId: string) => {
    performPresetTransition(presetId)
  }, [])

  // --- Per-preset accent color selection — updates BOTH primary and secondary ---
  const handleAccentSelect = useCallback(
    (idx: number) => {
      const state = useWorkspaceStore.getState().themeSettings
      const presetId = state.currentPresetId || 'default'
      const pal = PRESET_ACCENT_PALETTES[presetId] || PRESET_ACCENT_PALETTES.default
      const accent = pal[idx]
      if (!accent) return

      const isDark = state.mode === 'dark'
      const guiDark = {
        ...(state.guiColorsDark || state.guiColors!),
        accentPrimary: lightenColor(accent.glow, 10),
        accentSecondary: accent.glow,
      }
      const guiLight = {
        ...(state.guiColorsLight || state.guiColors!),
        accentPrimary: accent.glowLight,
        accentSecondary: accent.glowLight,
      }

      updateThemeSettings({
        accentIndex: idx,
        accentTheme: 'aurochs-gold' as AccentTheme, // Non-custom = using palette
        guiColors: isDark ? guiDark : guiLight,
        guiColorsDark: guiDark,
        guiColorsLight: guiLight,
      })
    },
    [updateThemeSettings],
  )

  const handleCustomHexApply = useCallback(
    (hex: string) => {
      const cleaned = hex.trim()
      if (/^#[0-9a-fA-F]{6}$/.test(cleaned)) {
        setCustomHexInput(cleaned)

        const state = useWorkspaceStore.getState().themeSettings
        const guiDark = {
          ...(state.guiColorsDark || state.guiColors!),
          accentPrimary: lightenColor(cleaned, 10),
          accentSecondary: cleaned,
        }
        const guiLight = {
          ...(state.guiColorsLight || state.guiColors!),
          accentPrimary: cleaned,
          accentSecondary: cleaned,
        }
        const isDark = state.mode === 'dark'

        updateThemeSettings({
          accentTheme: 'custom' as AccentTheme,
          customAccentColor: cleaned,
          guiColors: isDark ? guiDark : guiLight,
          guiColorsDark: guiDark,
          guiColorsLight: guiLight,
        })
      }
    },
    [updateThemeSettings],
  )

  const isDark = themeMode === 'dark'

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------------------------ */}
      {/* 1. Dark / Light Toggle                                             */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <label className="block text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">
          Mode
        </label>
        <div className="flex gap-1.5">
          {/* Dark button */}
          <button
            onClick={(e) => handleModeToggle('dark', e)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium',
              'border transition-colors duration-[var(--duration-fast)]',
              themeMode === 'dark'
                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--text-primary)]'
                : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-default)]',
            )}
          >
            <Moon className="w-3.5 h-3.5" />
            Dark
          </button>
          {/* Light button */}
          <button
            onClick={(e) => handleModeToggle('light', e)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium',
              'border transition-colors duration-[var(--duration-fast)]',
              themeMode === 'light'
                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--text-primary)]'
                : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-default)]',
            )}
          >
            <Sun className="w-3.5 h-3.5" />
            Light
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 2. Theme Preset Grid (2x4)                                         */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <label className="block text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">
          Theme
        </label>
        <div className="grid grid-cols-4 gap-2">
          {THEME_PRESETS.map((preset) => {
            const isActive = currentPresetId === preset.id
            const swatchColor = extractSwatchColor(preset.dark.canvasBackground)
            return (
              <button
                key={preset.id}
                onClick={() => handlePresetSelect(preset.id)}
                title={preset.name}
                className={cn(
                  'group relative flex flex-col items-center gap-1 p-1.5 rounded-lg',
                  'transition-all duration-[var(--duration-fast)]',
                  isActive
                    ? 'bg-[var(--surface-elevated)]'
                    : 'hover:bg-[var(--surface-elevated)]/50',
                )}
              >
                {/* Color swatch */}
                <div
                  className={cn(
                    'w-8 h-8 rounded-md border-2 transition-all',
                    isActive
                      ? 'border-[var(--accent-primary)] ring-1 ring-[var(--accent-primary)]/40'
                      : 'border-[var(--border-subtle)] group-hover:border-[var(--border-default)]',
                  )}
                  style={{ backgroundColor: swatchColor }}
                />
                {/* Label */}
                <span
                  className={cn(
                    'text-[10px] leading-tight truncate w-full text-center',
                    isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]',
                  )}
                >
                  {preset.name}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 3. Per-Preset Accent Color Selector                                */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <label className="block text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">
          Accent Color
        </label>
        {/* Per-preset accent swatches */}
        <div className="flex items-center gap-2">
          {palette.map((accent, idx) => {
            const isActive = accentTheme !== 'custom' && accentIndex === idx
            const color = isDark ? accent.glow : accent.glowLight
            return (
              <button
                key={`${currentPresetId}-${idx}`}
                onClick={() => handleAccentSelect(idx)}
                title={accent.label}
                className="relative flex-shrink-0 rounded-full transition-transform hover:scale-110"
                style={{
                  width: 22,
                  height: 22,
                  background: color,
                  boxShadow: isActive
                    ? `0 0 0 2px var(--surface-panel), 0 0 0 3.5px ${color}`
                    : 'none',
                }}
                aria-label={`${accent.label} accent`}
              />
            )
          })}
        </div>
        {/* Custom hex input */}
        <div className="flex items-center gap-1.5 mt-2">
          <input
            type="text"
            placeholder="#hexcolor"
            value={accentTheme === 'custom' ? customHexInput : ''}
            onChange={(e) => setCustomHexInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCustomHexApply(customHexInput)
              }
              // Prevent dropdown/popover key handlers from intercepting typing
              e.stopPropagation()
            }}
            onBlur={() => {
              if (customHexInput && /^#[0-9a-fA-F]{6}$/.test(customHexInput.trim())) {
                handleCustomHexApply(customHexInput)
              }
            }}
            className={cn(
              'flex-1 h-7 px-2 text-xs rounded-md',
              'border border-[var(--border-subtle)]',
              'bg-[var(--surface-elevated)] text-[var(--text-primary)]',
              'placeholder:text-[var(--text-muted)]',
              'outline-none focus:border-[var(--accent-primary)]',
              'transition-colors duration-[var(--duration-fast)]',
            )}
            style={{ fontFamily: 'var(--font-mono, monospace)', minWidth: 0 }}
          />
          {accentTheme === 'custom' && customAccentColor && (
            <div
              className="w-6 h-6 rounded-full flex-shrink-0 border border-[var(--border-subtle)]"
              style={{ background: customAccentColor }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export const AppearanceTab = memo(AppearanceTabComponent)
AppearanceTab.displayName = 'AppearanceTab'
