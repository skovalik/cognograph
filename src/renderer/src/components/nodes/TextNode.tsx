import { memo, useMemo, useCallback, useEffect } from 'react'
import { Handle, Position, NodeResizer, useUpdateNodeInternals, type NodeProps, type ResizeParams } from '@xyflow/react'
import type { TextNodeData } from '@shared/types'
import { DEFAULT_THEME_SETTINGS } from '@shared/types'
import { useWorkspaceStore, useIsSpawning, useNodeWarmth, useIsNodePinned } from '../../stores/workspaceStore'
import { useShowMembersClassForTextNode } from '../../hooks/useShowMembersClass'
import { useIsGlassEnabled } from '../../hooks/useIsGlassEnabled'
import { RichTextEditor } from '../RichTextEditor'
import { AttachmentBadge } from './AttachmentBadge'
import { ExtractionBadge, ExtractionControls } from '../extractions'
import { AutoFitButton } from './AutoFitButton'
import { useNodeResize } from '../../hooks/useNodeResize'
import { useNodeContentVisibility } from '../../hooks/useSemanticZoom'
import { AIPropertyAssist, NodeAIErrorBoundary } from '../properties'

// TypeScript interface for node styles with CSS custom properties
interface NodeStyleWithCustomProps extends React.CSSProperties {
  '--node-accent'?: string
  '--ring-color'?: string
}

// Default dimensions
const DEFAULT_WIDTH = 200
const DEFAULT_HEIGHT = 60
const MIN_WIDTH = 100
const MIN_HEIGHT = 30

function TextNodeComponent({ id, data, selected, width, height }: NodeProps): JSX.Element {
  const nodeData = data as TextNodeData
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
  const nodeColor = nodeData.color || themeSettings.nodeColors.text || DEFAULT_THEME_SETTINGS.nodeColors.text

  // Glass system integration
  const transparent = nodeData.transparent
  const isGlassEnabled = useIsGlassEnabled('nodes', transparent)

  // Node dimensions (for resizing) - prefer props from React Flow, then data, then defaults
  const nodeWidth = propsWidth || nodeData.width || DEFAULT_WIDTH
  const nodeHeight = propsHeight || nodeData.height || DEFAULT_HEIGHT

  const nodeStyle = useMemo((): NodeStyleWithCustomProps => {
    const safeNodeColor = nodeColor ?? themeSettings.nodeColors.text ?? '#64748b'

    return {
      '--ring-color': safeNodeColor,
      '--node-accent': safeNodeColor,
      width: nodeWidth,
      height: nodeHeight,
    }
  }, [nodeColor, themeSettings.nodeColors.text, nodeWidth, nodeHeight])

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
  const isCut = useWorkspaceStore(s => s.clipboardState?.mode === 'cut' && s.clipboardState.nodeIds.includes(id))

  // LOD (Level of Detail) rendering based on zoom level
  const { lodLevel, showContent, showPlaceholders } = useNodeContentVisibility()

  // TextNode is ultra-minimal: show text content at L2+ (mid and above)
  const showTextContent = lodLevel >= 2

  // Show members mode - dim non-members
  const { nonMemberClass } = useShowMembersClassForTextNode(id, nodeData.parentId)
  const showInteractiveControls = showContent

  // Extract plain text preview for aria-label at L0 (hidden) zoom
  const plainTextPreview = useMemo(() => {
    if (!nodeData.content) return ''
    // Strip HTML tags and collapse whitespace
    const plain = nodeData.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    return plain
  }, [nodeData.content])

  // Estimate line count for placeholder bars at L1
  const estimatedLines = useMemo(() => {
    if (!nodeData.content) return 2
    const plain = nodeData.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    const wordCount = plain ? plain.split(/\s+/).length : 0
    // ~5 words per line at typical text node width, clamp to 2-3
    return Math.min(3, Math.max(2, Math.ceil(wordCount / 5)))
  }, [nodeData.content])

  // Build className
  const nodeClassName = [
    'text-node',
    selected && 'selected',
    // is-active reserved for functional state only (not selection)
    isDisabled && 'cognograph-node--disabled',
    isSpawning && 'spawning',
    nonMemberClass,
    warmthLevel && `warmth-${warmthLevel}`,
    isPinned && 'node--pinned',
    isCut && 'text-node--cut',
    nodeData.nodeShape && `node-shape-${nodeData.nodeShape}`,
    `text-node--lod-${lodLevel}`
  ].filter(Boolean).join(' ')

  const nodeContent = (
    <div
      ref={nodeRef}
      className={nodeClassName}
      style={nodeStyle}
      data-lod={lodLevel}
      data-transparent={transparent}
    >
      {/* L0 (ultra-far): Hidden entirely — screen reader fallback only */}
      {lodLevel === 0 && (
        <div
          role="img"
          aria-label={`Text: ${plainTextPreview.slice(0, 50) || 'Empty'}`}
          style={{ display: 'none' }}
        />
      )}

      {/* L1 (far): Placeholder bars — abstract content density signal */}
      {showPlaceholders && !showTextContent && (
        <div className="text-node-body" aria-hidden="true" style={{ pointerEvents: 'none' }}>
          <div className="placeholder-bars">
            {Array.from({ length: estimatedLines }, (_, i) => (
              <div
                key={i}
                className={`placeholder-bar ${
                  i === 0 ? 'placeholder-bar--long placeholder-bar--accent' :
                  i === estimatedLines - 1 ? 'placeholder-bar--short' :
                  'placeholder-bar--medium'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* L2+ (mid/close/ultra-close): Minimal TipTap content — just the text, no chrome */}
      {showTextContent && (
        <>
          {/* Type label: floats above node — only at editable zoom */}
          <div className="cognograph-node__type-label" style={{ color: nodeColor ?? '#64748b' }}>
            TEXT
          </div>

          {/* Auto-fit button */}
          <AutoFitButton
            nodeId={id}
            title=""
            content={nodeData.content}
            selected={selected}
            nodeColor={nodeColor}
            minWidth={MIN_WIDTH}
            minHeight={MIN_HEIGHT}
            headerHeight={0}
            footerHeight={0}
          />

          {/* Handles */}
          <Handle type="target" position={Position.Top} id="top-target" className="text-node-handle" />
          <Handle type="source" position={Position.Top} id="top-source" className="text-node-handle" />
          <Handle type="target" position={Position.Bottom} id="bottom-target" className="text-node-handle" />
          <Handle type="source" position={Position.Bottom} id="bottom-source" className="text-node-handle" />
          <Handle type="target" position={Position.Left} id="left-target" className="text-node-handle" />
          <Handle type="source" position={Position.Left} id="left-source" className="text-node-handle" />
          <Handle type="target" position={Position.Right} id="right-target" className="text-node-handle" />
          <Handle type="source" position={Position.Right} id="right-source" className="text-node-handle" />

          {/* Extraction badge for spatial extraction system */}
          <ExtractionBadge nodeId={id} nodeColor={nodeColor} />

          {/* Extraction controls + AI Property Assist */}
          {showInteractiveControls && (
            <div className="absolute top-1 right-1 z-10 flex items-center gap-1">
              <NodeAIErrorBoundary compact>
                <AIPropertyAssist
                  nodeId={id}
                  nodeData={nodeData}
                  compact={true}
                />
              </NodeAIErrorBoundary>
              <ExtractionControls nodeId={id} />
            </div>
          )}

          {/* TipTap editor — minimal, no header, no footer, just text */}
          <div className="text-node-body" data-focusable="true">
            <RichTextEditor
              value={nodeData.content || ''}
              onChange={(html) => updateNode(id, { content: html })}
              placeholder="Type here..."
              enableLists={true}
              enableFormatting={true}
              enableHeadings={true}
              enableAlignment={true}
              floatingToolbar={true}
              showToolbar="on-focus"
              minHeight={20}
              editOnDoubleClick={true}
            />
          </div>

          {nodeData.attachments && nodeData.attachments.length > 0 && (
            <div className="cognograph-node__footer" style={{ padding: '2px 8px' }}>
              <AttachmentBadge count={nodeData.attachments.length} />
            </div>
          )}
        </>
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

export const TextNode = memo(TextNodeComponent)
