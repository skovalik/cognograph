import { memo, useMemo, useCallback, useEffect, useState, useRef } from 'react'
import { Handle, Position, NodeResizer, useUpdateNodeInternals, type NodeProps, type ResizeParams } from '@xyflow/react'
import {
  Code,
  FileText,
  Image,
  FileJson,
  Table,
  Globe,
  GitBranch,
  ChevronDown,
  ChevronUp,
  Settings2,
  Download,
  Info,
  RefreshCw,
  Eye,
  FileCode,
  FileImage,
  File
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import type { ArtifactNodeData, ArtifactContentType, ArtifactFile, PreviewViewport } from '@shared/types'
import { DEFAULT_THEME_SETTINGS } from '@shared/types'
import { PropertyBadges } from '../properties/PropertyBadge'
import { NodeSocketBars } from './SocketBar'
import { useShowMembersClass } from '../../hooks/useShowMembersClass'
import { AttachmentBadge } from './AttachmentBadge'
import { getPropertiesForNodeType } from '../../constants/properties'
import { useWorkspaceStore, useIsSpawning, useNodeWarmth, useIsNodePinned, useIsNodeBookmarked, useNodeNumberedBookmark } from '../../stores/workspaceStore'
import { useIsGlassEnabled } from '../../hooks/useIsGlassEnabled'
import { EditableTitle } from '../EditableTitle'
import { InlineIconPicker } from '../InlineIconPicker'
import { measureTextWidth } from '../../utils/nodeUtils'
import { useNodeResize } from '../../hooks/useNodeResize'
import { useNodeContentVisibility } from '../../hooks/useSemanticZoom'
import { PreviewToolbar } from './PreviewToolbar'
import { StructuredContentPreview } from './StructuredContentPreview'
import { AIPropertyAssist, NodeAIErrorBoundary } from '../properties'
import {
  isAllowedPreviewUrl,
  buildPreviewUrl,
  clampPreviewScale,
  clampRefreshInterval,
  PREVIEW_VIEWPORT_WIDTHS,
} from '../../utils/previewUrlValidation'

// TypeScript interface for node styles with CSS custom properties
interface NodeStyleWithCustomProps extends React.CSSProperties {
  '--node-accent'?: string
  '--ring-color'?: string
}

// Default dimensions
const DEFAULT_WIDTH = 320
const DEFAULT_HEIGHT = 220
const MIN_WIDTH = 280
const MIN_HEIGHT = 150

// Preview mode enforces larger minimums (LP-T16)
const PREVIEW_MIN_WIDTH = 400
const PREVIEW_MIN_HEIGHT = 300

// Iframe load timeout in ms (LP-E01 + performance budget)
const IFRAME_LOAD_TIMEOUT = 5000

/* Get icon for content type - reserved for future use
function getContentTypeIcon(contentType: ArtifactContentType): JSX.Element {
  switch (contentType) {
    case 'code':
      return <Code className="w-4 h-4" />
    case 'markdown':
      return <FileText className="w-4 h-4" />
    case 'html':
      return <Globe className="w-4 h-4" />
    case 'svg':
      return <Image className="w-4 h-4" />
    case 'mermaid':
      return <GitBranch className="w-4 h-4" />
    case 'json':
      return <FileJson className="w-4 h-4" />
    case 'csv':
      return <Table className="w-4 h-4" />
    case 'image':
      return <Image className="w-4 h-4" />
    case 'text':
    default:
      return <FileText className="w-4 h-4" />
  }
} */

// Get small icon for file tabs
function getSmallContentTypeIcon(contentType: ArtifactContentType): JSX.Element {
  switch (contentType) {
    case 'code':
      return <Code className="w-3 h-3" />
    case 'markdown':
      return <FileText className="w-3 h-3" />
    case 'html':
      return <Globe className="w-3 h-3" />
    case 'svg':
      return <Image className="w-3 h-3" />
    case 'mermaid':
      return <GitBranch className="w-3 h-3" />
    case 'json':
      return <FileJson className="w-3 h-3" />
    case 'csv':
      return <Table className="w-3 h-3" />
    case 'image':
      return <Image className="w-3 h-3" />
    case 'text':
    default:
      return <FileText className="w-3 h-3" />
  }
}

// Get content type label
function getContentTypeLabel(contentType: ArtifactContentType, customType?: string): string {
  const labels: Record<ArtifactContentType, string> = {
    code: 'Code',
    markdown: 'Markdown',
    html: 'HTML',
    svg: 'SVG',
    mermaid: 'Diagram',
    json: 'JSON',
    csv: 'CSV',
    image: 'Image',
    text: 'Text',
    custom: customType || 'Custom'
  }
  return labels[contentType] || 'File'
}

// Get injection format label
function getInjectionLabel(format: ArtifactNodeData['injectionFormat']): string {
  const labels: Record<ArtifactNodeData['injectionFormat'], string> = {
    full: 'Full',
    summary: 'Summary',
    chunked: 'Chunked',
    'reference-only': 'Ref'
  }
  return labels[format] || 'Full'
}

// Get the active file or primary content
function getActiveContent(nodeData: ArtifactNodeData): { content: string; contentType: ArtifactContentType; language?: string } {
  if (nodeData.files && nodeData.files.length > 0) {
    const activeFile = nodeData.activeFileId
      ? nodeData.files.find(f => f.id === nodeData.activeFileId)
      : nodeData.files[0]

    if (activeFile) {
      return {
        content: activeFile.content,
        contentType: activeFile.contentType,
        language: activeFile.language
      }
    }
  }

  return {
    content: nodeData.content,
    contentType: nodeData.contentType,
    language: nodeData.language
  }
}

function ArtifactNodeComponent({ id, data, selected, width, height }: NodeProps): JSX.Element {
  const nodeData = data as ArtifactNodeData
  const propsWidth = width as number | undefined
  const propsHeight = height as number | undefined
  const updateNodeInternals = useUpdateNodeInternals()
  const nodeRef = useNodeResize(id)
  const propertySchema = useWorkspaceStore((state) => state.propertySchema)
  const updateNode = useWorkspaceStore((state) => state.updateNode)
  const openFloatingProperties = useWorkspaceStore((state) => state.openFloatingProperties)
  const setSelectedNodes = useWorkspaceStore((state) => state.setSelectedNodes)
  const workspacePreferences = useWorkspaceStore((state) => state.workspacePreferences)
  const propertyDefinitions = getPropertiesForNodeType('artifact', propertySchema)
  const themeSettings = useWorkspaceStore((state) => state.themeSettings)
  const updateNodeDimensions = useWorkspaceStore((state) => state.updateNodeDimensions)
  const startNodeResize = useWorkspaceStore((state) => state.startNodeResize)
  const commitNodeResize = useWorkspaceStore((state) => state.commitNodeResize)

  // ---- Preview state ----
  const isPreviewMode = nodeData.previewEnabled === true && !!nodeData.previewUrl
  const [interactionMode, setInteractionMode] = useState(false)
  const [iframeError, setIframeError] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Calculate dynamic node color
  const nodeColor = nodeData.color || themeSettings.nodeColors.artifact || DEFAULT_THEME_SETTINGS.nodeColors.artifact

  // Glass system integration
  const transparent = nodeData.transparent
  const isGlassEnabled = useIsGlassEnabled('nodes', transparent)

  // Use larger minimums for preview mode
  const effectiveMinWidth = isPreviewMode ? PREVIEW_MIN_WIDTH : MIN_WIDTH
  const effectiveMinHeight = isPreviewMode ? PREVIEW_MIN_HEIGHT : MIN_HEIGHT

  // Node dimensions (for resizing) - prefer props from React Flow, then data, then defaults
  const defaultWidth = isPreviewMode ? Math.max(DEFAULT_WIDTH, PREVIEW_MIN_WIDTH) : DEFAULT_WIDTH
  const defaultHeight = isPreviewMode ? Math.max(DEFAULT_HEIGHT, PREVIEW_MIN_HEIGHT) : DEFAULT_HEIGHT
  const nodeWidth = propsWidth || nodeData.width || defaultWidth
  const nodeHeight = propsHeight || nodeData.height || defaultHeight

  // Get content type for tint differentiation
  const activeFileContentType = nodeData.files?.[0]?.contentType || nodeData.contentType

  const nodeStyle = useMemo((): NodeStyleWithCustomProps => {
    const safeNodeColor = nodeColor ?? themeSettings.nodeColors.artifact ?? '#8b5cf7'

    // Content type tint mapping (based on content complexity/importance)
    const contentTypeTints: Record<ArtifactContentType, number> = {
      code: 28,       // Medium-dark (structured content)
      html: 30,       // Darker (rich content)
      svg: 25,        // Medium (vector graphics)
      mermaid: 25,    // Medium (diagrams)
      json: 28,       // Medium-dark (data)
      markdown: 22,   // Lighter (text content)
      text: 20,       // Light (plain text)
      csv: 24,        // Medium-light (tabular data)
      image: 18,      // Lightest (visual content)
      custom: 25      // Medium (fallback)
    }

    const baseOpacity = contentTypeTints[activeFileContentType] || 25
    const tintOpacity = themeSettings.isDarkMode ? Math.round(baseOpacity * 0.5) : baseOpacity
    const borderWidth = 2

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
  }, [nodeColor, themeSettings.nodeColors.artifact, isGlassEnabled, selected, nodeWidth, nodeHeight, activeFileContentType])

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
      const newWidth = Math.max(effectiveMinWidth, Math.ceil(titleWidth + 80))
      updateNodeDimensions(id, newWidth, nodeHeight)
      updateNodeInternals(id)
      commitNodeResize(id)
    }
  }, [nodeData.title, id, nodeHeight, effectiveMinWidth, updateNodeDimensions, updateNodeInternals, startNodeResize, commitNodeResize])

  // ---- Preview: build full URL ----
  const fullPreviewUrl = useMemo(() => {
    if (!isPreviewMode || !nodeData.previewUrl) return null
    return buildPreviewUrl(nodeData.previewUrl, nodeData.previewPath)
  }, [isPreviewMode, nodeData.previewUrl, nodeData.previewPath])

  const isUrlValid = useMemo(() => {
    if (!fullPreviewUrl) return false
    return isAllowedPreviewUrl(fullPreviewUrl)
  }, [fullPreviewUrl])

  // Append refresh key as hash fragment to force reload (LP-T07)
  const iframeSrc = useMemo(() => {
    if (!fullPreviewUrl || !isUrlValid) return undefined
    return refreshKey > 0 ? `${fullPreviewUrl}#refresh-${refreshKey}` : fullPreviewUrl
  }, [fullPreviewUrl, isUrlValid, refreshKey])

  // ---- Preview: interaction mode reset on deselect (LP-T10) ----
  useEffect(() => {
    if (!selected) {
      setInteractionMode(false)
    }
  }, [selected])

  // ---- Preview: Escape key exits interaction mode (LP-E07) ----
  useEffect(() => {
    if (!interactionMode) return

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setInteractionMode(false)
      }
    }

    // Listener on document because focus may be inside the iframe
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [interactionMode])

  // ---- Preview: iframe load timeout (LP-E01) ----
  useEffect(() => {
    if (!isPreviewMode || !iframeSrc) return

    setIframeError(false)

    // Clear previous timeout
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current)
    }

    // Performance monitoring + timeout
    const start = performance.now()
    loadTimeoutRef.current = setTimeout(() => {
      // If the iframe hasn't loaded by now, show error state
      setIframeError(true)
    }, IFRAME_LOAD_TIMEOUT)

    const iframe = iframeRef.current
    if (iframe) {
      const handleLoad = (): void => {
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current)
          loadTimeoutRef.current = null
        }
        setIframeError(false)

        // Performance budget monitoring removed for production
      }

      const handleError = (): void => {
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current)
          loadTimeoutRef.current = null
        }
        setIframeError(true)
      }

      iframe.addEventListener('load', handleLoad, { once: true })
      iframe.addEventListener('error', handleError, { once: true })

      return () => {
        iframe.removeEventListener('load', handleLoad)
        iframe.removeEventListener('error', handleError)
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current)
          loadTimeoutRef.current = null
        }
      }
    }

    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current)
        loadTimeoutRef.current = null
      }
    }
  }, [isPreviewMode, iframeSrc])

  // ---- Preview: auto-refresh polling (LP-E06) ----
  useEffect(() => {
    if (!isPreviewMode || !nodeData.previewAutoRefresh) return

    const interval = clampRefreshInterval(nodeData.previewRefreshInterval || 2000)
    if (interval === 0) return

    const timer = setInterval(() => {
      setRefreshKey((k) => k + 1)
    }, interval)

    return () => clearInterval(timer)
  }, [isPreviewMode, nodeData.previewAutoRefresh, nodeData.previewRefreshInterval])

  // ---- Preview: toolbar callbacks ----
  const handlePreviewRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
    setIframeError(false)
  }, [])

  const handleViewportChange = useCallback(
    (viewport: PreviewViewport) => {
      updateNode(id, { previewViewport: viewport })
    },
    [id, updateNode]
  )

  const handleScaleChange = useCallback(
    (scale: number) => {
      updateNode(id, { previewScale: scale })
    },
    [id, updateNode]
  )

  const handleAutoRefreshToggle = useCallback(() => {
    updateNode(id, { previewAutoRefresh: !nodeData.previewAutoRefresh })
  }, [id, nodeData.previewAutoRefresh, updateNode])

  const handleInteractionModeToggle = useCallback(() => {
    setInteractionMode((prev) => !prev)
  }, [])

  const handlePreviewToggle = useCallback(() => {
    updateNode(id, { previewEnabled: !nodeData.previewEnabled })
  }, [id, nodeData.previewEnabled, updateNode])

  // ---- Preview: computed values ----
  const previewScale = clampPreviewScale(nodeData.previewScale)
  const previewViewport: PreviewViewport = nodeData.previewViewport || 'desktop'
  const viewportWidth = PREVIEW_VIEWPORT_WIDTHS[previewViewport]

  // Get active content (from multi-file or single file)
  const activeContent = getActiveContent(nodeData)
  const isMultiFile = nodeData.files && nodeData.files.length > 0
  const files = nodeData.files || []
  const firstFile = files[0]
  const activeFileId = nodeData.activeFileId || (firstFile ? firstFile.id : undefined)

  // Get preview content (truncated)
  const getPreviewContent = (): string => {
    if (!activeContent.content) return ''

    if (activeContent.contentType === 'image') {
      return '[Image content]'
    }

    const lines = activeContent.content.split('\n')
    const previewLines = nodeData.collapsed ? 3 : nodeData.previewLines || 10
    const preview = lines.slice(0, previewLines).join('\n')

    if (preview.length > 500) {
      return preview.slice(0, 500) + '...'
    }

    return lines.length > previewLines ? preview + '\n...' : preview
  }

  // Handle collapse toggle
  const toggleCollapsed = useCallback((e: React.MouseEvent): void => {
    e.stopPropagation()
    updateNode(id, { collapsed: !nodeData.collapsed })
  }, [id, nodeData.collapsed, updateNode])

  // Handle file tab click
  const handleFileTabClick = useCallback((e: React.MouseEvent, fileId: string): void => {
    e.stopPropagation()
    updateNode(id, { activeFileId: fileId })
  }, [id, updateNode])

  // Handle open properties - respects workspace preference
  const handleOpenProperties = useCallback((e: React.MouseEvent): void => {
    e.stopPropagation()
    if (workspacePreferences.artifactPropertiesDisplay === 'modal') {
      openFloatingProperties(id)
    } else {
      // Open in sidebar - just select the node which shows the properties panel
      setSelectedNodes([id])
    }
  }, [id, openFloatingProperties, setSelectedNodes, workspacePreferences.artifactPropertiesDisplay])

  // Handle download artifact
  const handleDownload = useCallback(async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    try {
      const isImage = activeContent.contentType === 'image'

      const result = await window.api.artifact.download({
        title: nodeData.title,
        content: activeContent.content,
        contentType: activeContent.contentType,
        language: activeContent.language,
        files: isMultiFile ? files.map(f => ({
          filename: f.filename,
          content: f.content,
          contentType: f.contentType
        })) : undefined,
        isBase64: isImage
      })

      if (result.success) {
        toast.success('Artifact saved')
        if (result.note) {
          toast(result.note, { icon: <Info size={16} className="text-blue-400" />, duration: 4000 })
        }
      } else if (!result.canceled) {
        toast.error('Failed to save: ' + (result.error || 'Unknown error'))
      }
    } catch {
      toast.error('Failed to save artifact')
    }
  }, [nodeData.title, activeContent, isMultiFile, files])

  // Count lines for display
  const lineCount = activeContent.content ? activeContent.content.split('\n').length : 0
  const totalFiles = files.length || 1

  // Check if node is disabled
  const isDisabled = nodeData.enabled === false

  // Visual feedback states
  const isSpawning = useIsSpawning(id)
  const warmthLevel = useNodeWarmth(id)

  // Build className with all animation states
  const isPinned = useIsNodePinned(id)
  const isBookmarked = useIsNodeBookmarked(id)
  const numberedBookmark = useNodeNumberedBookmark(id)
  const isCut = useWorkspaceStore(s => s.clipboardState?.mode === 'cut' && s.clipboardState.nodeIds.includes(id))

  // LOD (Level of Detail) rendering based on zoom level
  const { showContent, showTitle, showBadges, showLede, zoomLevel } = useNodeContentVisibility()
  const isFar = zoomLevel === 'far'

  // Show members mode - dim non-members
  const { nonMemberClass, memberHighlightClass } = useShowMembersClass(id, nodeData.parentId)

  // Get file-type icon for far zoom pill display
  const fileTypeIcon = useMemo(() => {
    const ct = activeContent.contentType
    switch (ct) {
      case 'code': return <FileCode size={16} style={{ color: nodeColor }} />
      case 'image':
      case 'svg': return <FileImage size={16} style={{ color: nodeColor }} />
      case 'markdown':
      case 'text': return <FileText size={16} style={{ color: nodeColor }} />
      case 'html': return <Globe size={16} style={{ color: nodeColor }} />
      case 'json': return <FileJson size={16} style={{ color: nodeColor }} />
      case 'csv': return <Table size={16} style={{ color: nodeColor }} />
      case 'mermaid': return <GitBranch size={16} style={{ color: nodeColor }} />
      default: return <File size={16} style={{ color: nodeColor }} />
    }
  }, [activeContent.contentType, nodeColor])

  // Truncated content preview for mid zoom (first 120 chars)
  const ledePreview = useMemo(() => {
    if (!activeContent.content) return ''
    if (activeContent.contentType === 'image') return '[Image content]'
    return activeContent.content.slice(0, 120).replace(/\n/g, ' ') + (activeContent.content.length > 120 ? '...' : '')
  }, [activeContent.content, activeContent.contentType])

  const nodeClassName = [
    'cognograph-node',
    'cognograph-node--artifact',
    selected && 'selected',
    isDisabled && 'cognograph-node--disabled',
    isSpawning && 'spawning',
    nonMemberClass,
    memberHighlightClass,
    warmthLevel && `warmth-${warmthLevel}`,
    isPinned && 'node--pinned',
    isBookmarked && 'cognograph-node--bookmarked',
    isCut && 'cognograph-node--cut',
    nodeData.nodeShape && `node-shape-${nodeData.nodeShape}`,
    `artifact-node--lod-${zoomLevel}`
  ].filter(Boolean).join(' ')

  const nodeContent = (
    <div ref={nodeRef} className={nodeClassName} style={nodeStyle} data-transparent={transparent} data-lod={zoomLevel} onDoubleClick={handleDoubleClick}>
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

      {/* === LOD: Far zoom — compact pill with file-type icon + title + type badge === */}
      {isFar && (
        <div className="flex items-center gap-2 px-2 py-1 h-full min-h-0 overflow-hidden">
          {fileTypeIcon}
          {showTitle && (
            <span
              className="text-xs font-medium truncate flex-1"
              style={{ color: 'var(--node-text-primary)' }}
            >
              {nodeData.title || 'Untitled Artifact'}
            </span>
          )}
          {showBadges && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0"
              style={{
                backgroundColor: 'var(--node-bg-secondary)',
                color: 'var(--node-text-secondary)'
              }}
            >
              {getContentTypeLabel(activeContent.contentType, nodeData.customContentType)}
            </span>
          )}
        </div>
      )}

      {/* === LOD: Mid + Close — full header === */}
      {!isFar && (
        <>
          {/* Header — standard buttons or preview toggle */}
          {isPreviewMode ? (
            // Preview mode: minimal header with title + Eye icon for preview identification
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
                placeholder="Untitled Artifact"
              />
              {showContent && (
                <NodeAIErrorBoundary compact>
                  <AIPropertyAssist
                    nodeId={id}
                    nodeData={nodeData}
                    compact={true}
                  />
                </NodeAIErrorBoundary>
              )}
              <Eye className="w-4 h-4 mr-1" style={{ color: 'var(--node-text-muted)' }} />
            </div>
          ) : (
            // Standard mode: Download, Properties, Collapse buttons
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
                placeholder="Untitled Artifact"
              />
              {showContent && (
                <NodeAIErrorBoundary compact>
                  <AIPropertyAssist
                    nodeId={id}
                    nodeData={nodeData}
                    compact={true}
                  />
                </NodeAIErrorBoundary>
              )}
              {showContent && (
                <button
                  onClick={handleDownload}
                  className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-colors"
                  title="Download artifact"
                >
                  <Download className="w-4 h-4" style={{ color: 'var(--node-text-secondary)' }} />
                </button>
              )}
              {showContent && (
                <button
                  onClick={handleOpenProperties}
                  className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-colors"
                  title="Open properties"
                >
                  <Settings2 className="w-4 h-4" style={{ color: 'var(--node-text-secondary)' }} />
                </button>
              )}
              <button
                onClick={toggleCollapsed}
                className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-colors"
                title={nodeData.collapsed ? 'Expand' : 'Collapse'}
              >
                {nodeData.collapsed ? (
                  <ChevronDown className="w-4 h-4" style={{ color: 'var(--node-text-secondary)' }} />
                ) : (
                  <ChevronUp className="w-4 h-4" style={{ color: 'var(--node-text-secondary)' }} />
                )}
              </button>
            </div>
          )}
        </>
      )}

      {/* === LOD: Far zoom — skeleton density preview for file content === */}
      {isFar && !nodeData.collapsed && activeContent.content && activeContent.contentType !== 'image' && (
        <div className="cognograph-node__body" style={{ pointerEvents: 'none' }}>
          <StructuredContentPreview content={activeContent.content} zoomLevel="far" />
        </div>
      )}

      {/* === LOD: Mid zoom — summary with content preview (lede) === */}
      {showLede && !isFar && !nodeData.collapsed && (
        <div className="cognograph-node__body" style={{ maxHeight: '4.5em', overflow: 'hidden' }}>
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: 'var(--node-bg-secondary)',
                color: 'var(--node-text-secondary)'
              }}
            >
              {getContentTypeLabel(activeContent.contentType, nodeData.customContentType)}
            </span>
            {activeContent.language && (
              <span className="text-[10px]" style={{ color: 'var(--node-text-muted)' }}>
                {activeContent.language}
              </span>
            )}
            {isMultiFile && (
              <span className="text-[10px]" style={{ color: 'var(--node-text-muted)' }}>
                {totalFiles} files
              </span>
            )}
          </div>
          {ledePreview && (
            <pre
              className="text-[10px] font-mono whitespace-pre-wrap overflow-hidden p-1 rounded"
              style={{
                backgroundColor: 'var(--node-bg-secondary)',
                color: 'var(--node-text-muted)',
                maxHeight: '2.4em'
              }}
            >
              {ledePreview}
            </pre>
          )}
        </div>
      )}

      {/* === LOD: Close zoom — full content === */}
      {showContent && !isFar && (
        <>
          {/* Preview Toolbar (replaces file tabs in preview mode — LP-T15) */}
          {isPreviewMode && (
            <PreviewToolbar
              viewport={previewViewport}
              scale={previewScale}
              autoRefresh={nodeData.previewAutoRefresh || false}
              interactionMode={interactionMode}
              previewUrl={fullPreviewUrl || nodeData.previewUrl || ''}
              onViewportChange={handleViewportChange}
              onScaleChange={handleScaleChange}
              onAutoRefreshToggle={handleAutoRefreshToggle}
              onRefresh={handlePreviewRefresh}
              onInteractionModeToggle={handleInteractionModeToggle}
              onPreviewToggle={handlePreviewToggle}
            />
          )}

          {/* File Tabs (for multi-file artifacts, standard mode only) */}
          {!isPreviewMode && isMultiFile && !nodeData.collapsed && (
            <div
              className="flex gap-0.5 px-2 py-1 border-b overflow-x-auto"
              style={{
                backgroundColor: 'var(--node-bg-secondary)',
                borderColor: 'var(--node-border-secondary)'
              }}
            >
              {files.sort((a, b) => a.order - b.order).map((file: ArtifactFile) => (
                <button
                  key={file.id}
                  onClick={(e) => handleFileTabClick(e, file.id)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] whitespace-nowrap transition-colors ${
                    activeFileId === file.id
                      ? 'bg-cyan-600/30'
                      : 'hover:bg-black/10 dark:hover:bg-white/10'
                  }`}
                  style={{
                    color: activeFileId === file.id ? 'var(--node-text-primary)' : 'var(--node-text-secondary)'
                  }}
                >
                  {getSmallContentTypeIcon(file.contentType)}
                  <span className="max-w-[80px] truncate">{file.filename}</span>
                </button>
              ))}
            </div>
          )}

          {/* Body — Preview iframe OR standard content */}
          {isPreviewMode ? (
            // ============ PREVIEW MODE BODY ============
            <div className="cognograph-node__body" style={{ flex: 1, minHeight: 0 }}>
              {!isUrlValid ? (
                // Invalid URL message
                <div
                  className="flex flex-col items-center justify-center gap-2 p-4 text-center h-full"
                  style={{ color: 'var(--node-text-muted)' }}
                >
                  <Globe className="w-8 h-8 opacity-50" />
                  <span className="text-xs">
                    Invalid preview URL. Only localhost URLs are allowed.
                  </span>
                </div>
              ) : iframeError ? (
                // Unreachable URL — error state (LP-E01 / LP-T17)
                <div
                  className="flex flex-col items-center justify-center gap-2 p-4 text-center h-full"
                  style={{ color: 'var(--node-text-muted)' }}
                >
                  <Globe className="w-8 h-8 opacity-50" />
                  <span className="text-xs">
                    Preview unavailable. Start your dev server at{' '}
                    <span className="font-mono text-cyan-400">{fullPreviewUrl}</span>{' '}
                    and click Refresh.
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handlePreviewRefresh()
                    }}
                    className="flex items-center gap-1 px-2 py-1 mt-1 text-xs rounded transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                    style={{ color: 'var(--node-text-secondary)' }}
                  >
                    <RefreshCw className="w-3 h-3" />
                    Refresh
                  </button>
                </div>
              ) : (
                // iframe container with overlay
                <div
                  className="relative flex-1"
                  style={{
                    width: '100%',
                    height: '100%',
                    overflow: 'hidden',
                  }}
                >
                  {/* Scaled iframe container */}
                  <div
                    style={{
                      width: viewportWidth,
                      maxWidth: '100%',
                      height: '100%',
                      transformOrigin: 'top left',
                      transform: `scale(${previewScale})`,
                    }}
                  >
                    <iframe
                      ref={iframeRef}
                      src={iframeSrc}
                      sandbox="allow-scripts allow-same-origin"
                      style={{
                        width: '100%',
                        height: `${100 / previewScale}%`,
                        border: '1px solid var(--node-border-secondary)',
                        borderRadius: '4px',
                        backgroundColor: 'white',
                      }}
                      title={`Preview: ${nodeData.title}`}
                    />
                  </div>

                  {/* Click overlay — captures pointer events for React Flow (LP-T08) */}
                  {!interactionMode && (
                    <div
                      className="absolute inset-0"
                      style={{
                        cursor: 'grab',
                        zIndex: 1,
                        // Transparent but clickable
                        backgroundColor: 'transparent',
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        setInteractionMode(true)
                      }}
                      title="Double-click to interact with preview"
                    />
                  )}
                </div>
              )}
            </div>
          ) : (
            // ============ STANDARD MODE BODY ============
            <>
              {!nodeData.collapsed && (
                <div className="cognograph-node__body">
                  {activeContent.contentType === 'image' && activeContent.content ? (
                    <div className="flex justify-center">
                      <img
                        src={activeContent.content}
                        alt={nodeData.title}
                        className="max-h-32 max-w-full rounded object-contain"
                      />
                    </div>
                  ) : (
                    <pre
                      className="text-xs font-mono whitespace-pre-wrap overflow-hidden p-2 rounded flex-1"
                      style={{
                        backgroundColor: 'var(--node-bg-secondary)',
                        color: 'var(--node-text-secondary)'
                      }}
                    >
                      {getPreviewContent() || <span className="italic" style={{ color: 'var(--node-text-muted)' }}>Empty artifact</span>}
                    </pre>
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
            </>
          )}
        </>
      )}

      {/* Footer — hidden at far zoom */}
      {!isFar && (
        <div className="cognograph-node__footer">
          <div className="flex items-center gap-2">
            {isPreviewMode ? (
              // Preview footer: show URL and viewport info
              <>
                <span className="text-cyan-500 text-xs font-mono truncate max-w-[150px]">
                  {fullPreviewUrl || nodeData.previewUrl}
                </span>
                <span className="text-xs" style={{ color: 'var(--node-text-muted)' }}>
                  {viewportWidth}px
                </span>
              </>
            ) : (
              // Standard footer
              <>
                <span className="text-cyan-500 text-xs">v{nodeData.version}</span>
                {activeContent.language && (
                  <span className="text-xs" style={{ color: 'var(--node-text-muted)' }}>{activeContent.language}</span>
                )}
                {isMultiFile ? (
                  <span className="text-xs" style={{ color: 'var(--node-text-muted)' }}>{totalFiles} files</span>
                ) : (
                  <span className="text-xs" style={{ color: 'var(--node-text-muted)' }}>{lineCount} lines</span>
                )}
                <AttachmentBadge count={nodeData.attachments?.length} />
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isPreviewMode ? (
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: 'var(--node-bg-secondary)',
                  color: 'var(--node-text-secondary)'
                }}
              >
                Preview
              </span>
            ) : (
              <>
                <span
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: 'var(--node-bg-secondary)',
                    color: 'var(--node-text-secondary)'
                  }}
                >
                  {getInjectionLabel(nodeData.injectionFormat)}
                </span>
                <span style={{ color: 'var(--node-text-muted)' }}>
                  {isMultiFile ? 'Multi-file' : getContentTypeLabel(activeContent.contentType, nodeData.customContentType)}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Socket bars showing connections — hidden at far zoom */}
      {!isFar && <NodeSocketBars nodeId={id} nodeColor={nodeColor} enabled={selected} />}
    </div>
  )

  return (
    <>
      {/* NodeResizer: only at close zoom */}
      {showContent && (
        <NodeResizer
          minWidth={effectiveMinWidth}
          minHeight={effectiveMinHeight}
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

export const ArtifactNode = memo(ArtifactNodeComponent)
