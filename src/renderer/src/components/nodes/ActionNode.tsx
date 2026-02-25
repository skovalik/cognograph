import { memo, useMemo, useCallback, useEffect } from 'react'
import { Handle, Position, NodeResizer, useUpdateNodeInternals, type NodeProps, type ResizeParams } from '@xyflow/react'
import { Zap, Play } from 'lucide-react'
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

// TypeScript interface for node styles with CSS custom properties
interface NodeStyleWithCustomProps extends React.CSSProperties {
  '--node-accent'?: string
  '--ring-color'?: string
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

  // Calculate dynamic node color
  const nodeColor = nodeData.color || themeSettings.nodeColors.action || DEFAULT_THEME_SETTINGS.nodeColors.action

  // Glass system integration
  const transparent = nodeData.transparent
  const isGlassEnabled = useIsGlassEnabled('nodes', transparent)

  // Node dimensions - prefer props from React Flow, then data, then defaults
  const nodeWidth = propsWidth || nodeData.width || DEFAULT_WIDTH
  const nodeHeight = propsHeight || nodeData.height || DEFAULT_HEIGHT
  const effectiveHeight = Math.max(MIN_HEIGHT, nodeHeight)

  const nodeStyle = useMemo((): NodeStyleWithCustomProps => {
    const baseOpacity = 20
    const tintOpacity = themeSettings.isDarkMode ? Math.round(baseOpacity * 0.5) : baseOpacity
    const borderWidth = 2
    const safeNodeColor = nodeColor ?? themeSettings.nodeColors.action ?? '#10b981'

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
  }, [nodeColor, themeSettings.nodeColors.action, isGlassEnabled, selected, nodeWidth, effectiveHeight])

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

  // Check if node is disabled
  const isDisabled = nodeData.enabled === false

  // Visual feedback states
  const isSpawning = useIsSpawning(id)
  const warmthLevel = useNodeWarmth(id)
  const isPinned = useIsNodePinned(id)
  const isBookmarked = useIsNodeBookmarked(id)
  const numberedBookmark = useNodeNumberedBookmark(id)
  const isCut = useWorkspaceStore(s => s.clipboardState?.mode === 'cut' && s.clipboardState.nodeIds.includes(id))

  // LOD (Level of Detail) rendering based on zoom level
  const { showContent, showTitle, showBadges, showLede, zoomLevel } = useNodeContentVisibility()

  // Show members mode - dim non-members
  const { nonMemberClass, memberHighlightClass } = useShowMembersClass(id, nodeData.parentId)
  const showInteractiveControls = showContent
  const showFooter = showBadges

  // Build className
  const nodeClassName = [
    'cognograph-node cognograph-node--action',
    selected && 'selected',
    isDisabled && 'cognograph-node--disabled',
    !nodeData.enabled && 'action-node--inactive',
    isSpawning && 'spawning',
    nonMemberClass,
    memberHighlightClass,
    warmthLevel && `warmth-${warmthLevel}`,
    isPinned && 'node--pinned',
    isBookmarked && 'cognograph-node--bookmarked',
    isCut && 'cognograph-node--cut',
    nodeData.nodeShape && `node-shape-${nodeData.nodeShape}`,
    `action-node--lod-${zoomLevel}`
  ].filter(Boolean).join(' ')

  // Build trigger summary
  const triggerLabel = TRIGGER_LABELS[nodeData.trigger.type] || nodeData.trigger.type

  // Build action steps summary
  const stepsLabels = nodeData.actions
    .filter(s => !s.disabled)
    .map(s => STEP_TYPE_LABELS[s.type] || s.type)

  // Manual trigger handler
  const handleManualTrigger = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    // Dispatch a custom event that the action store will pick up
    window.dispatchEvent(new CustomEvent('action:manual-trigger', { detail: { actionNodeId: id } }))
  }, [id])

  const nodeContent = (
    <div
      ref={nodeRef}
      className={nodeClassName}
      style={nodeStyle}
      data-lod={zoomLevel}
      data-transparent={transparent}
      {...(zoomLevel === 'far' ? { role: 'img', 'aria-label': `Action: ${nodeData.title}` } : {})}
    >
      {/* Handles - hidden at far zoom */}
      {zoomLevel !== 'far' && (
        <>
          <Handle type="target" position={Position.Top} id="top-target" className="cognograph-handle" />
          <Handle type="source" position={Position.Top} id="top-source" className="cognograph-handle" />
          <Handle type="target" position={Position.Bottom} id="bottom-target" className="cognograph-handle" />
          <Handle type="source" position={Position.Bottom} id="bottom-source" className="cognograph-handle" />
          <Handle type="target" position={Position.Left} id="left-target" className="cognograph-handle" />
          <Handle type="source" position={Position.Left} id="left-source" className="cognograph-handle" />
          <Handle type="target" position={Position.Right} id="right-target" className="cognograph-handle" />
          <Handle type="source" position={Position.Right} id="right-source" className="cognograph-handle" />
        </>
      )}

      {/* Numbered bookmark badge */}
      {numberedBookmark && (
        <div className={`numbered-bookmark-badge numbered-bookmark-badge--${numberedBookmark}`}>
          {numberedBookmark}
        </div>
      )}

      {/* Enabled/disabled status dot - always visible (important state indicator) */}
      <span
        className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${nodeData.enabled ? 'bg-emerald-400' : 'bg-[var(--text-muted)]'}`}
        title={nodeData.enabled ? 'Enabled' : 'Disabled'}
        aria-label={nodeData.enabled ? 'Action enabled' : 'Action disabled'}
      />

      {/* L0 far: Colored rectangle with Zap icon + title + status */}
      {zoomLevel === 'far' && (
        <div
          className="flex items-center justify-center gap-1.5 h-full"
          style={isDisabled ? { opacity: 0.5 } : undefined}
          aria-hidden={false}
        >
          <Zap className="w-5 h-5 flex-shrink-0" style={{ color: nodeColor }} />
          <span
            className="text-[11px] font-medium truncate"
            style={{ color: 'var(--node-text-primary)', maxWidth: '120px' }}
          >
            {nodeData.title}
          </span>
        </div>
      )}

      {/* Header - visible at mid + close */}
      {showTitle && (
        <div className="cognograph-node__header" style={{ borderBottomColor: `${nodeColor}30` }}>
          <Zap className="w-4 h-4 flex-shrink-0" style={{ color: nodeColor }} />
          <EditableTitle
            value={nodeData.title}
            onChange={(title) => updateNode(id, { title })}
            className="cognograph-node__title"
          />
          {/* AI Property Assist - only at close */}
          {showInteractiveControls && (
            <NodeAIErrorBoundary compact>
              <AIPropertyAssist
                nodeId={id}
                nodeData={nodeData}
                compact={true}
              />
            </NodeAIErrorBoundary>
          )}
          {/* Manual trigger button - only at close */}
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

      {/* Body - LOD-aware content */}
      {(showContent || showLede) && (
        <div className="cognograph-node__body text-xs flex flex-col gap-1 overflow-hidden" aria-hidden={!showContent && !showLede}>
          {/* WHEN line - visible at mid (lede) + close */}
          <div className="flex items-center gap-1.5 text-[var(--node-text-secondary)]">
            <span className="font-medium uppercase text-[10px] opacity-70">WHEN:</span>
            <span className="truncate">{triggerLabel}</span>
            {nodeData.trigger.type === 'property-change' && (
              <span className="opacity-60 truncate">
                ({(nodeData.trigger as { property?: string }).property || '?'})
              </span>
            )}
          </div>

          {/* THEN + IF lines - only at close */}
          {showContent && (
            <>
              {stepsLabels.length > 0 && (
                <div className="flex items-center gap-1.5 text-[var(--node-text-secondary)]">
                  <span className="font-medium uppercase text-[10px] opacity-70">THEN:</span>
                  <span className="truncate">{stepsLabels.join(', ')}</span>
                </div>
              )}
              {nodeData.conditions.length > 0 && (
                <div className="flex items-center gap-1.5 text-[var(--node-text-secondary)]">
                  <span className="font-medium uppercase text-[10px] opacity-70">IF:</span>
                  <span>{nodeData.conditions.length} condition{nodeData.conditions.length > 1 ? 's' : ''}</span>
                </div>
              )}
            </>
          )}

          {/* Run count badge at mid zoom */}
          {showLede && !showContent && nodeData.runCount > 0 && (
            <span className="text-[10px] text-[var(--node-text-muted)]">
              Runs: {nodeData.runCount}
            </span>
          )}
        </div>
      )}

      {/* Footer - visible at mid + close */}
      {showFooter && (
        <div className="cognograph-node__footer flex items-center gap-2 text-[10px] text-[var(--node-text-muted)]">
          <span className={`flex items-center gap-1 ${nodeData.enabled ? 'text-emerald-400' : 'text-[var(--text-muted)]'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${nodeData.enabled ? 'bg-emerald-400' : 'bg-[var(--text-muted)]'}`} />
            {nodeData.enabled ? 'Enabled' : 'Disabled'}
          </span>
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
