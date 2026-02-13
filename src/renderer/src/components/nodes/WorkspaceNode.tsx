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
    const baseOpacity = 25
    const tintOpacity = themeSettings.isDarkMode ? Math.round(baseOpacity * 0.5) : baseOpacity
    const borderWidth = 2
    const safeNodeColor = nodeColor ?? themeSettings.nodeColors.workspace ?? '#8b5cf7'

    return {
      borderWidth: `${borderWidth}px`,
      borderStyle: 'solid', // FORCE solid borders
      borderColor: safeNodeColor,
      // ALWAYS add opaque background (CSS overrides when glass enabled)
      background: `color-mix(in srgb, ${safeNodeColor} ${tintOpacity}%, var(--node-bg))`,
      boxShadow: selected ? `0 0 0 2px ${safeNodeColor}40, 0 0 20px ${safeNodeColor}30` : 'none',
      width: nodeWidth,
      height: nodeHeight,
      transition: 'background 200ms ease-out, border-color 200ms ease-out, backdrop-filter 200ms ease-out, opacity 200ms ease-out',
      // CSS custom properties for dynamic theming
      '--ring-color': safeNodeColor,    // Edge handles color
      '--node-accent': safeNodeColor     // Glass background tint
    }
  }, [nodeColor, themeSettings.nodeColors.workspace, isGlassEnabled, selected, nodeWidth, nodeHeight])

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

  // Check if node is disabled
  const isDisabled = nodeData.enabled === false

  // Visual feedback states
  const isSpawning = useIsSpawning(id)

  // Build className with all animation states
  const nodeClassName = [
    'cognograph-node',
    'cognograph-node--workspace',
    selected && 'selected',
    isDisabled && 'cognograph-node--disabled',
    isSpawning && 'spawning',
    nodeData.nodeShape && `node-shape-${nodeData.nodeShape}`
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

  // Format LLM settings summary
  const llmSummary = useMemo(() => {
    const { provider, model, temperature } = nodeData.llmSettings
    const parts: string[] = [provider]
    if (model) parts.push(model)
    if (temperature !== undefined) parts.push(`t=${temperature}`)
    return parts.join(' · ')
  }, [nodeData.llmSettings])

  // Format context rules summary
  const contextSummary = useMemo(() => {
    const { maxDepth, traversalMode, maxTokens } = nodeData.contextRules
    return `depth ${maxDepth} · ${traversalMode} · ${(maxTokens / 1000).toFixed(0)}k tokens`
  }, [nodeData.contextRules])

  const nodeContent = (
    <div
      ref={nodeRef}
      className={nodeClassName}
      style={nodeStyle}
      data-transparent={transparent}
      onDoubleClick={handleDoubleClick}
    >
      {/* Handles on all four sides */}
      <Handle type="target" position={Position.Top} id="top-target" />
      <Handle type="source" position={Position.Top} id="top-source" />
      <Handle type="target" position={Position.Bottom} id="bottom-target" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" />
      <Handle type="target" position={Position.Left} id="left-target" />
      <Handle type="source" position={Position.Left} id="left-source" />
      <Handle type="target" position={Position.Right} id="right-target" />
      <Handle type="source" position={Position.Right} id="right-source" />

      {/* Header */}
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

        {/* AI Property Assist */}
        <NodeAIErrorBoundary compact>
          <AIPropertyAssist
            nodeId={id}
            nodeData={nodeData}
            compact={true}
          />
        </NodeAIErrorBoundary>

        {/* Toggle buttons */}
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
      </div>

      {/* Body */}
      <div className="cognograph-node__body space-y-2">
        <EditableText
          value={nodeData.description || ''}
          onChange={(newDescription) => updateNode(id, { description: newDescription })}
          placeholder="Add description..."
          className="text-xs"
        />

        {/* LLM Settings Summary */}
        <div className="flex items-center gap-2 text-xs">
          <Bot className="w-3.5 h-3.5" style={{ color: nodeColor }} />
          <span style={{ color: 'var(--node-text-secondary)' }}>{llmSummary}</span>
        </div>

        {/* Context Rules Summary */}
        <div className="flex items-center gap-2 text-xs">
          <Compass className="w-3.5 h-3.5" style={{ color: nodeColor }} />
          <span style={{ color: 'var(--node-text-secondary)' }}>{contextSummary}</span>
        </div>

        {/* Property Badges */}
        <PropertyBadges
          properties={nodeData.properties || {}}
          definitions={propertyDefinitions}
          hiddenProperties={nodeData.hiddenProperties}
          compact
        />
      </div>

      {/* Footer */}
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

      {/* Socket bars showing connections */}
      <NodeSocketBars nodeId={id} nodeColor={nodeColor} enabled={selected} />
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
        handleStyle={{ borderColor: nodeColor, backgroundColor: nodeColor }}
        lineStyle={{ borderColor: nodeColor }}
      />
      {nodeContent}
    </>
  )
}

export const WorkspaceNode = memo(WorkspaceNodeComponent)
