import { memo, useCallback, useMemo, useState, useEffect, useRef } from 'react'
import { Handle, Position, NodeResizer, useUpdateNodeInternals, type NodeProps, type ResizeParams } from '@xyflow/react'
import { Sparkles, Wand2, ChevronDown, ChevronUp, Link2, Play, Pause, Square, Bot, MessageSquare, RotateCcw, Terminal, Maximize2, Minimize2 } from 'lucide-react'
import type { ConversationNodeData, AgentStatus } from '@shared/types'
import { formatCost } from '../../utils/tokenEstimator'
import { DEFAULT_EXTRACTION_SETTINGS, DEFAULT_THEME_SETTINGS } from '@shared/types'
import { useWorkspaceStore, useIsStreaming, useIsSpawning, useNodeWarmth, useIsNodePinned, useIsNodeBookmarked, useNodeNumberedBookmark, useDemoMode } from '../../stores/workspaceStore'
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

import { hasTerminalAccess } from '../../utils/terminalAccess'
import { FoldBadge } from './FoldBadge'
import { NodeModeDropdown } from './NodeModeDropdown'
import { useIsTouch } from '../../hooks/useIsMobile'
import { useNodeResize } from '../../hooks/useNodeResize'
import { useNodeContentVisibility } from '../../hooks/useSemanticZoom'
import { StructuredContentPreview } from './StructuredContentPreview'
import { NodePropertyControls } from './NodePropertyControls'
import { getPresetById } from '../../constants/agentPresets'
import { runAgent, pauseAgent, stopAgent, retryAgent } from '../../services/agentService'
import { CountUp } from '../ui/react-bits'
import { AgentActivityBadge } from '../bridge/AgentActivityBadge'
import { InlineErrorBoundary } from '../ErrorBoundary'
import { SessionStatusIndicator } from '../SessionStatusIndicator'
import { ChatPanel } from '../ChatPanel'

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

// Expanded (in-node chat) dimensions
const EXPANDED_WIDTH = 520
const EXPANDED_HEIGHT = 680

/**
 * Mode icon for ultra-far (L0) rendering.
 * Shows conversation mode at a glance: chat, agent, or terminal.
 */
function ModeIcon({ mode, color }: { mode: string; color: string }): JSX.Element {
  const iconProps = { size: 16, style: { color }, strokeWidth: 2.5 }
  switch (mode) {
    case 'agent':
      return <Bot {...iconProps} />
    default:
      return <MessageSquare {...iconProps} />
  }
}

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
  const demoMode = useDemoMode()
  const isTouch = useIsTouch()
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

  // LOD (Level of Detail) rendering based on zoom level
  const {
    showContent, showTitle, showBadges, showLede,
    showHeader, showFooter, showInteractiveControls,
    showEmbeddedContent, zoomLevel
  } = useNodeContentVisibility()

  const isUltraFar = zoomLevel === 'ultra-far'

  // Extraction particle state
  const [showParticles, setShowParticles] = useState(false)
  const wasExtractingRef = useRef(false)

  // In-node chat expansion state
  const [isExpanded, setIsExpanded] = useState(false)
  const [preExpandSize, setPreExpandSize] = useState<{ w: number; h: number } | null>(null)

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

  // Terminal identity — mode alone is sufficient for terminal rendering
  const isTerminal = nodeData.mode === 'terminal'
  const terminalAccentColor = isTerminal ? nodeData.terminal?.accentColor : undefined

  // Calculate dynamic node color
  const nodeColor = nodeData.color || themeSettings.nodeColors.conversation || DEFAULT_THEME_SETTINGS.nodeColors.conversation

  // Node dimensions (for resizing) - prefer props from React Flow, then data, then defaults
  const nodeWidth = propsWidth || nodeData.width || DEFAULT_WIDTH
  const nodeHeight = propsHeight || nodeData.height || DEFAULT_HEIGHT

  // Glass system integration - extract transparent to minimize re-renders
  const transparent = nodeData.transparent
  const isGlassEnabled = useIsGlassEnabled('nodes', transparent)

  // Terminal pulse class for L0-L1 ambient status
  const terminalPulseClass = isTerminal
    ? nodeData.terminal?.terminalState === 'running'
      ? 'terminal-node-pulse'
      : nodeData.terminal?.terminalState === 'idle'
        ? 'terminal-node-idle'
        : 'terminal-node-exited'
    : ''

  const nodeStyle = useMemo((): NodeStyleWithCustomProps => {
    const safeNodeColor = nodeColor ?? themeSettings.nodeColors.conversation ?? '#3b82f6' // blue-500

    return {
      '--ring-color': safeNodeColor,
      '--node-accent': safeNodeColor,
      '--pulse-color': terminalAccentColor || '#22d3ee',
      width: nodeWidth,
      height: demoMode && isTerminal ? undefined : nodeHeight,
    }
  }, [nodeColor, nodeWidth, nodeHeight, themeSettings.nodeColors.conversation, terminalAccentColor, demoMode, isTerminal])

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

  const handleCollapseChat = useCallback((): void => {
    setIsExpanded(false)
    if (preExpandSize) {
      startNodeResize(id)
      updateNodeDimensions(id, preExpandSize.w, preExpandSize.h)
      updateNodeInternals(id)
      commitNodeResize(id)
      setPreExpandSize(null)
    }
  }, [preExpandSize, id, startNodeResize, updateNodeDimensions, updateNodeInternals, commitNodeResize])

  // Escape key to collapse expanded chat
  useEffect(() => {
    if (!isExpanded || !selected) return
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        handleCollapseChat()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isExpanded, selected, handleCollapseChat])

  const showTokenEstimates = useWorkspaceStore(
    (state) => state.workspacePreferences.showTokenEstimates
  )

  const messageCount = nodeData.messages.length
  const lastMessage = nodeData.messages[nodeData.messages.length - 1]

  const totalCost = useMemo(() => {
    return nodeData.messages.reduce((sum, m) => sum + (m.costUSD ?? 0), 0)
  }, [nodeData.messages])

  // Expand node for in-node chat — touch-aware dimensions
  const handleExpandChat = useCallback((): void => {
    const expandedWidth = isTouch ? Math.min(EXPANDED_WIDTH, window.innerWidth - 32) : EXPANDED_WIDTH
    // Mobile: 70% viewport height (not full), leaves room for bottom bar + breathing room
    const expandedHeight = isTouch ? Math.min(EXPANDED_HEIGHT, Math.round(window.innerHeight * 0.7)) : EXPANDED_HEIGHT
    setPreExpandSize({ w: nodeWidth, h: nodeHeight })
    setIsExpanded(true)
    startNodeResize(id)
    updateNodeDimensions(id, expandedWidth, expandedHeight)
    updateNodeInternals(id)
    commitNodeResize(id)
  }, [isTouch, nodeWidth, nodeHeight, id, startNodeResize, updateNodeDimensions, updateNodeInternals, commitNodeResize])

  const handleDoubleClick = useCallback((e: React.MouseEvent): void => {
    if (e.ctrlKey) {
      // Ctrl+double-click: auto-fit width to title
      e.stopPropagation()
      startNodeResize(id)
      const titleWidth = measureTextWidth(nodeData.title, '14px Inter, sans-serif')
      const newWidth = Math.max(MIN_WIDTH, Math.ceil(titleWidth + 80))
      updateNodeDimensions(id, newWidth, nodeHeight)
      updateNodeInternals(id)
      commitNodeResize(id)
    } else if (isExpanded) {
      // Double-click while expanded: collapse back
      handleCollapseChat()
    } else {
      // Double-click: expand for in-node chat
      handleExpandChat()
    }
  }, [
    nodeData.title, id, nodeWidth, nodeHeight, isExpanded,
    updateNodeDimensions, updateNodeInternals, startNodeResize, commitNodeResize,
    handleCollapseChat, handleExpandChat
  ])

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

  // Get lede text for L2 (mid zoom) — truncated last message
  const getLedeText = (): string => {
    if (!lastMessage) return ''
    const prefix = lastMessage.role === 'user' ? 'You: ' : 'AI: '
    const content = lastMessage.content
    return prefix + (content.length > 80 ? content.slice(0, 80) + '...' : content)
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
  const handleModeChange = useCallback((newMode: 'chat' | 'agent' | 'terminal') => {
    if (newMode === 'agent') {
      // Initialize agent mode fields if not set
      updateNode(id, {
        mode: 'agent',
        agentPreset: nodeData.agentPreset || 'custom',
        agentStatus: nodeData.agentStatus || 'idle'
      })
    } else if (newMode === 'terminal') {
      // Initialize terminal fields if not set
      updateNode(id, {
        title: nodeData.title === 'Conversation' ? 'Terminal' : nodeData.title,
        mode: 'terminal',
        terminal: nodeData.terminal || {
          sessionId: crypto.randomUUID(),
          origin: 'embedded',
          workingDirectory: '',
          terminalState: 'idle',
          startedAt: Date.now(),
          lastActivityAt: Date.now(),
          accentColor: '#22d3ee',
        },
      })
    } else {
      // Switch to chat mode (preserve agent data for later)
      updateNode(id, { mode: 'chat' })
    }
  }, [id, nodeData.title, nodeData.agentPreset, nodeData.agentStatus, nodeData.terminal, updateNode])

  // Mode dropdown options
  const modeOptions = useMemo(() => {
    const options = [
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
      },
    ]
    // Terminal mode available when local agent or cloud terminal is accessible
    if (hasTerminalAccess()) {
      options.push({
        value: 'terminal',
        label: 'Terminal',
        icon: Terminal,
        description: 'Embedded CLI with project context'
      })
    }
    return options
  }, [])

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
    isTerminal && 'conversation-node--terminal',
    selected && 'selected',
    isDisabled && 'cognograph-node--disabled',
    isStreaming && 'streaming',
    isStreaming && 'is-thinking',
    // is-active reserved for functional state only (not selection)
    nonMemberClass,
    memberHighlightClass,
    isExtracting === id && 'extracting',
    isSpawning && 'spawning',
    warmthLevel && `warmth-${warmthLevel}`,
    isPinned && 'node--pinned',
    isBookmarked && 'cognograph-node--bookmarked',
    isCut && 'cognograph-node--cut',
    nodeData.nodeShape && `node-shape-${nodeData.nodeShape}`,
    terminalPulseClass
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
      {/* Type label: floats above node */}
      <div className="cognograph-node__type-label">
        {nodeData.mode === 'agent' ? 'AGENT' : isTerminal ? 'CC SESSION' : 'CONVERSATION'}
      </div>

      {/* ================================================================
          L0 (ultra-far): Colored pill with mode icon only.
          Minimal DOM — ~5 elements. No handles, no text, no editor.
          ================================================================ */}
      {isUltraFar && (
        <div className="flex items-center justify-center h-full">
          <ModeIcon mode={nodeData.mode || 'chat'} color={nodeColor ?? '#3b82f6'} />
          {/* Streaming indicator at L0 — pulsing border glow */}
          {isStreaming && (
            <div
              className="absolute inset-0 rounded-lg pointer-events-none"
              style={{
                boxShadow: `0 0 8px 2px ${nodeColor ?? '#3b82f6'}80`,
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
              }}
            />
          )}
        </div>
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

      {/* Extraction particles effect — L3+ only */}
      {showContent && showParticles && (
        <div className="extraction-particles">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="extraction-particle" />
          ))}
        </div>
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

      {/* Bridge: Agent activity badge — L3+ only */}
      {showContent && nodeData.mode === 'agent' && (
        <InlineErrorBoundary name="AgentActivityBadge">
          <AgentActivityBadge nodeId={id} agentName={nodeData.title || 'Agent'} />
        </InlineErrorBoundary>
      )}

      {/* Terminal: ARIA live region for screen reader status announcements */}
      {isTerminal && (
        <div
          role="status"
          aria-live="polite"
          className="sr-only"
        >
          {`Terminal ${nodeData.terminal?.terminalState} for ${nodeData.title}`}
        </div>
      )}

      {/* ================================================================
          L1+ (far and above): Header with title + mode badge
          ================================================================ */}
      {showHeader && (
        <div className="cognograph-node__header">
          {/* Terminal: Terminal badge (L1+ far zoom) */}
          {isTerminal && (
            <span className="terminal-badge" style={{ color: terminalAccentColor }}>{'>'}_</span>
          )}
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
          {showTitle && (
            <EditableTitle
              value={nodeData.title}
              onChange={(newTitle) => updateNode(id, { title: newTitle })}
              className="cognograph-node__title flex-1 truncate"
              placeholder="Untitled Conversation"
            />
          )}
          {/* Terminal: Status indicator (L2+ mid zoom) */}
          {isTerminal && nodeData.terminal && (
            <SessionStatusIndicator
              state={nodeData.terminal.terminalState}
              accentColor={nodeData.terminal.accentColor}
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
          {/* Touch expand button — visible on touch devices when not expanded */}
          {isTouch && !isExpanded && showInteractiveControls && (
            <button
              className="cognograph-node__expand-btn p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 node-chrome--hover"
              onClick={(e) => {
                e.stopPropagation()
                handleExpandChat()
              }}
              aria-label="Expand conversation"
              title="Expand to chat"
            >
              <Maximize2 className="w-3.5 h-3.5" style={{ color: 'var(--node-text-secondary)' }} />
            </button>
          )}
          {/* Collapse button — only when expanded in-node chat */}
          {isExpanded && showInteractiveControls && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleCollapseChat()
              }}
              className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 node-chrome--hover"
              title="Collapse chat (Esc)"
            >
              <Minimize2 className="w-3.5 h-3.5" style={{ color: 'var(--node-text-secondary)' }} />
            </button>
          )}
          {/* Mode dropdown — L3+ only (interactive control) */}
          {showInteractiveControls && (
            <div className="node-chrome--hover">
              <NodeModeDropdown
                value={nodeData.mode || 'chat'}
                options={modeOptions}
                onChange={handleModeChange}
                nodeColor={nodeColor}
                aria-label="Conversation mode"
                disabled={nodeData.agentStatus === 'running'}
              />
            </div>
          )}
          {/* At L1 (far): Show mode badge as simple text instead of dropdown */}
          {showBadges && !showInteractiveControls && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
              style={{
                backgroundColor: `${nodeColor ?? '#3b82f6'}20`,
                color: nodeColor ?? '#3b82f6'
              }}
            >
              {nodeData.mode === 'agent' ? 'Agent' : 'Chat'}
            </span>
          )}
          {/* L1 (far): Show streaming dots in header when AI is active */}
          {!showContent && isStreaming && (
            <div className="streaming-dots text-blue-400 flex-shrink-0">
              <span></span>
              <span></span>
              <span></span>
            </div>
          )}
          {/* Agent mode indicators — L3+ only */}
          {showContent && nodeData.mode === 'agent' && (
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
                      ? '0 0 3px #22c55e50'
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
          {/* Warmth indicator — L1+ */}
          {warmthLevel && (
            <div className={`warmth-indicator ${warmthLevel}`} title="Recently active" />
          )}
          {/* Collapse toggle — L3+ only (interactive control) */}
          {showContent && messageCount > 0 && (
            <div className="node-chrome--hover">
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
            </div>
          )}
        </div>
      )}

      {/* ================================================================
          L1 (far): Skeleton density preview for last message content
          Terminal: dark terminal strip with "$ _" prompt
          ================================================================ */}
      {!isUltraFar && !showLede && !showContent && (
        isTerminal ? (
          <div className="cognograph-node__body" style={{ pointerEvents: 'none' }}>
            <div
              className="mx-1 rounded overflow-hidden"
              style={{ backgroundColor: 'var(--terminal-bg)', padding: '4px 6px' }}
            >
              <pre className="text-[9px] leading-tight" style={{ fontFamily: 'var(--font-mono, "Space Mono", monospace)', color: 'var(--terminal-text-muted)', margin: 0 }}>
                {'$ _'}
              </pre>
            </div>
          </div>
        ) : lastMessage ? (
          <div className="cognograph-node__body" style={{ pointerEvents: 'none' }}>
            <StructuredContentPreview content={lastMessage.content} zoomLevel="far" />
          </div>
        ) : null
      )}

      {/* ================================================================
          L2 (mid): Lede — last message preview + model badge
          Terminal: dark inset with 5 lines of terminal output
          ================================================================ */}
      {showLede && (
        isTerminal ? (
          // Only render L2 terminal preview if we're NOT also showing L3 content
          !showContent ? (
            <div className="cognograph-node__body" style={{ opacity: 0.9 }}>
              <div
                className="mx-1 rounded overflow-hidden"
                style={{ backgroundColor: 'var(--terminal-bg)', padding: '6px 8px', minHeight: 48 }}
              >
                <pre
                  className="text-[10px] leading-tight overflow-hidden whitespace-pre"
                  style={{ fontFamily: 'var(--font-mono, "Space Mono", monospace)', color: 'var(--terminal-text)', margin: 0 }}
                >
                  {((nodeData as any).terminalPreviewLines || []).slice(-5).join('\n') || '$ _'}
                </pre>
              </div>
            </div>
          ) : null
        ) : (
          <div className="cognograph-node__body" style={{ opacity: 0.8 }}>
            {lastMessage ? (
              <StructuredContentPreview content={lastMessage.content} zoomLevel="mid" />
            ) : (
              <p className="text-sm italic" style={{ color: 'var(--node-text-muted)' }}>
                No messages yet
              </p>
            )}
            {/* Model badge at L2 */}
            {nodeData.provider && (
              <span
                className="text-[10px] mt-1 inline-block px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: 'var(--node-bg-secondary)',
                  color: 'var(--node-text-muted)'
                }}
              >
                {nodeData.provider}
              </span>
            )}
          </div>
        )
      )}

      {/* ================================================================
          L3+ (close and above): Full body content — messages, preview, properties
          Terminal: dark inset with 12 lines of terminal output
          ================================================================ */}
      {showContent && (
        isExpanded ? (
          /* Expanded in-node chat (works for both chat and terminal nodes) */
          <div
            className="flex-1 overflow-hidden rounded-b-lg"
            style={{ minHeight: 0 }}
            onWheelCapture={isTouch ? undefined : (e) => e.stopPropagation()}
            onPointerDownCapture={(e) => {
              // Prevent React Flow panning when interacting with chat input — but allow pinch-zoom on touch
              if (isTouch) return
              const target = e.target as HTMLElement
              if (target.closest('textarea') || target.closest('button') || target.closest('select') || target.closest('.overflow-y-auto')) {
                e.stopPropagation()
              }
            }}
          >
            <ChatPanel nodeId={id} isFocused embedded />
          </div>
        ) : isTerminal ? (
          <div className="cognograph-node__body" style={demoMode ? { overflow: 'visible', minHeight: 'unset', flex: 'none' } : undefined}>
            <div
              className={demoMode ? 'mx-1 rounded' : 'mx-1 rounded overflow-hidden'}
              style={{ backgroundColor: 'var(--terminal-bg)', padding: '8px 10px', minHeight: demoMode ? undefined : 120 }}
            >
              <pre
                className={demoMode ? 'text-[11px] leading-snug whitespace-pre' : 'text-[11px] leading-snug overflow-hidden whitespace-pre'}
                style={{ fontFamily: 'var(--font-mono, "Space Mono", monospace)', color: 'var(--terminal-text)', margin: 0 }}
              >
                {(() => {
                  const lines = (nodeData as any).terminalPreviewLines || []
                  return (demoMode ? lines : lines.slice(-12)).join('\n') || '$ _'
                })()}
              </pre>
            </div>
          </div>
        ) : (
          <div className="cognograph-node__body">
            {lastMessage ? (
              nodeData.collapsed ? (
                <div>
                  <p className="text-sm overflow-hidden line-clamp-1">
                    {getPreviewContent()}
                  </p>
                </div>
              ) : (
                <div className="h-full overflow-hidden">
                  {nodeData.messages
                    .filter((m) => m.role === 'user' || m.role === 'assistant')
                    .slice(-6)
                    .map((msg, i) => (
                      <div
                        key={msg.id || i}
                        className={`chat-bubble chat-bubble--${msg.role === 'user' ? 'user' : 'assistant'}`}
                      >
                        <span
                          className={`chat-bubble__role chat-bubble__role--${msg.role === 'user' ? 'user' : 'assistant'}`}
                        >
                          {msg.role === 'user' ? 'You' : 'Assistant'}
                        </span>
                        <p className="text-sm overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' as const }}>
                          {msg.content}
                        </p>
                      </div>
                    ))}
                </div>
              )
            ) : (
              <p className="italic" style={{ color: 'var(--node-text-muted)' }}>Double-click to start chatting</p>
            )}

            {/* Inline property controls */}
            {!nodeData.collapsed && (
              <NodePropertyControls nodeId={id} nodeType="conversation" data={data as Record<string, unknown>} />
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
        )
      )}

      {/* ================================================================
          L2+ (mid and above): Footer
          ================================================================ */}
      {showFooter && showContent && !isExpanded && (
        <div className="cognograph-node__footer">
          <div className="flex items-center gap-1 node-chrome--hover">
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
              {!demoMode && <>{messageCount} messages</>}
              {!demoMode && showTokenEstimates && totalCost > 0 && (
                <span style={{ color: 'var(--node-text-muted)', marginLeft: '4px' }}>
                  · <CountUp to={totalCost} duration={0.8} format={formatCost} />
                </span>
              )}
            </span>
          )}
          <AttachmentBadge count={nodeData.attachments?.length} />
          <span className="capitalize">{nodeData.provider}</span>
        </div>
      )}

      {/* L2 (mid): Simplified footer with just message count */}
      {showFooter && !showContent && (
        <div className="cognograph-node__footer" style={{ opacity: 0.7 }}>
          {isStreaming ? (
            <div className="streaming-dots text-blue-400">
              <span></span>
              <span></span>
              <span></span>
            </div>
          ) : !demoMode ? (
            <span style={{ color: 'var(--node-text-muted)' }}>
              {messageCount} messages
            </span>
          ) : null}
        </div>
      )}

      {/* ================================================================
          L4 (ultra-close): Artboard expansion hint
          ================================================================ */}
      {showEmbeddedContent && !isExpanded && (
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
          minHeight={MIN_HEIGHT}
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

export const ConversationNode = memo(ConversationNodeComponent)
