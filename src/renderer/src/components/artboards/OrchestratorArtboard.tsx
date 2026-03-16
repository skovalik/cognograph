/**
 * OrchestratorArtboard — Full pipeline view for ArtboardOverlay.
 *
 * Shows the complete agent list with status, execution log from run history,
 * budget meters, and run controls. Expanded version of the L3 orchestrator view.
 */

import { memo, useCallback, useMemo } from 'react'
import { Play, Pause, Square, Workflow } from 'lucide-react'
import { useNodesStore } from '../../stores/nodesStore'
import type {
  OrchestratorNodeData,
  ConnectedAgentStatus,
} from '@shared/types'

interface OrchestratorArtboardProps {
  nodeId: string
}

// Agent status indicators
const STATUS_DISPLAY: Record<
  ConnectedAgentStatus,
  { icon: string; color: string; label: string }
> = {
  idle: { icon: '\u25CB', color: '#9ca3af', label: 'Idle' },
  queued: { icon: '\u23F3', color: '#60a5fa', label: 'Queued' },
  running: { icon: '\u25C9', color: '#fbbf24', label: 'Running' },
  completed: { icon: '\u2713', color: '#34d399', label: 'Completed' },
  failed: { icon: '\u2717', color: '#f87171', label: 'Failed' },
  skipped: { icon: '\u2298', color: '#6b7280', label: 'Skipped' },
  retrying: { icon: '\u21BB', color: '#fb923c', label: 'Retrying' },
}

const STRATEGY_LABELS: Record<string, string> = {
  sequential: 'Sequential',
  parallel: 'Parallel',
  conditional: 'Conditional',
}

function getBudgetPercentage(
  used: number,
  limit: number | undefined
): number | null {
  if (limit === undefined || limit <= 0) return null
  return Math.min((used / limit) * 100, 100)
}

function getBudgetColor(pct: number): string {
  if (pct >= 90) return '#ef4444'
  if (pct >= 70) return '#f59e0b'
  return '#10b981'
}

function OrchestratorArtboardComponent({
  nodeId,
}: OrchestratorArtboardProps): JSX.Element {
  const nodes = useNodesStore((s) => s.nodes)

  const node = nodes.find((n) => n.id === nodeId)
  const nodeData = node?.data as OrchestratorNodeData | undefined

  const currentRun = nodeData?.currentRun
  const isRunning = currentRun?.status === 'running'
  const isPaused = currentRun?.status === 'paused'
  const isActive = isRunning || isPaused || currentRun?.status === 'planning'

  // Budget calculations
  const budgetTokens = useMemo(
    () =>
      getBudgetPercentage(
        (currentRun?.totalInputTokens ?? 0) +
          (currentRun?.totalOutputTokens ?? 0),
        nodeData?.budget.maxTotalTokens
      ),
    [currentRun, nodeData?.budget.maxTotalTokens]
  )

  const budgetCost = useMemo(
    () =>
      getBudgetPercentage(
        currentRun?.totalCostUSD ?? 0,
        nodeData?.budget.maxTotalCostUSD
      ),
    [currentRun, nodeData?.budget.maxTotalCostUSD]
  )

  // Run controls
  const handleStart = useCallback(() => {
    window.api?.orchestrator?.start(nodeId).catch(() => {})
  }, [nodeId])

  const handlePause = useCallback(() => {
    window.api?.orchestrator?.pause(nodeId).catch(() => {})
  }, [nodeId])

  const handleResume = useCallback(() => {
    window.api?.orchestrator?.resume(nodeId).catch(() => {})
  }, [nodeId])

  const handleAbort = useCallback(() => {
    window.api?.orchestrator?.abort(nodeId).catch(() => {})
  }, [nodeId])

  // Build log entries from run history
  const logEntries = useMemo(() => {
    if (!nodeData) return []
    const entries: Array<{
      timestamp: number
      level: 'info' | 'warn' | 'error'
      message: string
    }> = []

    for (const run of nodeData.runHistory.slice(-10)) {
      entries.push({
        timestamp: run.startedAt,
        level: 'info',
        message: `Pipeline started (${run.strategy}, ${run.agentResults.length} agents)`,
      })
      for (const result of run.agentResults) {
        entries.push({
          timestamp: result.startedAt,
          level: result.status === 'failed' ? 'error' : 'info',
          message: `Agent ${result.agentNodeId.slice(0, 8)} ${result.status} (${result.toolCallCount} tool calls, $${result.costUSD.toFixed(4)})`,
        })
      }
      entries.push({
        timestamp: run.completedAt ?? run.startedAt,
        level:
          run.status === 'failed'
            ? 'error'
            : run.status === 'completed'
            ? 'info'
            : 'warn',
        message: `Pipeline ${run.status} — $${run.totalCostUSD.toFixed(4)} total`,
      })
    }
    return entries.sort((a, b) => a.timestamp - b.timestamp)
  }, [nodeData])

  if (!nodeData) {
    return (
      <div
        className="flex items-center justify-center h-full text-sm"
        style={{ color: 'var(--gui-text-muted)' }}
      >
        Node not found
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Controls bar */}
      <div
        className="flex items-center gap-4 px-5 py-3 shrink-0"
        style={{ borderBottom: '1px solid var(--gui-border)' }}
      >
        {/* Strategy badge */}
        <span
          className="text-xs px-2 py-1 rounded-md font-medium"
          style={{
            backgroundColor: 'var(--gui-bg-secondary)',
            color: 'var(--gui-text-primary)',
          }}
        >
          {STRATEGY_LABELS[nodeData.strategy] || nodeData.strategy}
        </span>

        {/* Failure policy */}
        <span className="text-xs" style={{ color: 'var(--gui-text-muted)' }}>
          {nodeData.failurePolicy.type} (max {nodeData.failurePolicy.maxRetries}{' '}
          retries)
        </span>

        {/* Run controls */}
        <div className="ml-auto flex items-center gap-1">
          {!isActive && (
            <button
              onClick={handleStart}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-150"
              style={{
                backgroundColor: '#22c55e20',
                color: '#22c55e',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#22c55e30'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#22c55e20'
              }}
            >
              <Play className="w-3 h-3" />
              Start
            </button>
          )}
          {isRunning && (
            <button
              onClick={handlePause}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-150"
              style={{
                backgroundColor: '#f59e0b20',
                color: '#f59e0b',
                cursor: 'pointer',
              }}
            >
              <Pause className="w-3 h-3" />
              Pause
            </button>
          )}
          {isPaused && (
            <button
              onClick={handleResume}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-150"
              style={{
                backgroundColor: '#22c55e20',
                color: '#22c55e',
                cursor: 'pointer',
              }}
            >
              <Play className="w-3 h-3" />
              Resume
            </button>
          )}
          {isActive && (
            <button
              onClick={handleAbort}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-150"
              style={{
                backgroundColor: '#ef444420',
                color: '#ef4444',
                cursor: 'pointer',
              }}
            >
              <Square className="w-3 h-3" />
              Abort
            </button>
          )}
        </div>
      </div>

      {/* Main content: split between agents and log */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Agent list + budget */}
        <div
          className="w-[300px] shrink-0 flex flex-col overflow-hidden"
          style={{ borderRight: '1px solid var(--gui-border)' }}
        >
          {/* Budget meters */}
          <div
            className="px-4 py-3 shrink-0 space-y-2"
            style={{ borderBottom: '1px solid var(--gui-border)' }}
          >
            <div
              className="text-[10px] font-medium uppercase tracking-wider"
              style={{ color: 'var(--gui-text-muted)' }}
            >
              Budget
            </div>
            {budgetTokens !== null ? (
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] w-12 flex-shrink-0"
                  style={{ color: 'var(--gui-text-muted)' }}
                >
                  Tokens
                </span>
                <div
                  className="flex-1 h-2 rounded-full overflow-hidden"
                  style={{ backgroundColor: 'var(--gui-bg-secondary)' }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${budgetTokens}%`,
                      backgroundColor: getBudgetColor(budgetTokens),
                    }}
                  />
                </div>
                <span
                  className="text-[10px] flex-shrink-0"
                  style={{ color: 'var(--gui-text-muted)' }}
                >
                  {Math.round(budgetTokens)}%
                </span>
              </div>
            ) : null}
            {budgetCost !== null ? (
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] w-12 flex-shrink-0"
                  style={{ color: 'var(--gui-text-muted)' }}
                >
                  Cost
                </span>
                <div
                  className="flex-1 h-2 rounded-full overflow-hidden"
                  style={{ backgroundColor: 'var(--gui-bg-secondary)' }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${budgetCost}%`,
                      backgroundColor: getBudgetColor(budgetCost),
                    }}
                  />
                </div>
                <span
                  className="text-[10px] flex-shrink-0"
                  style={{ color: 'var(--gui-text-muted)' }}
                >
                  ${(currentRun?.totalCostUSD ?? 0).toFixed(4)}
                </span>
              </div>
            ) : null}
            {budgetTokens === null && budgetCost === null && (
              <span
                className="text-xs"
                style={{ color: 'var(--gui-text-muted)' }}
              >
                Unlimited
              </span>
            )}
          </div>

          {/* Agent list */}
          <div className="flex-1 overflow-auto px-4 py-2">
            <div
              className="text-[10px] font-medium uppercase tracking-wider mb-2"
              style={{ color: 'var(--gui-text-muted)' }}
            >
              Agents ({nodeData.connectedAgents.length})
            </div>
            {nodeData.connectedAgents.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6">
                <Workflow
                  className="w-6 h-6 opacity-30"
                  style={{ color: 'var(--gui-text-muted)' }}
                />
                <span
                  className="text-xs italic"
                  style={{ color: 'var(--gui-text-muted)' }}
                >
                  No agents connected
                </span>
              </div>
            ) : (
              <div className="space-y-1">
                {nodeData.connectedAgents.map((agent, idx) => {
                  const statusInfo = STATUS_DISPLAY[agent.status]
                  return (
                    <div
                      key={agent.nodeId}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs"
                      style={{
                        backgroundColor: 'var(--gui-bg-secondary)',
                      }}
                    >
                      <span
                        className="text-[10px] opacity-50 w-4 text-right flex-shrink-0"
                        style={{ color: 'var(--gui-text-muted)' }}
                      >
                        {idx + 1}.
                      </span>
                      <span
                        style={{ color: statusInfo.color }}
                        className={
                          agent.status === 'running' ? 'animate-pulse' : ''
                        }
                      >
                        {statusInfo.icon}
                      </span>
                      <span
                        className="truncate flex-1"
                        style={{ color: 'var(--gui-text-primary)' }}
                      >
                        {agent.nodeId.slice(0, 12)}
                      </span>
                      <span
                        className="text-[10px] flex-shrink-0"
                        style={{ color: statusInfo.color }}
                      >
                        {statusInfo.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Execution log */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div
            className="px-4 py-2 shrink-0"
            style={{ borderBottom: '1px solid var(--gui-border)' }}
          >
            <span
              className="text-[10px] font-medium uppercase tracking-wider"
              style={{ color: 'var(--gui-text-muted)' }}
            >
              Execution Log ({logEntries.length} entries)
            </span>
          </div>
          <div className="flex-1 overflow-auto font-mono text-[11px] px-2">
            {logEntries.length === 0 ? (
              <div
                className="flex items-center justify-center h-full text-xs"
                style={{ color: 'var(--gui-text-muted)' }}
              >
                No execution history
              </div>
            ) : (
              logEntries.map((entry, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 px-2 py-0.5"
                  style={{
                    borderBottom: '1px solid var(--gui-border)',
                  }}
                >
                  <span
                    className="flex-shrink-0 text-[9px]"
                    style={{ color: 'var(--gui-text-muted)' }}
                  >
                    {new Date(entry.timestamp).toLocaleTimeString(undefined, {
                      hour12: false,
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                  <span
                    className="flex-shrink-0 w-8 text-center text-[9px] font-semibold uppercase"
                    style={{
                      color:
                        entry.level === 'error'
                          ? '#ef4444'
                          : entry.level === 'warn'
                          ? '#f59e0b'
                          : 'var(--gui-text-muted)',
                    }}
                  >
                    {entry.level}
                  </span>
                  <span
                    className="truncate"
                    style={{
                      color:
                        entry.level === 'error'
                          ? '#ef4444'
                          : entry.level === 'warn'
                          ? '#f59e0b'
                          : 'var(--gui-text-primary)',
                    }}
                  >
                    {entry.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export const OrchestratorArtboard = memo(OrchestratorArtboardComponent)
