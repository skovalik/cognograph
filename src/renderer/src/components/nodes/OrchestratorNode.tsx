// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { memo, useMemo, useCallback, useEffect } from 'react'
import { NodeResizer, useUpdateNodeInternals, type NodeProps, type ResizeParams } from '@xyflow/react'
import { SpreadHandles } from './SpreadHandles'
import { Workflow, Play, Pause, Square, ChevronDown, ChevronRight } from 'lucide-react'
import type { OrchestratorNodeData, ConnectedAgentStatus } from '@shared/types'
import { DEFAULT_THEME_SETTINGS } from '@shared/types'
import { useWorkspaceStore, useIsSpawning, useNodeWarmth, useIsNodePinned, useIsNodeBookmarked, useNodeNumberedBookmark } from '../../stores/workspaceStore'
import { useShowMembersClass } from '../../hooks/useShowMembersClass'
import { useIsGlassEnabled } from '../../hooks/useIsGlassEnabled'
import { EditableTitle } from '../EditableTitle'
import { NodeModeDropdown } from './NodeModeDropdown'
import { useNodeResize } from '../../hooks/useNodeResize'
import { useNodeContentVisibility } from '../../hooks/useSemanticZoom'
import { DecryptedText } from '../ui/react-bits'
import { AIPropertyAssist, NodeAIErrorBoundary } from '../properties'
import { OrchestratorBadge } from '../bridge/OrchestratorBadge'
import { ExecutionStatusBadge } from '../ExecutionStatusBadge'
import { NodePropertyControls } from './NodePropertyControls'
import { useExecutionStatusStore } from '../../stores/executionStatusStore'

// TypeScript interface for node styles with CSS custom properties
interface NodeStyleWithCustomProps extends React.CSSProperties {
  '--node-accent'?: string
  '--ring-color'?: string
}

// Default dimensions
const DEFAULT_WIDTH = 360
const DEFAULT_HEIGHT = 280
const MIN_WIDTH = 300
const MIN_HEIGHT = 200

// Strategy display labels
const STRATEGY_LABELS: Record<string, { icon: string; label: string }> = {
  sequential: { icon: '\u2192\u2192\u2192', label: 'Sequential' },
  parallel: { icon: '\u21F6', label: 'Parallel' },
  conditional: { icon: '\u2461', label: 'Conditional' },
}

// Agent status indicators
const STATUS_DISPLAY: Record<ConnectedAgentStatus, { icon: string; colorClass: string }> = {
  idle: { icon: '\u25CB', colorClass: 'text-gray-400' },
  queued: { icon: '\u23F3', colorClass: 'text-blue-400' },
  running: { icon: '\u25C9', colorClass: 'text-amber-400' },
  completed: { icon: '\u2713', colorClass: 'text-emerald-400' },
  failed: { icon: '\u2717', colorClass: 'text-red-400' },
  skipped: { icon: '\u2298', colorClass: 'text-gray-500' },
  retrying: { icon: '\u21BB', colorClass: 'text-orange-400' },
}

function getBudgetPercentage(used: number, limit: number | undefined): number | null {
  if (limit === undefined || limit <= 0) return null
  return Math.min((used / limit) * 100, 100)
}

function getBudgetColor(percentage: number): string {
  if (percentage >= 90) return '#ef4444'  // red
  if (percentage >= 70) return '#f59e0b'  // amber
  return '#10b981'  // green
}

/**
 * ProgressDots — L0 pipeline progress indicator.
 * Shows filled/empty dots representing agent completion state.
 */
function ProgressDots({ completed, total, color }: { completed: number; total: number; color: string }): JSX.Element {
  return (
    <div className="progress-dots" style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`dot ${i < completed ? 'dot--filled' : 'dot--empty'}`}
          style={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: i < completed ? color : 'var(--border-subtle, rgba(255,255,255,0.15))',
            transition: 'background 200ms ease',
          }}
        />
      ))}
    </div>
  )
}

function OrchestratorNodeComponent({ id, data, selected, width, height }: NodeProps): JSX.Element {
  const nodeData = data as OrchestratorNodeData
  const propsWidth = width as number | undefined
  const propsHeight = height as number | undefined
  const updateNodeInternals = useUpdateNodeInternals()
  const nodeRef = useNodeResize(id)
  const updateNode = useWorkspaceStore((state) => state.updateNode)
  const themeSettings = useWorkspaceStore((state) => state.themeSettings)
  const updateNodeDimensions = useWorkspaceStore((state) => state.updateNodeDimensions)
  const startNodeResize = useWorkspaceStore((state) => state.startNodeResize)
  const commitNodeResize = useWorkspaceStore((state) => state.commitNodeResize)

  // Calculate dynamic node color
  const nodeColor = nodeData.color || themeSettings.nodeColors.orchestrator || DEFAULT_THEME_SETTINGS.nodeColors.orchestrator

  // Glass system integration
  const transparent = nodeData.transparent
  const isGlassEnabled = useIsGlassEnabled('nodes', transparent)

  // Node dimensions
  const nodeWidth = propsWidth || (nodeData as Record<string, unknown>).width as number || DEFAULT_WIDTH
  const nodeHeight = propsHeight || (nodeData as Record<string, unknown>).height as number || DEFAULT_HEIGHT
  const effectiveHeight = Math.max(MIN_HEIGHT, nodeHeight)

  const nodeStyle = useMemo((): NodeStyleWithCustomProps => {
    const safeNodeColor = nodeColor ?? themeSettings.nodeColors.orchestrator ?? '#6366f1'

    return {
      '--ring-color': safeNodeColor,
      '--node-accent': safeNodeColor,
      width: nodeWidth,
      height: effectiveHeight,
    }
  }, [nodeColor, themeSettings.nodeColors.orchestrator, nodeWidth, effectiveHeight])

  // Handle resize
  const handleResizeStart = useCallback(() => {
    startNodeResize(id)
  }, [id, startNodeResize])

  const handleResize = useCallback((_event: unknown, params: ResizeParams) => {
    updateNodeDimensions(id, params.width, params.height)
  }, [id, updateNodeDimensions])

  const handleResizeEnd = useCallback(() => {
    updateNodeInternals(id)
    commitNodeResize(id)
  }, [id, updateNodeInternals, commitNodeResize])

  // Sync React Flow bounds on mount
  useEffect(() => {
    updateNodeInternals(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Visual feedback states
  const isSpawning = useIsSpawning(id)
  const warmthLevel = useNodeWarmth(id)
  const isPinned = useIsNodePinned(id)
  const isBookmarked = useIsNodeBookmarked(id)
  const numberedBookmark = useNodeNumberedBookmark(id)
  const isCut = useWorkspaceStore(s => s.clipboardState?.mode === 'cut' && s.clipboardState.nodeIds.includes(id))

  // LOD (Level of Detail) rendering based on zoom level
  const {
    showContent, showTitle, showBadges, showLede,
    showHeader, showFooter, showInteractiveControls,
    lodLevel, zoomLevel
  } = useNodeContentVisibility()

  const isUltraFar = zoomLevel === 'ultra-far'

  // Execution status badge — visible at ALL zoom levels for critical state
  const executionState = useExecutionStatusStore((s) => s.nodeExecutions[id])

  // Show members mode
  const { nonMemberClass, memberHighlightClass } = useShowMembersClass(id, nodeData.parentId)

  // Run state
  const currentRun = nodeData.currentRun
  const isRunning = currentRun?.status === 'running'
  const isPaused = currentRun?.status === 'paused'
  const isPlanning = currentRun?.status === 'planning'
  const isActive = isRunning || isPaused || isPlanning

  // Processing state for is-thinking className
  const isProcessing = isRunning || isPlanning

  // Progress dots: count completed agents
  const completedAgents = useMemo(() =>
    nodeData.connectedAgents.filter(a => a.status === 'completed').length,
    [nodeData.connectedAgents]
  )
  const totalAgents = nodeData.connectedAgents.length

  // Build className
  const nodeClassName = [
    'cognograph-node cognograph-node--orchestrator',
    selected && 'selected',
    isSpawning && 'spawning',
    isActive && 'cognograph-node--active-run',
    // is-active reserved for functional state only (not selection)
    isProcessing && 'is-thinking',
    nonMemberClass,
    memberHighlightClass,
    warmthLevel && `warmth-${warmthLevel}`,
    isPinned && 'node--pinned',
    isBookmarked && 'cognograph-node--bookmarked',
    isCut && 'cognograph-node--cut',
    (nodeData as Record<string, unknown>).nodeShape && `node-shape-${(nodeData as Record<string, unknown>).nodeShape}`,
    `orchestrator-node--lod-${zoomLevel}`
  ].filter(Boolean).join(' ')

  // Strategy label
  const strategy = STRATEGY_LABELS[nodeData.strategy] || STRATEGY_LABELS.sequential

  // Strategy dropdown options
  const strategyOptions = useMemo(() => [
    {
      value: 'sequential',
      label: 'Sequential',
      description: 'Run agents one after another',
      color: nodeColor
    },
    {
      value: 'parallel',
      label: 'Parallel',
      description: 'Run all agents simultaneously',
      color: nodeColor
    },
    {
      value: 'conditional',
      label: 'Conditional',
      description: 'Run agents based on conditions',
      color: nodeColor
    }
  ], [nodeColor])

  const handleStrategyChange = useCallback((newStrategy: string) => {
    updateNode(id, { strategy: newStrategy as 'sequential' | 'parallel' | 'conditional' })
  }, [id, updateNode])

  // Budget progress
  const budgetTokens = getBudgetPercentage(
    (currentRun?.totalInputTokens ?? 0) + (currentRun?.totalOutputTokens ?? 0),
    nodeData.budget.maxTotalTokens
  )
  const budgetCost = getBudgetPercentage(
    currentRun?.totalCostUSD ?? 0,
    nodeData.budget.maxTotalCostUSD
  )

  // Run controls
  const handleStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (window.api?.orchestrator) {
      window.api.orchestrator.start(id).catch(() => {
        // Silently handle errors
      })
    }
  }, [id])

  const handlePause = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (window.api?.orchestrator) {
      window.api.orchestrator.pause(id).catch(() => {
        // Silently handle errors
      })
    }
  }, [id])

  const handleResume = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (window.api?.orchestrator) {
      window.api.orchestrator.resume(id).catch(() => {
        // Silently handle errors
      })
    }
  }, [id])

  const handleAbort = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (window.api?.orchestrator) {
      window.api.orchestrator.abort(id).catch(() => {
        // Silently handle errors
      })
    }
  }, [id])

  // Collapse toggle for run history
  const isCollapsed = nodeData.collapsed ?? true
  const handleToggleCollapse = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    updateNode(id, { collapsed: !isCollapsed })
  }, [id, isCollapsed, updateNode])

  // Budget summary line for L2 mid zoom
  const budgetSummaryLine = useMemo(() => {
    if (budgetTokens === null && budgetCost === null) return 'Budget: Unlimited'
    const parts: string[] = []
    if (budgetTokens !== null) parts.push(`Tokens: ${Math.round(budgetTokens)}%`)
    if (budgetCost !== null) parts.push(`Cost: $${(currentRun?.totalCostUSD ?? 0).toFixed(2)}`)
    return parts.join(' | ')
  }, [budgetTokens, budgetCost, currentRun?.totalCostUSD])

  const nodeContent = (
    <div
      ref={nodeRef}
      className={nodeClassName}
      style={nodeStyle}
      data-lod={lodLevel}
      data-transparent={transparent}
      {...(isUltraFar ? { role: 'img', 'aria-label': `Orchestrator: ${nodeData.title}` } : {})}
    >
      {/* Type label: floats above node */}
      <div className="cognograph-node__type-label" style={{ color: nodeColor ?? '#6366f1' }}>
        ORCHESTRATOR
      </div>

      {/* ================================================================
          L1+ (far and above): Handles on all four sides
          Suppressed at L0 — no connection affordance at navigation level
          ================================================================ */}
      <SpreadHandles hidden={isUltraFar} />

      {/* Numbered bookmark badge — visible at L1+ (navigation aid) */}
      {!isUltraFar && numberedBookmark && (
        <div className={`numbered-bookmark-badge numbered-bookmark-badge--${numberedBookmark}`}>
          {numberedBookmark}
        </div>
      )}

      {/* Bridge: Orchestrator activity badge (Phase 1) — L1+ */}
      {showTitle && <OrchestratorBadge nodeId={id} />}

      {/* Execution status badge (Phase 5A) — visible at all zoom levels */}
      {executionState && (
        <ExecutionStatusBadge
          status={executionState.status}
          message={executionState.message}
        />
      )}

      {/* ================================================================
          L0 (ultra-far, lodLevel 0): Pipeline icon + progress dots
          Minimal DOM — icon, progress dots, optional pulse for active runs
          ================================================================ */}
      {isUltraFar && (
        <div className="flex items-center justify-center gap-2 h-full" aria-hidden={false}>
          <Workflow className="w-5 h-5 flex-shrink-0" style={{ color: nodeColor }} />
          {totalAgents > 0 && (
            <ProgressDots completed={completedAgents} total={totalAgents} color={nodeColor ?? '#6366f1'} />
          )}
          {/* Active run pulse indicator at L0 */}
          {isProcessing && (
            <div
              className="absolute inset-0 rounded-lg pointer-events-none"
              style={{
                boxShadow: `0 0 8px 2px ${nodeColor ?? '#6366f1'}80`,
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
              }}
            />
          )}
        </div>
      )}

      {/* ================================================================
          L1 (far, lodLevel 1): Title + strategy label + step dots
          ================================================================ */}
      {zoomLevel === 'far' && (
        <div className="flex items-center justify-center gap-1.5 h-full" aria-hidden={false}>
          <Workflow className="w-4 h-4 flex-shrink-0" style={{ color: nodeColor }} />
          <span
            className="text-[11px] font-medium truncate"
            style={{ color: 'var(--node-text-primary)', maxWidth: '120px' }}
          >
            {nodeData.title}
          </span>
          <span className="text-[9px] px-1 py-0.5 rounded" style={{
            background: `${nodeColor}30`,
            color: nodeColor
          }}>
            {strategy.label}
          </span>
          {totalAgents > 0 && (
            <ProgressDots completed={completedAgents} total={totalAgents} color={nodeColor ?? '#6366f1'} />
          )}
          {isActive && (
            <span className={`text-[9px] px-1 py-0.5 rounded ${
              isRunning ? 'text-amber-400 animate-pulse' :
              isPaused ? 'text-blue-400' : 'text-gray-400'
            }`} style={{ background: 'rgba(0,0,0,0.3)' }}>
              {currentRun?.status}
            </span>
          )}
        </div>
      )}

      {/* ================================================================
          L1+ (far and above): Header with title + controls
          ================================================================ */}
      {showHeader && zoomLevel !== 'far' && (
        <div className="cognograph-node__header" style={{ borderBottomColor: `${nodeColor}30` }}>
          <Workflow className="w-4 h-4 flex-shrink-0" style={{ color: nodeColor }} />
          <EditableTitle
            value={nodeData.title}
            onChange={(title) => updateNode(id, { title })}
            className="cognograph-node__title"
          />
          {/* AI Property Assist — L3+ only */}
          {showInteractiveControls && (
            <NodeAIErrorBoundary compact>
              <AIPropertyAssist
                nodeId={id}
                nodeData={nodeData}
                compact={true}
              />
            </NodeAIErrorBoundary>
          )}
          {/* Strategy dropdown — L3+ only (interactive control) */}
          {showInteractiveControls && (
            <NodeModeDropdown
              value={nodeData.strategy}
              options={strategyOptions}
              onChange={handleStrategyChange}
              nodeColor={nodeColor}
            />
          )}
          {/* Strategy label at L2 mid zoom (read-only badge) */}
          {showLede && !showContent && (
            <span className="text-[10px] px-1.5 py-0.5 rounded ml-auto" style={{
              background: `${nodeColor}20`,
              color: nodeColor
            }}>
              {strategy.label}
            </span>
          )}
          {/* Run controls — L3+ only */}
          {showInteractiveControls && (
            <div className="ml-auto flex items-center gap-0.5 flex-shrink-0">
              {!isActive && (
                <button
                  onClick={handleStart}
                  className="p-1 rounded hover:bg-white/10 transition-colors"
                  title="Start pipeline"
                >
                  <Play className="w-3 h-3" style={{ color: nodeColor }} />
                </button>
              )}
              {isRunning && (
                <button
                  onClick={handlePause}
                  className="p-1 rounded hover:bg-white/10 transition-colors"
                  title="Pause pipeline"
                >
                  <Pause className="w-3 h-3" style={{ color: nodeColor }} />
                </button>
              )}
              {isPaused && (
                <button
                  onClick={handleResume}
                  className="p-1 rounded hover:bg-white/10 transition-colors"
                  title="Resume pipeline"
                >
                  <Play className="w-3 h-3" style={{ color: '#10b981' }} />
                </button>
              )}
              {isActive && (
                <button
                  onClick={handleAbort}
                  className="p-1 rounded hover:bg-white/10 transition-colors"
                  title="Abort pipeline"
                >
                  <Square className="w-3 h-3" style={{ color: '#ef4444' }} />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================================================================
          L2 (mid, lodLevel 2): Agent list with status indicators +
          token budget bar (horizontal progress)
          ================================================================ */}
      {showLede && !showContent && (
        <div className="cognograph-node__body text-xs flex flex-col gap-1.5 overflow-hidden">
          {/* Agent list with status indicators */}
          {nodeData.connectedAgents.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              {nodeData.connectedAgents.map((agent) => {
                const statusInfo = STATUS_DISPLAY[agent.status]
                return (
                  <div key={agent.nodeId} className="flex items-center gap-1.5 text-[var(--node-text-secondary)]">
                    <span className={`${statusInfo.colorClass} ${agent.status === 'running' ? 'animate-pulse' : ''}`}>
                      {statusInfo.icon}
                    </span>
                    <span className="truncate text-[10px]">{agent.nodeId.slice(0, 8)}</span>
                    <span className="ml-auto text-[9px] opacity-60">{agent.status}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <span className="text-[10px] text-[var(--node-text-muted)] italic">No agents</span>
          )}

          {/* Token budget bar (horizontal progress) */}
          {budgetTokens !== null && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[var(--node-text-secondary)] w-10 flex-shrink-0">Tokens</span>
              <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${budgetTokens}%`,
                    backgroundColor: getBudgetColor(budgetTokens),
                  }}
                />
              </div>
              <span className="text-[9px] text-[var(--node-text-muted)] flex-shrink-0">{Math.round(budgetTokens)}%</span>
            </div>
          )}
          {budgetTokens === null && budgetCost === null && (
            <span className="text-[10px] text-[var(--node-text-muted)]">{budgetSummaryLine}</span>
          )}
        </div>
      )}

      {/* ================================================================
          L3+ (close/ultra-close, lodLevel 3-4): Full pipeline view +
          execution log + budget bars + run history
          ================================================================ */}
      {showContent && (
        <div className="cognograph-node__body text-xs flex flex-col gap-1.5 overflow-hidden">
          {/* Full budget meters */}
          {(budgetTokens !== null || budgetCost !== null) && (
            <div className="flex flex-col gap-0.5">
              {budgetTokens !== null && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[var(--node-text-secondary)] w-10 flex-shrink-0">Tokens</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${budgetTokens}%`,
                        backgroundColor: getBudgetColor(budgetTokens),
                      }}
                    />
                  </div>
                  <span className="text-[9px] text-[var(--node-text-muted)] flex-shrink-0">
                    {((currentRun?.totalInputTokens ?? 0) + (currentRun?.totalOutputTokens ?? 0)).toLocaleString()} / {nodeData.budget.maxTotalTokens?.toLocaleString()}
                  </span>
                </div>
              )}
              {budgetCost !== null && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[var(--node-text-secondary)] w-10 flex-shrink-0">Cost</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${budgetCost}%`,
                        backgroundColor: getBudgetColor(budgetCost),
                      }}
                    />
                  </div>
                  <span className="text-[9px] text-[var(--node-text-muted)] flex-shrink-0">
                    ${(currentRun?.totalCostUSD ?? 0).toFixed(4)} / ${nodeData.budget.maxTotalCostUSD?.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}
          {budgetTokens === null && budgetCost === null && (
            <span className="text-[10px] text-[var(--node-text-muted)]">Budget: Unlimited</span>
          )}

          {/* Full agent list with status indicators */}
          {nodeData.connectedAgents.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-medium text-[var(--node-text-secondary)] uppercase">Agents</span>
              {nodeData.connectedAgents.map((agent, idx) => {
                const statusInfo = STATUS_DISPLAY[agent.status]
                return (
                  <div key={agent.nodeId} className="flex items-center gap-1.5 text-[var(--node-text-secondary)]">
                    <span className="text-[10px] opacity-50 w-3 text-right">{idx + 1}.</span>
                    <span className={`${statusInfo.colorClass} ${agent.status === 'running' ? 'animate-pulse' : ''}`}>
                      {statusInfo.icon}
                    </span>
                    <span className="truncate text-[11px]">{agent.nodeId.slice(0, 8)}</span>
                    <span className="ml-auto text-[9px] opacity-60">{agent.status}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <span className="text-[10px] text-[var(--node-text-muted)] italic">
              No agents connected. Draw edges to agent nodes.
            </span>
          )}

          {/* Collapsible run history — L3+ only */}
          {nodeData.runHistory.length > 0 && (
            <div>
              <button
                onClick={handleToggleCollapse}
                className="flex items-center gap-1 text-[10px] text-[var(--node-text-secondary)] hover:text-[var(--node-text-primary)] transition-colors"
              >
                {isCollapsed ? (
                  <ChevronRight className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
                <span>Last Runs ({nodeData.runHistory.length})</span>
              </button>
              {!isCollapsed && (
                <div className="mt-1 flex flex-col gap-0.5 max-h-16 overflow-y-auto">
                  {nodeData.runHistory.slice(0, 5).map((run) => (
                    <div key={run.id} className="flex items-center gap-2 text-[9px] text-[var(--node-text-muted)]">
                      <span>{new Date(run.startedAt).toLocaleString()}</span>
                      <span>{run.agentResults.length} agents</span>
                      <span>${run.totalCostUSD.toFixed(4)}</span>
                      <span className={run.status === 'completed' ? 'text-emerald-400' : run.status === 'failed' ? 'text-red-400' : 'text-amber-400'}>
                        {run.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================================================================
          L2+ (mid and above): Footer
          ================================================================ */}
      {showFooter && showContent && (
        <div className="cognograph-node__footer flex items-center gap-2 text-[10px] text-[var(--node-text-muted)]">
          <NodePropertyControls nodeId={id} nodeType="orchestrator" data={data as Record<string, unknown>} />
          <span className="capitalize">{nodeData.failurePolicy.type}</span>
          <span>Retries: {nodeData.failurePolicy.maxRetries}</span>
          {currentRun && (
            <span className={
              currentRun.status === 'running' ? 'text-amber-400 animate-pulse' :
              currentRun.status === 'completed' ? 'text-emerald-400' :
              currentRun.status === 'failed' ? 'text-red-400' :
              ''
            }>
              {currentRun.status}
            </span>
          )}
        </div>
      )}

      {/* L2 (mid): Simplified footer with agent count + status */}
      {showFooter && !showContent && (
        <div className="cognograph-node__footer flex items-center gap-2 text-[10px] text-[var(--node-text-muted)]" style={{ opacity: 0.7 }}>
          <span>{totalAgents} agent{totalAgents !== 1 ? 's' : ''}</span>
          <span className="capitalize">{nodeData.failurePolicy.type}</span>
          {currentRun && (
            <span className={
              currentRun.status === 'running' ? 'text-amber-400 animate-pulse' :
              currentRun.status === 'completed' ? 'text-emerald-400' :
              currentRun.status === 'failed' ? 'text-red-400' :
              ''
            }>
              {currentRun.status}
            </span>
          )}
        </div>
      )}
    </div>
  )

  return (
    <>
      {showInteractiveControls && (
        <NodeResizer
          minWidth={MIN_WIDTH}
          minHeight={MIN_HEIGHT}
          isVisible={selected}
          onResizeStart={handleResizeStart}
          onResize={handleResize}
          onResizeEnd={handleResizeEnd}
          handleClassName="w-2 h-2"
          handleStyle={{ borderColor: nodeColor, backgroundColor: nodeColor, opacity: 0.7 }}
          lineStyle={{ borderColor: nodeColor, opacity: 0.4 }}
        />
      )}
      {nodeContent}
    </>
  )
}

export const OrchestratorNode = memo(OrchestratorNodeComponent)
