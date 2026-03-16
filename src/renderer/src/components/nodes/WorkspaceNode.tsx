// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { memo, useMemo, useCallback, useEffect } from 'react'
import { Handle, Position, NodeResizer, useUpdateNodeInternals, type NodeProps, type ResizeParams } from '@xyflow/react'
import {
  Eye,
  EyeOff,
  Link2,
  Link2Off,
  Settings2,
  Users,
  Bot,
  Compass
} from 'lucide-react'
import type { WorkspaceNodeData } from '@shared/types'
import { PropertyBadges } from '../properties/PropertyBadge'
import { getPropertiesForNodeType } from '../../constants/properties'
import { useWorkspaceStore, useIsSpawning } from '../../stores/workspaceStore'
import { useIsGlassEnabled } from '../../hooks/useIsGlassEnabled'
import { NodeSocketBars } from './SocketBar'
import { EditableTitle } from '../EditableTitle'
import { EditableText } from '../EditableText'
import { InlineIconPicker } from '../InlineIconPicker'
import { measureTextWidth } from '../../utils/nodeUtils'
import { AttachmentBadge } from './AttachmentBadge'
import { useNodeResize } from '../../hooks/useNodeResize'
import { useNodeContentVisibility } from '../../hooks/useSemanticZoom'
import { AIPropertyAssist, NodeAIErrorBoundary } from '../properties'

// TypeScript interface for node styles with CSS custom properties
interface NodeStyleWithCustomProps extends React.CSSProperties {
  '--node-accent'?: string
  '--ring-color'?: string
}

// Default dimensions
const DEFAULT_WIDTH = 320
const DEFAULT_HEIGHT = 200
const MIN_WIDTH = 280
const MIN_HEIGHT = 150

function WorkspaceNodeComponent({ id, data, selected, width, height }: NodeProps): JSX.Element {
  const nodeData = data as WorkspaceNodeData
  const propsWidth = width as number | undefined
  const propsHeight = height as number | undefined
  const updateNodeInternals = useUpdateNodeInternals()
  const nodeRef = useNodeResize(id)
  const propertySchema = useWorkspaceStore((state) => state.propertySchema)
  const propertyDefinitions = getPropertiesForNodeType('workspace', propertySchema)
  const themeSettings = useWorkspaceStore((state) => state.themeSettings)
  const toggleWorkspaceVisibility = useWorkspaceStore((state) => state.toggleWorkspaceVisibility)
  const toggleWorkspaceLinks = useWorkspaceStore((state) => state.toggleWorkspaceLinks)
  const setSelectedNodes = useWorkspaceStore((state) => state.setSelectedNodes)
  const updateNodeDimensions = useWorkspaceStore((state) => state.updateNodeDimensions)
  const startNodeResize = useWorkspaceStore((state) => state.startNodeResize)
  const commitNodeResize = useWorkspaceStore((state) => state.commitNodeResize)
  const updateNode = useWorkspaceStore((state) => state.updateNode)

  // Calculate dynamic node color - workspace uses red by default
  const nodeColor = nodeData.color || themeSettings.nodeColors.workspace || '#ef4444' // Red

  // Glass system integration
  const transparent = nodeData.transparent
  const isGlassEnabled = useIsGlassEnabled('nodes', transparent)

  // Node dimensions (for resizing) - prefer props from React Flow, then data, then defaults
  const nodeWidth = propsWidth || nodeData.width || DEFAULT_WIDTH
  const nodeHeight = propsHeight || nodeData.height || DEFAULT_HEIGHT

  const nodeStyle = useMemo((): NodeStyleWithCustomProps => {
    const safeNodeColor = nodeColor ?? themeSettings.nodeColors.workspace ?? '#8b5cf7'

    return {
      '--ring-color': safeNodeColor,
      '--node-accent': safeNodeColor,
      width: nodeWidth,
      height: nodeHeight,
    }
  }, [nodeColor, themeSettings.nodeColors.workspace, nodeWidth, nodeHeight])

  // Handle resize - also update node internals to trigger edge recalculation
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

  // Sync React Flow bounds on mount so selection rectangle aligns with visual node
  // Use requestAnimationFrame to ensure DOM is fully painted before measuring
  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      updateNodeInternals(id)
    })
    return () => cancelAnimationFrame(rafId)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Ctrl+double-click to auto-fit width to title
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (e.ctrlKey) {
      e.stopPropagation()
      startNodeResize(id)
      const titleWidth = measureTextWidth(nodeData.title, '14px Inter, sans-serif')
      const newWidth = Math.max(MIN_WIDTH, Math.ceil(titleWidth + 80))
      updateNodeDimensions(id, newWidth, nodeHeight)
      updateNodeInternals(id)
      commitNodeResize(id)
    }
  }, [nodeData.title, id, nodeHeight, updateNodeDimensions, updateNodeInternals, startNodeResize, commitNodeResize])

  // Count members
  const memberCount = nodeData.includedNodeIds.length
  const excludedCount = nodeData.excludedNodeIds.length

  // LOD (Level of Detail) rendering based on zoom level
  const { showContent, showTitle, showLede, showInteractiveControls, showFooter, lodLevel, zoomLevel } = useNodeContentVisibility()

  // Check if node is disabled
  const isDisabled = nodeData.enabled === false

  // Visual feedback states
  const isSpawning = useIsSpawning(id)
  // Workspaces are configuration containers — no inherent processing state,
  // but the className is wired so it activates if processing state is added later.
  const isProcessing = false

  // Build className with all animation states
  const nodeClassName = [
    'cognograph-node',
    'cognograph-node--workspace',
    selected && 'selected',
    // is-active reserved for functional state only (not selection)
    isProcessing && 'is-thinking',
    isDisabled && 'cognograph-node--disabled',
    isSpawning && 'spawning',
    nodeData.nodeShape && `node-shape-${nodeData.nodeShape}`,
    `workspace-node--lod-${zoomLevel}`
  ].filter(Boolean).join(' ')

  // Handle visibility toggle
  const handleToggleVisibility = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    toggleWorkspaceVisibility(id)
  }, [id, toggleWorkspaceVisibility])

  // Handle links toggle
  const handleToggleLinks = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    toggleWorkspaceLinks(id)
  }, [id, toggleWorkspaceLinks])

  // Handle settings click - select node to show properties
  const handleSettingsClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedNodes([id])
  }, [id, setSelectedNodes])

  // Format LLM settings summary (L2 compact)
  const llmSummary = useMemo(() => {
    const { provider, model, temperature } = nodeData.llmSettings
    const parts: string[] = [provider]
    if (model) parts.push(model)
    if (temperature !== undefined) parts.push(`t=${temperature}`)
    return parts.join(' · ')
  }, [nodeData.llmSettings])

  // Format context rules summary (L2 compact — first 2 rules)
  const contextSummary = useMemo(() => {
    const { maxDepth, traversalMode } = nodeData.contextRules
    return `depth ${maxDepth} · ${traversalMode}`
  }, [nodeData.contextRules])

  // Full context rules (L3+)
  const contextDetailSummary = useMemo(() => {
    const { maxDepth, traversalMode, maxTokens, includeDisabledNodes } = nodeData.contextRules
    return `depth ${maxDepth} · ${traversalMode} · ${(maxTokens / 1000).toFixed(0)}k tokens${includeDisabledNodes ? ' · incl. disabled' : ''}`
  }, [nodeData.contextRules])

  // Direction indicator icon for L1
  const directionLabel = useMemo(() => {
    switch (nodeData.linkDirection) {
      case 'to-members': return '→ members'
      case 'from-members': return '← members'
      case 'bidirectional': return '↔ members'
      default: return '→ members'
    }
  }, [nodeData.linkDirection])

  const nodeContent = (
    <div
      ref={nodeRef}
      className={nodeClassName}
      style={nodeStyle}
      data-lod={lodLevel}
      data-transparent={transparent}
      onDoubleClick={handleDoubleClick}
      {...(lodLevel === 0 ? { role: 'img', 'aria-label': `Workspace: ${nodeData.title} (${memberCount} members)` } : {})}
    >
      {/* Type label: floats above node — hidden at L0 */}
      {lodLevel >= 1 && (
        <div className="cognograph-node__type-label" style={{ color: nodeColor ?? '#ef4444' }}>
          WORKSPACE
        </div>
      )}

      {/* Handles - hidden at L0 (ultra-far) */}
      {lodLevel >= 1 && (
        <>
          <Handle type="target" position={Position.Top} id="top-target" />
          <Handle type="source" position={Position.Top} id="top-source" />
          <Handle type="target" position={Position.Bottom} id="bottom-target" />
          <Handle type="source" position={Position.Bottom} id="bottom-source" />
          <Handle type="target" position={Position.Left} id="left-target" />
          <Handle type="source" position={Position.Left} id="left-source" />
          <Handle type="target" position={Position.Right} id="right-target" />
          <Handle type="source" position={Position.Right} id="right-source" />
        </>
      )}

      {/* ── L0 (ultra-far): Workspace icon + member count badge ── */}
      {lodLevel === 0 && (
        <div className="flex items-center justify-center gap-1.5 h-full" aria-hidden={false}>
          <InlineIconPicker
            nodeData={nodeData}
            nodeColor={nodeColor}
            onIconChange={(icon) => updateNode(id, { icon })}
            onIconColorChange={(iconColor) => updateNode(id, { iconColor })}
            className="cognograph-node__icon"
          />
          <span
            className="flex items-center gap-1 text-[10px]"
            style={{ color: nodeColor }}
            aria-label={`${memberCount} members`}
          >
            <Users className="w-3 h-3" />
            {memberCount}
          </span>
        </div>
      )}

      {/* ── L1+ (far+): Title + member count + direction indicator ── */}
      {lodLevel >= 1 && showTitle && (
        <div className="cognograph-node__header">
          <InlineIconPicker
            nodeData={nodeData}
            nodeColor={nodeColor}
            onIconChange={(icon) => updateNode(id, { icon })}
            onIconColorChange={(iconColor) => updateNode(id, { iconColor })}
            className="cognograph-node__icon"
          />
          <EditableTitle
            value={nodeData.title}
            onChange={(newTitle) => updateNode(id, { title: newTitle })}
            className="cognograph-node__title flex-1 truncate"
            placeholder="Untitled Workspace"
          />

          {/* L1: Direction indicator + member count */}
          {lodLevel === 1 && (
            <span
              className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded"
              style={{ background: `${nodeColor}25`, color: nodeColor }}
            >
              <Compass className="w-3 h-3" />
              {directionLabel}
            </span>
          )}

          {/* L1+ member count badge */}
          <span
            className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded node-chrome--hover"
            style={{ background: `${nodeColor}25`, color: nodeColor }}
            aria-label={`${memberCount} members`}
          >
            <Users className="w-3 h-3" />
            {memberCount}
          </span>

          {/* AI Property Assist — L3+ only */}
          {lodLevel >= 3 && showInteractiveControls && (
            <NodeAIErrorBoundary compact>
              <AIPropertyAssist
                nodeId={id}
                nodeData={nodeData}
                compact={true}
              />
            </NodeAIErrorBoundary>
          )}

          {/* Toggle buttons — L3+ only */}
          {lodLevel >= 3 && showInteractiveControls && (
            <>
              <button
                onClick={handleToggleVisibility}
                className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-colors"
                title={nodeData.showOnCanvas ? 'Hide from canvas' : 'Show on canvas'}
              >
                {nodeData.showOnCanvas ? (
                  <Eye className="w-4 h-4" style={{ color: 'var(--node-text-secondary)' }} />
                ) : (
                  <EyeOff className="w-4 h-4" style={{ color: 'var(--node-text-muted)' }} />
                )}
              </button>
              <button
                onClick={handleToggleLinks}
                className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-colors"
                title={nodeData.showLinks ? 'Hide member links' : 'Show member links'}
              >
                {nodeData.showLinks ? (
                  <Link2 className="w-4 h-4" style={{ color: nodeData.linkColor }} />
                ) : (
                  <Link2Off className="w-4 h-4" style={{ color: 'var(--node-text-muted)' }} />
                )}
              </button>
              <button
                onClick={handleSettingsClick}
                className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-colors"
                title="Open settings"
              >
                <Settings2 className="w-4 h-4" style={{ color: 'var(--node-text-secondary)' }} />
              </button>
            </>
          )}
        </div>
      )}

      {/* ── L2 (mid): Summary — context rules (first 2) + provider icon ── */}
      {lodLevel === 2 && showLede && (
        <div className="cognograph-node__body space-y-2" aria-hidden={false}>
          {/* Context rules summary — first 2 rules */}
          <div className="flex items-center gap-2 text-xs">
            <Compass className="w-3.5 h-3.5" style={{ color: nodeColor }} />
            <span style={{ color: 'var(--node-text-secondary)' }}>{contextSummary}</span>
          </div>

          {/* Provider icon + model */}
          <div className="flex items-center gap-2 text-xs">
            <Bot className="w-3.5 h-3.5" style={{ color: nodeColor }} />
            <span style={{ color: 'var(--node-text-secondary)' }}>{llmSummary}</span>
          </div>
        </div>
      )}

      {/* ── L3+ (close/ultra-close): Full LLM config + member list + exclusion rules + settings ── */}
      {lodLevel >= 3 && showContent && (
        <div className="cognograph-node__body space-y-2" aria-hidden={false}>
          {/* Description editor */}
          <EditableText
            value={nodeData.description || ''}
            onChange={(newDescription) => updateNode(id, { description: newDescription })}
            placeholder="Add description..."
            className="text-xs"
          />

          {/* Full LLM config panel */}
          <div className="flex items-center gap-2 text-xs">
            <Bot className="w-3.5 h-3.5" style={{ color: nodeColor }} />
            <span style={{ color: 'var(--node-text-secondary)' }}>{llmSummary}</span>
          </div>

          {/* Full context rules — depth + traversal + tokens + disabled flag */}
          <div className="flex items-center gap-2 text-xs">
            <Compass className="w-3.5 h-3.5" style={{ color: nodeColor }} />
            <span style={{ color: 'var(--node-text-secondary)' }}>{contextDetailSummary}</span>
          </div>

          {/* Temperature + max tokens detail line */}
          {(nodeData.llmSettings.temperature !== undefined || nodeData.llmSettings.maxTokens !== undefined) && (
            <div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--node-text-muted)' }}>
              {nodeData.llmSettings.temperature !== undefined && (
                <span>temp {nodeData.llmSettings.temperature}</span>
              )}
              {nodeData.llmSettings.maxTokens !== undefined && (
                <span>{(nodeData.llmSettings.maxTokens / 1000).toFixed(0)}k max tokens</span>
              )}
            </div>
          )}

          {/* Member list (L3+) */}
          {memberCount > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <Users className="w-3.5 h-3.5" style={{ color: nodeColor }} />
              <span style={{ color: 'var(--node-text-secondary)' }}>
                {memberCount} member{memberCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          {/* Exclusion rules (L3+) */}
          {excludedCount > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <EyeOff className="w-3.5 h-3.5" style={{ color: 'var(--node-text-muted)' }} />
              <span style={{ color: 'var(--node-text-muted)' }}>
                {excludedCount} excluded
              </span>
            </div>
          )}

          {/* Property Badges */}
          <PropertyBadges
            properties={nodeData.properties || {}}
            definitions={propertyDefinitions}
            hiddenProperties={nodeData.hiddenProperties}
            compact
          />
        </div>
      )}

      {/* Footer — visible at L2+ */}
      {lodLevel >= 2 && showFooter && (
        <div className="cognograph-node__footer">
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5" style={{ color: 'var(--node-text-muted)' }} />
            <span>{memberCount} members</span>
            {excludedCount > 0 && (
              <span style={{ color: 'var(--node-text-muted)' }}>({excludedCount} excluded)</span>
            )}
          </div>
          <AttachmentBadge count={nodeData.attachments?.length} />
          <span style={{ color: nodeColor }}>Workspace</span>
        </div>
      )}

      {/* Socket bars — L3+ only */}
      {lodLevel >= 3 && showContent && <NodeSocketBars nodeId={id} nodeColor={nodeColor} enabled={selected} />}
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
          handleStyle={{ borderColor: nodeColor, backgroundColor: nodeColor }}
          lineStyle={{ borderColor: nodeColor }}
        />
      )}
      {nodeContent}
    </>
  )
}

export const WorkspaceNode = memo(WorkspaceNodeComponent)
