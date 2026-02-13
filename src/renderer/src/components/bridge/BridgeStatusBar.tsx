/**
 * BridgeStatusBar — Fixed top bar showing aggregate bridge activity
 *
 * Shows: active agent count, total tokens, cost, run count
 * Auto-shows when any orchestrator starts running.
 * Includes popover with per-orchestrator breakdown.
 *
 * Accessibility: role="status", aria-live="polite", debounced announcements
 */

import { memo, useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { Activity, Hash, Coins, Settings, ScrollText, X, Zap } from 'lucide-react'
import { Badge } from '../ui/Badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Button } from '../ui/Button'
import { Separator } from '../ui/separator'
import { useBridgeStore } from '../../stores/bridgeStore'
import { usePerformanceMode } from '../../hooks/usePerformanceMode'
import { cn } from '../../lib/utils'

interface BridgeStatusBarProps {
  onOpenLog?: () => void
  onOpenSettings?: () => void
}

function formatTokenCount(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`
  return tokens.toLocaleString()
}

function formatCostDisplay(cost: number): string {
  if (cost < 0.001) return '<$0.001'
  return `$${cost.toFixed(3)}`
}

function BridgeStatusBarComponent({ onOpenLog, onOpenSettings }: BridgeStatusBarProps): JSX.Element | null {
  const isVisible = useBridgeStore(s => s.isBridgeStatusBarVisible)
  const totalActiveAgents = useBridgeStore(s => s.totalActiveAgents)
  const totalTokensUsed = useBridgeStore(s => s.totalTokensUsed)
  const totalCostUSD = useBridgeStore(s => s.totalCostUSD)
  const totalActiveRuns = useBridgeStore(s => s.totalActiveRuns)
  const activeOrchestrators = useBridgeStore(s => s.activeOrchestrators)
  const activeAgents = useBridgeStore(s => s.activeAgents)
  const toggleStatusBar = useBridgeStore(s => s.toggleStatusBar)
  const performanceMode = usePerformanceMode()

  // Popover state
  const [detailsOpen, setDetailsOpen] = useState(false)

  // Screen reader announcement debouncing (2s coalescing window)
  const [announcementText, setAnnouncementText] = useState('')
  const announcementQueue = useRef<string[]>([])
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>()

  const queueAnnouncement = useCallback((message: string): void => {
    announcementQueue.current.push(message)

    if (debounceTimer.current) clearTimeout(debounceTimer.current)

    debounceTimer.current = setTimeout(() => {
      const messages = announcementQueue.current
      announcementQueue.current = []

      const starts = messages.filter(m => m.includes('started')).length
      const completes = messages.filter(m => m.includes('completed')).length
      const errors = messages.filter(m => m.includes('failed')).length

      const parts: string[] = []
      if (starts > 0) parts.push(`${starts} agent${starts > 1 ? 's' : ''} started`)
      if (completes > 0) parts.push(`${completes} completed`)
      if (errors > 0) parts.push(`${errors} failed`)

      setAnnouncementText(parts.join(', '))
    }, 2000)
  }, [])

  // Queue announcements when agent counts change
  useEffect(() => {
    if (totalActiveAgents > 0) {
      queueAnnouncement(`${totalActiveAgents} agent${totalActiveAgents > 1 ? 's' : ''} started`)
    }
  }, [totalActiveAgents, queueAnnouncement])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [])

  // Orchestrator breakdown for popover
  const orchestratorBreakdown = useMemo(() => {
    return Object.entries(activeOrchestrators).map(([id, state]) => ({
      id,
      status: state.status,
      agentCount: state.agentCount,
      completedCount: state.completedAgentCount,
      tokens: state.totalTokens,
      cost: state.totalCostUSD,
    }))
  }, [activeOrchestrators])

  // Running agent list for tooltip
  const runningAgentNames = useMemo(() => {
    return Object.entries(activeAgents)
      .filter(([_, s]) => s.status === 'running')
      .map(([id]) => id)
  }, [activeAgents])

  if (!isVisible) return null

  const hasActivity = totalActiveAgents > 0 || totalActiveRuns > 0

  return (
    <div
      role="status"
      aria-label="Bridge status bar"
      aria-live="polite"
      className={cn(
        'bridge-status-bar',
        'fixed top-0 left-0 right-0 h-9 flex items-center justify-between px-2 gap-2',
        'backdrop-blur-md border-b',
      )}
      style={{
        zIndex: 45,
        background: 'var(--surface-panel)',
        borderColor: 'var(--border-subtle, rgba(255,255,255,0.06))',
        fontSize: '12px',
      }}
    >
      {/* Screen reader only announcement region */}
      <span className="sr-only" aria-live="assertive" id="bridge-announcements">
        {announcementText}
      </span>

      {/* Left section: status metrics */}
      <div className="flex items-center gap-3">
        {/* Bridge indicator */}
        <div className="flex items-center gap-1.5">
          <div
            className={cn(
              'w-2 h-2 rounded-full',
              hasActivity ? 'bg-green-500 bridge-badge-pulse' : 'bg-gray-500'
            )}
          />
          <span style={{ color: 'var(--text-muted)' }} className="text-xs font-medium">
            Bridge
          </span>
        </div>

        <Separator orientation="vertical" className="h-4" />

        {/* Agent count */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 cursor-default">
              <Activity
                className="w-3.5 h-3.5"
                style={{ color: totalActiveAgents > 0 ? 'var(--color-info, #3b82f6)' : 'var(--text-muted)' }}
              />
              <span style={{ color: 'var(--text-primary)' }}>
                {totalActiveAgents > 0 ? `${totalActiveAgents} agent${totalActiveAgents > 1 ? 's' : ''}` : 'No agents'}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {runningAgentNames.length > 0
              ? runningAgentNames.map(name => <div key={name}>{name}</div>)
              : 'No agents currently running'
            }
          </TooltipContent>
        </Tooltip>

        {/* Token count */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 cursor-default">
              <Hash className="w-3.5 h-3.5" style={{ color: 'var(--text-primary)' }} />
              <span style={{ color: 'var(--text-primary)' }}>
                {formatTokenCount(totalTokensUsed)} tokens
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {totalTokensUsed.toLocaleString()} total tokens this session
          </TooltipContent>
        </Tooltip>

        {/* Cost */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 cursor-default">
              <Coins
                className="w-3.5 h-3.5"
                style={{ color: totalCostUSD > 0.10 ? 'var(--color-warning, #f59e0b)' : 'var(--text-primary)' }}
              />
              <span style={{ color: 'var(--text-primary)' }}>
                {formatCostDisplay(totalCostUSD)}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Session total: ${totalCostUSD.toFixed(4)}
          </TooltipContent>
        </Tooltip>

        {/* Active runs */}
        {totalActiveRuns > 0 && (
          <div className="flex items-center gap-1">
            <Zap className="w-3.5 h-3.5" style={{ color: 'var(--node-orchestrator, #a855f7)' }} />
            <span style={{ color: 'var(--text-primary)' }}>
              {totalActiveRuns} run{totalActiveRuns > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Right section: actions */}
      <div className="flex items-center gap-1">
        {/* Details popover */}
        {orchestratorBreakdown.length > 0 && (
          <Popover open={detailsOpen} onOpenChange={setDetailsOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]">
                Details
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px]" side="bottom" align="end">
              <div className="space-y-2">
                <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                  Active Orchestrators
                </div>
                <Separator />
                {orchestratorBreakdown.map(orch => (
                  <div key={orch.id} className="text-xs space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono truncate max-w-[140px]" style={{ color: 'var(--text-primary)' }}>
                        {orch.id.slice(0, 8)}...
                      </span>
                      <Badge
                        variant={orch.status === 'orchestrating' ? 'default' : 'outline'}
                        className="text-[9px] px-1 h-4"
                      >
                        {orch.status}
                      </Badge>
                    </div>
                    <div className="flex gap-3" style={{ color: 'var(--text-muted)' }}>
                      <span>{orch.completedCount}/{orch.agentCount} agents</span>
                      <span>{orch.tokens.toLocaleString()} tokens</span>
                      <span>${orch.cost.toFixed(4)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Bridge Log button */}
        {onOpenLog && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={onOpenLog}
              >
                <ScrollText className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Bridge Log</TooltipContent>
          </Tooltip>
        )}

        {/* Settings button */}
        {onOpenSettings && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={onOpenSettings}
              >
                <Settings className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Bridge Settings</TooltipContent>
          </Tooltip>
        )}

        {/* Close button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={toggleStatusBar}
            >
              <X className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Hide status bar</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}

export const BridgeStatusBar = memo(BridgeStatusBarComponent)
