// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * EffectsTab -- Compact glass & effects controls for the SettingsPopover.
 *
 * 4 sections:
 *   1. Glass Style (4-option segmented button group)
 *   2. Ambient Effect (grouped dropdown select)
 *   3. Bloom Intensity (slider, only visible when an effect is active)
 *   4. Canvas Overlays (Living Grid + Particle Drift toggles)
 *
 * All changes apply immediately via the workspace store -- no save button.
 */

import type { AmbientEffectType, GlassStyle } from '@shared/types'
import { DEFAULT_AMBIENT_EFFECT, DEFAULT_GLASS_SETTINGS } from '@shared/types'
import { memo, useCallback } from 'react'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { EFFECTS_BY_CATEGORY } from '../ambient/effectRegistry'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GLASS_OPTIONS: { value: GlassStyle; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'fluid-glass', label: 'Immersive' },
  { value: 'soft-blur', label: 'Subtle' },
  { value: 'solid', label: 'Minimal' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function EffectsTabComponent(): JSX.Element {
  const glassSettings = useWorkspaceStore((s) => s.themeSettings.glassSettings)
  const ambientEffect = useWorkspaceStore((s) => s.themeSettings.ambientEffect)
  const livingGridEnabled = useWorkspaceStore((s) => s.themeSettings.livingGridEnabled ?? true)
  const particleDriftEnabled = useWorkspaceStore(
    (s) => s.themeSettings.particleDriftEnabled ?? true,
  )
  const updateThemeSettings = useWorkspaceStore((s) => s.updateThemeSettings)

  const currentGlassStyle = glassSettings?.userPreference ?? 'auto'
  const currentEffect = ambientEffect ?? DEFAULT_AMBIENT_EFFECT
  const isEffectActive = currentEffect.enabled && currentEffect.effect !== 'none'

  // --- Glass style selection ---
  const handleGlassStyleChange = useCallback(
    (style: GlassStyle) => {
      updateThemeSettings({
        glassSettings: {
          ...DEFAULT_GLASS_SETTINGS,
          ...glassSettings,
          userPreference: style,
        },
      })
    },
    [glassSettings, updateThemeSettings],
  )

  // --- Ambient effect selection ---
  const handleEffectSelect = useCallback(
    (effectId: string) => {
      if (effectId === 'none') {
        updateThemeSettings({
          ambientEffect: { ...currentEffect, effect: 'none', enabled: false },
        })
      } else {
        updateThemeSettings({
          ambientEffect: {
            ...currentEffect,
            effect: effectId as AmbientEffectType,
            enabled: true,
          },
        })
      }
    },
    [currentEffect, updateThemeSettings],
  )

  // --- Bloom intensity ---
  const handleBloomChange = useCallback(
    (value: number[]) => {
      updateThemeSettings({
        ambientEffect: { ...currentEffect, bloomIntensity: value[0] },
      })
    },
    [currentEffect, updateThemeSettings],
  )

  // --- Canvas overlay toggles ---
  const handleLivingGridToggle = useCallback(() => {
    updateThemeSettings({ livingGridEnabled: !livingGridEnabled })
  }, [livingGridEnabled, updateThemeSettings])

  const handleParticleDriftToggle = useCallback(() => {
    updateThemeSettings({ particleDriftEnabled: !particleDriftEnabled })
  }, [particleDriftEnabled, updateThemeSettings])

  // Resolve the display name of the current effect
  const currentEffectName = (() => {
    if (!currentEffect.enabled || currentEffect.effect === 'none') return 'None'
    for (const group of EFFECTS_BY_CATEGORY) {
      const found = group.effects.find((e) => e.id === currentEffect.effect)
      if (found) return found.name
    }
    return 'None'
  })()

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------------------------ */}
      {/* 1. Glass Style                                                     */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <label className="block text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">
          Glass Style
        </label>
        <div className="grid grid-cols-4 gap-1.5">
          {GLASS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleGlassStyleChange(opt.value)}
              className={cn(
                'flex items-center justify-center px-2 py-1.5 rounded-md text-xs font-medium',
                'border transition-colors duration-[var(--duration-fast)]',
                currentGlassStyle === opt.value
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
      {/* 2. Ambient Effect Selector                                         */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <label className="block text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">
          Canvas Effect
        </label>
        <Select
          value={currentEffect.enabled ? currentEffect.effect : 'none'}
          onValueChange={handleEffectSelect}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="None">{currentEffectName}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectSeparator />
            {EFFECTS_BY_CATEGORY.map(({ category, effects }, idx) => (
              <SelectGroup key={category}>
                <SelectLabel className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                  {category}
                </SelectLabel>
                {effects.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {entry.name}
                  </SelectItem>
                ))}
                {idx < EFFECTS_BY_CATEGORY.length - 1 && <SelectSeparator />}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 3. Bloom Intensity (only when an effect is active)                  */}
      {/* ------------------------------------------------------------------ */}
      {isEffectActive && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wider">
              Bloom
            </label>
            <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
              {currentEffect.bloomIntensity ?? 0}%
            </span>
          </div>
          <Slider
            value={[currentEffect.bloomIntensity ?? 0]}
            onValueChange={handleBloomChange}
            min={0}
            max={100}
            step={1}
          />
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 4. Canvas Overlays                                                  */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <label className="block text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">
          Canvas Overlays
        </label>
        <div className="space-y-2">
          {/* Living Grid toggle */}
          <button
            onClick={handleLivingGridToggle}
            className={cn(
              'w-full flex items-center justify-between px-3 py-2 rounded-md text-xs',
              'border transition-colors duration-[var(--duration-fast)]',
              livingGridEnabled
                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--text-primary)]'
                : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-default)]',
            )}
          >
            <span>Living Grid</span>
            <span
              className={cn(
                'text-[10px] uppercase tracking-wider',
                livingGridEnabled ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]',
              )}
            >
              {livingGridEnabled ? 'On' : 'Off'}
            </span>
          </button>

          {/* Particle Drift toggle */}
          <button
            onClick={handleParticleDriftToggle}
            className={cn(
              'w-full flex items-center justify-between px-3 py-2 rounded-md text-xs',
              'border transition-colors duration-[var(--duration-fast)]',
              particleDriftEnabled
                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--text-primary)]'
                : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-default)]',
            )}
          >
            <span>Particle Drift</span>
            <span
              className={cn(
                'text-[10px] uppercase tracking-wider',
                particleDriftEnabled ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]',
              )}
            >
              {particleDriftEnabled ? 'On' : 'Off'}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

export const EffectsTab = memo(EffectsTabComponent)
EffectsTab.displayName = 'EffectsTab'
