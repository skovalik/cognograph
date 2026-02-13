import { memo, useMemo, useCallback, useState, useEffect, useRef } from 'react'
import { Handle, Position, NodeResizer, useUpdateNodeInternals, type NodeProps, type ResizeParams } from '@xyflow/react'
import { Link2 } from 'lucide-react'
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
import { AIPropertyAssist, NodeAIErrorBoundary } from '../properties'

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
    <div ref={nodeRef} className={nodeClassName} style={nodeStyle} data-transparent={transparent} onDoubleClick={handleDoubleClick}>
      {/* Auto-fit button - appears when selected */}
      <AutoFitButton
        nodeId={id}
        title={nodeData.title}
        content={nodeData.description}
        selected={selected}
        nodeColor={nodeColor}
        minWidth={MIN_WIDTH}
        minHeight={MIN_HEIGHT}
      />
      {/* Remote selection indicator */}
      <SelectionIndicator selectors={remoteSelectors} />

      {/* Handles on all four sides */}
      <Handle type="target" position={Position.Top} id="top-target" />
      <Handle type="source" position={Position.Top} id="top-source" />
      <Handle type="target" position={Position.Bottom} id="bottom-target" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" />
      <Handle type="target" position={Position.Left} id="left-target" />
      <Handle type="source" position={Position.Left} id="left-source" />
      <Handle type="target" position={Position.Right} id="right-target" />
      <Handle type="source" position={Position.Right} id="right-source" />

      {/* Numbered bookmark badge */}
      {numberedBookmark && (
        <div className={`numbered-bookmark-badge numbered-bookmark-badge--${numberedBookmark}`}>
          {numberedBookmark}
        </div>
      )}

      {/* Extraction badge for spatial extraction system */}
      <ExtractionBadge nodeId={id} nodeColor={nodeColor} />

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
          className="cognograph-node__title"
          placeholder="Untitled Task"
        />
        {!!nodeData.properties?.url && (
          <span title={nodeData.properties.url as string}>
            <Link2
              className="w-3 h-3 opacity-60 flex-shrink-0"
              style={{ color: 'var(--node-text-secondary)' }}
            />
          </span>
        )}
        <NodeAIErrorBoundary compact>
          <AIPropertyAssist
            nodeId={id}
            nodeData={nodeData}
            compact={true}
          />
        </NodeAIErrorBoundary>
        <ExtractionControls nodeId={id} />
      </div>

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

      {/* Socket bars showing connections */}
      <NodeSocketBars nodeId={id} nodeColor={nodeColor} enabled={selected} />

      {/* Fold badge for collapsing children */}
      <FoldBadge nodeId={id} nodeColor={nodeColor} />
    </div>
  )

  return (
    <>
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
      {nodeContent}
    </>
  )
}

export const TaskNode = memo(TaskNodeComponent)
