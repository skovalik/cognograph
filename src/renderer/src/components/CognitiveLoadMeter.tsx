// CognitiveLoadMeter — PFD Phase 7C: Canvas Complexity Indicator
// Real-time indicator of current canvas complexity.
// Not for gamification — for self-awareness.
// "You have 47 visible nodes. Consider zooming in or filtering."

import { memo, useMemo } from 'react'
import { useStore } from '@xyflow/react'
import { useWorkspaceStore } from '../stores/workspaceStore'

type LoadLevel = 'low' | 'moderate' | 'high' | 'overloaded'

const LEVEL_CONFIG: Record<LoadLevel, { label: string; color: string; hint: string }> = {
  low: { label: 'Clear', color: 'var(--gui-accent-success, #10b981)', hint: '' },
  moderate: { label: 'Active', color: 'var(--gui-accent-warning, #f59e0b)', hint: '' },
  high: { label: 'Dense', color: 'var(--gui-accent-warning, #f97316)', hint: 'Consider zooming in or filtering' },
  overloaded: { label: 'Overloaded', color: 'var(--gui-accent-danger, #ef4444)', hint: 'Try Focus Mode or Calm Mode' }
}

function getLoadLevel(visibleNodes: number, connectionDensity: number): LoadLevel {
  // Weighted score: node count matters most, connection density is a multiplier
  const score = visibleNodes * (1 + connectionDensity * 0.5)
  if (score <= 12) return 'low'
  if (score <= 25) return 'moderate'
  if (score <= 45) return 'high'
  return 'overloaded'
}

function CognitiveLoadMeterComponent(): JSX.Element | null {
  const nodes = useWorkspaceStore((state) => state.nodes)
  const edges = useWorkspaceStore((state) => state.edges)
  const calmMode = useWorkspaceStore((state) => state.calmMode)
  const zoom = useStore((s) => s.transform[2])

  const metrics = useMemo(() => {
    const visibleNodes = nodes.filter(n => !n.hidden && !n.data.isArchived)
    const visibleCount = visibleNodes.length
    if (visibleCount === 0) return null

    const visibleIds = new Set(visibleNodes.map(n => n.id))
    const visibleEdgeCount = edges.filter(e => !e.hidden && visibleIds.has(e.source) && visibleIds.has(e.target)).length
    // Connection density: average degree (edges per node)
    const connectionDensity = visibleCount > 0 ? visibleEdgeCount / visibleCount : 0
    const level = getLoadLevel(visibleCount, connectionDensity)
    const config = LEVEL_CONFIG[level]

    return { visibleCount, visibleEdgeCount, connectionDensity: connectionDensity.toFixed(1), level, config }
  }, [nodes, edges])

  // Hide in calm mode or when empty
  if (calmMode || !metrics) return null
  // Only show at overview zoom levels where it's useful
  if (zoom > 0.8) return null

  return (
    <div className="cognitive-load-meter" title={metrics.config.hint || `${metrics.visibleCount} nodes, ${metrics.visibleEdgeCount} connections`}>
      <div className="cognitive-load-meter__bar">
        <div
          className="cognitive-load-meter__fill"
          style={{
            width: `${Math.min(100, (metrics.visibleCount / 50) * 100)}%`,
            backgroundColor: metrics.config.color
          }}
        />
      </div>
      <span className="cognitive-load-meter__label" style={{ color: metrics.config.color }}>
        {metrics.visibleCount}n
      </span>
    </div>
  )
}

export const CognitiveLoadMeter = memo(CognitiveLoadMeterComponent)
