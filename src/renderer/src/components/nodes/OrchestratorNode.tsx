import { memo, useMemo, useCallback, useEffect } from 'react'
import { Handle, Position, NodeResizer, useUpdateNodeInternals, type NodeProps, type ResizeParams } from '@xyflow/react'
import { Workflow, Play, Pause, Square, ChevronDown, ChevronRight } from 'lucide-react'
import type { OrchestratorNodeData, ConnectedAgentStatus } from '@shared/types'
import { DEFAULT_THEME_SETTINGS } from '@shared/types'
import { useWorkspaceStore, useIsSpawning, useNodeWarmth, useIsNodePinned, useIsNodeBookmarked, useNodeNumberedBookmark } from '../../stores/workspaceStore'
import { useShowMembersClass } from '../../hooks/useShowMembersClass'
import { useIsGlassEnabled } from '../../hooks/useIsGlassEnabled'
import { EditableTitle } from '../EditableTitle'
import { NodeModeDropdown } from './NodeModeDropdown'
import { useNodeResize } from '../../hooks/useNodeResize'
import { StarBorder, DecryptedText } from '../ui/react-bits'
import { AIPropertyAssist, NodeAIErrorBoundary } from '../properties'
import { OrchestratorBadge } from '../bridge/OrchestratorBadge'

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
    const baseOpacity = 20
    const tintOpacity = themeSettings.isDarkMode ? Math.round(baseOpacity * 0.5) : baseOpacity
    const borderWidth = 2
    const safeNodeColor = nodeColor ?? themeSettings.nodeColors.orchestrator ?? '#6366f1'

    return {
      borderWidth: `${borderWidth}px`,
      borderStyle: 'solid', // FORCE solid borders
      borderColor: safeNodeColor,
      // ALWAYS add opaque background (CSS overrides when glass enabled)
      background: `color-mix(in srgb, ${safeNodeColor} ${tintOpacity}%, var(--node-bg))`,
      boxShadow: selected ? `0 0 0 2px ${safeNodeColor}40, 0 0 20px ${safeNodeColor}30` : 'none',
      width: nodeWidth,
      height: effectiveHeight,
      transition: 'background 200ms ease-out, border-color 200ms ease-out, backdrop-filter 200ms ease-out, opacity 200ms ease-out',
      // CSS custom properties for dynamic theming
      '--ring-color': safeNodeColor,    // Edge handles color
      '--node-accent': safeNodeColor     // Glass background tint
    }
  }, [nodeColor, themeSettings.nodeColors.orchestrator, isGlassEnabled, selected, nodeWidth, effectiveHeight])

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

  // Show members mode
  const { nonMemberClass, memberHighlightClass } = useShowMembersClass(id, nodeData.parentId)

  // Build className
  const nodeClassName = [
    'cognograph-node cognograph-node--orchestrator',
    selected && 'selected',
    isSpawning && 'spawning',
    nonMemberClass,
    memberHighlightClass,
    warmthLevel && `warmth-${warmthLevel}`,
    isPinned && 'node--pinned',
    isBookmarked && 'cognograph-node--bookmarked',
    isCut && 'cognograph-node--cut',
    (nodeData as Record<string, unknown>).nodeShape && `node-shape-${(nodeData as Record<string, unknown>).nodeShape}`,
  ].filter(Boolean).join(' ')

  // Run state
  const currentRun = nodeData.currentRun
  const isRunning = currentRun?.status === 'running'
  const isPaused = currentRun?.status === 'paused'
  const isPlanning = currentRun?.status === 'planning'
  const isActive = isRunning || isPaused || isPlanning

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

  const nodeContent = (
    <div ref={nodeRef} className={nodeClassName} style={nodeStyle} data-transparent={transparent}>
      {/* Handles */}
      <Handle type="target" position={Position.Top} id="top-target" className="cognograph-handle" />
      <Handle type="source" position={Position.Top} id="top-source" className="cognograph-handle" />
      <Handle type="target" position={Position.Bottom} id="bottom-target" className="cognograph-handle" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="cognograph-handle" />
      <Handle type="target" position={Position.Left} id="left-target" className="cognograph-handle" />
      <Handle type="source" position={Position.Left} id="left-source" className="cognograph-handle" />
      <Handle type="target" position={Position.Right} id="right-target" className="cognograph-handle" />
      <Handle type="source" position={Position.Right} id="right-source" className="cognograph-handle" />

      {/* Numbered bookmark badge */}
      {numberedBookmark && (
        <div className={`numbered-bookmark-badge numbered-bookmark-badge--${numberedBookmark}`}>
          {numberedBookmark}
        </div>
      )}

      {/* Bridge: Orchestrator activity badge (Phase 1) */}
      <OrchestratorBadge nodeId={id} />

      {/* Header */}
      <div className="cognograph-node__header" style={{ borderBottomColor: `${nodeColor}30` }}>
        <Workflow className="w-4 h-4 flex-shrink-0" style={{ color: nodeColor }} />
        <EditableTitle
          value={nodeData.title}
          onChange={(title) => updateNode(id, { title })}
          className="cognograph-node__title"
        />
        {/* AI Property Assist */}
        <NodeAIErrorBoundary compact>
          <AIPropertyAssist
            nodeId={id}
            nodeData={nodeData}
            compact={true}
          />
        </NodeAIErrorBoundary>
        {/* Strategy dropdown */}
        <NodeModeDropdown
          value={nodeData.strategy}
          options={strategyOptions}
          onChange={handleStrategyChange}
          nodeColor={nodeColor}
        />
        {/* Run controls */}
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
      </div>

      {/* Body */}
      <div className="cognograph-node__body text-xs flex flex-col gap-1.5 overflow-hidden">
        {/* Budget meter */}
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

        {/* Agent list */}
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

        {/* Collapsible run history */}
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

      {/* Footer */}
      <div className="cognograph-node__footer flex items-center gap-2 text-[10px] text-[var(--node-text-muted)]">
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
    </div>
  )

  return (
    <>
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
      <StarBorder color={nodeColor} speed="4s" thickness={2} borderRadius={12} animate={isActive}>
        {nodeContent}
      </StarBorder>
    </>
  )
}

export const OrchestratorNode = memo(OrchestratorNodeComponent)
