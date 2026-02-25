import { memo, useState, useCallback, useMemo, useEffect } from 'react'
import { Handle, Position, type NodeProps, NodeResizer, useUpdateNodeInternals, useReactFlow, type ResizeParams } from '@xyflow/react'
import { ChevronDown, ChevronRight, Plus, Link2, FolderKanban } from 'lucide-react'
import type { ProjectNodeData } from '@shared/types'
import { DEFAULT_THEME_SETTINGS } from '@shared/types'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useIsGlassEnabled } from '../../hooks/useIsGlassEnabled'
import { PropertyBadges } from '../properties/PropertyBadge'
import { getPropertiesForNodeType } from '../../constants/properties'
import { useIsSpawning, useIsNodePinned, useIsNodeBookmarked, useNodeNumberedBookmark } from '../../stores/workspaceStore'
import { NodeSocketBars } from './SocketBar'
import { AttachmentBadge } from './AttachmentBadge'
import { EditableTitle } from '../EditableTitle'
import { EditableText } from '../EditableText'
import { InlineIconPicker } from '../InlineIconPicker'
import { useContextMenuStore } from '../../stores/contextMenuStore'
import { measureTextWidth } from '../../utils/nodeUtils'
import { ExtractionBadge, ExtractionControls } from '../extractions'
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

function ProjectNodeComponent({ id, data, selected, width, height }: NodeProps): JSX.Element {
  const nodeData = data as ProjectNodeData
  const updateNodeInternals = useUpdateNodeInternals()
  const nodeRef = useNodeResize(id)
  const updateNode = useWorkspaceStore((state) => state.updateNode)
  const updateNodeDimensions = useWorkspaceStore((state) => state.updateNodeDimensions)
  const startNodeResize = useWorkspaceStore((state) => state.startNodeResize)
  const commitNodeResize = useWorkspaceStore((state) => state.commitNodeResize)
  const propertySchema = useWorkspaceStore((state) => state.propertySchema)
  const propertyDefinitions = getPropertiesForNodeType('project', propertySchema)
  const themeSettings = useWorkspaceStore((state) => state.themeSettings)
  const openContextMenu = useContextMenuStore((state) => state.open)
  const { screenToFlowPosition } = useReactFlow()
  const [isDragOver, setIsDragOver] = useState(false)

  const onNodesChange = useWorkspaceStore((state) => state.onNodesChange)

  // Block single-click selection — require double-click to select project nodes
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
  }, [])

  // Calculate dynamic node color
  const nodeColor = nodeData.color || themeSettings.nodeColors.project || DEFAULT_THEME_SETTINGS.nodeColors.project

  // Glass system integration
  const transparent = nodeData.transparent
  const isGlassEnabled = useIsGlassEnabled('nodes', transparent)

  const nodeStyle = useMemo((): NodeStyleWithCustomProps => {
    const baseOpacity = 25
    const tintOpacity = themeSettings.isDarkMode ? Math.round(baseOpacity * 0.5) : baseOpacity
    const borderWidth = 2
    const safeNodeColor = nodeColor ?? themeSettings.nodeColors.project ?? '#0ea5e9'

    return {
      borderWidth: `${borderWidth}px`,
      borderStyle: 'solid', // FORCE solid borders
      borderColor: safeNodeColor,
      // ALWAYS add opaque background (CSS overrides when glass enabled)
      background: `color-mix(in srgb, ${safeNodeColor} ${tintOpacity}%, var(--node-bg))`,
      boxShadow: selected ? `0 0 0 2px ${safeNodeColor}40, 0 0 20px ${safeNodeColor}30` : 'none',
      width: '100%',
      height: '100%',
      transition: 'background 200ms ease-out, border-color 200ms ease-out, backdrop-filter 200ms ease-out, opacity 200ms ease-out',
      // CSS custom properties for dynamic theming
      '--ring-color': safeNodeColor,    // Edge handles color
      '--node-accent': safeNodeColor     // Glass background tint
    }
  }, [nodeColor, themeSettings.nodeColors.project, isGlassEnabled, selected])

  // Get current node dimensions - prefer props (from React Flow), fall back to data/defaults
  const nodeWidth = width ?? nodeData.width ?? 280
  const nodeHeight = height ?? nodeData.height ?? 250

  const toggleCollapsed = (e: React.MouseEvent): void => {
    e.stopPropagation()
    updateNode(id, { collapsed: !nodeData.collapsed })
  }

  // Handle resize events - also update node internals to trigger edge recalculation
  const handleResizeStart = useCallback(() => {
    startNodeResize(id)
  }, [id, startNodeResize])

  const handleResize = useCallback(
    (_event: unknown, params: ResizeParams): void => {
      updateNodeDimensions(id, params.width, params.height)
    },
    [id, updateNodeDimensions]
  )

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

  // Double-click to select; Ctrl+double-click to auto-fit width to title
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (e.ctrlKey) {
      startNodeResize(id)
      const titleWidth = measureTextWidth(nodeData.title, '14px Inter, sans-serif')
      const newWidth = Math.max(250, Math.ceil(titleWidth + 80))
      updateNodeDimensions(id, newWidth, nodeHeight)
      updateNodeInternals(id)
      commitNodeResize(id)
    } else {
      // Regular double-click selects the project node
      onNodesChange([{ type: 'select', id, selected: true }])
    }
  }, [nodeData.title, id, nodeHeight, updateNodeDimensions, updateNodeInternals, startNodeResize, commitNodeResize, onNodesChange])

  // Right-click in body to open project-specific context menu
  const handleBodyContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    openContextMenu(
      { x: e.clientX, y: e.clientY },
      { type: 'project-body', projectId: id, position: screenToFlowPosition({ x: e.clientX, y: e.clientY }) }
    )
  }, [id, openContextMenu, screenToFlowPosition])

  // Get child node titles for display — use targeted selector returning only titles (stable during drag)
  const childNodeIds = nodeData.childNodeIds ?? []
  const childNodeTitles = useWorkspaceStore((state) => {
    if (childNodeIds.length === 0) return ''
    return childNodeIds
      .map(cid => {
        const n = state.nodes.find(nd => nd.id === cid)
        return n ? (n.data.title as string) : null
      })
      .filter(Boolean)
      .join('\x00')  // Join as stable primitive string
  })
  const childNodes = useMemo(() => {
    if (!childNodeTitles) return []
    return childNodeTitles.split('\x00').map((title, i) => ({
      id: childNodeIds[i],
      data: { title }
    }))
  }, [childNodeTitles, childNodeIds])

  // Visual feedback states
  const isSpawning = useIsSpawning(id)

  // Check if node is disabled
  const isDisabled = nodeData.enabled === false

  const isPinned = useIsNodePinned(id)
  const isBookmarked = useIsNodeBookmarked(id)
  const numberedBookmark = useNodeNumberedBookmark(id)
  const isCut = useWorkspaceStore(s => s.clipboardState?.mode === 'cut' && s.clipboardState.nodeIds.includes(id))

  // LOD (Level of Detail) rendering based on zoom level
  const { showContent, showTitle, showBadges, showLede, zoomLevel } = useNodeContentVisibility()
  const isFar = zoomLevel === 'far'

  // Build className with all animation states
  const nodeClassName = [
    'cognograph-node',
    'cognograph-node--project',
    selected && 'selected',
    isDragOver && 'drag-over',
    isDisabled && 'cognograph-node--disabled',
    isSpawning && 'spawning',
    isPinned && 'node--pinned',
    isBookmarked && 'cognograph-node--bookmarked',
    isCut && 'cognograph-node--cut',
    nodeData.nodeShape && `node-shape-${nodeData.nodeShape}`,
    `project-node--lod-${zoomLevel}`
  ].filter(Boolean).join(' ')

  // Compute child count for LOD summary display
  const childCount = (nodeData.childNodeIds ?? []).length

  const nodeContent = (
    <div
      ref={nodeRef}
      className={nodeClassName}
      style={nodeStyle}
      data-project-id={id}
      data-transparent={transparent}
      data-lod={zoomLevel}
      onDoubleClick={handleDoubleClick}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragOver(true)
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={() => setIsDragOver(false)}
    >
      {/* Handles on all four sides — hidden at far zoom */}
      {!isFar && (
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

      {/* Numbered bookmark badge */}
      {numberedBookmark && (
        <div className={`numbered-bookmark-badge numbered-bookmark-badge--${numberedBookmark}`}>
          {numberedBookmark}
        </div>
      )}

      {/* Extraction badge for spatial extraction system */}
      <ExtractionBadge nodeId={id} nodeColor={nodeColor} />

      {/* === LOD: Far zoom — compact pill with icon + title + child count === */}
      {isFar && (
        <div className="flex items-center gap-2 px-2 py-1 h-full min-h-0 overflow-hidden">
          <FolderKanban size={16} className="flex-shrink-0" style={{ color: nodeColor }} />
          {showTitle && (
            <span
              className="text-xs font-medium truncate flex-1"
              style={{ color: 'var(--node-text-primary)' }}
            >
              {nodeData.title || 'Untitled Project'}
            </span>
          )}
          {showBadges && childCount > 0 && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0"
              style={{
                backgroundColor: 'var(--node-bg-secondary)',
                color: 'var(--node-text-secondary)'
              }}
            >
              {childCount} items
            </span>
          )}
        </div>
      )}

      {/* === LOD: Mid + Close — full header === */}
      {!isFar && (
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
            placeholder="Untitled Project"
          />
          {!!nodeData.properties?.url && (
            <span title={nodeData.properties.url as string}>
              <Link2
                className="w-3 h-3 opacity-60 flex-shrink-0"
                style={{ color: 'var(--node-text-secondary)' }}
              />
            </span>
          )}
          {showContent && (
            <NodeAIErrorBoundary compact>
              <AIPropertyAssist
                nodeId={id}
                nodeData={nodeData}
                compact={true}
              />
            </NodeAIErrorBoundary>
          )}
          {showContent && <ExtractionControls nodeId={id} />}
          <button
            onClick={toggleCollapsed}
            className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-colors"
          >
            {nodeData.collapsed ? (
              <ChevronRight className="w-4 h-4" style={{ color: 'var(--node-text-secondary)' }} />
            ) : (
              <ChevronDown className="w-4 h-4" style={{ color: 'var(--node-text-secondary)' }} />
            )}
          </button>
        </div>
      )}

      {/* === LOD: Far zoom — skeleton density preview for description === */}
      {isFar && !nodeData.collapsed && nodeData.description && (
        <div className="cognograph-node__body" style={{ pointerEvents: 'none' }}>
          <StructuredContentPreview content={nodeData.description} zoomLevel="far" />
        </div>
      )}

      {/* === LOD: Mid zoom — summary with child count + truncated child names === */}
      {showLede && !nodeData.collapsed && (
        <div className="cognograph-node__body flex-1 overflow-hidden" style={{ maxHeight: '4.5em' }}>
          {childCount > 0 ? (
            <div className="space-y-1">
              <span
                className="text-xs font-medium"
                style={{ color: 'var(--node-text-secondary)' }}
              >
                {childCount} items
              </span>
              {childNodes.slice(0, 3).map((child) => (
                <div
                  key={child.id}
                  className="flex items-center gap-1 text-xs px-2 py-0.5 rounded truncate"
                  style={{
                    backgroundColor: 'var(--node-bg-secondary)',
                    color: 'var(--node-text-secondary)'
                  }}
                >
                  <span className="truncate">{child.data.title as string}</span>
                </div>
              ))}
              {childNodes.length > 3 && (
                <div className="text-[10px]" style={{ color: 'var(--node-text-muted)' }}>
                  +{childNodes.length - 3} more
                </div>
              )}
            </div>
          ) : (
            <span className="text-xs italic" style={{ color: 'var(--node-text-muted)' }}>
              Empty project
            </span>
          )}
        </div>
      )}

      {/* === LOD: Close zoom — full content (default behavior) === */}
      {showContent && !nodeData.collapsed && (
        <div className="cognograph-node__body flex-1 overflow-auto" onContextMenu={handleBodyContextMenu}>
          <EditableText
            value={nodeData.description || ''}
            onChange={(newDescription) => updateNode(id, { description: newDescription })}
            placeholder="Add description..."
            className="mb-2"
          />

          {/* Property Badges */}
          <PropertyBadges
            properties={nodeData.properties || {}}
            definitions={propertyDefinitions}
            hiddenProperties={nodeData.hiddenProperties}
            compact
          />

          {/* Child nodes list */}
          {childNodes.length > 0 && (
            <div className="mt-2 space-y-1">
              {childNodes.slice(0, 5).map((child) => (
                <div
                  key={child.id}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded"
                  style={{
                    backgroundColor: 'var(--node-bg-secondary)',
                    color: 'var(--node-text-secondary)'
                  }}
                >
                  <span className="truncate">{child.data.title as string}</span>
                </div>
              ))}
              {childNodes.length > 5 && (
                <div className="text-xs" style={{ color: 'var(--node-text-muted)' }}>+{childNodes.length - 5} more</div>
              )}
            </div>
          )}

          {/* Drop zone indicator */}
          {isDragOver && (
            <div className="mt-2 border-2 border-dashed border-violet-400 rounded p-2 text-center text-xs text-violet-300">
              <Plus className="w-4 h-4 inline-block mr-1" />
              Drop to add
            </div>
          )}

          {childNodes.length === 0 && !isDragOver && (
            <p className="italic text-center" style={{ color: 'var(--node-text-muted)' }}>Drag nodes here</p>
          )}
        </div>
      )}

      {/* Footer — hidden at far zoom */}
      {!isFar && (
        <div className="cognograph-node__footer">
          <span>{childCount} items</span>
          <AttachmentBadge count={nodeData.attachments?.length} />
          <span style={{ color: 'var(--node-text-muted)' }}>Project</span>
        </div>
      )}

      {/* Socket bars showing connections — hidden at far zoom */}
      {!isFar && <NodeSocketBars nodeId={id} nodeColor={nodeColor} enabled={selected} />}

      {/* Fold badge for collapsing children */}
      <FoldBadge nodeId={id} nodeColor={nodeColor} />
    </div>
  )

  return (
    <div style={{ width: nodeWidth, height: nodeHeight, position: 'relative' }} onMouseDown={handleMouseDown}>
      {/* NodeResizer: only at close zoom */}
      {showContent && (
        <NodeResizer
          minWidth={250}
          minHeight={200}
          isVisible={selected}
          onResizeStart={handleResizeStart}
          onResize={handleResize}
          onResizeEnd={handleResizeEnd}
          handleStyle={{ borderColor: nodeColor, backgroundColor: nodeColor }}
          lineStyle={{ borderColor: nodeColor }}
        />
      )}
      {nodeContent}
    </div>
  )
}

export const ProjectNode = memo(ProjectNodeComponent)
