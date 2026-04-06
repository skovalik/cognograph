// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * OrchestratorBadge — Shows orchestrator "controlling" state on OrchestratorNode
 *
 * States: orchestrating (purple glow), paused, completed, error
 * Positioned absolute top-right of the node.
 */

import { useStore } from '@xyflow/react'
import { CheckCircle, Pause, XCircle, Zap } from 'lucide-react'
import { memo, useMemo } from 'react'
import { usePerformanceMode } from '../../hooks/usePerformanceMode'
import { cn } from '../../lib/utils'
import { useBridgeStore } from '../../stores/bridgeStore'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'

interface OrchestratorBadgeProps {
  nodeId: string
}

const STATUS_CONFIG = {
  orchestrating: {
    Icon: Zap,
    className: 'orchestrator-badge--orchestrating',
    label: 'Orchestrating',
  },
  paused: {
    Icon: Pause,
    className: 'orchestrator-badge--paused',
    label: 'Paused',
  },
  completed: {
    Icon: CheckCircle,
    className: 'orchestrator-badge--completed',
    label: 'Completed',
  },
  error: {
    Icon: XCircle,
    className: 'orchestrator-badge--error',
    label: 'Error',
  },
} as const

function OrchestratorBadgeComponent({ nodeId }: OrchestratorBadgeProps): JSX.Element | null {
  const orchState = useBridgeStore((s) => s.activeOrchestrators[nodeId])
  const performanceMode = usePerformanceMode()

  // Scale badge inversely with zoom at low zoom levels
  const zoom = useStore((s) => s.transform[2])
  const badgeScale = useMemo(() => {
    if (zoom >= 0.5) return 1
    if (zoom >= 0.3) return 0.5 / zoom
    return 1.67
  }, [zoom])

  if (!orchState) return null

  const config = STATUS_CONFIG[orchState.status]
  if (!config) return null

  const { Icon, className: statusClass, label } = config
  const showGlow = performanceMode === 'full' && orchState.status === 'orchestrating'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            'orchestrator-badge',
            statusClass,
            !showGlow && orchState.status === 'orchestrating' && 'animate-none',
          )}
          style={{ transform: `scale(${badgeScale})` }}
          role="status"
          aria-label={`Orchestrator: ${label}`}
        >
          <Icon className="w-3.5 h-3.5" />
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <p className="font-medium">{label}</p>
        <p style={{ color: 'var(--text-muted)' }}>
          {orchState.completedAgentCount}/{orchState.agentCount} agents |{' '}
          {orchState.totalTokens.toLocaleString()} tokens | ${orchState.totalCostUSD.toFixed(4)}
        </p>
      </TooltipContent>
    </Tooltip>
  )
}

export const OrchestratorBadge = memo(OrchestratorBadgeComponent)
