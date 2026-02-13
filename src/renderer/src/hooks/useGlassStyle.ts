/**
 * React hook for accessing effective glass style.
 *
 * Returns the resolved glass style based on theme settings, GPU tier, and ambient state.
 * Result is memoized to prevent unnecessary re-renders.
 */

import { useMemo } from 'react'
import { useWorkspaceStore } from '@/store'
import { getGPUTier } from '@/utils/gpuDetection'
import { resolveGlassStyle } from '@/utils/glassUtils'
import { DEFAULT_GLASS_SETTINGS } from '@shared/types'

/**
 * Get effective glass style for current theme/hardware.
 *
 * @returns Resolved glass style ('solid', 'soft-blur', or 'fluid-glass')
 */
export function useGlassStyle(): 'solid' | 'soft-blur' | 'fluid-glass' {
  // Get theme settings from workspace store
  const themeSettings = useWorkspaceStore((state) => state.themeSettings)

  // Memoize to avoid recalculating on every render
  return useMemo(() => {
    const glassSettings = themeSettings.glassSettings ?? DEFAULT_GLASS_SETTINGS
    const gpuTier = getGPUTier()
    const ambientActive = themeSettings.ambientEffect?.enabled ?? false

    return resolveGlassStyle(glassSettings.userPreference, gpuTier.tier, ambientActive)
  }, [themeSettings.glassSettings, themeSettings.ambientEffect])
}
