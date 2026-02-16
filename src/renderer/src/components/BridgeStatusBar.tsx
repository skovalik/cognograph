/**
 * Bridge Status Bar (Orchestrator)
 *
 * Global status bar showing all active orchestrator runs.
 * Appears at bottom-right when any orchestrator is running.
 * Collapsible to save space.
 * Only renders when there are active runs (no skeleton flash).
 *
 * NOTE: A separate bridge/BridgeStatusBar.tsx exists for Spatial Command Bridge
 * activity (deferred to v0.3.0). When re-enabled, consolidate or namespace
 * to avoid confusion. See docs/TODO-BRIDGE.md.
 *
 * Part of Fix 4: Make autonomous agent activity visible globally
 */

import { useState } from 'react'
import { useOrchestratorStore } from '@/stores'

export function BridgeStatusBar() {
  const [expanded, setExpanded] = useState(false)

  // Get all active runs
  const activeRuns = useOrchestratorStore(state => {
    const runs: Array<{ id: string; tokens: number; cost: number }> = []

    state.activeRuns.forEach((run, orchestratorId) => {
      if (run.status === 'running' || run.status === 'paused') {
        runs.push({
          id: orchestratorId,
          tokens: run.tokensUsed || 0,
          cost: run.costUSD || 0
        })
      }
    })

    return runs
  })

  // Hide if no active runs
  if (activeRuns.length === 0) {
    return null
  }

  const totalTokens = activeRuns.reduce((sum, r) => sum + r.tokens, 0)
  const totalCost = activeRuns.reduce((sum, r) => sum + r.cost, 0)

  // Compact mode - just agent count
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className={`
          fixed bottom-16 right-4 z-[50]
          inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
          bg-green-600 hover:bg-green-500
          text-white text-xs font-medium
          shadow-lg
          transition-all duration-200
          animate-pulse
        `}
        aria-label={`${activeRuns.length} agent${activeRuns.length !== 1 ? 's' : ''} running, click to expand`}
      >
        <span className="text-sm">🤖</span>
        <span>{activeRuns.length}</span>
      </button>
    )
  }

  // Expanded mode - full details
  return (
    <div
      onClick={() => setExpanded(false)}
      className={`
        fixed bottom-16 right-4 z-[50]
        inline-flex items-center gap-2 px-4 py-2 rounded-full
        bg-green-600 hover:bg-green-500
        text-white text-xs font-medium
        shadow-lg
        cursor-pointer
        transition-all duration-200
      `}
      role="status"
      aria-live="polite"
      aria-label={`${activeRuns.length} agents running, ${totalTokens} tokens, $${totalCost.toFixed(4)} cost. Click to collapse`}
    >
      <span className="text-sm">🤖</span>
      <span>{activeRuns.length} agent{activeRuns.length !== 1 ? 's' : ''} running</span>
      <span className="opacity-75">•</span>
      <span>{totalTokens} tokens</span>
      <span className="opacity-75">•</span>
      <span>${totalCost.toFixed(4)} cost</span>
    </div>
  )
}
