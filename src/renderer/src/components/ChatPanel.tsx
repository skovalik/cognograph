import { memo, useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { X, Send, Square, Link, Key, Package, ChevronDown, ChevronUp, Boxes, GripHorizontal, Bot, MessageSquare, Settings2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { toast } from 'react-hot-toast'
import { useWorkspaceStore, useIsStreaming as useStoreIsStreaming } from '../stores/workspaceStore'
import { ContextIndicator } from './ContextIndicator'
import { ContextSettingsModal } from './ContextSettingsModal'
import { TokenMeter } from './TokenMeter'
import { TokenIndicator } from './TokenEstimator'
import { ToolCallBubble } from './ToolCallBubble'
import { detectArtifacts } from '../utils/artifactDetection'
import { runExtraction, debounceExtraction } from '../utils/extraction'
import { sendAgentMessage, interruptAgent, initAgentService } from '../services/agentService'
import { estimateCost } from '../utils/tokenEstimator'
import { useSessionStatsStore } from '../stores/sessionStatsStore'
import type { ConversationNodeData, Message, ConnectorProvider } from '@shared/types'
import { DEFAULT_EXTRACTION_SETTINGS, DEFAULT_AGENT_SETTINGS, CONNECTOR_PROVIDER_INFO } from '@shared/types'
import { logger } from '../utils/logger'
import { InlineErrorBoundary } from './ErrorBoundary'

interface ChatPanelProps {
  nodeId: string
  isFocused?: boolean
  isModal?: boolean
}

function ChatPanelComponent({ nodeId, isFocused = true, isModal = false }: ChatPanelProps): JSX.Element | null {
  // All store subscriptions MUST come first
  const nodes = useWorkspaceStore((state) => state.nodes)
  const closeChat = useWorkspaceStore((state) => state.closeChat)
  const focusChat = useWorkspaceStore((state) => state.focusChat)
  const addMessage = useWorkspaceStore((state) => state.addMessage)
  const updateLastMessage = useWorkspaceStore((state) => state.updateLastMessage)
  const setLastMessageUsage = useWorkspaceStore((state) => state.setLastMessageUsage)
  const removeLastMessage = useWorkspaceStore((state) => state.removeLastMessage)
  const getContextForNode = useWorkspaceStore((state) => state.getContextForNode)
  const getConnectedNodes = useWorkspaceStore((state) => state.getConnectedNodes)
  const addPendingExtraction = useWorkspaceStore((state) => state.addPendingExtraction)
  const setIsExtracting = useWorkspaceStore((state) => state.setIsExtracting)
  const setStreaming = useWorkspaceStore((state) => state.setStreaming)
  const setLeftSidebarTab = useWorkspaceStore((state) => state.setLeftSidebarTab)
  const toggleLeftSidebar = useWorkspaceStore((state) => state.toggleLeftSidebar)
  const leftSidebarOpen = useWorkspaceStore((state) => state.leftSidebarOpen)
  const getEffectiveLLMSettings = useWorkspaceStore((state) => state.getEffectiveLLMSettings)
  const deleteMessage = useWorkspaceStore((state) => state.deleteMessage)
  const getWorkspaceNodesForNode = useWorkspaceStore((state) => state.getWorkspaceNodesForNode)
  const showTokenEstimates = useWorkspaceStore((state) => state.workspacePreferences.showTokenEstimates)

  // Subscribe to store's streaming state (for agent mode)
  const storeIsStreaming = useStoreIsStreaming(nodeId)

  // All useState hooks
  const [input, setInput] = useState('')
  const [isStreamingLocal, setIsStreamingLocal] = useState(false)
  const [showApiKeyModal, setShowApiKeyModal] = useState(false)
  const [showContextSettings, setShowContextSettings] = useState(false)
  const [isInjecting, setIsInjecting] = useState(false) // For context injection flash
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null) // null = checking

  // Modal drag state
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 })

  // Modal size state for resize
  const [modalSize, setModalSize] = useState({ width: 500, height: 600 })
  const [isResizing, setIsResizing] = useState(false)
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 })

  // All useRef hooks
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const currentResponseRef = useRef<string>('')
  const userScrolledUpRef = useRef(false)
  const rafRef = useRef<number | null>(null)

  // Refs for on-close extraction (avoids stale closure in cleanup effect)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onCloseExtractRef = useRef<{ nodeData: any; extractionSettings: any; nodeId: string }>({
    nodeData: null,
    extractionSettings: null,
    nodeId
  })

  // Find the node - use useMemo to avoid recalculating
  const node = useMemo(() => {
    try {
      return nodes.find((n) => n.id === nodeId)
    } catch (e) {
      console.error('Error finding node:', e)
      return undefined
    }
  }, [nodes, nodeId])

  const isValidConversation = Boolean(node && node.data && node.data.type === 'conversation')

  // Get node data safely
  const nodeData = useMemo(() => {
    if (!isValidConversation || !node) return null
    try {
      return node.data as ConversationNodeData
    } catch (e) {
      console.error('Error casting node data:', e)
      return null
    }
  }, [isValidConversation, node])

  // Derive isStreaming from store (agent mode) or local state (chat mode)
  // Agent mode uses store state because the agent service controls streaming
  // Chat mode uses local state because LLM event handlers control it
  const isStreaming = nodeData?.mode === 'agent' ? storeIsStreaming : isStreamingLocal

  const connectedNodes = useMemo(() => {
    if (!isValidConversation) return []
    try {
      return getConnectedNodes(nodeId)
    } catch (e) {
      console.error('Error getting connected nodes:', e)
      return []
    }
  }, [isValidConversation, getConnectedNodes, nodeId])

  // Get effective LLM settings (resolves workspace inheritance)
  const effectiveLLMSettings = useMemo(() => {
    if (!isValidConversation) return null
    try {
      return getEffectiveLLMSettings(nodeId)
    } catch (e) {
      console.error('Error getting effective LLM settings:', e)
      return null
    }
  }, [isValidConversation, getEffectiveLLMSettings, nodeId])

  // Get workspaces this node belongs to (for display purposes)
  const workspaceNodes = useMemo(() => {
    if (!isValidConversation) return []
    try {
      return getWorkspaceNodesForNode(nodeId)
    } catch (e) {
      console.error('Error getting workspace nodes:', e)
      return []
    }
  }, [isValidConversation, getWorkspaceNodesForNode, nodeId])

  // Check API key availability for current provider (async — keys stored via IPC)
  const currentProvider = effectiveLLMSettings?.provider || nodeData?.provider
  useEffect(() => {
    if (!currentProvider) return
    let cancelled = false
    window.api.settings.getApiKey(currentProvider).then((key: string | null) => {
      if (!cancelled) setHasApiKey(Boolean(key))
    }).catch(() => {
      if (!cancelled) setHasApiKey(false)
    })
    return () => { cancelled = true }
  }, [currentProvider])

  // Get extraction settings from node data
  const extractionSettings = nodeData?.extractionSettings || DEFAULT_EXTRACTION_SETTINGS

  // Keep refs in sync for on-close extraction cleanup (avoids stale closure)
  onCloseExtractRef.current = { nodeData, extractionSettings, nodeId }

  // Per-message extraction handler (debounced)
  const triggerPerMessageExtraction = useCallback(async () => {
    if (!nodeData || !extractionSettings.autoExtractEnabled) return
    if (extractionSettings.extractionTrigger !== 'per-message') return

    const messages = nodeData.messages
    if (messages.length === 0) return

    setIsExtracting(nodeId)

    try {
      const results = await runExtraction(
        nodeId,
        messages,
        extractionSettings,
        nodeData.extractedTitles || []
      )

      results.forEach((result) => {
        addPendingExtraction({
          sourceNodeId: nodeId,
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
  }, [
    nodeId,
    nodeData,
    extractionSettings,
    addPendingExtraction,
    setIsExtracting,
    setLeftSidebarTab,
    leftSidebarOpen,
    toggleLeftSidebar
  ])

  // Detect when user scrolls up (to not force scroll during streaming)
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current
    if (!container) return

    // Check if user is near the bottom (within 100px)
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100
    userScrolledUpRef.current = !isNearBottom
  }, [])

  // Scroll to bottom on new messages (only if user hasn't scrolled up)
  useEffect(() => {
    if (nodeData?.messages && !userScrolledUpRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [nodeData?.messages])

  // Reset scroll flag when streaming ends
  useEffect(() => {
    if (!isStreaming) {
      userScrolledUpRef.current = false
    }
  }, [isStreaming])

  // Focus input on mount and when panel becomes focused
  useEffect(() => {
    if (isFocused) {
      // Small delay to ensure DOM is ready after visibility changes
      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
    }
  }, [isFocused])

  // Initialize agent service when in agent mode
  // This MUST happen before any messages are sent to ensure stream listener is registered
  useEffect(() => {
    if (nodeData?.mode === 'agent') {
      initAgentService()
    }
  }, [nodeData?.mode])

  // Set up stream listeners - now filtered by conversationId (nodeId)
  // Using ref for currentResponse to avoid closure issues when effect re-runs
  useEffect(() => {
    let unsubChunk: (() => void) | undefined
    let unsubComplete: (() => void) | undefined
    let unsubError: (() => void) | undefined

    // Small delay to ensure preload bridge is ready
    const setupListeners = (): void => {
      if (!window.api?.llm) {
        console.warn('window.api.llm not yet available, will retry on send')
        return
      }

      // Filter events by conversationId to only handle events for THIS chat panel
      unsubChunk = window.api.llm.onChunk((data) => {
        if (data.conversationId === nodeId) {
          // First chunk starts streaming state in global store (for canvas visibility)
          if (currentResponseRef.current === '') {
            setStreaming(nodeId, true)
          }
          currentResponseRef.current += data.chunk
          updateLastMessage(nodeId, currentResponseRef.current)
        }
      })

      unsubComplete = window.api.llm.onComplete((data) => {
        if (data.conversationId === nodeId) {
          setStreaming(nodeId, false) // Clear global streaming state
          setIsStreamingLocal(false)

          // If cancelled with no content, remove the empty placeholder message
          if (data.cancelled && currentResponseRef.current === '') {
            removeLastMessage(nodeId)
          }

          // Attach actual token usage to the assistant message
          if (!data.cancelled && data.usage) {
            const cost = estimateCost(data.usage.inputTokens, data.usage.outputTokens, data.usage.model)
            setLastMessageUsage(nodeId, {
              inputTokens: data.usage.inputTokens,
              outputTokens: data.usage.outputTokens,
              costUSD: cost.totalCost
            })

            // Record to session stats — read fresh state to avoid stale closure
            const currentNode = useWorkspaceStore.getState().nodes.find(n => n.id === nodeId)
            const effectiveSettings = useWorkspaceStore.getState().getEffectiveLLMSettings(nodeId)
            const nodeProvider = currentNode?.data?.type === 'conversation'
              ? (currentNode.data as ConversationNodeData).provider
              : 'unknown'

            useSessionStatsStore.getState().recordUsage({
              provider: nodeProvider,
              model: data.usage.model ?? effectiveSettings?.model ?? 'unknown',
              inputTokens: data.usage.inputTokens,
              outputTokens: data.usage.outputTokens,
              costUSD: cost.totalCost,
            })
          }

          currentResponseRef.current = ''

          // Trigger per-message extraction if enabled (debounced to avoid excessive calls)
          if (!data.cancelled && extractionSettings.autoExtractEnabled && extractionSettings.extractionTrigger === 'per-message') {
            debounceExtraction(nodeId, triggerPerMessageExtraction)
          }
        }
      })

      unsubError = window.api.llm.onError((data) => {
        if (data.conversationId === nodeId) {
          setStreaming(nodeId, false) // Clear global streaming state
          setIsStreamingLocal(false)
          toast.error(data.error)
          currentResponseRef.current = ''
        }
      })
    }

    setupListeners()

    return () => {
      unsubChunk?.()
      unsubComplete?.()
      unsubError?.()
    }
  }, [nodeId, updateLastMessage, extractionSettings, triggerPerMessageExtraction, setStreaming])

  // On-close extraction trigger - runs when chat panel unmounts
  // Uses ref to read latest values at unmount time (avoids stale closure)
  useEffect(() => {
    return () => {
      const { nodeData: latestNodeData, extractionSettings: latestSettings, nodeId: latestNodeId } = onCloseExtractRef.current
      // Only trigger if auto-extract is enabled and trigger mode is 'on-close'
      if (
        latestNodeData &&
        latestSettings.autoExtractEnabled &&
        latestSettings.extractionTrigger === 'on-close' &&
        latestNodeData.messages.length > 0
      ) {
        // Run extraction asynchronously (fire and forget since component is unmounting)
        runExtraction(
          latestNodeId,
          latestNodeData.messages,
          latestSettings,
          latestNodeData.extractedTitles || []
        ).then((results) => {
          results.forEach((result) => {
            addPendingExtraction({
              sourceNodeId: latestNodeId,
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
        })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty deps - latest values read from onCloseExtractRef at unmount time

  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming || !nodeData) return

    const userMessage = input.trim()
    setInput('')

    // Get effective settings (workspace-aware)
    const llmSettings = effectiveLLMSettings || {
      provider: nodeData.provider,
      temperature: undefined,
      maxTokens: undefined,
      systemPrompt: undefined
    }

    // Check for API key using the effective provider
    const apiKey = await window.api.settings.getApiKey(llmSettings.provider)
    if (!apiKey) {
      toast.error(`Please set your ${llmSettings.provider} API key first`)
      setShowApiKeyModal(true)
      setInput(userMessage) // Restore input
      return
    }

    // If in agent mode, use agent service
    if (nodeData.mode === 'agent') {
      // Flash context indicator
      if (connectedNodes.length > 0) {
        setIsInjecting(true)
        setTimeout(() => setIsInjecting(false), 600)
      }

      // console.log('[ChatPanel] Using agent mode')
      // Note: Agent mode uses store.setStreaming() managed by agentService
      // We don't set isStreamingLocal here - the derived isStreaming uses storeIsStreaming

      try {
        // Initialize agent service if needed
        initAgentService()
        await sendAgentMessage(nodeId, userMessage)
      } catch (error) {
        console.error('[ChatPanel] Agent error:', error)
        toast.error('Failed to send agent message')
      }
      return
    }

    // Regular chat mode (non-agent)
    // Add user message
    addMessage(nodeId, 'user', userMessage)

    // Add placeholder for assistant message
    addMessage(nodeId, 'assistant', '')

    // Get context from connected nodes
    const context = getContextForNode(nodeId)

    // Flash context indicator when context is being injected
    if (connectedNodes.length > 0) {
      setIsInjecting(true)
      setTimeout(() => setIsInjecting(false), 600)
    }

    // Diagnostic logging for context injection
    // console.log('[ChatPanel] Connected nodes:', connectedNodes.length)
    // console.log('[ChatPanel] Context length:', context?.length || 0)
    // console.log('[ChatPanel] Workspace nodes:', workspaceNodes.length)
    // console.log('[ChatPanel] Effective LLM settings:', llmSettings)
    if (context) {
      // console.log('[ChatPanel] Context preview:', context.substring(0, 200) + '...')
    }

    // Build messages array for API
    const messages = nodeData.messages.map((m) => ({
      role: m.role,
      content: m.content
    }))
    messages.push({ role: 'user', content: userMessage })

    // Build system prompt with context
    // Start with workspace system prompt if available, otherwise default
    let systemPrompt = llmSettings.systemPrompt || 'You are a helpful AI assistant.'
    if (context) {
      systemPrompt += `\n\nYou have access to the following context from connected nodes:\n\n${context}`
    }

    // console.log('[ChatPanel] System prompt length:', systemPrompt.length)
    // console.log('[ChatPanel] Messages count:', messages.length)

    setIsStreamingLocal(true)

    try {
      await window.api.llm.send({
        conversationId: nodeId, // Route responses back to this specific chat panel
        provider: llmSettings.provider,
        messages: messages.filter((m) => m.role !== 'system'),
        systemPrompt,
        // Pass additional settings if supported by the API
        temperature: llmSettings.temperature,
        maxTokens: llmSettings.maxTokens
      })
    } catch (error) {
      setIsStreamingLocal(false)
      toast.error('Failed to send message')
    }
  }, [input, isStreamingLocal, storeIsStreaming, nodeData, nodeId, addMessage, getContextForNode, effectiveLLMSettings, connectedNodes.length, workspaceNodes.length])

  const handleCancel = useCallback(async () => {
    // Use agent interrupt if in agent mode
    if (nodeData?.mode === 'agent') {
      interruptAgent()
    } else {
      await window.api.llm.cancel(nodeId)
    }
    setIsStreamingLocal(false)
  }, [nodeData?.mode, nodeId])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  // Early return AFTER all hooks have been called
  if (!isValidConversation || !nodeData) {
    logger.log('ChatPanel: Invalid state', { nodeId, isValidConversation, hasNodeData: !!nodeData })
    return null
  }

  const handleClose = useCallback(() => {
    closeChat(nodeId)
  }, [closeChat, nodeId])

  const updateNode = useWorkspaceStore((state) => state.updateNode)

  const handleToggleAgentMode = useCallback(() => {
    if (!nodeData) return
    const newMode = nodeData.mode === 'agent' ? 'chat' : 'agent'
    updateNode(nodeId, {
      mode: newMode,
      // Set default agent settings if enabling agent mode for the first time
      agentSettings: newMode === 'agent' && !nodeData.agentSettings ? DEFAULT_AGENT_SETTINGS : nodeData.agentSettings
    } as Partial<ConversationNodeData>)
  }, [nodeData, nodeId, updateNode])

  const handleFocus = useCallback(() => {
    if (!isFocused) {
      focusChat(nodeId)
    }
  }, [focusChat, nodeId, isFocused])

  // Modal drag handlers
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (!isModal) return
    e.preventDefault()
    setIsDragging(true)
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: modalPosition.x,
      posY: modalPosition.y
    }
  }, [isModal, modalPosition])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent): void => {
      // Cancel any pending RAF to avoid stacking
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }

      // Throttle position updates with RAF for smooth 60fps
      rafRef.current = requestAnimationFrame(() => {
        const deltaX = e.clientX - dragStartRef.current.x
        const deltaY = e.clientY - dragStartRef.current.y
        setModalPosition({
          x: dragStartRef.current.posX + deltaX,
          y: dragStartRef.current.posY + deltaY
        })
      })
    }

    const handleMouseUp = (): void => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [isDragging])

  // Resize handlers for modal
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    if (!isModal) return
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: modalSize.width,
      height: modalSize.height
    }
  }, [isModal, modalSize])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent): void => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }

      rafRef.current = requestAnimationFrame(() => {
        const deltaX = e.clientX - resizeStartRef.current.x
        const deltaY = e.clientY - resizeStartRef.current.y
        setModalSize({
          width: Math.max(350, resizeStartRef.current.width + deltaX),
          height: Math.max(300, resizeStartRef.current.height + deltaY)
        })
      })
    }

    const handleMouseUp = (): void => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [isResizing])

  // Get theme settings for light/dark mode
  const themeSettings = useWorkspaceStore((state) => state.themeSettings)
  const isLightMode = themeSettings.mode === 'light'

  // Theme-aware styling (using design tokens)
  const bgClasses = 'bg-[var(--surface-panel)]'
  const borderClasses = 'border-[var(--border-subtle)]'
  const focusBorderClasses = isFocused ? 'border-blue-500' : borderClasses
  const headerBgClasses = isFocused
    ? 'border-blue-500/50 bg-blue-900/10'
    : borderClasses
  const textClasses = 'text-[var(--text-primary)]'
  const textMutedClasses = 'text-[var(--text-secondary)]'
  const textFaintClasses = 'text-[var(--text-muted)]'
  const inputBgClasses = 'bg-[var(--surface-panel-secondary)] border-[var(--border-subtle)]'
  const hoverBgClasses = 'hover:bg-[var(--surface-panel-secondary)]'

  // Different classes for modal vs column mode
  const containerClasses = isModal
    ? `${bgClasses} glass-soft rounded-lg shadow-2xl flex flex-col border-2 ${focusBorderClasses} ${!isFocused ? 'opacity-90' : ''}`
    : `h-full w-[380px] ${bgClasses} border-l shadow-xl z-50 flex flex-col ${isFocused ? 'border-blue-500 border-l-2' : borderClasses} ${!isFocused ? 'opacity-90' : ''}`

  return (
    <div
      className={containerClasses}
      style={isModal ? {
        transform: `translate(${modalPosition.x}px, ${modalPosition.y}px)`,
        width: modalSize.width,
        height: modalSize.height,
        willChange: isDragging || isResizing ? 'transform' : 'auto'
      } : undefined}
      onClick={handleFocus}
    >
      {/* Header - draggable in modal mode */}
      <div
        className={`flex items-center justify-between px-4 py-3 border-b ${headerBgClasses} ${isModal ? 'cursor-move select-none' : ''}`}
        onMouseDown={handleDragStart}
      >
        {/* Drag handle indicator for modal */}
        {isModal && (
          <div className="mr-2 flex-shrink-0">
            <GripHorizontal className={`w-4 h-4 ${textFaintClasses}`} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className={`font-medium ${textClasses} truncate`}>{nodeData.title}</h2>
          <div className={`flex items-center gap-2 text-xs ${textMutedClasses}`}>
            <select
              value={effectiveLLMSettings?.provider || nodeData.provider || 'anthropic'}
              onChange={(e) => {
                const newProvider = e.target.value as ConnectorProvider
                const info = CONNECTOR_PROVIDER_INFO[newProvider]
                updateNode(nodeId, { provider: newProvider, model: info?.defaultModel || '' })
              }}
              onClick={(e) => e.stopPropagation()}
              className="capitalize px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 font-medium border-none outline-none cursor-pointer text-xs"
              style={{ appearance: 'none', WebkitAppearance: 'none', paddingRight: '4px' }}
              title="Switch AI provider"
            >
              {Object.entries(CONNECTOR_PROVIDER_INFO).map(([key, info]) => (
                <option key={key} value={key}>{info.label}</option>
              ))}
            </select>
            {effectiveLLMSettings?.model && (
              <span className={`${textFaintClasses} font-mono`}>{effectiveLLMSettings.model}</span>
            )}
            {connectedNodes.length > 0 && (
              <span className="flex items-center gap-1">
                <Link className="w-3 h-3" />
                {connectedNodes.length} connected
              </span>
            )}
            {workspaceNodes.length > 0 && (
              <span className="flex items-center gap-1 text-violet-400">
                <Boxes className="w-3 h-3" />
                {workspaceNodes.length} workspace{workspaceNodes.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
          {/* Agent Mode Toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleToggleAgentMode()
            }}
            onMouseDown={(e) => e.stopPropagation()}
            disabled={isStreaming}
            className={`p-2 rounded transition-colors ${nodeData.mode !== 'agent' ? `${hoverBgClasses} ${textMutedClasses}` : ''} ${isStreaming ? 'opacity-50 cursor-not-allowed' : ''}`}
            style={nodeData.mode === 'agent' ? {
              backgroundColor: 'color-mix(in srgb, var(--gui-accent-primary) 20%, transparent)',
              color: 'var(--gui-accent-primary)'
            } : undefined}
            title={nodeData.mode === 'agent' ? 'Disable agent mode' : 'Enable agent mode (allows workspace manipulation)'}
          >
            <Bot className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowApiKeyModal(true)
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className={`p-2 ${hoverBgClasses} rounded transition-colors`}
            title="API Key Settings"
          >
            <Key className={`w-4 h-4 ${textMutedClasses}`} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleClose()
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className={`p-2 ${hoverBgClasses} rounded transition-colors`}
            title="Close"
          >
            <X className={`w-5 h-5 ${textMutedClasses}`} />
          </button>
        </div>
      </div>

      {/* Context indicator - compact badge with settings access */}
      <div className={`px-4 py-2 border-t border-[var(--border-subtle)] flex items-center gap-2 ${isInjecting ? 'animate-pulse bg-blue-500/10' : ''}`}>
        <InlineErrorBoundary name="ContextIndicator" fallback={
          <span className={`text-xs ${textMutedClasses}`}>Context unavailable</span>
        }>
          <ContextIndicator
            nodeId={nodeId}
            compact={true}
            className="flex-1"
          />
        </InlineErrorBoundary>
        <button
          onClick={() => setShowContextSettings(true)}
          className={`p-1 ${hoverBgClasses} rounded transition-colors`}
          title="Context Settings"
          aria-label="Open context settings"
        >
          <Settings2 className={`w-3.5 h-3.5 ${textMutedClasses}`} />
        </button>
      </div>

      {/* Token usage meter */}
      <div className={`px-4 py-2 border-t border-[var(--border-subtle)]`}>
        {showTokenEstimates ? (
          <TokenIndicator
            nodeId={nodeId}
            currentInput={input}
            isLightMode={isLightMode}
          />
        ) : (
          <TokenMeter
            contextText={getContextForNode(nodeId)}
            messages={nodeData.messages}
            systemPrompt={effectiveLLMSettings?.systemPrompt}
            model={effectiveLLMSettings?.model}
            compact
          />
        )}
      </div>

      {/* No API Key Banner */}
      {hasApiKey === false && (
        <div
          className="mx-3 mt-2 px-3 py-2 rounded-md flex items-center gap-2 text-xs"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--gui-accent-warning, #f59e0b) 15%, transparent)',
            border: '1px solid color-mix(in srgb, var(--gui-accent-warning, #f59e0b) 40%, transparent)',
            color: 'var(--gui-text-primary)'
          }}
        >
          <Key className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--gui-accent-warning, #f59e0b)' }} />
          <span className="flex-1">
            No API key set for <strong>{currentProvider}</strong>
          </span>
          <button
            onClick={() => setShowApiKeyModal(true)}
            className="px-2 py-0.5 rounded text-xs font-medium transition-colors"
            style={{
              backgroundColor: 'var(--gui-accent-warning, #f59e0b)',
              color: '#000'
            }}
          >
            Set Key
          </button>
        </div>
      )}

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4"
      >
        {nodeData.messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className={`${textFaintClasses} text-center`}>
              Start a conversation.
              <br />
              <span className="text-xs">
                Connected nodes will provide context to the AI.
              </span>
            </p>
          </div>
        ) : (
          nodeData.messages.map((message, msgIndex) => (
            message.role === 'tool_use' || message.role === 'tool_result' ? (
              <ToolCallBubble
                key={message.id}
                message={message}
                isLightMode={isLightMode}
              />
            ) : (
              <MessageBubble
                key={message.id}
                message={message}
                conversationNodeId={nodeId}
                isLightMode={isLightMode}
                onDelete={() => deleteMessage(nodeId, msgIndex)}
              />
            )
          ))
        )}

        {/* Suggested Actions - show after last assistant message when not streaming */}
        {nodeData.messages.length > 0 &&
         nodeData.messages[nodeData.messages.length - 1]?.role === 'assistant' &&
         !isStreaming && (
          <SuggestedActions
            nodeId={nodeId}
            onContinue={() => {
              setInput('continue')
              // Small delay to let the input update, then trigger send
              requestAnimationFrame(() => {
                inputRef.current?.focus()
              })
            }}
            onExtract={() => {
              // Trigger extraction using the existing handler
              debounceExtraction(nodeId, triggerPerMessageExtraction)
            }}
            isLightMode={isLightMode}
          />
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className={`p-4 border-t ${borderClasses}`}>
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={nodeData.mode === 'agent' ? "Ask me to modify your workspace..." : "Type a message..."}
            rows={1}
            disabled={isStreaming}
            spellCheck={true}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement
              target.style.height = 'auto'
              target.style.height = `${Math.min(target.scrollHeight, 120)}px`
            }}
            className={`flex-1 ${inputBgClasses} rounded px-3 py-2 text-sm ${textClasses} focus:outline-none focus:border-blue-500 resize-none disabled:opacity-50`}
          />
          {isStreaming ? (
            <button
              onClick={handleCancel}
              className="px-4 bg-red-600 hover:bg-red-700 rounded transition-colors flex items-center justify-center"
            >
              <Square className="w-5 h-5 text-white" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors flex items-center justify-center"
            >
              <Send className="w-5 h-5 text-white" />
            </button>
          )}
        </div>
      </div>

      {/* Resize handle for modal */}
      {isModal && (
        <div
          className={`absolute bottom-0 right-0 w-4 h-4 cursor-se-resize hover:bg-[var(--surface-panel-secondary)] rounded-tl transition-colors`}
          onMouseDown={handleResizeStart}
          title="Drag to resize"
        >
          <svg
            className={`w-4 h-4 ${textFaintClasses}`}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M22 22H20V20H22V22ZM22 18H20V16H22V18ZM18 22H16V20H18V22ZM22 14H20V12H22V14ZM18 18H16V16H18V18ZM14 22H12V20H14V22Z" />
          </svg>
        </div>
      )}

      {/* API Key Modal */}
      {showApiKeyModal && (
        <ApiKeyModal
          provider={effectiveLLMSettings?.provider || nodeData.provider}
          onSuccess={() => {
            setShowApiKeyModal(false)
            setHasApiKey(true) // Dismiss banner immediately on success
          }}
          onClose={() => setShowApiKeyModal(false)}
        />
      )}

      {/* Context Settings Modal */}
      <ContextSettingsModal
        isOpen={showContextSettings}
        onClose={() => setShowContextSettings(false)}
      />
    </div>
  )
}

// Message bubble component with artifact extraction
interface MessageBubbleProps {
  message: Message
  conversationNodeId: string
  isLightMode?: boolean
  onDelete?: () => void
}

const MessageBubble = memo(function MessageBubbleComponent({ message, conversationNodeId, isLightMode = false, onDelete }: MessageBubbleProps): JSX.Element {
  const isUser = message.role === 'user'
  const [showArtifacts, setShowArtifacts] = useState(false)
  const spawnArtifactFromLLM = useWorkspaceStore((state) => state.spawnArtifactFromLLM)

  // Use a specific selector to get only the conversation node position
  // This prevents re-renders when other nodes change
  const conversationPosition = useWorkspaceStore(
    useCallback((state) => {
      const convNode = state.nodes.find((n) => n.id === conversationNodeId)
      return convNode ? { x: convNode.position.x, y: convNode.position.y } : null
    }, [conversationNodeId])
  )

  // Detect extractable artifacts in assistant messages
  const detectedArtifacts = useMemo(() => {
    if (isUser || !message.content) return []
    return detectArtifacts(message.content)
  }, [isUser, message.content])

  const hasArtifacts = detectedArtifacts.length > 0

  // Get conversation node position for artifact placement
  const getConversationPosition = useCallback(() => {
    if (conversationPosition) {
      return { x: conversationPosition.x + 420, y: conversationPosition.y }
    }
    return { x: 100, y: 100 }
  }, [conversationPosition])

  const handleExtractArtifact = useCallback(
    (artifactIndex: number) => {
      const artifact = detectedArtifacts[artifactIndex]
      if (!artifact) return

      const position = getConversationPosition()
      // Offset each artifact vertically
      position.y += artifactIndex * 250

      spawnArtifactFromLLM(conversationNodeId, message.id, {
        content: artifact.content,
        type: artifact.type,
        language: artifact.language,
        title: artifact.title
      })

      toast.success(`Extracted: ${artifact.title}`)
    },
    [detectedArtifacts, getConversationPosition, spawnArtifactFromLLM, conversationNodeId, message.id]
  )

  const handleExtractAll = useCallback(() => {
    detectedArtifacts.forEach((artifact) => {
      spawnArtifactFromLLM(conversationNodeId, message.id, {
        content: artifact.content,
        type: artifact.type,
        language: artifact.language,
        title: artifact.title
      })
    })

    toast.success(`Extracted ${detectedArtifacts.length} artifact${detectedArtifacts.length > 1 ? 's' : ''}`)
    setShowArtifacts(false)
  }, [detectedArtifacts, spawnArtifactFromLLM, conversationNodeId, message.id])

  // Theme-aware message styling (using design tokens)
  const assistantBgClasses = 'bg-[var(--surface-panel-secondary)] text-[var(--text-primary)] border border-[var(--border-subtle)]'
  const inlineCodeClasses = 'bg-[var(--surface-panel-secondary)] text-[var(--text-primary)]'
  const copyButtonClasses = 'bg-[var(--surface-panel-secondary)] hover:bg-[var(--surface-panel)] text-[var(--text-primary)]'
  const proseClasses = isLightMode ? 'prose prose-sm' : 'prose prose-invert prose-sm'

  return (
    <div className={`group/msg flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      <div className="relative">
        {onDelete && (
          <button
            onClick={onDelete}
            className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-xs opacity-0 group-hover/msg:opacity-100 transition-opacity z-10"
            style={{
              backgroundColor: 'var(--gui-bg-tertiary, #374151)',
              color: 'var(--gui-text-muted, #9ca3af)',
              border: '1px solid var(--gui-border-subtle, #4b5563)'
            }}
            title="Delete message"
          >
            <X className="w-3 h-3" />
          </button>
        )}
        <div
          className={`max-w-[85%] min-w-0 rounded-lg px-4 py-2 overflow-hidden ${
            isUser
              ? 'bg-blue-600 text-white'
              : assistantBgClasses
          }`}
        >
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm break-words">{message.content}</p>
        ) : (
          <div className={`chat-message-content ${proseClasses} max-w-none w-full`}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // Ensure paragraphs display as blocks with proper spacing
                p({ children }) {
                  return <p style={{ display: 'block', marginTop: '0.75em', marginBottom: '0.75em' }}>{children}</p>
                },
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '')
                  const isInlineCode = !match

                  if (isInlineCode) {
                    return (
                      <code className={`${inlineCodeClasses} px-1 py-0.5 rounded text-sm`} {...props}>
                        {children}
                      </code>
                    )
                  }

                  return (
                    <div className="relative group overflow-hidden">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(String(children).replace(/\n$/, ''))
                          toast.success('Copied to clipboard')
                        }}
                        className={`absolute top-2 right-2 px-2 py-1 ${copyButtonClasses} rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity z-10`}
                      >
                        Copy
                      </button>
                      <SyntaxHighlighter
                        style={oneDark}
                        language={match[1]}
                        PreTag="div"
                        customStyle={{
                          margin: 0,
                          borderRadius: '0.5rem',
                          overflowX: 'auto',
                          maxWidth: '100%'
                        }}
                        wrapLongLines={false}
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    </div>
                  )
                }
              }}
            >
              {message.content || ''}
            </ReactMarkdown>
            {/* Typing indicator when assistant message is empty (streaming) */}
            {!message.content && (
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            )}
          </div>
        )}
      </div>
      </div>

      {/* Token usage badge for assistant messages */}
      {!isUser && message.inputTokens != null && (
        <div className="mt-0.5 flex items-center gap-2 text-[10px] opacity-60" style={{ color: 'var(--text-muted)' }}>
          <span>{message.inputTokens.toLocaleString()} in</span>
          <span>{(message.outputTokens ?? 0).toLocaleString()} out</span>
          {message.costUSD != null && message.costUSD > 0 && (
            <span>${message.costUSD < 0.01 ? message.costUSD.toFixed(4) : message.costUSD.toFixed(3)}</span>
          )}
        </div>
      )}

      {/* Artifact extraction UI for assistant messages */}
      {!isUser && hasArtifacts && (
        <div className="mt-1 max-w-[85%]">
          <button
            onClick={() => setShowArtifacts(!showArtifacts)}
            className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <Package className="w-3.5 h-3.5" />
            <span>
              {detectedArtifacts.length} extractable artifact{detectedArtifacts.length > 1 ? 's' : ''}
            </span>
            {showArtifacts ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>

          {showArtifacts && (
            <div className="mt-2 p-2 bg-[var(--surface-panel)]/50 border border-[var(--border-subtle)] rounded-lg space-y-2">
              {detectedArtifacts.map((artifact, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 rounded">
                      {artifact.type}
                    </span>
                    <span className="text-[var(--text-secondary)] truncate">{artifact.title}</span>
                    {artifact.language && (
                      <span className="text-[var(--text-muted)]">{artifact.language}</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleExtractArtifact(index)}
                    className="px-2 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded transition-colors whitespace-nowrap"
                  >
                    Extract
                  </button>
                </div>
              ))}

              {detectedArtifacts.length > 1 && (
                <button
                  onClick={handleExtractAll}
                  className="w-full mt-1 px-2 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 rounded transition-colors text-xs"
                >
                  Extract All ({detectedArtifacts.length})
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if message content actually changed
  // Note: onDelete is excluded because it's an inline closure (always new reference)
  // but it only changes when the parent's messages array changes, which is correct
  return prevProps.message.id === nextProps.message.id &&
         prevProps.message.content === nextProps.message.content &&
         prevProps.conversationNodeId === nextProps.conversationNodeId &&
         prevProps.isLightMode === nextProps.isLightMode
})

MessageBubble.displayName = 'MessageBubble'

// Suggested Actions component (ND feature - reduces initiation friction)
interface SuggestedActionsProps {
  nodeId: string
  onContinue: () => void
  onExtract: () => void
  isLightMode?: boolean
}

function SuggestedActions({ nodeId, onContinue, onExtract, isLightMode: _isLightMode = false }: SuggestedActionsProps): JSX.Element {
  const addNode = useWorkspaceStore(state => state.addNode)
  const nodes = useWorkspaceStore(state => state.nodes)

  const handleNewConversation = useCallback(() => {
    // Find the current node to get its position
    const currentNode = nodes.find(n => n.id === nodeId)
    if (currentNode) {
      // Create new conversation offset to the right
      addNode('conversation', {
        x: currentNode.position.x + 420,
        y: currentNode.position.y
      })
    }
  }, [addNode, nodes, nodeId])

  // Using design tokens
  const bgClasses = 'bg-[var(--surface-panel-secondary)]/50 hover:bg-[var(--surface-panel-secondary)]'
  const textClasses = 'text-[var(--text-secondary)]'

  return (
    <div className="flex flex-wrap gap-2 py-2 animate-fade-in">
      <button
        onClick={onContinue}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs ${bgClasses} ${textClasses} transition-colors border border-transparent hover:border-blue-500/30`}
        title="Send 'continue' to keep the conversation going"
      >
        <Send className="w-3 h-3" />
        Continue
      </button>
      <button
        onClick={onExtract}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs ${bgClasses} ${textClasses} transition-colors border border-transparent hover:border-cyan-500/30`}
        title="Extract notes, tasks, or artifacts from this response"
      >
        <Package className="w-3 h-3" />
        Extract
      </button>
      <button
        onClick={handleNewConversation}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs ${bgClasses} ${textClasses} transition-colors border border-transparent hover:border-purple-500/30`}
        title="Start a new conversation"
      >
        <MessageSquare className="w-3 h-3" />
        New Chat
      </button>
    </div>
  )
}

// API Key Modal
function ApiKeyModal({
  provider,
  onSuccess,
  onClose
}: {
  provider: string
  onSuccess: () => void
  onClose: () => void
}): JSX.Element {
  const [key, setKey] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const providerNames: Record<string, string> = {
    anthropic: 'Anthropic (Claude)',
    gemini: 'Google (Gemini)',
    openai: 'OpenAI (GPT)'
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!key.trim() || isSaving) return

    setIsSaving(true)
    setError(null)

    try {
      // Access window.api directly here to ensure we have the latest reference
      if (!window.api?.settings?.setApiKey) {
        throw new Error('API not available. Please restart the app.')
      }

      logger.log('ApiKeyModal: Calling setApiKey for', provider)
      const result = await window.api.settings.setApiKey(provider, key.trim())
      logger.log('ApiKeyModal: Result:', result)

      if (result && !result.success) {
        setError(result.error || 'Unknown error')
        return
      }

      toast.success('API key saved')
      onSuccess()
    } catch (err) {
      console.error('ApiKeyModal: Error saving API key:', err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsSaving(false)
    }
  }

  // Using design tokens
  const modalBgClasses = 'bg-[var(--surface-panel-secondary)]'
  const textClasses = 'text-[var(--text-primary)]'
  const inputClasses = 'bg-[var(--surface-panel)] border-[var(--border-subtle)] text-[var(--text-primary)]'
  const cancelTextClasses = 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'

  return (
    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <div className={`${modalBgClasses} rounded-lg p-6 w-96 shadow-xl`}>
        <h3 className={`text-lg font-medium ${textClasses} mb-4`}>
          Enter {providerNames[provider] || provider} API Key
        </h3>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk-..."
            className={`w-full ${inputClasses} border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 mb-4`}
            autoFocus
            disabled={isSaving}
          />
          {error && (
            <p className="text-red-500 text-sm mb-4">{error}</p>
          )}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className={`px-4 py-2 ${cancelTextClasses} transition-colors disabled:opacity-50`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!key.trim() || isSaving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded transition-colors"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
        <p className="text-xs text-[var(--text-muted)] mt-4">
          Your API key is encrypted and stored locally.
        </p>
      </div>
    </div>
  )
}

export const ChatPanel = memo(ChatPanelComponent)
