import { memo, useMemo, useCallback, useState, useEffect } from 'react'
import { Handle, Position, NodeResizer, useUpdateNodeInternals, useReactFlow, type NodeProps, type ResizeParams } from '@xyflow/react'
import { Link2, Bot, BookOpen, Code2, Layers, Palette, FileText, Component, FileJson, Settings, Focus, Minimize2 } from 'lucide-react'
import type { NoteNodeData, NoteMode } from '@shared/types'
import { DEFAULT_THEME_SETTINGS } from '@shared/types'
import { PropertyBadges } from '../properties/PropertyBadge'
import { getPropertiesForNodeType } from '../../constants/properties'
import { useWorkspaceStore, useIsSpawning, useNodeWarmth, useIsNodePinned, useIsNodeBookmarked, useNodeNumberedBookmark, useIsNodeLayoutPinned } from '../../stores/workspaceStore'
import { useShowMembersClass } from '../../hooks/useShowMembersClass'
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
import { NodeModeDropdown } from './NodeModeDropdown'
import { useNodeResize } from '../../hooks/useNodeResize'
import { useNodeContentVisibility } from '../../hooks/useSemanticZoom'
import { useIsGlassEnabled } from '../../hooks/useIsGlassEnabled'
import { AIPropertyAssist, NodeAIErrorBoundary } from '../properties'
import { DesignTokenEditor } from './DesignTokenEditor'
import { PageNoteBody } from './PageNoteBody'
import { ComponentNoteBody } from './ComponentNoteBody'
import { ContentModelBody } from './ContentModelBody'
import { WPConfigBody } from './WPConfigBody'
import { getNodeModeStyle, getTintOpacity, getBorderStyle, getBorderWidth } from '../../utils/nodeModeUtils'
import { StructuredContentPreview } from './StructuredContentPreview'

// TypeScript interface for node styles with CSS custom properties
interface NodeStyleWithCustomProps extends React.CSSProperties {
  '--node-accent'?: string
  '--ring-color'?: string
  '--density-accent'?: string
}

// Default dimensions
const DEFAULT_WIDTH = 280
const DEFAULT_HEIGHT = 140
const MIN_WIDTH = 200
const MIN_HEIGHT = 100
const MAX_HEIGHT = 600

// Note mode presets — each maps to contextRole + contextPriority + visual badge
const NOTE_MODE_CONFIG: Record<NoteMode, {
  label: string
  contextRole: NoteNodeData['contextRole']
  contextPriority: NoteNodeData['contextPriority']
  icon: typeof Bot | null
  badgeColor: string
}> = {
  general: { label: 'General', contextRole: undefined, contextPriority: undefined, icon: null, badgeColor: '' },
  persona: { label: 'Persona / Instructions', contextRole: 'instruction', contextPriority: 'high', icon: Bot, badgeColor: '#8b5cf6' },
  reference: { label: 'Reference Material', contextRole: 'reference', contextPriority: 'medium', icon: BookOpen, badgeColor: '#3b82f6' },
  examples: { label: 'Style Guide / Examples', contextRole: 'example', contextPriority: 'medium', icon: Code2, badgeColor: '#f59e0b' },
  background: { label: 'Background Context', contextRole: 'background', contextPriority: 'low', icon: Layers, badgeColor: '#6b7280' },
  'design-tokens': { label: 'Design Tokens', contextRole: 'reference', contextPriority: 'high', icon: Palette, badgeColor: '#ec4899' },
  page: { label: 'Page', contextRole: 'scope', contextPriority: 'high', icon: FileText, badgeColor: '#3b82f6' },
  component: { label: 'Component', contextRole: 'reference', contextPriority: 'medium', icon: Component, badgeColor: '#8b5cf6' },
  'content-model': { label: 'Content Model', contextRole: 'reference', contextPriority: 'medium', icon: FileJson, badgeColor: '#f97316' },
  'wp-config': { label: 'WordPress Config', contextRole: 'background', contextPriority: 'low', icon: Settings, badgeColor: '#21759b' }
}

function NoteNodeComponent({ id, data, selected, width, height }: NodeProps): JSX.Element {
  const nodeData = data as NoteNodeData
  const propsWidth = width as number | undefined
  const propsHeight = height as number | undefined
  const updateNodeInternals = useUpdateNodeInternals()
  const nodeRef = useNodeResize(id)
  const updateNode = useWorkspaceStore((state) => state.updateNode)
  const propertySchema = useWorkspaceStore((state) => state.propertySchema)
  const propertyDefinitions = getPropertiesForNodeType('note', propertySchema)
  const themeSettings = useWorkspaceStore((state) => state.themeSettings)
  const updateNodeDimensions = useWorkspaceStore((state) => state.updateNodeDimensions)
  const startNodeResize = useWorkspaceStore((state) => state.startNodeResize)
  const isInPlaceExpanded = useWorkspaceStore((state) => state.inPlaceExpandedNodeId === id)
  const collapseInPlaceExpansion = useWorkspaceStore((state) => state.collapseInPlaceExpansion)
  const expandNodeInPlace = useWorkspaceStore((state) => state.expandNodeInPlace)
  const { getViewport } = useReactFlow()
  const commitNodeResize = useWorkspaceStore((state) => state.commitNodeResize)

  // Strip HTML tags for word count
  const plainContent = nodeData.content
    ? nodeData.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    : ''
  const wordCount = plainContent ? plainContent.split(/\s+/).filter((w) => w.length > 0).length : 0

  // Calculate dynamic node color
  const nodeColor = nodeData.color || themeSettings.nodeColors.note || DEFAULT_THEME_SETTINGS.nodeColors.note

  // Node dimensions (for resizing) - prefer props from React Flow, then data, then defaults
  const nodeWidth = propsWidth || nodeData.width || DEFAULT_WIDTH
  const nodeHeight = propsHeight || nodeData.height || DEFAULT_HEIGHT

  // Content-aware minimum height: auto-expand based on content length, capped at MAX_HEIGHT
  const contentMinHeight = useMemo(() => {
    const charCount = plainContent.length
    if (charCount === 0) return MIN_HEIGHT
    const charsPerLine = Math.max(20, Math.floor((nodeWidth - 24) / 7.5))
    const lines = Math.ceil(charCount / charsPerLine)
    const contentHeight = lines * 16
    const totalHeight = 76 + 16 + contentHeight // header+footer + padding + content
    return Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, totalHeight))
  }, [plainContent.length, nodeWidth])

  // PFD Phase 5A: In-place expansion dimensions (flow coordinates, viewport-relative)
  const expandedDimensions = useMemo(() => {
    if (!isInPlaceExpanded) return null
    const viewport = getViewport()
    const zoom = viewport.zoom || 1
    // Viewport dimensions in flow coordinates
    const vpWidthFlow = window.innerWidth / zoom
    const vpHeightFlow = window.innerHeight / zoom
    const expandedWidth = Math.min(nodeWidth * 2, vpWidthFlow * 0.6)
    const expandedHeight = vpHeightFlow * 0.8
    return { width: Math.max(expandedWidth, nodeWidth), height: expandedHeight }
  }, [isInPlaceExpanded, nodeWidth, getViewport])

  const effectiveWidth = expandedDimensions ? expandedDimensions.width : nodeWidth
  const effectiveHeight = expandedDimensions
    ? expandedDimensions.height
    : Math.max(contentMinHeight, nodeHeight)

  // Get tint intensity from preferences (TODO: wire up preference store)
  const tintIntensity = 'normal' // Default to normal, will be configurable in preferences

  // Get current mode and config (before nodeStyle useMemo that references modeConfig)
  const currentMode = nodeData.noteMode || 'general'
  const modeConfig = NOTE_MODE_CONFIG[currentMode]
  const ModeBadgeIcon = modeConfig.icon

  // Glass system integration - extract transparent to minimize re-renders
  const transparent = nodeData.transparent
  const isGlassEnabled = useIsGlassEnabled('nodes', transparent)

  const nodeStyle = useMemo((): NodeStyleWithCustomProps => {
    // Get tint opacity percentage (20-35% based on mode + intensity + theme)
    const tintOpacity = getTintOpacity(currentMode, tintIntensity, themeSettings.isDarkMode ? 'dark' : 'light')
    const borderStyle = getBorderStyle(currentMode)
    const borderWidth = getBorderWidth(currentMode)

    // Fallback chain for undefined nodeColor
    const safeNodeColor = nodeColor ?? themeSettings.nodeColors.note ?? '#f59e0b' // amber-500

    return {
      borderWidth: `${borderWidth}px`,
      borderStyle: 'solid', // Use solid borders for all modes (accessibility handled via tint + border width)
      borderColor: safeNodeColor,
      // ALWAYS add opaque background (CSS overrides when glass enabled)
      background: `color-mix(in srgb, ${safeNodeColor} ${tintOpacity}%, var(--node-bg))`,
      boxShadow: selected ? `0 0 0 2px ${safeNodeColor}40, 0 0 20px ${safeNodeColor}30` : 'none',
      width: effectiveWidth,
      height: effectiveHeight,
      transition: 'background 200ms ease-out, border-color 200ms ease-out, backdrop-filter 200ms ease-out, opacity 200ms ease-out',
      // CSS custom properties for dynamic theming
      '--ring-color': safeNodeColor,    // Edge handles color
      '--node-accent': safeNodeColor,    // Glass background tint
      '--density-accent': modeConfig.badgeColor || safeNodeColor  // PFD Phase 2: density bracket accent (mode color)
    }
  }, [nodeColor, selected, effectiveWidth, effectiveHeight, currentMode, tintIntensity, themeSettings.nodeColors.note, themeSettings.isDarkMode, modeConfig.badgeColor])

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

  // Sync React Flow bounds on mount and when expansion state changes
  useEffect(() => {
    updateNodeInternals(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update node internals when in-place expansion changes (edges snap to new size)
  useEffect(() => {
    if (isInPlaceExpanded || expandedDimensions === null) {
      updateNodeInternals(id)
    }
  }, [isInPlaceExpanded, id, updateNodeInternals])

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

  // Mode dropdown options (transform NOTE_MODE_CONFIG)
  const modeOptions = useMemo(() =>
    Object.entries(NOTE_MODE_CONFIG).map(([key, cfg]) => ({
      value: key,
      label: cfg.label,
      icon: cfg.icon || undefined,
      color: cfg.badgeColor || undefined,
      description: key === 'general' ? 'Default note mode' :
                  key === 'persona' ? 'AI personality & instructions' :
                  key === 'reference' ? 'Background reading material' :
                  key === 'examples' ? 'Code/writing style examples' :
                  key === 'background' ? 'Supporting context' :
                  key === 'design-tokens' ? 'Theme colors & fonts' :
                  key === 'page' ? 'Web page documentation' :
                  key === 'component' ? 'UI component spec' :
                  key === 'content-model' ? 'Data structure definition' :
                  key === 'wp-config' ? 'WordPress configuration' :
                  undefined
    })),
    []
  )

  const handleModeChange = useCallback((newMode: string) => {
    const config = NOTE_MODE_CONFIG[newMode as NoteMode]
    updateNode(id, {
      noteMode: newMode as NoteMode,
      ...(newMode !== 'general' ? {
        contextRole: config.contextRole,
        contextPriority: config.contextPriority
      } : {})
    })
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
  const isPinned = useIsNodePinned(id)
  const isLayoutPinned = useIsNodeLayoutPinned(id)
  const isBookmarked = useIsNodeBookmarked(id)
  const numberedBookmark = useNodeNumberedBookmark(id)
  const isCut = useWorkspaceStore(s => s.clipboardState?.mode === 'cut' && s.clipboardState.nodeIds.includes(id))

  // LOD (Level of Detail) rendering based on zoom level
  const { showContent, showTitle, showBadges, showLede, zoomLevel } = useNodeContentVisibility()
  const showInteractiveControls = showContent

  // PFD Phase 2: Density tier computation
  // 3 tiers at far zoom, 5 at mid/close (Section 2A of PFD Implementation Plan)
  const densityClass = useMemo(() => {
    if (zoomLevel === 'ultra-far' || zoomLevel === 'far') {
      // Collapse to 3 discriminable tiers at far/ultra-far zoom
      if (wordCount <= 30) return 'density--empty'
      if (wordCount <= 299) return 'density--has-content'
      return 'density--dense'
    }
    // Full 5-tier system at mid/close zoom
    if (wordCount <= 30) return 'density--empty'
    if (wordCount <= 99) return 'density--sparse'
    if (wordCount <= 299) return 'density--medium'
    if (wordCount <= 599) return 'density--substantial'
    return 'density--dense'
  }, [wordCount, zoomLevel])

  // Focus mode and pinned window actions
  const setFocusModeNode = useWorkspaceStore((state) => state.setFocusModeNode)


  // Show members mode - dim non-members
  const { nonMemberClass, memberHighlightClass } = useShowMembersClass(id, nodeData.parentId)

  // Build className with all animation states
  const nodeClassName = [
    'cognograph-node',
    'cognograph-node--note',
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
    nodeData.nodeShape && `node-shape-${nodeData.nodeShape}`,
    isInPlaceExpanded && 'cognograph-node--in-place-expanded',
    `note-node--lod-${zoomLevel}`,
    densityClass
  ].filter(Boolean).join(' ')

  const nodeContent = (
    <div
      ref={nodeRef}
      className={nodeClassName}
      style={nodeStyle}
      data-lod={zoomLevel}
      data-transparent={transparent?.toString()}
      onDoubleClick={handleDoubleClick}
      {...(zoomLevel === 'far' ? { role: 'img', 'aria-label': `Note: ${nodeData.title}` } : {})}
    >
      {/* Auto-fit button - only at close */}
      {showInteractiveControls && (
        <AutoFitButton
          nodeId={id}
          title={nodeData.title}
          content={nodeData.content}
          selected={selected}
          nodeColor={nodeColor}
          minWidth={MIN_WIDTH}
          minHeight={MIN_HEIGHT}
        />
      )}
      {/* Remote selection indicator */}
      <SelectionIndicator selectors={remoteSelectors} />

      {/* Handles - hidden at far zoom */}
      {zoomLevel !== 'far' && (
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

      {/* PFD Phase 6B: Landmark badge — visible at all zoom levels */}
      {nodeData.isLandmark && (
        <div className="landmark-badge" title="Landmark node">&#9670;</div>
      )}

      {/* Numbered bookmark badge */}
      {numberedBookmark && (
        <div className={`numbered-bookmark-badge numbered-bookmark-badge--${numberedBookmark}`}>
          {numberedBookmark}
        </div>
      )}

      {/* Extraction badge for spatial extraction system */}
      <ExtractionBadge nodeId={id} nodeColor={nodeColor} />

      {/* PFD Phase 4B: Context role label — visible only when context viz is active */}
      {modeConfig.contextRole && (
        <div className="context-role-badge" data-role={modeConfig.contextRole}>
          {modeConfig.contextRole}
        </div>
      )}

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
          placeholder="Untitled Note"
        />
        {!!nodeData.properties?.url && (
          <span title={nodeData.properties.url as string}>
            <Link2
              className="w-3 h-3 opacity-60 flex-shrink-0"
              style={{ color: 'var(--node-text-secondary)' }}
            />
          </span>
        )}
        {showInteractiveControls && (
          <NodeAIErrorBoundary compact>
            <AIPropertyAssist
              nodeId={id}
              nodeData={nodeData}
              compact={true}
            />
          </NodeAIErrorBoundary>
        )}
        {showInteractiveControls && <ExtractionControls nodeId={id} />}
        {/* Focus mode button */}
        {showContent && (
          <button
            onClick={(e) => { e.stopPropagation(); setFocusModeNode(id) }}
            className="cognograph-node__focus-trigger"
            title="Focus on this node (Alt+F)"
            aria-label="Focus on this node"
          >
            <Focus className="w-3.5 h-3.5" />
          </button>
        )}
        {/* Note mode dropdown - only at close */}
        {showInteractiveControls && (
          <NodeModeDropdown
            value={currentMode}
            options={modeOptions}
            onChange={handleModeChange}
            nodeColor={nodeColor}
            aria-label="Note mode"
          />
        )}
      </div>

      <div
        className={`cognograph-node__body${isInPlaceExpanded ? ' cognograph-node__body--expanded' : ''}`}
        data-focusable="true"
        style={isInPlaceExpanded ? { overflow: 'auto', overscrollBehavior: 'contain', flex: 1 } : undefined}
      >
        {/* LOD: Far zoom shows structured preview, mid shows clamped content, close shows full editor */}
        {zoomLevel === 'far' && !isInPlaceExpanded && !nodeData.hiddenProperties?.includes('content') && (
          <StructuredContentPreview content={nodeData.content || ''} zoomLevel="far" />
        )}
        {(showContent || showLede || isEditing || isInPlaceExpanded) && !nodeData.hiddenProperties?.includes('content') && (
          <div
            className={zoomLevel === 'ultra-far' && !isInPlaceExpanded ? 'note-node__body-hidden' : undefined}
            style={
              isInPlaceExpanded ? undefined :
              zoomLevel === 'mid' && !isEditing ? { overflow: 'hidden' } : undefined
            }
            aria-hidden={zoomLevel === 'ultra-far' && !isInPlaceExpanded}
          >
            {currentMode === 'page' ? (
              <PageNoteBody
                page={nodeData.page}
                onChange={(page) => updateNode(id, { page })}
                selected={selected}
              />
            ) : currentMode === 'component' ? (
              <ComponentNoteBody
                component={nodeData.component}
                onChange={(component) => updateNode(id, { component })}
                selected={selected}
              />
            ) : currentMode === 'content-model' ? (
              <ContentModelBody
                contentModel={nodeData.contentModel}
                onChange={(contentModel) => updateNode(id, { contentModel })}
                selected={selected}
              />
            ) : currentMode === 'wp-config' ? (
              <WPConfigBody
                wpConfig={nodeData.wpConfig}
                onChange={(wpConfig) => updateNode(id, { wpConfig })}
                selected={selected}
              />
            ) : currentMode === 'design-tokens' ? (
              <DesignTokenEditor
                content={nodeData.content || ''}
                onChange={(content) => updateNode(id, { content, contentFormat: 'plain' })}
              />
            ) : isMultiplayer ? (
              <CollaborativeEditor
                nodeId={id}
                fieldName="content"
                placeholder="Add note content..."
                enableLists={true}
                enableFormatting={true}
                enableHeadings={false}
                showToolbar="on-focus"
                minHeight={40}
              />
            ) : (
              <RichTextEditor
                value={nodeData.content || ''}
                onChange={(html) => updateNode(id, { content: html })}
                placeholder="Add note content..."
                enableLists={true}
                enableFormatting={true}
                enableHeadings={false}
                showToolbar="on-focus"
                minHeight={40}
                editOnDoubleClick={true}
                onEditingChange={setIsEditing}
                onOverflowChange={setIsContentOverflowing}
                observeOverflow={!!selected}
              />
            )}
          </div>
        )}
        {isContentOverflowing && !isEditing && !isInPlaceExpanded && effectiveHeight >= MAX_HEIGHT && (
          <button
            onClick={(e) => { e.stopPropagation(); expandNodeInPlace(id) }}
            className="cognograph-node__expand-trigger"
            aria-label={`Expand node: ${wordCount} words`}
          >
            ↕ {wordCount} words
          </button>
        )}
        {isInPlaceExpanded && (
          <button
            onClick={(e) => { e.stopPropagation(); collapseInPlaceExpansion() }}
            className="cognograph-node__collapse-trigger"
            aria-label="Collapse expanded node"
          >
            <Minimize2 className="w-3.5 h-3.5" /> Collapse
          </button>
        )}

        {/* Property Badges - only at close */}
        {showContent && (
          <PropertyBadges
            properties={nodeData.properties || {}}
            definitions={propertyDefinitions}
            hiddenProperties={nodeData.hiddenProperties}
            compact
          />
        )}
      </div>

      {/* Footer - visible at mid + close */}
      {showBadges && (
        <div className="cognograph-node__footer">
          <span>{wordCount} words</span>
          <AttachmentBadge count={nodeData.attachments?.length} />
        </div>
      )}

      {/* Socket bars showing connections - only at close */}
      {showContent && <NodeSocketBars nodeId={id} nodeColor={nodeColor} enabled={selected} />}

      {/* Fold badge for collapsing children */}
      <FoldBadge nodeId={id} nodeColor={nodeColor} />
    </div>
  )

  return (
    <>
      {showInteractiveControls && (
        <NodeResizer
          minWidth={MIN_WIDTH}
          minHeight={contentMinHeight}
          isVisible={selected}
          onResizeStart={handleResizeStart}
          onResize={handleResize}
          onResizeEnd={handleResizeEnd}
          lineClassName="border-amber-500"
          handleClassName="w-3 h-3 bg-amber-500 border-amber-300"
          handleStyle={{ borderColor: nodeColor, backgroundColor: nodeColor }}
          lineStyle={{ borderColor: nodeColor }}
        />
      )}
      {nodeContent}
    </>
  )
}

export const NoteNode = memo(NoteNodeComponent)
