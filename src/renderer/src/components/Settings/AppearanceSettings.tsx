// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * AppearanceSettings — Appearance tab for the Settings modal.
 *
 * Controls: Mode toggle, Accent theme, Font picker, Base font size, Grid style.
 * All changes apply instantly via the workspace store.
 */

import { memo, useCallback, useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { FONT_THEMES, PRESET_ACCENT_PALETTES, type FontTheme, type AccentTheme, type GridStyle } from '@shared/types'
import { performThemeTransition } from '../../utils/themeTransition'
import { Slider } from '../ui/slider'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function AppearanceSettingsComponent(): JSX.Element {
  const themeSettings = useWorkspaceStore((state) => state.themeSettings)
  const updateThemeSettings = useWorkspaceStore((state) => state.updateThemeSettings)

  // Local state for custom hex input
  const [customHexInput, setCustomHexInput] = useState(themeSettings.customAccentColor || '')

  // Current palette based on active preset
  const palette = PRESET_ACCENT_PALETTES[themeSettings.currentPresetId || 'default'] || PRESET_ACCENT_PALETTES.default

  // --- Mode toggle ---
  const handleModeChange = useCallback((mode: 'dark' | 'light', event?: React.MouseEvent) => {
    performThemeTransition(mode, event)
  }, [])

  // --- Per-preset accent selection ---
  const handleAccentSelect = useCallback((idx: number) => {
    const state = useWorkspaceStore.getState().themeSettings
    const presetId = state.currentPresetId || 'default'
    const pal = PRESET_ACCENT_PALETTES[presetId] || PRESET_ACCENT_PALETTES.default
    const accent = pal[idx]
    if (!accent) return

    const isDark = state.mode === 'dark'
    const guiDark = { ...(state.guiColorsDark || state.guiColors!), accentSecondary: accent.glow }
    const guiLight = { ...(state.guiColorsLight || state.guiColors!), accentSecondary: accent.glowLight }

    updateThemeSettings({
      accentIndex: idx,
      accentTheme: 'aurochs-gold' as AccentTheme,
      guiColors: isDark ? guiDark : guiLight,
      guiColorsDark: guiDark,
      guiColorsLight: guiLight,
    })
  }, [updateThemeSettings])

  const handleCustomHexApply = useCallback((hex: string) => {
    const cleaned = hex.trim()
    if (/^#[0-9a-fA-F]{6}$/.test(cleaned)) {
      setCustomHexInput(cleaned)

      const state = useWorkspaceStore.getState().themeSettings
      const guiDark = { ...(state.guiColorsDark || state.guiColors!), accentSecondary: cleaned }
      const guiLight = { ...(state.guiColorsLight || state.guiColors!), accentSecondary: cleaned }
      const isDark = state.mode === 'dark'

      updateThemeSettings({
        accentTheme: 'custom' as AccentTheme,
        customAccentColor: cleaned,
        guiColors: isDark ? guiDark : guiLight,
        guiColorsDark: guiDark,
        guiColorsLight: guiLight,
      })
    }
  }, [updateThemeSettings])

  // --- Font picker ---
  const handleFontChange = useCallback((font: FontTheme) => {
    updateThemeSettings({ fontTheme: font })
  }, [updateThemeSettings])

  // --- Font size ---
  const handleFontSizeChange = useCallback((values: number[]) => {
    updateThemeSettings({ fontSize: values[0] })
  }, [updateThemeSettings])

  // --- Grid style ---
  const handleGridStyleChange = useCallback((style: GridStyle) => {
    updateThemeSettings({ gridStyle: style })
  }, [updateThemeSettings])

  const currentMode = themeSettings.mode
  const currentAccent = themeSettings.accentTheme || 'aurochs-gold'
  const currentAccentIndex = themeSettings.accentIndex ?? 0
  const currentFont = themeSettings.fontTheme || 'space-grotesk'
  const isDark = currentMode === 'dark'
  const currentFontSize = themeSettings.fontSize || 12
  const currentGridStyle = themeSettings.gridStyle || 'dots'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-sm font-medium gui-text mb-1">Appearance</h3>
        <p className="text-xs gui-text-secondary">
          Customize how Cognograph looks and feels.
        </p>
      </div>

      {/* Mode toggle */}
      <div>
        <label className="panel-section-label block text-xs font-semibold gui-text-secondary uppercase tracking-wider mb-2">
          Mode
        </label>
        <div className="flex gap-2">
          <button
            onClick={(e) => handleModeChange('dark', e)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded border text-sm transition-colors ${
              currentMode === 'dark' ? 'gui-btn-accent' : 'gui-card'
            }`}
          >
            <Moon className="w-4 h-4" />
            Dark
          </button>
          <button
            onClick={(e) => handleModeChange('light', e)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded border text-sm transition-colors ${
              currentMode === 'light' ? 'gui-btn-accent' : 'gui-card'
            }`}
          >
            <Sun className="w-4 h-4" />
            Light
          </button>
        </div>
      </div>

      {/* Accent theme */}
      <div>
        <label className="panel-section-label block text-xs font-semibold gui-text-secondary uppercase tracking-wider mb-2">
          Accent Color
        </label>
        <div className="flex items-center gap-2 flex-wrap">
          {palette.map((accent, idx) => {
            const isActive = currentAccent !== 'custom' && currentAccentIndex === idx
            const color = isDark ? accent.glow : accent.glowLight
            return (
              <button
                key={`${themeSettings.currentPresetId}-${idx}`}
                onClick={() => handleAccentSelect(idx)}
                title={accent.label}
                className={`w-7 h-7 rounded-full border-2 transition-all ${
                  isActive
                    ? 'border-[var(--gui-accent-primary)] ring-2 ring-[var(--gui-accent-secondary)]/30 scale-110'
                    : 'border-transparent hover:border-[var(--gui-text-secondary)]/40'
                }`}
                style={{ backgroundColor: color }}
              />
            )
          })}
          {/* Custom hex input */}
          <div className="flex items-center gap-1.5 ml-1">
            <input
              type="text"
              placeholder="#hex"
              value={currentAccent === 'custom' ? customHexInput : ''}
              onChange={(e) => setCustomHexInput(e.target.value)}
              onBlur={(e) => handleCustomHexApply(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCustomHexApply((e.target as HTMLInputElement).value)
              }}
              className="w-20 px-2 py-1 rounded border gui-border gui-panel-secondary text-xs gui-text font-mono"
            />
            {currentAccent === 'custom' && themeSettings.customAccentColor && (
              <div
                className="w-5 h-5 rounded-full border border-[var(--gui-border)]"
                style={{ backgroundColor: themeSettings.customAccentColor }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Font picker */}
      <div>
        <label className="panel-section-label block text-xs font-semibold gui-text-secondary uppercase tracking-wider mb-2">
          Font
        </label>
        <div className="space-y-1.5">
          {(Object.keys(FONT_THEMES) as FontTheme[]).map((key) => {
            const font = FONT_THEMES[key]
            const isActive = currentFont === key
            return (
              <button
                key={key}
                onClick={() => handleFontChange(key)}
                className={`w-full text-left px-3 py-2 rounded border transition-all ${
                  isActive
                    ? 'border-[var(--gui-accent-primary)] gui-panel-secondary'
                    : 'border-transparent gui-card hover:border-[var(--gui-text-secondary)]/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm gui-text" style={{ fontFamily: font.sans }}>
                    {font.label}
                  </span>
                  {isActive && (
                    <span className="text-xs" style={{ color: 'var(--gui-accent-secondary)' }}>Active</span>
                  )}
                </div>
                <span className="text-xs gui-text-secondary" style={{ fontFamily: font.sans }}>
                  The quick brown fox jumps over the lazy dog
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Base font size */}
      <div>
        <label className="panel-section-label block text-xs font-semibold gui-text-secondary uppercase tracking-wider mb-2">
          Base Font Size: {currentFontSize}px
        </label>
        <Slider
          min={10}
          max={16}
          step={1}
          value={[currentFontSize]}
          onValueChange={handleFontSizeChange}
          className="w-full"
        />
        <div className="flex justify-between text-xs gui-text-secondary mt-1">
          <span>10px (Compact)</span>
          <span>16px (Large)</span>
        </div>
      </div>

      {/* Grid style */}
      <div>
        <label className="panel-section-label block text-xs font-semibold gui-text-secondary uppercase tracking-wider mb-2">
          Canvas Grid
        </label>
        <div className="flex gap-2">
          {([
            { id: 'dots' as GridStyle, label: 'Dots' },
            { id: 'hash' as GridStyle, label: 'Hash' },
            { id: 'none' as GridStyle, label: 'None' },
          ]).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => handleGridStyleChange(id)}
              className={`flex-1 px-3 py-2 rounded border text-sm transition-colors ${
                currentGridStyle === id ? 'gui-btn-accent' : 'gui-card'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs gui-text-secondary mt-1">
          Controls the background grid pattern on the canvas.
        </p>
      </div>
    </div>
  )
}

export const AppearanceSettings = memo(AppearanceSettingsComponent)
AppearanceSettings.displayName = 'AppearanceSettings'
