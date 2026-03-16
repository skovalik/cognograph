/**
 * ConversationArtboard — Expanded editing view for conversation nodes
 *
 * Two-pane split layout:
 * - Left (40%): Terminal / command history / agent output
 * - Right (60%): Chat message history with chat-bubble styling
 * - Footer: Token count, cost, model info
 * - Input: Message textarea + provider selector + send button
 *
 * Reuses chat-bubble CSS classes from nodes.css (Task 3).
 * Reads node data from workspaceStore via nodeId prop.
 */

import { memo, useState, useCallback, useRef, useEffect, useMemo, type CSSProperties } from 'react'
import {
  Send,
  Terminal,
  MessageSquare,
  Bot,
  ChevronDown,
  Cpu,
  DollarSign,
  Hash
} from 'lucide-react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import type { ConversationNodeData, Message } from '@shared/types'
import { formatCost } from '../../utils/tokenEstimator'

// =============================================================================
// Types
// =============================================================================

interface ConversationArtboardProps {
  nodeId: string
}

type Provider = 'anthropic' | 'gemini' | 'openai'

const PROVIDER_LABELS: Record<Provider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  gemini: 'Gemini'
}

// =============================================================================
// Sub-components
// =============================================================================

/**
 * Single chat message bubble — reuses .chat-bubble CSS from nodes.css
 */
const ChatMessage = memo(function ChatMessage({
  message,
  accentColor
}: {
  message: Message
  accentColor?: string
}) {
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'
  const isSystem = message.role === 'system'
  const isTool = message.role === 'tool_use' || message.role === 'tool_result'

  // Skip tool messages in the chat view for cleanliness
  if (isTool) return null

  const roleLabel = isUser
    ? 'You'
    : isAssistant
      ? 'Assistant'
      : isSystem
        ? 'System'
        : message.role

  const bubbleClass = isUser ? 'chat-bubble--user' : 'chat-bubble--assistant'

  return (
    <div
      className={`chat-bubble ${bubbleClass}`}
      style={
        {
          '--ring-color': accentColor
        } as CSSProperties
      }
    >
      <span
        className={`chat-bubble__role chat-bubble__role--${isUser ? 'user' : 'assistant'}`}
      >
        {roleLabel}
      </span>
      <p
        className="text-sm leading-relaxed whitespace-pre-wrap break-words"
        style={{ color: 'var(--gui-text-primary)', margin: 0 }}
      >
        {message.content}
      </p>
      {/* Token info for assistant messages */}
      {isAssistant && (message.inputTokens || message.outputTokens) && (
        <div
          className="flex items-center gap-2 mt-1.5 text-[10px]"
          style={{ color: 'var(--gui-text-muted)' }}
        >
          {message.inputTokens && (
            <span>{message.inputTokens.toLocaleString()} in</span>
          )}
          {message.outputTokens && (
            <span>{message.outputTokens.toLocaleString()} out</span>
          )}
          {message.costUSD != null && message.costUSD > 0 && (
            <span>{formatCost(message.costUSD)}</span>
          )}
        </div>
      )}
    </div>
  )
})

/**
 * Terminal output pane — shows command history / agent output
 * Renders terminal preview lines in a monospace dark inset.
 */
const TerminalPane = memo(function TerminalPane({
  nodeData
}: {
  nodeData: ConversationNodeData
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const terminalLines = (nodeData as any).terminalPreviewLines as string[] | undefined
  const messages = nodeData.messages

  // Auto-scroll to bottom when content changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [terminalLines, messages])

  const isTerminalMode = nodeData.mode === 'terminal'
  const isAgentMode = nodeData.mode === 'agent'

  return (
    <div
      className="flex flex-col h-full"
      style={{
        backgroundColor: 'var(--terminal-bg)',
        borderRadius: '8px',
        overflow: 'hidden'
      }}
    >
      {/* Terminal header */}
      <div
        className="flex items-center gap-2 px-3 py-2 shrink-0"
        style={{
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
        }}
      >
        <Terminal
          className="w-3.5 h-3.5"
          style={{ color: nodeData.terminal?.accentColor || 'var(--terminal-prompt)' }}
        />
        <span
          className="text-[11px] font-medium"
          style={{
            color: 'var(--terminal-text)',
            fontFamily: 'var(--font-mono, "Space Mono", monospace)'
          }}
        >
          {isTerminalMode
            ? 'Terminal'
            : isAgentMode
              ? 'Agent Output'
              : 'History'}
        </span>
        {nodeData.terminal?.workingDirectory && (
          <span
            className="text-[10px] truncate ml-auto"
            style={{
              color: 'var(--terminal-text-muted)',
              fontFamily: 'var(--font-mono, "Space Mono", monospace)',
              maxWidth: '200px'
            }}
          >
            {nodeData.terminal.workingDirectory}
          </span>
        )}
      </div>

      {/* Terminal content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto p-3"
        style={{ minHeight: 0 }}
      >
        {isTerminalMode && terminalLines && terminalLines.length > 0 ? (
          <pre
            className="text-[11px] leading-snug whitespace-pre-wrap break-all"
            style={{
              fontFamily: 'var(--font-mono, "Space Mono", monospace)',
              color: 'var(--terminal-text)',
              margin: 0
            }}
          >
            {terminalLines.join('\n')}
          </pre>
        ) : messages.length > 0 ? (
          // For chat/agent mode, show a condensed command-style log
          <div className="space-y-1.5">
            {messages
              .filter((m) => m.role === 'user' || m.role === 'assistant')
              .map((msg, i) => (
                <div key={msg.id || i}>
                  <span
                    className="text-[10px] font-bold"
                    style={{
                      color:
                        msg.role === 'user'
                          ? 'var(--terminal-prompt)'
                          : 'var(--terminal-text-muted)',
                      fontFamily: 'var(--font-mono, "Space Mono", monospace)'
                    }}
                  >
                    {msg.role === 'user' ? '> ' : '  '}
                  </span>
                  <span
                    className="text-[11px]"
                    style={{
                      color: 'var(--terminal-text)',
                      fontFamily: 'var(--font-mono, "Space Mono", monospace)'
                    }}
                  >
                    {msg.content.length > 120
                      ? msg.content.slice(0, 120) + '...'
                      : msg.content}
                  </span>
                </div>
              ))}
          </div>
        ) : (
          <pre
            className="text-[11px]"
            style={{
              fontFamily: 'var(--font-mono, "Space Mono", monospace)',
              color: 'var(--terminal-text-muted)',
              margin: 0
            }}
          >
            {'$ _'}
          </pre>
        )}
      </div>
    </div>
  )
})

/**
 * Provider selector dropdown
 */
const ProviderSelector = memo(function ProviderSelector({
  value,
  onChange
}: {
  value: Provider
  onChange: (provider: Provider) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors duration-150"
        style={{
          backgroundColor: 'var(--gui-bg-secondary)',
          color: 'var(--gui-text-secondary)',
          border: '1px solid var(--gui-border)',
          cursor: 'pointer'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--gui-bg-tertiary)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--gui-bg-secondary)'
        }}
      >
        <Cpu className="w-3 h-3" />
        <span>{PROVIDER_LABELS[value]}</span>
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <div
          className="absolute bottom-full left-0 mb-1 rounded-md overflow-hidden shadow-lg"
          style={{
            backgroundColor: 'var(--gui-bg-secondary)',
            border: '1px solid var(--gui-border)',
            zIndex: 10,
            minWidth: '140px'
          }}
        >
          {(Object.keys(PROVIDER_LABELS) as Provider[]).map((provider) => (
            <button
              key={provider}
              onClick={() => {
                onChange(provider)
                setOpen(false)
              }}
              className="w-full text-left px-3 py-2 text-xs transition-colors duration-150"
              style={{
                color:
                  provider === value
                    ? 'var(--gui-accent-primary)'
                    : 'var(--gui-text-secondary)',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                borderBottom: '1px solid var(--gui-border)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--gui-bg-tertiary)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              {PROVIDER_LABELS[provider]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
})

// =============================================================================
// Main Component
// =============================================================================

function ConversationArtboardComponent({ nodeId }: ConversationArtboardProps): JSX.Element {
  const nodes = useWorkspaceStore((s) => s.nodes)
  const addMessage = useWorkspaceStore((s) => s.addMessage)
  const updateNode = useWorkspaceStore((s) => s.updateNode)
  const showTokenEstimates = useWorkspaceStore(
    (s) => s.workspacePreferences.showTokenEstimates
  )

  const node = nodes.find((n) => n.id === nodeId)
  const nodeData = node?.data as ConversationNodeData | undefined

  const [inputValue, setInputValue] = useState('')
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Derived data
  const messages = nodeData?.messages ?? []
  const provider = (nodeData?.provider ?? 'anthropic') as Provider
  const mode = nodeData?.mode ?? 'chat'
  const nodeColor = nodeData?.color || 'var(--gui-accent-primary)'

  const totalTokensIn = useMemo(
    () => messages.reduce((sum, m) => sum + (m.inputTokens ?? 0), 0),
    [messages]
  )
  const totalTokensOut = useMemo(
    () => messages.reduce((sum, m) => sum + (m.outputTokens ?? 0), 0),
    [messages]
  )
  const totalCost = useMemo(
    () => messages.reduce((sum, m) => sum + (m.costUSD ?? 0), 0),
    [messages]
  )
  const visibleMessages = useMemo(
    () => messages.filter((m) => m.role === 'user' || m.role === 'assistant'),
    [messages]
  )

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [messages.length])

  // Focus textarea on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      textareaRef.current?.focus()
    }, 250) // After animation completes
    return () => clearTimeout(timer)
  }, [])

  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim()
    if (!trimmed || !nodeData) return

    addMessage(nodeId, 'user', trimmed)
    setInputValue('')

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [inputValue, nodeId, nodeData, addMessage])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  const handleProviderChange = useCallback(
    (newProvider: Provider) => {
      updateNode(nodeId, { provider: newProvider })
    },
    [nodeId, updateNode]
  )

  // Auto-resize textarea
  const handleTextareaInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInputValue(e.target.value)
      // Auto-resize
      const el = e.target
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 120) + 'px'
    },
    []
  )

  if (!nodeData) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ color: 'var(--gui-text-muted)' }}
      >
        <p className="text-sm">Node not found</p>
      </div>
    )
  }

  const modeIcon =
    mode === 'agent' ? (
      <Bot className="w-3.5 h-3.5" />
    ) : mode === 'terminal' ? (
      <Terminal className="w-3.5 h-3.5" />
    ) : (
      <MessageSquare className="w-3.5 h-3.5" />
    )

  return (
    <div className="flex flex-col h-full" style={{ minHeight: '400px' }}>
      {/* ================================================================
          Two-pane body: Terminal (40%) + Chat (60%)
          ================================================================ */}
      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {/* Left pane: Terminal / command log (40%) */}
        <div
          className="flex flex-col p-3"
          style={{
            width: '40%',
            borderRight: '1px solid var(--gui-border)',
            minWidth: 0
          }}
        >
          <TerminalPane nodeData={nodeData} />
        </div>

        {/* Right pane: Chat history (60%) */}
        <div
          className="flex flex-col"
          style={{ width: '60%', minWidth: 0 }}
        >
          {/* Chat messages */}
          <div
            ref={chatScrollRef}
            className="flex-1 overflow-auto p-4 space-y-1"
            style={{ minHeight: 0 }}
          >
            {visibleMessages.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center h-full gap-2"
                style={{ color: 'var(--gui-text-muted)' }}
              >
                {modeIcon}
                <p className="text-sm">No messages yet</p>
                <p className="text-xs">Type below to start a conversation</p>
              </div>
            ) : (
              visibleMessages.map((msg, i) => (
                <ChatMessage
                  key={msg.id || i}
                  message={msg}
                  accentColor={nodeColor}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* ================================================================
          Footer: Token counts + cost + model info
          ================================================================ */}
      <div
        className="flex items-center justify-between px-4 py-2 shrink-0"
        style={{
          borderTop: '1px solid var(--gui-border)',
          color: 'var(--gui-text-muted)',
          fontSize: '11px'
        }}
      >
        <div className="flex items-center gap-3">
          {/* Message count */}
          <span className="flex items-center gap-1">
            <Hash className="w-3 h-3" />
            {messages.length} messages
          </span>

          {/* Token counts */}
          {showTokenEstimates && (totalTokensIn > 0 || totalTokensOut > 0) && (
            <span className="flex items-center gap-1">
              <Cpu className="w-3 h-3" />
              {totalTokensIn.toLocaleString()} in / {totalTokensOut.toLocaleString()} out
            </span>
          )}

          {/* Cost */}
          {showTokenEstimates && totalCost > 0 && (
            <span className="flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              {formatCost(totalCost)}
            </span>
          )}
        </div>

        {/* Mode + Provider */}
        <div className="flex items-center gap-2">
          <span
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]"
            style={{
              backgroundColor: `color-mix(in srgb, ${nodeColor} 12%, transparent)`,
              color: nodeColor
            }}
          >
            {modeIcon}
            {mode === 'agent' ? 'Agent' : mode === 'terminal' ? 'Terminal' : 'Chat'}
          </span>
          <span
            className="px-1.5 py-0.5 rounded text-[10px]"
            style={{
              backgroundColor: 'var(--gui-bg-secondary)',
              color: 'var(--gui-text-muted)'
            }}
          >
            {PROVIDER_LABELS[provider]}
          </span>
        </div>
      </div>

      {/* ================================================================
          Input area: Provider selector + textarea + send button
          ================================================================ */}
      <div
        className="flex items-end gap-2 px-4 py-3 shrink-0"
        style={{
          borderTop: '1px solid var(--gui-border)',
          backgroundColor: 'color-mix(in srgb, var(--gui-bg-secondary) 50%, transparent)'
        }}
      >
        <ProviderSelector value={provider} onChange={handleProviderChange} />

        <div
          className="flex-1 relative"
          style={{
            backgroundColor: 'var(--gui-bg-secondary)',
            borderRadius: '8px',
            border: '1px solid var(--gui-border)'
          }}
        >
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleTextareaInput}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
            rows={1}
            className="w-full resize-none text-sm px-3 py-2 bg-transparent outline-none"
            style={{
              color: 'var(--gui-text-primary)',
              maxHeight: '120px',
              lineHeight: '1.5'
            }}
          />
        </div>

        <button
          onClick={handleSend}
          disabled={!inputValue.trim()}
          className="p-2 rounded-md transition-colors duration-150 shrink-0"
          style={{
            backgroundColor: inputValue.trim()
              ? nodeColor
              : 'var(--gui-bg-tertiary)',
            color: inputValue.trim()
              ? '#fff'
              : 'var(--gui-text-muted)',
            cursor: inputValue.trim() ? 'pointer' : 'default',
            opacity: inputValue.trim() ? 1 : 0.5
          }}
          aria-label="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export const ConversationArtboard = memo(ConversationArtboardComponent)
