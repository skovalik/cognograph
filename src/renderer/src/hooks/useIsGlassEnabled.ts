/**
 * useIsGlassEnabled Hook
 *
 * Determines if glass effects should be applied to a surface.
 * Handles per-node overrides and gracefully falls back to defaults.
 *
 * @param surface - Which UI surface to check (nodes, modals, panels, overlays, toolbar)
 * @param perNodeOverride - Optional per-node transparency setting
 * @returns true if glass should be applied, false for solid backgrounds
 */

import { useMemo } from 'react'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { DEFAULT_GLASS_SETTINGS } from '@shared/types'

export function useIsGlassEnabled(
  surface: 'nodes' | 'modals' | 'panels' | 'overlays' | 'toolbar',
  perNodeOverride?: boolean | undefined
): boolean {
  // Select only glassSettings to minimize re-renders
  const glassSettings = useWorkspaceStore((state) => state.themeSettings.glassSettings)

  return useMemo(() => {
    // Defensive: handle undefined glassSettings gracefully
    const settings = glassSettings ?? DEFAULT_GLASS_SETTINGS

    // Per-node override takes precedence
    if (perNodeOverride !== undefined) return perNodeOverride

    // Defensive: handle undefined applyTo (for migration from older versions)
    const applyTo = settings.applyTo ?? DEFAULT_GLASS_SETTINGS.applyTo
    if (!applyTo[surface]) return false

    // Check if effective style is glass (not solid)
    const effectiveStyle = settings.effectiveStyle ?? settings.userPreference ?? 'soft-blur'
    return effectiveStyle !== 'solid'
  }, [glassSettings, surface, perNodeOverride])
}
