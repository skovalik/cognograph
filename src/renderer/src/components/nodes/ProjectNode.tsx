// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import type { ProjectNodeData } from '@shared/types'
import { DEFAULT_THEME_SETTINGS } from '@shared/types'
import {
  type NodeProps,
  NodeResizer,
  type ResizeParams,
  useReactFlow,
  useUpdateNodeInternals,
} from '@xyflow/react'
import { ChevronDown, ChevronRight, FolderKanban, FolderOpen, Link2, Plus } from 'lucide-react'
import * as path from 'path'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { CONIC_PALETTES } from '../../constants/conicPalettes'
import { getPropertiesForNodeType } from '../../constants/properties'
import { useIsGlassEnabled } from '../../hooks/useIsGlassEnabled'
import { useNodeResize } from '../../hooks/useNodeResize'
import { useNodeContentVisibility } from '../../hooks/useSemanticZoom'
import { useContextMenuStore } from '../../stores/contextMenuStore'
import {
  useIsNodeBookmarked,
  useIsNodePinned,
  useIsSpawning,
  useNodeNumberedBookmark,
  useWorkspaceStore,
} from '../../stores/workspaceStore'
import { measureTextWidth } from '../../utils/textMeasure'
import { EditableText } from '../EditableText'
import { EditableTitle } from '../EditableTitle'
import { ExtractionBadge, ExtractionControls } from '../extractions'
import { FilePreviewSection } from '../FilePreviewSection'
import { InlineIconPicker } from '../InlineIconPicker'
import { AIPropertyAssist, NodeAIErrorBoundary } from '../properties'
import { PropertyBadges } from '../properties/PropertyBadge'
import { AttachmentBadge } from './AttachmentBadge'
import { FoldBadge } from './FoldBadge'
import { NodePropertyControls } from './NodePropertyControls'
import { NodeSocketBars } from './SocketBar'
import { SpreadHandles } from './SpreadHandles'
import { StructuredContentPreview } from './StructuredContentPreview'

// TypeScript interface for node styles with CSS custom properties
interface NodeStyleWithCustomProps extends React.CSSProperties {
  '--node-accent'?: string
  '--ring-color'?: string
  '--conic-color-1'?: string
  '--conic-color-2'?: string
  '--conic-color-3'?: string
  '--conic-color-4'?: string
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

  const onNodesChange = useWorkspaceStore((state) => state.onNodesChange)

  // Block single-click selection — require double-click to select project nodes
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
  }, [])

  // Calculate dynamic node color
  const nodeColor =
    nodeData.color || themeSettings.nodeColors.project || DEFAULT_THEME_SETTINGS.nodeColors.project

  // Glass system integration
  const transparent = nodeData.transparent
  const isGlassEnabled = useIsGlassEnabled('nodes', transparent)

  const nodeStyle = useMemo((): NodeStyleWithCustomProps => {
    const safeNodeColor = nodeColor ?? themeSettings.nodeColors.project ?? '#0ea5e9'
    const palette = CONIC_PALETTES['project'] || CONIC_PALETTES.default

    return {
      '--ring-color': safeNodeColor,
      '--node-accent': safeNodeColor,
      '--conic-color-1': palette[0],
      '--conic-color-2': palette[1],
      '--conic-color-3': palette[2],
      '--conic-color-4': palette[3],
      width: '100%',
      height: '100%',
    }
  }, [nodeColor, themeSettings.nodeColors.project])

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
    [id, updateNodeDimensions],
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
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
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
    },
    [
      nodeData.title,
      id,
      nodeHeight,
      updateNodeDimensions,
      updateNodeInternals,
      startNodeResize,
      commitNodeResize,
      onNodesChange,
    ],
  )

  // Right-click in body to open project-specific context menu
  const handleBodyContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      openContextMenu(
        { x: e.clientX, y: e.clientY },
        {
          type: 'project-body',
          projectId: id,
          position: screenToFlowPosition({ x: e.clientX, y: e.clientY }),
        },
      )
    },
    [id, openContextMenu, screenToFlowPosition],
  )

  // Get child node titles + types for display — use targeted selector returning stable primitive string
  const childNodeIds = nodeData.childNodeIds ?? []
  const childNodeInfo = useWorkspaceStore((state) => {
    if (childNodeIds.length === 0) return ''
    return childNodeIds
      .map((cid) => {
        const n = state.nodes.find((nd) => nd.id === cid)
        return n ? `${n.data.title as string}\x01${n.type ?? 'note'}` : null
      })
      .filter(Boolean)
      .join('\x00') // Join as stable primitive string
  })
  const childNodes = useMemo(() => {
    if (!childNodeInfo) return []
    return childNodeInfo.split('\x00').map((entry, i) => {
      const [title, type] = entry.split('\x01')
      return { id: childNodeIds[i], data: { title }, type: type || 'note' }
    })
  }, [childNodeInfo, childNodeIds])

  // Visual feedback states
  const isSpawning = useIsSpawning(id)

  // Check if node is disabled
  const isDisabled = nodeData.enabled === false

  const isPinned = useIsNodePinned(id)
  const isBookmarked = useIsNodeBookmarked(id)
  const numberedBookmark = useNodeNumberedBookmark(id)
  const isCut = useWorkspaceStore(
    (s) => s.clipboardState?.mode === 'cut' && s.clipboardState.nodeIds.includes(id),
  )

  // LOD (Level of Detail) rendering based on zoom level
  const {
    showContent,
    showTitle,
    showBadges,
    showLede,
    showHeader,
    showFooter,
    showInteractiveControls,
    showPlaceholders,
    zoomLevel,
    lodLevel,
  } = useNodeContentVisibility()
  const isUltraFar = zoomLevel === 'ultra-far'
  const isFar = zoomLevel === 'far'

  // Activity indicator: spawning state serves as "processing" for project nodes
  const isProcessing = isSpawning

  // Build className with all animation states + activity indicators
  const nodeClassName = [
    'cognograph-node',
    'cognograph-node--project',
    selected && 'selected',
    // is-active reserved for functional state only (not selection)
    isProcessing && 'is-thinking',
    isDragOver && 'drag-over',
    isDisabled && 'cognograph-node--disabled',
    isSpawning && 'spawning',
    isPinned && 'node--pinned',
    isBookmarked && 'cognograph-node--bookmarked',
    isCut && 'cognograph-node--cut',
    nodeData.nodeShape && `node-shape-${nodeData.nodeShape}`,
    `project-node--lod-${zoomLevel}`,
  ]
    .filter(Boolean)
    .join(' ')

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
      data-lod-level={lodLevel}
      onDoubleClick={handleDoubleClick}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragOver(true)
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={() => setIsDragOver(false)}
    >
      {/* Type label: floats above node */}
      <div className="cognograph-node__type-label">PROJECT</div>

      {/* Handles on all four sides — hidden at L0 (ultra-far) */}
      <SpreadHandles hidden={isUltraFar} width={nodeWidth} height={nodeHeight} />

      {/* Numbered bookmark badge */}
      {numberedBookmark && (
        <div className={`numbered-bookmark-badge numbered-bookmark-badge--${numberedBookmark}`}>
          {numberedBookmark}
        </div>
      )}

      {/* Extraction badge for spatial extraction system */}
      <ExtractionBadge nodeId={id} nodeColor={nodeColor} />

      {/* ================================================================
          L0 (ultra-far): Icon + title (display font, italic) + child count pill
          ================================================================ */}
      {isUltraFar && (
        <div className="flex items-center gap-2 px-2 py-1 h-full min-h-0 overflow-hidden">
          <FolderKanban size={16} className="flex-shrink-0" style={{ color: nodeColor }} />
          <span
            className="text-xs truncate flex-1"
            style={{
              color: 'var(--node-text-primary)',
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              fontWeight: 500,
            }}
          >
            {nodeData.title || 'Untitled Project'}
          </span>
          {childCount > 0 && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0"
              style={{
                backgroundColor: 'var(--node-bg-secondary)',
                color: 'var(--node-text-secondary)',
              }}
            >
              {childCount}
            </span>
          )}
        </div>
      )}

      {/* ================================================================
          L1 (far): Title + child count + dashed container border
          Skeleton placeholders for description content
          ================================================================ */}
      {isFar && (
        <div className="flex items-center gap-2 px-2 py-1 h-full min-h-0 overflow-hidden">
          <FolderKanban size={16} className="flex-shrink-0" style={{ color: nodeColor }} />
          {showTitle && (
            <span
              className="text-xs truncate flex-1"
              style={{
                color: 'var(--node-text-primary)',
                fontFamily: 'var(--font-display)',
                fontStyle: 'italic',
                fontWeight: 500,
              }}
            >
              {nodeData.title || 'Untitled Project'}
            </span>
          )}
          {showBadges && childCount > 0 && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0"
              style={{
                backgroundColor: 'var(--node-bg-secondary)',
                color: 'var(--node-text-secondary)',
              }}
            >
              {childCount} items
            </span>
          )}
        </div>
      )}

      {/* L1: Skeleton density preview for description */}
      {showPlaceholders && !nodeData.collapsed && nodeData.description && (
        <div className="cognograph-node__body" style={{ pointerEvents: 'none' }}>
          <StructuredContentPreview content={nodeData.description} zoomLevel="far" />
        </div>
      )}

      {/* ================================================================
          L2+ (mid/close/ultra-close): Full header with icon picker, editable title, controls
          Project title uses --font-display at ALL LOD levels
          ================================================================ */}
      {showHeader && !isUltraFar && !isFar && (
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
            startEditing={renameTriggered}
          />
          {nodeData.folderPath && (
            <span
              className="flex items-center gap-0.5 text-[10px] shrink-0"
              style={{ color: 'var(--node-text-muted)' }}
              title={nodeData.folderPath}
            >
              <FolderOpen className="w-3 h-3" />
              <span className="truncate max-w-[80px]">{path.basename(nodeData.folderPath)}</span>
            </span>
          )}
          {!!nodeData.properties?.url && (
            <span title={nodeData.properties.url as string}>
              <Link2
                className="w-3 h-3 opacity-60 flex-shrink-0"
                style={{ color: 'var(--node-text-secondary)' }}
              />
            </span>
          )}
          {/* AI Property Assist — L3+ only (interactive control) */}
          {showInteractiveControls && (
            <NodeAIErrorBoundary compact>
              <AIPropertyAssist nodeId={id} nodeData={nodeData} compact={true} />
            </NodeAIErrorBoundary>
          )}
          {/* Extraction controls — L3+ only */}
          {showInteractiveControls && <ExtractionControls nodeId={id} />}
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

      {/* ================================================================
          L2 (mid): Description (first 2 lines) + child list (first 3 with type-color dots)
          ================================================================ */}
      {showLede && !nodeData.collapsed && (
        <div className="cognograph-node__body flex-1 overflow-hidden" style={{ maxHeight: '5em' }}>
          {/* Description truncated to ~2 lines */}
          {nodeData.description && (
            <p
              className="text-xs mb-1"
              style={{
                color: 'var(--node-text-secondary)',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {nodeData.description}
            </p>
          )}
          {childCount > 0 ? (
            <div className="space-y-1">
              <span className="text-xs font-medium" style={{ color: 'var(--node-text-secondary)' }}>
                {childCount} items
              </span>
              {childNodes.slice(0, 3).map((child) => (
                <div
                  key={child.id}
                  className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded truncate"
                  style={{
                    backgroundColor: 'var(--node-bg-secondary)',
                    color: 'var(--node-text-secondary)',
                  }}
                >
                  {/* Type-color dot */}
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor:
                        (themeSettings.nodeColors as Record<string, string>)[child.type] ??
                        'var(--node-text-muted)',
                    }}
                  />
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

      {/* ================================================================
          L3+ (close/ultra-close): Full description + child list (first 5) + drop zone + drag-to-add
          ================================================================ */}
      {showContent && !nodeData.collapsed && (
        <div
          className="cognograph-node__body flex-1 overflow-auto"
          onContextMenu={handleBodyContextMenu}
        >
          <EditableText
            value={nodeData.description || ''}
            onChange={(newDescription) => updateNode(id, { description: newDescription })}
            placeholder="Add description..."
            className="mb-2"
          />

          {/* Inline property controls */}
          <NodePropertyControls
            nodeId={id}
            nodeType="project"
            data={data as Record<string, unknown>}
          />
          {/* Property Badges */}
          <PropertyBadges
            properties={nodeData.properties || {}}
            definitions={propertyDefinitions}
            hiddenProperties={nodeData.hiddenProperties}
            compact
          />

          {/* Child nodes list (first 5 with type-color dots) */}
          {childNodes.length > 0 && (
            <div className="mt-2 space-y-1">
              {childNodes.slice(0, 5).map((child) => (
                <div
                  key={child.id}
                  className="flex items-center gap-1.5 text-xs px-2 py-1 rounded"
                  style={{
                    backgroundColor: 'var(--node-bg-secondary)',
                    color: 'var(--node-text-secondary)',
                  }}
                >
                  {/* Type-color dot */}
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor:
                        (themeSettings.nodeColors as Record<string, string>)[child.type] ??
                        'var(--node-text-muted)',
                    }}
                  />
                  <span className="truncate">{child.data.title as string}</span>
                </div>
              ))}
              {childNodes.length > 5 && (
                <div className="text-xs" style={{ color: 'var(--node-text-muted)' }}>
                  +{childNodes.length - 5} more
                </div>
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
            <p className="italic text-center" style={{ color: 'var(--node-text-muted)' }}>
              Drag nodes here
            </p>
          )}

          {/* File listing preview — only when folderPath is set and zoom >= 0.3 */}
          {nodeData.folderPath && zoomLevel !== 'ultra-far' && zoomLevel !== 'far' && (
            <FilePreviewSection
              folderPath={nodeData.folderPath}
              fileFilter={nodeData.fileFilter}
              fileListVisible={nodeData.fileListVisible ?? false}
              onToggleVisible={() => updateNode(id, { fileListVisible: !nodeData.fileListVisible })}
              compact
            />
          )}
        </div>
      )}

      {/* Footer — L3+ full, L2 simplified */}
      {showFooter && showContent && (
        <div className="cognograph-node__footer">
          <span>{childCount} items</span>
          <AttachmentBadge count={nodeData.attachments?.length} />
          <span style={{ color: 'var(--node-text-muted)' }}>Project</span>
        </div>
      )}
      {showFooter && !showContent && (
        <div className="cognograph-node__footer" style={{ opacity: 0.7 }}>
          <span>{childCount} items</span>
          <span style={{ color: 'var(--node-text-muted)' }}>Project</span>
        </div>
      )}

      {/* Socket bars showing connections — hidden at L0-L1 */}
      {showHeader && <NodeSocketBars nodeId={id} nodeColor={nodeColor} enabled={selected} />}

      {/* Fold badge for collapsing children */}
      <FoldBadge nodeId={id} nodeColor={nodeColor} />
    </div>
  )

  return (
    <div
      style={{ width: nodeWidth, height: nodeHeight, position: 'relative' }}
      onMouseDown={handleMouseDown}
    >
      {/* NodeResizer only at L3+ (interactive controls) */}
      {showInteractiveControls && (
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
