/**
 * AgentActivityBadge — Shows agent status on ConversationNode when in agent mode
 *
 * 6 states: running, waiting-approval, completed, error, paused, queued
 * Each state has unique icon, color, animation, and shape (colorblind-friendly).
 * Positioned absolute top-right of the node (-6px offset).
 * Includes tooltip with details + popover on click.
 *
 * Error badges persist until next run or manual dismiss.
 * Completed badges fade after configurable duration (default 3s).
 */

import { memo, useState, useMemo } from 'react'
import { Loader2, Clock, Check, AlertCircle, Pause, Clock3 } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Separator } from '../ui/separator'
import { useBridgeStore } from '../../stores/bridgeStore'
import { usePerformanceMode } from '../../hooks/usePerformanceMode'
import type { AgentActivityStatus } from '@shared/types/bridge'
import { cn } from '../../lib/utils'
import { useStore } from '@xyflow/react'

// Status config: icon, color class, and label
const STATUS_CONFIG: Record<AgentActivityStatus, {
  Icon: typeof Loader2
  className: string
  label: string
  animateIcon: boolean
}> = {
  'running': {
    Icon: Loader2,
    className: 'agent-badge--running',
    label: 'Running',
    animateIcon: true,
  },
  'waiting-approval': {
    Icon: Clock,
    className: 'agent-badge--waiting',
    label: 'Waiting',
    animateIcon: false,
  },
  'completed': {
    Icon: Check,
    className: 'agent-badge--completed',
    label: 'Completed',
    animateIcon: false,
  },
  'error': {
    Icon: AlertCircle,
    className: 'agent-badge--error',
    label: 'Error',
    animateIcon: false,
  },
  'paused': {
    Icon: Pause,
    className: 'agent-badge--paused',
    label: 'Paused',
    animateIcon: false,
  },
  'queued': {
    Icon: Clock3,
    className: 'agent-badge--queued',
    label: 'Queued',
    animateIcon: false,
  },
}

interface AgentActivityBadgeProps {
  nodeId: string
  agentName?: string
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}

function AgentActivityBadgeComponent({ nodeId, agentName }: AgentActivityBadgeProps): JSX.Element | null {
  const agentState = useBridgeStore(s => s.activeAgents[nodeId])
  const dismissError = useBridgeStore(s => s.dismissAgentError)
  const performanceMode = usePerformanceMode()
  const [popoverOpen, setPopoverOpen] = useState(false)

  // Scale badge inversely with zoom at low zoom levels
  const zoom = useStore((s) => s.transform[2])
  const badgeScale = useMemo(() => {
    if (zoom >= 0.5) return 1
    if (zoom >= 0.3) return 0.5 / zoom
    return 1.67 // Cap
  }, [zoom])

  if (!agentState) return null

  const config = STATUS_CONFIG[agentState.status]
  if (!config) return null

  const { Icon, className: statusClass, label, animateIcon } = config
  const showAnimation = performanceMode === 'full' || (performanceMode === 'reduced' && agentState.status === 'running')

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <div
              className={cn('agent-badge', statusClass)}
              style={{ transform: `scale(${badgeScale})` }}
              onClick={(e) => {
                e.stopPropagation()
                setPopoverOpen(!popoverOpen)
              }}
              role="status"
              aria-label={`${agentName || 'Agent'}: ${label}`}
            >
              <Icon
                className={cn(
                  'w-3.5 h-3.5 agent-badge-icon',
                  showAnimation && animateIcon && 'agent-badge-spinner'
                )}
              />
            </div>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px]">
          <p className="font-medium text-xs">{agentName || nodeId}</p>
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {label}{agentState.currentAction ? `: ${agentState.currentAction}` : ''}
          </p>
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {agentState.tokensUsed.toLocaleString()} tokens | ${agentState.costUSD.toFixed(4)}
          </p>
        </TooltipContent>
      </Tooltip>

      <PopoverContent className="w-[280px]" side="top" align="end">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge
              variant={agentState.status === 'error' ? 'destructive' : 'default'}
              className="text-[10px]"
            >
              {label}
            </Badge>
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {agentName || nodeId}
            </span>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-1 text-xs">
            {agentState.orchestratorId && (
              <>
                <span style={{ color: 'var(--text-muted)' }}>Orchestrator:</span>
                <span className="font-mono truncate" style={{ color: 'var(--text-primary)' }}>
                  {agentState.orchestratorId.slice(0, 12)}...
                </span>
              </>
            )}
            <span style={{ color: 'var(--text-muted)' }}>Duration:</span>
            <span style={{ color: 'var(--text-primary)' }}>
              {formatDuration(Date.now() - agentState.startedAt)}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>Tokens:</span>
            <span style={{ color: 'var(--text-primary)' }}>
              {agentState.tokensUsed.toLocaleString()}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>Cost:</span>
            <span style={{ color: 'var(--text-primary)' }}>
              ${agentState.costUSD.toFixed(4)}
            </span>
          </div>

          {agentState.status === 'error' && (
            <>
              <Separator />
              <div className="text-xs" style={{ color: 'var(--color-error, #dc2626)' }}>
                {agentState.currentAction}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[10px]"
                onClick={(e) => {
                  e.stopPropagation()
                  dismissError(nodeId)
                  setPopoverOpen(false)
                }}
              >
                Dismiss
              </Button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export const AgentActivityBadge = memo(AgentActivityBadgeComponent)
