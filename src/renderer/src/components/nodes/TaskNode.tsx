import { memo, useMemo, useCallback, useState, useEffect, useRef } from 'react'
import { Handle, Position, NodeResizer, useUpdateNodeInternals, type NodeProps, type ResizeParams } from '@xyflow/react'
import { Link2, Maximize2 } from 'lucide-react'
import { sciFiToast } from '../ui/SciFiToast'
import type { TaskNodeData } from '@shared/types'
import { DEFAULT_THEME_SETTINGS } from '@shared/types'
import { useWorkspaceStore, useIsSpawning, useNodeWarmth, useIsNodePinned, useIsNodeBookmarked, useNodeNumberedBookmark, useIsNodeLayoutPinned } from '../../stores/workspaceStore'
import { useShowMembersClass } from '../../hooks/useShowMembersClass'
import { useIsGlassEnabled } from '../../hooks/useIsGlassEnabled'
import { PropertyBadges } from '../properties/PropertyBadge'
import { getPropertiesForNodeType } from '../../constants/properties'
import { NodeSocketBars } from './SocketBar'
import { AttachmentBadge } from './AttachmentBadge'
import { InlineIconPicker } from '../InlineIconPicker'
import { EditableTitle } from '../EditableTitle'
import { RichTextEditor } from '../RichTextEditor'
import { CollaborativeEditor } from '../CollaborativeEditor'
import { SelectionIndicator } from '../Presence/SelectionIndicators'
import { useNodeRemoteSelectors } from '../../hooks/useOtherUserSelections'
import { useWorkspaceStore as useWsStoreForSync } from '../../stores/workspaceStore'
import { measureTextWidth } from '../../utils/nodeUtils'
import { ExtractionBadge, ExtractionControls } from '../extractions'
import { AutoFitButton } from './AutoFitButton'
import { FoldBadge } from './FoldBadge'
import { useNodeResize } from '../../hooks/useNodeResize'
import { useNodeContentVisibility } from '../../hooks/useSemanticZoom'
import { AIPropertyAssist, NodeAIErrorBoundary } from '../properties'
import { StructuredContentPreview } from './StructuredContentPreview'

// TypeScript interface for node styles with CSS custom properties
interface NodeStyleWithCustomProps extends React.CSSProperties {
  '--node-accent'?: string
  '--ring-color'?: string
}

// Default dimensions
const DEFAULT_WIDTH = 260
const DEFAULT_HEIGHT = 140
const MIN_WIDTH = 200
const MIN_HEIGHT = 100
const MAX_HEIGHT = 600

/**
 * Status shape for ultra-far (L0) rendering.
 * Uses shape (not just color) for WCAG 1.4.1 accessibility compliance.
 * Each status is distinguishable by shape alone.
 */
function TaskStatusShape({ status, color }: { status: string; color: string }): JSX.Element {
  const size = 16
  switch (status) {
    case 'done':
      // Circle with checkmark
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" aria-label="Done">
          <circle cx="8" cy="8" r="7" fill={color} stroke={color} strokeWidth="1" />
          <path d="M4.5 8L7 10.5L11.5 5.5" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'in-progress':
      // Filled square
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" aria-label="In Progress">
          <rect x="2" y="2" width="12" height="12" rx="2" fill={color} stroke={color} strokeWidth="1" />
        </svg>
      )
    default:
      // todo — hollow circle
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" aria-label="To Do">
          <circle cx="8" cy="8" r="6" fill="none" stroke={color} strokeWidth="2" />
        </svg>
      )
  }
}

/**
 * Status badge for L1 (far) rendering.
 * Shows status text with shape indicator.
 */
function TaskStatusBadge({ status, color }: { status: string; color: string }): JSX.Element {
  const label = status === 'in-progress' ? 'In Progress' : status === 'done' ? 'Done' : 'To Do'
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
      style={{
        backgroundColor: `${color}20`,
        color: color
      }}
    >
      <TaskStatusShape status={status} color={color} />
      {label}
    </span>
  )
}

/** Returns a color for task status */
function getStatusColor(status: string): string {
  switch (status) {
    case 'done': return '#22c55e'       // green
    case 'in-progress': return '#f59e0b' // amber
    default: return '#6b7280'            // gray
  }
}

function TaskNodeComponent({ id, data, selected, width, height }: NodeProps): JSX.Element {
  const nodeData = data as TaskNodeData
  const propsWidth = width as number | undefined
  const propsHeight = height as number | undefined
  const updateNodeInternals = useUpdateNodeInternals()
  const nodeRef = useNodeResize(id)
  const updateNode = useWorkspaceStore((state) => state.updateNode)
  const propertySchema = useWorkspaceStore((state) => state.propertySchema)
  const propertyDefinitions = getPropertiesForNodeType('task', propertySchema)
  const themeSettings = useWorkspaceStore((state) => state.themeSettings)
  const updateNodeDimensions = useWorkspaceStore((state) => state.updateNodeDimensions)
  const startNodeResize = useWorkspaceStore((state) => state.startNodeResize)
  const commitNodeResize = useWorkspaceStore((state) => state.commitNodeResize)

  // Calculate dynamic node color
  const nodeColor = nodeData.color || themeSettings.nodeColors.task || DEFAULT_THEME_SETTINGS.nodeColors.task

  // Glass system integration
  const transparent = nodeData.transparent
  const isGlassEnabled = useIsGlassEnabled('nodes', transparent)

  // Node dimensions (for resizing) - prefer props from React Flow, then data, then defaults
  const nodeWidth = propsWidth || nodeData.width || DEFAULT_WIDTH
  const nodeHeight = propsHeight || nodeData.height || DEFAULT_HEIGHT

  // LOD (Level of Detail) rendering based on zoom level
  const {
    showContent, showTitle, showBadges, showLede,
    showHeader, showFooter, showInteractiveControls,
    showEmbeddedContent, zoomLevel
  } = useNodeContentVisibility()

  const isUltraFar = zoomLevel === 'ultra-far'

  // Strip HTML for character count (content-aware height)
  const plainDescription = nodeData.description
    ? nodeData.description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    : ''

  // Content-aware minimum height: auto-expand based on content length, capped at MAX_HEIGHT
  const contentMinHeight = useMemo(() => {
    const charCount = plainDescription.length
    if (charCount === 0) return MIN_HEIGHT
    const charsPerLine = Math.max(20, Math.floor((nodeWidth - 24) / 7.5))
    const lines = Math.ceil(charCount / charsPerLine)
    const contentHeight = lines * 16
    const totalHeight = 76 + 16 + contentHeight
    return Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, totalHeight))
  }, [plainDescription.length, nodeWidth])

  const effectiveHeight = Math.max(contentMinHeight, nodeHeight)

  const nodeStyle = useMemo((): NodeStyleWithCustomProps => {
    const baseOpacity = 25
    const tintOpacity = themeSettings.isDarkMode ? Math.round(baseOpacity * 0.5) : baseOpacity
    const borderWidth = 2
    const safeNodeColor = nodeColor ?? themeSettings.nodeColors.task ?? '#10b981'

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
  }, [nodeColor, themeSettings.nodeColors.task, isGlassEnabled, selected, nodeWidth, effectiveHeight])

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
      updateNodeDimensions(id, newWidth, effectiveHeight)
      updateNodeInternals(id)
      commitNodeResize(id)
    }
  }, [nodeData.title, id, effectiveHeight, updateNodeDimensions, updateNodeInternals, startNodeResize, commitNodeResize])

  // Merge top-level status/priority/complexity into properties for unified badge rendering
  const mergedProperties = useMemo(() => ({
    ...nodeData.properties,
    status: nodeData.status,
    ...(nodeData.priority && { priority: nodeData.priority }),
    ...(nodeData.complexity && { complexity: nodeData.complexity })
  }), [nodeData.properties, nodeData.status, nodeData.priority, nodeData.complexity])

  // Handle property cycling from badges
  const handlePropertyChange = useCallback((propertyId: string, newValue: string) => {
    updateNode(id, { [propertyId]: newValue })
  }, [id, updateNode])

  // Content editing and overflow state
  const [isEditing, setIsEditing] = useState(false)
  const [isContentOverflowing, setIsContentOverflowing] = useState(false)

  // Check if node is disabled
  const isDisabled = nodeData.enabled === false

  // Multiplayer: remote selections and sync mode
  const remoteSelectors = useNodeRemoteSelectors(id)
  const syncMode = useWsStoreForSync((s) => s.syncMode)
  const isMultiplayer = syncMode === 'multiplayer'

  // Visual feedback states
  const isSpawning = useIsSpawning(id)
  const warmthLevel = useNodeWarmth(id)

  // Build className with all animation states
  const isPinned = useIsNodePinned(id)
  const isLayoutPinned = useIsNodeLayoutPinned(id)
  const isBookmarked = useIsNodeBookmarked(id)
  const numberedBookmark = useNodeNumberedBookmark(id)
  const isCut = useWorkspaceStore(s => s.clipboardState?.mode === 'cut' && s.clipboardState.nodeIds.includes(id))

  // Show members mode - dim non-members
  const { nonMemberClass, memberHighlightClass } = useShowMembersClass(id, nodeData.parentId)

  // Completion celebration (ND feature - dopamine hit on task done)
  const [isCelebrating, setIsCelebrating] = useState(false)
  const prevStatusRef = useRef(nodeData.status)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined

    // Detect when status changes TO "done" from something else
    if (nodeData.status === 'done' && prevStatusRef.current !== 'done') {
      setIsCelebrating(true)
      sciFiToast('Task completed!', 'success')

      // Clear celebration after animation
      timer = setTimeout(() => {
        setIsCelebrating(false)
      }, 1000)
    }
    prevStatusRef.current = nodeData.status

    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [nodeData.status])

  // Status color for L0/L1 rendering
  const statusColor = getStatusColor(nodeData.status)

  // Lede text for L2 (mid zoom) — description truncated to 80 chars
  const ledeText = useMemo(() => {
    if (!plainDescription) return ''
    return plainDescription.length > 80
      ? plainDescription.slice(0, 80) + '...'
      : plainDescription
  }, [plainDescription])

  const nodeClassName = [
    'cognograph-node',
    'cognograph-node--task',
    selected && 'selected',
    isDisabled && 'cognograph-node--disabled',
    isSpawning && 'spawning',
    nonMemberClass,
    memberHighlightClass,
    warmthLevel && `warmth-${warmthLevel}`,
    isPinned && 'node--pinned',
    isLayoutPinned && 'node--layout-pinned',
    isBookmarked && 'cognograph-node--bookmarked',
    isCut && 'cognograph-node--cut',
    isCelebrating && 'cognograph-node--celebrating',
    nodeData.nodeShape && `node-shape-${nodeData.nodeShape}`
  ].filter(Boolean).join(' ')

  const nodeContent = (
    <div
      ref={nodeRef}
      className={nodeClassName}
      style={nodeStyle}
      data-transparent={transparent}
      data-lod={zoomLevel}
      onDoubleClick={handleDoubleClick}
    >
      {/* Remote selection indicator */}
      <SelectionIndicator selectors={remoteSelectors} />

      {/* ================================================================
          L0 (ultra-far): Colored pill with status shape only.
          Minimal DOM — ~5 elements. No handles, no text, no editor.
          Uses shapes (not color only) for WCAG 1.4.1 accessibility.
          ================================================================ */}
      {isUltraFar && (
        <div className="flex items-center justify-center h-full">
          <TaskStatusShape status={nodeData.status} color={statusColor} />
        </div>
      )}

      {/* ================================================================
          L1+ (far and above): Auto-fit button
          ================================================================ */}
      {showInteractiveControls && (
        <AutoFitButton
          nodeId={id}
          title={nodeData.title}
          content={nodeData.description}
          selected={selected}
          nodeColor={nodeColor}
          minWidth={MIN_WIDTH}
          minHeight={MIN_HEIGHT}
        />
      )}

      {/* Remote selection indicator — L1+ */}
      {!isUltraFar && (
        <SelectionIndicator selectors={remoteSelectors} />
      )}

      {/* ================================================================
          L1+ (far and above): Handles on all four sides
          Suppressed at L0 — no connection affordance at navigation level
          ================================================================ */}
      {!isUltraFar && (
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

      {/* Numbered bookmark badge — visible at L1+ (navigation aid) */}
      {!isUltraFar && numberedBookmark && (
        <div className={`numbered-bookmark-badge numbered-bookmark-badge--${numberedBookmark}`}>
          {numberedBookmark}
        </div>
      )}

      {/* Extraction badge for spatial extraction system — L1+ */}
      {!isUltraFar && (
        <ExtractionBadge nodeId={id} nodeColor={nodeColor} />
      )}

      {/* ================================================================
          L1+ (far and above): Header with title + status badge
          ================================================================ */}
      {showHeader && (
        <div className="cognograph-node__header">
          <InlineIconPicker
            nodeData={nodeData}
            nodeColor={nodeColor}
            onIconChange={(icon) => updateNode(id, { icon })}
            onIconColorChange={(iconColor) => updateNode(id, { iconColor })}
            className="cognograph-node__icon"
          />
          {showTitle && (
            <EditableTitle
              value={nodeData.title}
              onChange={(newTitle) => updateNode(id, { title: newTitle })}
              className="cognograph-node__title"
              placeholder="Untitled Task"
            />
          )}
          {!!nodeData.properties?.url && (
            <span title={nodeData.properties.url as string}>
              <Link2
                className="w-3 h-3 opacity-60 flex-shrink-0"
                style={{ color: 'var(--node-text-secondary)' }}
              />
            </span>
          )}
          {/* Status badge at L1 (far) — visible when not showing full content */}
          {showBadges && !showContent && (
            <TaskStatusBadge status={nodeData.status} color={statusColor} />
          )}
          {/* AI Property Assist — L3+ only (interactive control) */}
          {showInteractiveControls && (
            <NodeAIErrorBoundary compact>
              <AIPropertyAssist
                nodeId={id}
                nodeData={nodeData}
                compact={true}
              />
            </NodeAIErrorBoundary>
          )}
          {/* Extraction controls — L3+ only */}
          {showInteractiveControls && (
            <ExtractionControls nodeId={id} />
          )}
        </div>
      )}

      {/* ================================================================
          L1 (far): Skeleton density preview for description content
          ================================================================ */}
      {!isUltraFar && !showLede && !showContent && nodeData.description && (
        <div className="cognograph-node__body" style={{ pointerEvents: 'none' }}>
          <StructuredContentPreview content={nodeData.description} zoomLevel="far" />
        </div>
      )}

      {/* ================================================================
          L2 (mid): Lede — description snippet + assignee + due date badges
          ================================================================ */}
      {showLede && (
        <div className="cognograph-node__body" style={{ opacity: 0.8 }}>
          {nodeData.description ? (
            <StructuredContentPreview content={nodeData.description} zoomLevel="mid" />
          ) : (
            <p className="text-sm italic" style={{ color: 'var(--node-text-muted)' }}>
              No description
            </p>
          )}
          {/* Key badges at L2: status + priority + due date */}
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            <TaskStatusBadge status={nodeData.status} color={statusColor} />
            {nodeData.priority && nodeData.priority !== 'none' && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                style={{
                  backgroundColor: 'var(--node-bg-secondary)',
                  color: 'var(--node-text-secondary)'
                }}
              >
                {nodeData.priority}
              </span>
            )}
            {nodeData.dueDate && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                style={{
                  backgroundColor: 'var(--node-bg-secondary)',
                  color: nodeData.dueDate < Date.now() ? '#ef4444' : 'var(--node-text-muted)'
                }}
              >
                {new Date(nodeData.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ================================================================
          L3+ (close and above): Full body content — rich text editor, description
          This is where the expensive RichTextEditor/CollaborativeEditor mounts.
          NOT mounted at L0-L1 for major performance win.
          ================================================================ */}
      {showContent && (
        <div className="cognograph-node__body" data-focusable="true">
          {!nodeData.hiddenProperties?.includes('description') && (
            isMultiplayer ? (
              <CollaborativeEditor
                nodeId={id}
                fieldName="description"
                placeholder="Add description..."
                enableLists={true}
                enableFormatting={true}
                enableHeadings={false}
                showToolbar="on-focus"
                minHeight={30}
              />
            ) : (
              <RichTextEditor
                value={nodeData.description || ''}
                onChange={(html) => updateNode(id, { description: html })}
                placeholder="Add description..."
                enableLists={true}
                enableFormatting={true}
                enableHeadings={false}
                showToolbar="on-focus"
                minHeight={30}
                editOnDoubleClick={true}
                onEditingChange={setIsEditing}
                onOverflowChange={setIsContentOverflowing}
                observeOverflow={!!selected}
              />
            )
          )}
          {isContentOverflowing && !isEditing && effectiveHeight >= MAX_HEIGHT && (
            <div className="cognograph-node__truncation-indicator">...</div>
          )}
        </div>
      )}

      {/* ================================================================
          L3+ (close and above): Footer with property badges
          ================================================================ */}
      {showFooter && showContent && (
        <div className="cognograph-node__footer">
          <PropertyBadges
            properties={mergedProperties}
            definitions={propertyDefinitions}
            hiddenProperties={nodeData.hiddenProperties}
            onPropertyChange={handlePropertyChange}
            compact
          />
          <AttachmentBadge count={nodeData.attachments?.length} />
        </div>
      )}

      {/* L2 (mid): Simplified footer — just attachment count */}
      {showFooter && !showContent && (
        <div className="cognograph-node__footer" style={{ opacity: 0.7 }}>
          <AttachmentBadge count={nodeData.attachments?.length} />
        </div>
      )}

      {/* ================================================================
          L4 (ultra-close): Artboard expansion hint
          ================================================================ */}
      {showEmbeddedContent && (
        <div
          className="flex items-center justify-center gap-1 py-1 text-[10px] cursor-pointer rounded-b-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          style={{ color: 'var(--node-text-muted)' }}
          title="Expand to artboard (coming soon)"
        >
          <Maximize2 className="w-3 h-3" />
          <span>Expand</span>
        </div>
      )}

      {/* Socket bars showing connections — L1+ */}
      {!isUltraFar && (
        <NodeSocketBars nodeId={id} nodeColor={nodeColor} enabled={selected} />
      )}

      {/* Fold badge for collapsing children — L1+ */}
      {!isUltraFar && (
        <FoldBadge nodeId={id} nodeColor={nodeColor} />
      )}
    </div>
  )

  return (
    <>
      {/* NodeResizer only at L3+ (interactive controls) */}
      {showInteractiveControls && (
        <NodeResizer
          minWidth={MIN_WIDTH}
          minHeight={contentMinHeight}
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

export const TaskNode = memo(TaskNodeComponent)
