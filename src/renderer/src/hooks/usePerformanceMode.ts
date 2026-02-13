/**
 * usePerformanceMode — Progressive enhancement based on canvas complexity
 *
 * Returns 'full' | 'reduced' | 'minimal' based on node count.
 * Used to disable/simplify animations at scale.
 *
 * Thresholds:
 * - full:    < 250 nodes — all animations + effects
 * - reduced: 250-499 — disable CountUp, reduce edge animations
 * - minimal: 500+ — static icons, no animations, text-only badges
 */

import { useMemo } from 'react'
import { useWorkspaceStore } from '../stores/workspaceStore'

export type PerformanceMode = 'full' | 'reduced' | 'minimal'

export function usePerformanceMode(): PerformanceMode {
  const nodeCount = useWorkspaceStore((state) => state.nodes.length)

  return useMemo((): PerformanceMode => {
    if (nodeCount >= 500) return 'minimal'
    if (nodeCount >= 250) return 'reduced'
    return 'full'
  }, [nodeCount])
}
