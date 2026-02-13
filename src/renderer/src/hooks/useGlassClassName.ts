/**
 * useGlassClassName Hook
 *
 * Returns the appropriate glass CSS class name for a surface.
 * This hook is specifically for components that need to apply glass classes
 * to their className strings (e.g., SuggestedAutomations).
 *
 * @param surface - Which UI surface to check (nodes, modals, panels, overlays, toolbar)
 * @returns CSS class name: 'glass-solid', 'glass-soft', or 'glass-fluid'
 */

import { useMemo } from 'react'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { DEFAULT_GLASS_SETTINGS } from '@shared/types'

export function useGlassClassName(
  surface: 'nodes' | 'modals' | 'panels' | 'overlays' | 'toolbar'
): string {
  // Select only glassSettings to minimize re-renders
  const glassSettings = useWorkspaceStore((state) => state.themeSettings.glassSettings)

  return useMemo(() => {
    // Defensive: handle undefined glassSettings gracefully
    const settings = glassSettings ?? DEFAULT_GLASS_SETTINGS

    // Check if glass is enabled for this surface
    const applyTo = settings.applyTo ?? DEFAULT_GLASS_SETTINGS.applyTo
    if (!applyTo[surface]) {
      return 'glass-solid' // Fallback to solid if disabled for this surface
    }

    // Get the effective style (resolved after GPU detection)
    const effectiveStyle = settings.effectiveStyle ?? settings.userPreference ?? 'soft-blur'

    // Map effectiveStyle to CSS class name
    switch (effectiveStyle) {
      case 'solid':
        return 'glass-solid'
      case 'soft-blur':
        return 'glass-soft'
      case 'fluid-glass':
        return 'glass-fluid'
      default:
        return 'glass-soft' // Fallback
    }
  }, [glassSettings, surface])
}
