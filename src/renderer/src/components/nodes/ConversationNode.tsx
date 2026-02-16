import { memo, useCallback, useMemo, useState, useEffect, useRef } from 'react'
import { Handle, Position, NodeResizer, useUpdateNodeInternals, type NodeProps, type ResizeParams } from '@xyflow/react'
import { Sparkles, Wand2, ChevronDown, ChevronUp, Link2, Play, Pause, Square, Bot, MessageSquare, RotateCcw } from 'lucide-react'
import type { ConversationNodeData, AgentStatus } from '@shared/types'
import { formatCost } from '../../utils/tokenEstimator'
import { DEFAULT_EXTRACTION_SETTINGS, DEFAULT_THEME_SETTINGS } from '@shared/types'
import { useWorkspaceStore, useIsStreaming, useIsSpawning, useNodeWarmth, useIsNodePinned, useIsNodeBookmarked, useNodeNumberedBookmark } from '../../stores/workspaceStore'
import { useShowMembersClass } from '../../hooks/useShowMembersClass'
import { useIsGlassEnabled } from '../../hooks/useIsGlassEnabled'
import { PropertyBadges } from '../properties/PropertyBadge'
import { getPropertiesForNodeType } from '../../constants/properties'
import { runExtraction } from '../../utils/extraction'
import { NodeSocketBars } from './SocketBar'
import { AttachmentBadge } from './AttachmentBadge'
import { EditableTitle } from '../EditableTitle'
import { InlineIconPicker } from '../InlineIconPicker'
import { measureTextWidth } from '../../utils/nodeUtils'
import { ExtractionBadge } from '../extractions'
import { AutoFitButton } from './AutoFitButton'
import { FoldBadge } from './FoldBadge'
import { NodeModeDropdown } from './NodeModeDropdown'
import { useNodeResize } from '../../hooks/useNodeResize'
import { getPresetById } from '../../constants/agentPresets'
import { runAgent, pauseAgent, stopAgent, retryAgent } from '../../services/agentService'
import { CountUp } from '../ui/react-bits'
import { AgentActivityBadge } from '../bridge/AgentActivityBadge'
import { InlineErrorBoundary } from '../ErrorBoundary'

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

function ConversationNodeComponent({ id, data, selected, width, height }: NodeProps): JSX.Element {
  const nodeData = data as ConversationNodeData
  const propsWidth = width as number | undefined
  const propsHeight = height as number | undefined
  const updateNodeInternals = useUpdateNodeInternals()
  const nodeRef = useNodeResize(id)
  const openChat = useWorkspaceStore((state) => state.openChat)
  const updateNode = useWorkspaceStore((state) => state.updateNode)
  const propertySchema = useWorkspaceStore((state) => state.propertySchema)
  const propertyDefinitions = getPropertiesForNodeType('conversation', propertySchema)
  const updateExtractionSettings = useWorkspaceStore((state) => state.updateExtractionSettings)
  const setLeftSidebarTab = useWorkspaceStore((state) => state.setLeftSidebarTab)
  const toggleLeftSidebar = useWorkspaceStore((state) => state.toggleLeftSidebar)
  const leftSidebarOpen = useWorkspaceStore((state) => state.leftSidebarOpen)
  const setIsExtracting = useWorkspaceStore((state) => state.setIsExtracting)
  const addPendingExtraction = useWorkspaceStore((state) => state.addPendingExtraction)
  const isExtracting = useWorkspaceStore((state) => state.isExtracting)
  const themeSettings = useWorkspaceStore((state) => state.themeSettings)
  const updateNodeDimensions = useWorkspaceStore((state) => state.updateNodeDimensions)
  const startNodeResize = useWorkspaceStore((state) => state.startNodeResize)
  const commitNodeResize = useWorkspaceStore((state) => state.commitNodeResize)

  // Visual feedback state
  const isStreaming = useIsStreaming(id)
  const isSpawning = useIsSpawning(id)
  const warmthLevel = useNodeWarmth(id)

  // Extraction particle state
  const [showParticles, setShowParticles] = useState(false)
  const wasExtractingRef = useRef(false)

  // Trigger particles when extraction completes
  useEffect(() => {
    const wasExtracting = wasExtractingRef.current
    const isNowExtracting = isExtracting === id

    // Trigger particles when extraction ends (and was extracting before)
    if (wasExtracting && !isNowExtracting) {
      setShowParticles(true)
      setTimeout(() => setShowParticles(false), 1500)
    }

    wasExtractingRef.current = isNowExtracting
  }, [isExtracting, id])

  const extractionSettings = nodeData.extractionSettings || DEFAULT_EXTRACTION_SETTINGS

  // Calculate dynamic node color
  const nodeColor = nodeData.color || themeSettings.nodeColors.conversation || DEFAULT_THEME_SETTINGS.nodeColors.conversation

  // Node dimensions (for resizing) - prefer props from React Flow, then data, then defaults
  const nodeWidth = propsWidth || nodeData.width || DEFAULT_WIDTH
  const nodeHeight = propsHeight || nodeData.height || DEFAULT_HEIGHT

  // Glass system integration - extract transparent to minimize re-renders
  const transparent = nodeData.transparent
  const isGlassEnabled = useIsGlassEnabled('nodes', transparent)

  const nodeStyle = useMemo((): NodeStyleWithCustomProps => {
    const isAgent = nodeData.mode === 'agent'
    // Agent mode: 30% tint (darker), Chat mode: 20% tint (lighter)
    // Dark mode: use lower opacity for better text contrast
    const baseOpacity = isAgent ? 30 : 20
    const tintOpacity = themeSettings.isDarkMode ? Math.round(baseOpacity * 0.5) : baseOpacity
    const borderWidth = 2

    // Fallback chain for undefined nodeColor
    const safeNodeColor = nodeColor ?? themeSettings.nodeColors.conversation ?? '#3b82f6' // blue-500

    // Agent mode uses conversation blue, same as chat mode
    const effectiveBorderColor = safeNodeColor
    const effectiveTintColor = safeNodeColor

    return {
      borderWidth: `${borderWidth}px`,
      borderStyle: 'solid', // FORCE solid borders
      borderColor: effectiveBorderColor, // Blue for both chat and agent
      // ALWAYS add opaque background (CSS overrides when glass enabled)
      background: `color-mix(in srgb, ${effectiveTintColor} ${tintOpacity}%, var(--node-bg))`,
      boxShadow: selected ? `0 0 0 2px ${safeNodeColor}40, 0 0 20px ${safeNodeColor}30` : 'none',
      width: nodeWidth,
      height: nodeHeight,
      transition: 'background 200ms ease-out, border-color 200ms ease-out, backdrop-filter 200ms ease-out, opacity 200ms ease-out',
      // CSS custom properties for dynamic theming
      '--ring-color': effectiveBorderColor,    // Edge handles color
      '--node-accent': effectiveBorderColor     // Glass background tint
    }
  }, [nodeColor, selected, nodeWidth, nodeHeight, nodeData.mode, isGlassEnabled, themeSettings.nodeColors.conversation, themeSettings.isDarkMode])

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

  const showTokenEstimates = useWorkspaceStore(
    (state) => state.workspacePreferences.showTokenEstimates
  )

  const messageCount = nodeData.messages.length
  const lastMessage = nodeData.messages[nodeData.messages.length - 1]

  const totalCost = useMemo(() => {
    return nodeData.messages.reduce((sum, m) => sum + (m.costUSD ?? 0), 0)
  }, [nodeData.messages])

  const handleDoubleClick = useCallback((e: React.MouseEvent): void => {
    if (e.ctrlKey) {
      e.stopPropagation()
      startNodeResize(id)
      const titleWidth = measureTextWidth(nodeData.title, '14px Inter, sans-serif')
      const newWidth = Math.max(MIN_WIDTH, Math.ceil(titleWidth + 80))
      updateNodeDimensions(id, newWidth, nodeHeight)
      updateNodeInternals(id)
      commitNodeResize(id)
    } else {
      openChat(id)
    }
  }, [nodeData.title, id, nodeHeight, updateNodeDimensions, updateNodeInternals, openChat, startNodeResize, commitNodeResize])

  // Handle collapse toggle
  const toggleCollapsed = useCallback((e: React.MouseEvent): void => {
    e.stopPropagation()
    updateNode(id, { collapsed: !nodeData.collapsed })
  }, [id, nodeData.collapsed, updateNode])

  // Get preview content based on collapsed state
  const getPreviewContent = (): string => {
    if (!lastMessage) return ''

    const prefix = lastMessage.role === 'user' ? 'You: ' : 'AI: '
    const content = lastMessage.content

    if (nodeData.collapsed) {
      // Collapsed: show first 60 chars
      return prefix + (content.length > 60 ? content.slice(0, 60) + '...' : content)
    } else {
      // Expanded: show first 300 chars with more lines
      const maxChars = 300
      const preview = content.slice(0, maxChars)
      return prefix + (content.length > maxChars ? preview + '...' : content)
    }
  }

  const handleManualExtract = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      if (isExtracting === id) return // Already extracting

      setIsExtracting(id)

      try {
        const results = await runExtraction(
          id,
          nodeData.messages,
          { ...extractionSettings, extractionConfidenceThreshold: 0.5 }, // Lower threshold for manual
          nodeData.extractedTitles || []
        )

        results.forEach((result) => {
          addPendingExtraction({
            sourceNodeId: id,
            type: result.type,
            suggestedData: {
              title: result.title,
              content: result.content,
              ...(result.type === 'task' && {
                priority: result.priority || 'medium',
                status: 'todo',
                description: result.content
              }),
              tags: result.tags
            },
            confidence: result.confidence
          })
        })

        // Open extractions panel if we found something
        if (results.length > 0) {
          setLeftSidebarTab('extractions')
          if (!leftSidebarOpen) toggleLeftSidebar()
        }
      } finally {
        setIsExtracting(null)
      }
    },
    [
      id,
      nodeData.messages,
      nodeData.extractedTitles,
      extractionSettings,
      isExtracting,
      addPendingExtraction,
      setIsExtracting,
      setLeftSidebarTab,
      leftSidebarOpen,
      toggleLeftSidebar
    ]
  )

  // Mode change handler for dropdown
  const handleModeChange = useCallback((newMode: 'chat' | 'agent') => {
    if (newMode === 'agent') {
      // Initialize agent mode fields if not set
      updateNode(id, {
        mode: 'agent',
        agentPreset: nodeData.agentPreset || 'custom',
        agentStatus: nodeData.agentStatus || 'idle'
      })
    } else {
      // Switch to chat mode (preserve agent data for later)
      updateNode(id, { mode: 'chat' })
    }
  }, [id, nodeData.agentPreset, nodeData.agentStatus, updateNode])

  // Mode dropdown options
  const modeOptions = useMemo(() => [
    {
      value: 'chat',
      label: 'Chat',
      icon: MessageSquare,
      description: 'Interactive chat with AI'
    },
    {
      value: 'agent',
      label: 'Agent',
      icon: Bot,
      description: 'Autonomous AI that creates nodes'
    }
  ], [])

  // Check if node is disabled
  const isDisabled = nodeData.enabled === false

  const isPinned = useIsNodePinned(id)
  const isBookmarked = useIsNodeBookmarked(id)
  const numberedBookmark = useNodeNumberedBookmark(id)
  const isCut = useWorkspaceStore(s => s.clipboardState?.mode === 'cut' && s.clipboardState.nodeIds.includes(id))

  // Show members mode - dim non-members
  const { nonMemberClass, memberHighlightClass } = useShowMembersClass(id, nodeData.parentId)

  // Build className with all visual feedback states
  const nodeClassName = [
    'cognograph-node',
    'cognograph-node--conversation',
    nodeData.mode === 'agent' && 'conversation-node--agent',
    selected && 'selected',
    isDisabled && 'cognograph-node--disabled',
    isStreaming && 'streaming',
    nonMemberClass,
    memberHighlightClass,
    isExtracting === id && 'extracting',
    isSpawning && 'spawning',
    warmthLevel && `warmth-${warmthLevel}`,
    isPinned && 'node--pinned',
    isBookmarked && 'cognograph-node--bookmarked',
    isCut && 'cognograph-node--cut',
    nodeData.nodeShape && `node-shape-${nodeData.nodeShape}`
  ].filter(Boolean).join(' ')

  const nodeContent = (
    <div
      ref={nodeRef}
      className={nodeClassName}
      style={nodeStyle}
      data-transparent={transparent}
      onDoubleClick={handleDoubleClick}
    >
      {/* Auto-fit button - appears when selected */}
      <AutoFitButton
        nodeId={id}
        title={nodeData.title}
        selected={selected}
        nodeColor={nodeColor}
        minWidth={MIN_WIDTH}
        minHeight={MIN_HEIGHT}
      />
      {/* Handles on all four sides - each can be both source and target */}
      <Handle type="target" position={Position.Top} id="top-target" />
      <Handle type="source" position={Position.Top} id="top-source" />
      <Handle type="target" position={Position.Bottom} id="bottom-target" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" />
      <Handle type="target" position={Position.Left} id="left-target" />
      <Handle type="source" position={Position.Left} id="left-source" />
      <Handle type="target" position={Position.Right} id="right-target" />
      <Handle type="source" position={Position.Right} id="right-source" />

      {/* Extraction particles effect */}
      {showParticles && (
        <div className="extraction-particles">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="extraction-particle" />
          ))}
        </div>
      )}

      {/* Numbered bookmark badge */}
      {numberedBookmark && (
        <div className={`numbered-bookmark-badge numbered-bookmark-badge--${numberedBookmark}`}>
          {numberedBookmark}
        </div>
      )}

      {/* Extraction badge for spatial extraction system */}
      <ExtractionBadge nodeId={id} nodeColor={nodeColor} />

      {/* Bridge: Agent activity badge (Phase 1) - wrapped in error boundary */}
      {nodeData.mode === 'agent' && (
        <InlineErrorBoundary name="AgentActivityBadge">
          <AgentActivityBadge nodeId={id} agentName={nodeData.title || 'Agent'} />
        </InlineErrorBoundary>
      )}

      <div className="cognograph-node__header">
        <InlineIconPicker
          nodeData={{
            ...nodeData,
            // Use Bot icon for agent mode if user hasn't customized it
            icon: nodeData.mode === 'agent' && !nodeData.icon ? 'Bot' : nodeData.icon
          }}
          nodeColor={nodeColor}
          onIconChange={(icon) => updateNode(id, { icon })}
          onIconColorChange={(iconColor) => updateNode(id, { iconColor })}
          className="cognograph-node__icon"
        />
        <EditableTitle
          value={nodeData.title}
          onChange={(newTitle) => updateNode(id, { title: newTitle })}
          className="cognograph-node__title flex-1 truncate"
          placeholder="Untitled Conversation"
        />
        {!!nodeData.properties?.url && (
          <span title={nodeData.properties.url as string}>
            <Link2
              className="w-3 h-3 opacity-60 flex-shrink-0"
              style={{ color: 'var(--node-text-secondary)' }}
            />
          </span>
        )}
        {/* Mode dropdown */}
        <NodeModeDropdown
          value={nodeData.mode || 'chat'}
          options={modeOptions}
          onChange={handleModeChange}
          nodeColor={nodeColor}
          aria-label="Conversation mode"
          disabled={nodeData.agentStatus === 'running'}
        />
        {/* Agent mode indicators */}
        {nodeData.mode === 'agent' && (
          <>
            {/* Agent status dot */}
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{
                backgroundColor:
                  (nodeData.agentStatus ?? 'idle') === 'running' ? '#22c55e' :
                  (nodeData.agentStatus ?? 'idle') === 'paused' ? '#f59e0b' :
                  (nodeData.agentStatus ?? 'idle') === 'error' ? '#ef4444' :
                  (nodeData.agentStatus ?? 'idle') === 'completed' ? '#3b82f6' :
                  'var(--node-text-muted)',
                boxShadow:
                  (nodeData.agentStatus ?? 'idle') === 'running'
                    ? '0 0 6px #22c55e80'
                    : 'none',
                animation:
                  (nodeData.agentStatus ?? 'idle') === 'running'
                    ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                    : 'none'
              }}
              title={`Agent: ${nodeData.agentStatus ?? 'idle'}`}
            />
            {/* Agent run controls — only when selected */}
            {selected && (
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {(nodeData.agentStatus ?? 'idle') === 'running' ? (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); pauseAgent(id) }}
                      className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10"
                      title="Pause agent (Stub)"
                    >
                      <Pause className="w-3 h-3" style={{ color: '#f59e0b' }} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); stopAgent(id) }}
                      className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10"
                      title="Stop agent (Stub)"
                    >
                      <Square className="w-3 h-3" style={{ color: '#ef4444' }} />
                    </button>
                  </>
                ) : (nodeData.agentStatus ?? 'idle') === 'error' ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); retryAgent(id) }}
                    className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10"
                    title="Retry agent (Stub)"
                  >
                    <RotateCcw className="w-3 h-3" style={{ color: '#f59e0b' }} />
                  </button>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); runAgent(id) }}
                    className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10"
                    title="Run agent (Stub - execution coming in future release)"
                  >
                    <Play className="w-3 h-3" style={{ color: '#22c55e' }} />
                  </button>
                )}
              </div>
            )}
          </>
        )}
        {/* Warmth indicator */}
        {warmthLevel && (
          <div className={`warmth-indicator ${warmthLevel}`} title="Recently active" />
        )}
        {messageCount > 0 && (
          <button
            onClick={toggleCollapsed}
            className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-colors"
            title={nodeData.collapsed ? 'Expand preview' : 'Collapse preview'}
          >
            {nodeData.collapsed ? (
              <ChevronDown className="w-4 h-4" style={{ color: 'var(--node-text-secondary)' }} />
            ) : (
              <ChevronUp className="w-4 h-4" style={{ color: 'var(--node-text-secondary)' }} />
            )}
          </button>
        )}
      </div>

      <div className="cognograph-node__body">
        {lastMessage ? (
          <div className={nodeData.collapsed ? '' : 'h-full overflow-hidden'}>
            <p className={`text-sm overflow-hidden ${nodeData.collapsed ? 'line-clamp-1' : ''}`} style={!nodeData.collapsed ? { display: '-webkit-box', WebkitLineClamp: 'unset', WebkitBoxOrient: 'vertical' } : undefined}>
              {getPreviewContent()}
            </p>
          </div>
        ) : (
          <p className="italic" style={{ color: 'var(--node-text-muted)' }}>Double-click to start chatting</p>
        )}

        {/* Property Badges */}
        {!nodeData.collapsed && (
          <PropertyBadges
            properties={nodeData.properties || {}}
            definitions={propertyDefinitions}
            hiddenProperties={nodeData.hiddenProperties}
            compact
          />
        )}
      </div>

      <div className="cognograph-node__footer">
        <div className="flex items-center gap-1">
          <button
            onClick={handleManualExtract}
            disabled={isExtracting === id}
            className={`p-1 rounded transition-colors ${
              isExtracting === id
                ? 'text-blue-400 animate-pulse'
                : 'hover:bg-black/10 dark:hover:bg-white/10'
            }`}
            style={isExtracting !== id ? { color: 'var(--node-text-muted)' } : undefined}
            title={isExtracting === id ? 'Extracting...' : 'Extract now'}
          >
            <Wand2 className="w-3.5 h-3.5" />
          </button>
        </div>
        {/* Show streaming dots when streaming, otherwise message count */}
        {isStreaming ? (
          <div className="streaming-dots text-blue-400">
            <span></span>
            <span></span>
            <span></span>
          </div>
        ) : (
          <span>
            {messageCount} messages
            {showTokenEstimates && totalCost > 0 && (
              <span style={{ color: 'var(--node-text-muted)', marginLeft: '4px' }}>
                · <CountUp to={totalCost} duration={0.8} format={formatCost} />
              </span>
            )}
          </span>
        )}
        <AttachmentBadge count={nodeData.attachments?.length} />
        <span className="capitalize">{nodeData.provider}</span>
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

export const ConversationNode = memo(ConversationNodeComponent)
