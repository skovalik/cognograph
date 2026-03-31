// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { memo, useMemo, useCallback, useEffect, useState } from 'react'
import { NodeResizer, useUpdateNodeInternals, type NodeProps, type ResizeParams } from '@xyflow/react'
import { SpreadHandles } from './SpreadHandles'
import { Zap, Play, Power } from 'lucide-react'
import type { ActionNodeData } from '@shared/actionTypes'
import { DEFAULT_THEME_SETTINGS } from '@shared/types'
import { useWorkspaceStore, useIsSpawning, useNodeWarmth, useIsNodePinned, useIsNodeBookmarked, useNodeNumberedBookmark } from '../../stores/workspaceStore'
import { useShowMembersClass } from '../../hooks/useShowMembersClass'
import { useIsGlassEnabled } from '../../hooks/useIsGlassEnabled'
import { EditableTitle } from '../EditableTitle'
import { AttachmentBadge } from './AttachmentBadge'
import { useNodeResize } from '../../hooks/useNodeResize'
import { useNodeContentVisibility } from '../../hooks/useSemanticZoom'
import { AIPropertyAssist, NodeAIErrorBoundary } from '../properties'
import { NodePropertyControls } from './NodePropertyControls'
import { CONIC_PALETTES } from '../../constants/conicPalettes'

// TypeScript interface for node styles with CSS custom properties
interface NodeStyleWithCustomProps extends React.CSSProperties {
  '--node-accent'?: string
  '--ring-color'?: string
  '--conic-color-1'?: string
  '--conic-color-2'?: string
  '--conic-color-3'?: string
  '--conic-color-4'?: string
}

// Default dimensions
const DEFAULT_WIDTH = 280
const DEFAULT_HEIGHT = 140
const MIN_WIDTH = 220
const MIN_HEIGHT = 100

// Trigger type display labels
const TRIGGER_LABELS: Record<string, string> = {
  'property-change': 'Property Change',
  'manual': 'Manual',
  'schedule': 'Schedule',
  'node-created': 'Node Created',
  'connection-made': 'Connection Made',
  'region-enter': 'Region Enter',
  'region-exit': 'Region Exit',
  'cluster-size': 'Cluster Size',
  'proximity': 'Proximity',
  'children-complete': 'Children Complete',
  'ancestor-change': 'Ancestor Change',
  'connection-count': 'Connection Count',
  'isolation': 'Isolation'
}

// Trigger type short labels (for L1 compact display)
const TRIGGER_SHORT_LABELS: Record<string, string> = {
  'property-change': 'on-change',
  'manual': 'manual',
  'schedule': 'on-schedule',
  'node-created': 'on-create',
  'connection-made': 'on-connect',
  'region-enter': 'on-enter',
  'region-exit': 'on-exit',
  'cluster-size': 'on-cluster',
  'proximity': 'on-proximity',
  'children-complete': 'on-complete',
  'ancestor-change': 'on-ancestor',
  'connection-count': 'on-connections',
  'isolation': 'on-isolate'
}

// Step type short labels
const STEP_TYPE_LABELS: Record<string, string> = {
  'update-property': 'update',
  'create-node': 'create',
  'delete-node': 'delete',
  'move-node': 'move',
  'link-nodes': 'link',
  'unlink-nodes': 'unlink',
  'wait': 'wait',
  'condition': 'if',
  'llm-call': 'AI',
  'http-request': 'HTTP'
}

function ActionNodeComponent({ id, data, selected, width, height }: NodeProps): JSX.Element {
  const nodeData = data as ActionNodeData
  const propsWidth = width as number | undefined
  const propsHeight = height as number | undefined
  const updateNodeInternals = useUpdateNodeInternals()
  const nodeRef = useNodeResize(id)
  const updateNode = useWorkspaceStore((state) => state.updateNode)
  const themeSettings = useWorkspaceStore((state) => state.themeSettings)
  const updateNodeDimensions = useWorkspaceStore((state) => state.updateNodeDimensions)
  const startNodeResize = useWorkspaceStore((state) => state.startNodeResize)
  const commitNodeResize = useWorkspaceStore((state) => state.commitNodeResize)

  // Rename trigger (F2 / context menu Rename)
  const [renameTriggered, setRenameTriggered] = useState(false)
  useEffect(() => {
    function handleRename(e: Event) {
      const detail = (e as CustomEvent).detail
      if (detail?.nodeId === id) {
        setRenameTriggered(true)
        requestAnimationFrame(() => setRenameTriggered(false))
      }
    }
    window.addEventListener('rename-node', handleRename)
    return () => window.removeEventListener('rename-node', handleRename)
  }, [id])

  // Calculate dynamic node color
  const nodeColor = nodeData.color || themeSettings.nodeColors.action || DEFAULT_THEME_SETTINGS.nodeColors.action

  // Glass system integration
  const transparent = nodeData.transparent
  const isGlassEnabled = useIsGlassEnabled('nodes', transparent)

  // Node dimensions - prefer props from React Flow, then data, then defaults
  const nodeWidth = propsWidth || nodeData.width || DEFAULT_WIDTH
  const nodeHeight = propsHeight || nodeData.height || DEFAULT_HEIGHT
  const effectiveHeight = Math.max(MIN_HEIGHT, nodeHeight)

  // Check if node is disabled
  const isDisabled = nodeData.enabled === false

  const nodeStyle = useMemo((): NodeStyleWithCustomProps => {
    const safeNodeColor = nodeColor ?? themeSettings.nodeColors.action ?? '#10b981'
    const palette = CONIC_PALETTES['action'] || CONIC_PALETTES.default

    return {
      '--ring-color': safeNodeColor,
      '--node-accent': safeNodeColor,
      '--conic-color-1': palette[0],
      '--conic-color-2': palette[1],
      '--conic-color-3': palette[2],
      '--conic-color-4': palette[3],
      width: nodeWidth,
      height: effectiveHeight,
      // Grayscale + dim for disabled actions at ALL zoom levels
      ...(isDisabled && {
        filter: 'grayscale(1)',
        opacity: 0.5
      })
    }
  }, [nodeColor, themeSettings.nodeColors.action, nodeWidth, effectiveHeight, isDisabled])

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
    showPlaceholders, zoomLevel, lodLevel
  } = useNodeContentVisibility()

  const isUltraFar = zoomLevel === 'ultra-far'

  // Show members mode - dim non-members
  const { nonMemberClass, memberHighlightClass } = useShowMembersClass(id, nodeData.parentId)

  // Activity indicator: spawning = processing analog for action nodes
  const isProcessing = isSpawning

  // Build className
  const nodeClassName = [
    'cognograph-node',
    'cognograph-node--action',
    selected && 'selected',
    // is-active reserved for functional state only (not selection)
    isProcessing && 'is-thinking',
    isDisabled && 'cognograph-node--disabled',
    !nodeData.enabled && 'action-node--inactive',
    isSpawning && 'spawning',
    nonMemberClass,
    memberHighlightClass,
    warmthLevel && `warmth-${warmthLevel}`,
    isPinned && 'node--pinned',
    isBookmarked && 'cognograph-node--bookmarked',
    isCut && 'cognograph-node--cut',
    nodeData.nodeShape && `node-shape-${nodeData.nodeShape}`
  ].filter(Boolean).join(' ')

  // Build trigger summary
  const triggerLabel = TRIGGER_LABELS[nodeData.trigger.type] || nodeData.trigger.type
  const triggerShortLabel = TRIGGER_SHORT_LABELS[nodeData.trigger.type] || nodeData.trigger.type

  // Build action steps summary
  const activeSteps = nodeData.actions.filter(s => !s.disabled)
  const stepsLabels = activeSteps.map(s => STEP_TYPE_LABELS[s.type] || s.type)

  // First 2 steps for L2 compact list
  const compactSteps = activeSteps.slice(0, 2)

  // Manual trigger handler
  const handleManualTrigger = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    // Dispatch a custom event that the action store will pick up
    window.dispatchEvent(new CustomEvent('action:manual-trigger', { detail: { actionNodeId: id } }))
  }, [id])

  // Toggle enabled/disabled
  const handleToggleEnabled = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    updateNode(id, { enabled: !nodeData.enabled })
  }, [id, nodeData.enabled, updateNode])

  const nodeContent = (
    <div
      ref={nodeRef}
      className={nodeClassName}
      style={nodeStyle}
      data-lod={zoomLevel}
      data-lod-level={lodLevel}
      data-transparent={transparent}
      {...(isUltraFar ? { role: 'img', 'aria-label': `Action: ${nodeData.title}` } : {})}
    >
      {/* Type label: floats above node */}
      <div className="cognograph-node__type-label">
        ACTION
      </div>

      {/* ================================================================
          L0 (ultra-far): Trigger shape icon + enabled/disabled status dot
          Minimal DOM. No handles, no text, no editor.
          ================================================================ */}
      {isUltraFar && (
        <div className="flex items-center justify-center gap-2 h-full">
          <Zap className="w-5 h-5 flex-shrink-0" style={{ color: nodeColor }} />
          <span
            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${nodeData.enabled ? 'bg-emerald-400' : 'bg-[var(--text-muted)]'}`}
            aria-label={nodeData.enabled ? 'Enabled' : 'Disabled'}
          />
        </div>
      )}

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

      {/* Enabled/disabled status dot — always visible at L1+ (important state indicator) */}
      {!isUltraFar && (
        <span
          className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${nodeData.enabled ? 'bg-emerald-400' : 'bg-[var(--text-muted)]'}`}
          title={nodeData.enabled ? 'Enabled' : 'Disabled'}
          aria-label={nodeData.enabled ? 'Action enabled' : 'Action disabled'}
        />
      )}

      {/* ================================================================
          L1 (far): Title + trigger type label + status dot
          Shows identity and trigger type at a glance.
          ================================================================ */}
      {showHeader && (
        <div className="cognograph-node__header" style={{ borderBottomColor: `${nodeColor}30` }}>
          <Zap className="w-4 h-4 flex-shrink-0" style={{ color: nodeColor }} />
          {showTitle && (
            <EditableTitle
              value={nodeData.title}
              onChange={(title) => updateNode(id, { title })}
              className="cognograph-node__title"
              startEditing={renameTriggered}
            />
          )}
          {/* Trigger type badge at L1 — visible when not showing full content */}
          {showBadges && !showContent && (
            <span
              className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
              style={{
                backgroundColor: `${nodeColor}20`,
                color: nodeColor
              }}
            >
              {triggerShortLabel}
            </span>
          )}
          {/* AI Property Assist — L3+ only (interactive control) */}
          {showInteractiveControls && (
            <div className="node-chrome--hover">
              <NodeAIErrorBoundary compact>
                <AIPropertyAssist
                  nodeId={id}
                  nodeData={nodeData}
                  compact={true}
                />
              </NodeAIErrorBoundary>
            </div>
          )}
          {/* Manual trigger button — L3+ only */}
          {showInteractiveControls && (
            <button
              onClick={handleManualTrigger}
              className="ml-auto p-1 rounded hover:bg-white/10 transition-colors flex-shrink-0"
              title="Run manually"
            >
              <Play className="w-3 h-3" style={{ color: nodeColor }} />
            </button>
          )}
        </div>
      )}

      {/* ================================================================
          L1 (far): Placeholder shimmer bars for content preview
          showPlaceholders is true only at L1.
          ================================================================ */}
      {showPlaceholders && nodeData.description && (
        <div className="cognograph-node__body" style={{ pointerEvents: 'none' }}>
          <div className="flex flex-col gap-1.5 px-1">
            <div className="h-2 rounded-full bg-current opacity-10" style={{ width: '80%' }} />
            <div className="h-2 rounded-full bg-current opacity-10" style={{ width: '60%' }} />
          </div>
        </div>
      )}

      {/* ================================================================
          L2 (mid): Trigger description (1-2 lines) + first 2 action steps
          as compact list. Summary card mode.
          ================================================================ */}
      {showLede && (
        <div className="cognograph-node__body text-xs flex flex-col gap-1 overflow-hidden" style={{ opacity: 0.8 }}>
          {/* WHEN line — trigger type with detail */}
          <div className="flex items-center gap-1.5 text-[var(--node-text-secondary)]">
            <span className="font-medium uppercase text-[10px] opacity-70">WHEN:</span>
            <span className="truncate">{triggerLabel}</span>
            {nodeData.trigger.type === 'property-change' && (
              <span className="opacity-60 truncate">
                ({(nodeData.trigger as { property?: string }).property || '?'})
              </span>
            )}
          </div>

          {/* First 2 action steps as compact list */}
          {compactSteps.length > 0 && (
            <div className="flex items-center gap-1.5 text-[var(--node-text-secondary)]">
              <span className="font-medium uppercase text-[10px] opacity-70">THEN:</span>
              <span className="truncate">
                {compactSteps.map(s => STEP_TYPE_LABELS[s.type] || s.type).join(', ')}
                {activeSteps.length > 2 && ` +${activeSteps.length - 2}`}
              </span>
            </div>
          )}

          {/* Run count at mid zoom */}
          {nodeData.runCount > 0 && (
            <span className="text-[10px] text-[var(--node-text-muted)]">
              Runs: {nodeData.runCount}
            </span>
          )}
        </div>
      )}

      {/* ================================================================
          L3+ (close and above): Full trigger config + all steps +
          enable/disable toggle + test button.
          Full body content — expensive interactive controls mount here.
          ================================================================ */}
      {showContent && (
        <div className="cognograph-node__body text-xs flex flex-col gap-1 overflow-hidden">
          {/* WHEN line — full trigger description */}
          <div className="flex items-center gap-1.5 text-[var(--node-text-secondary)]">
            <span className="font-medium uppercase text-[10px] opacity-70">WHEN:</span>
            <span className="truncate">{triggerLabel}</span>
            {nodeData.trigger.type === 'property-change' && (
              <span className="opacity-60 truncate">
                ({(nodeData.trigger as { property?: string }).property || '?'})
              </span>
            )}
          </div>

          {/* THEN — all steps */}
          {stepsLabels.length > 0 && (
            <div className="flex items-center gap-1.5 text-[var(--node-text-secondary)]">
              <span className="font-medium uppercase text-[10px] opacity-70">THEN:</span>
              <span className="truncate">{stepsLabels.join(', ')}</span>
            </div>
          )}

          {/* IF — conditions */}
          {nodeData.conditions.length > 0 && (
            <div className="flex items-center gap-1.5 text-[var(--node-text-secondary)]">
              <span className="font-medium uppercase text-[10px] opacity-70">IF:</span>
              <span>{nodeData.conditions.length} condition{nodeData.conditions.length > 1 ? 's' : ''}</span>
            </div>
          )}

          {/* Description (if present) */}
          {nodeData.description && (
            <p className="text-[11px] text-[var(--node-text-muted)] mt-1 line-clamp-2">
              {nodeData.description}
            </p>
          )}
        </div>
      )}

      {/* ================================================================
          L2 (mid): Simplified footer — attachment count only
          ================================================================ */}
      {showFooter && !showContent && (
        <div className="cognograph-node__footer flex items-center gap-2 text-[10px] text-[var(--node-text-muted)]" style={{ opacity: 0.7 }}>
          {nodeData.attachments && nodeData.attachments.length > 0 && (
            <AttachmentBadge count={nodeData.attachments.length} />
          )}
        </div>
      )}

      {/* ================================================================
          L3+ (close and above): Full footer with controls, stats, errors
          ================================================================ */}
      {showFooter && showContent && (
        <div className="cognograph-node__footer flex items-center gap-2 text-[10px] text-[var(--node-text-muted)]">
          <NodePropertyControls nodeId={id} nodeType="action" data={data as Record<string, unknown>} />
          {/* Enable/disable toggle */}
          <button
            onClick={handleToggleEnabled}
            className={`flex items-center gap-1 cursor-pointer transition-colors ${nodeData.enabled ? 'text-emerald-400' : 'text-[var(--text-muted)]'}`}
            title={nodeData.enabled ? 'Click to disable' : 'Click to enable'}
          >
            <Power className="w-3 h-3" />
            <span className={`w-1.5 h-1.5 rounded-full ${nodeData.enabled ? 'bg-emerald-400' : 'bg-[var(--text-muted)]'}`} />
            {nodeData.enabled ? 'Enabled' : 'Disabled'}
          </button>
          {nodeData.runCount > 0 && (
            <span>Runs: {nodeData.runCount}</span>
          )}
          {nodeData.errorCount > 0 && (
            <span className="text-red-400">Errors: {nodeData.errorCount}</span>
          )}
          {nodeData.lastError && (
            <span className="text-red-400 truncate max-w-[150px]" title={nodeData.lastError}>
              {nodeData.lastError}
            </span>
          )}
          {nodeData.attachments && nodeData.attachments.length > 0 && (
            <AttachmentBadge count={nodeData.attachments.length} />
          )}
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* NodeResizer only at L3+ (interactive controls) */}
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

export const ActionNode = memo(ActionNodeComponent)
