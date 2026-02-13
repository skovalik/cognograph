/**
 * AISidebar Component
 *
 * Persistent AI conversation panel that can be toggled via button or Ctrl+Shift+A.
 * Shows conversation history, supports @mentions for nodes, and can apply plans to canvas.
 */

import { memo, useState, useCallback, useRef, useEffect } from 'react'
import {
  X,
  Send,
  Trash2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Play
} from 'lucide-react'
import { useAIEditorStore } from '../../stores/aiEditorStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { buildAIEditorContext } from '../../utils/contextBuilder'
import { executeMutationPlan } from '../../utils/mutationExecutor'
import { ScrollArea } from '../ui'
import type { ConversationMessage, MutationPlan } from '@shared/types'

interface AISidebarProps {
  isOpen: boolean
  onClose: () => void
}

function AISidebarComponent({ isOpen, onClose }: AISidebarProps): JSX.Element | null {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)
  const [inputValue, setInputValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [expandedPlans, setExpandedPlans] = useState<Set<number>>(new Set())

  // Store state
  const conversationHistory = useAIEditorStore((s) => s.conversationHistory)
  const addToConversation = useAIEditorStore((s) => s.addToConversation)
  const clearConversation = useAIEditorStore((s) => s.clearConversation)
  const generatePlan = useAIEditorStore((s) => s.generatePlan)
  const currentPlan = useAIEditorStore((s) => s.currentPlan)

  const nodes = useWorkspaceStore((s) => s.nodes)
  const edges = useWorkspaceStore((s) => s.edges)
  const selectedNodeIds = useWorkspaceStore((s) => s.selectedNodeIds)
  const viewport = useWorkspaceStore((s) => s.viewport)
  const themeSettings = useWorkspaceStore((s) => s.themeSettings)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesRef.current) {
      // ScrollArea wraps content in a viewport; scroll the last child into view
      const lastChild = messagesRef.current.lastElementChild
      if (lastChild) {
        lastChild.scrollIntoView({ behavior: 'smooth', block: 'end' })
      }
    }
  }, [conversationHistory])

  // Focus input when sidebar opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Handle submit with actual AI generation
  const handleSubmit = useCallback(async () => {
    if (!inputValue.trim() || isSubmitting) return

    const message = inputValue.trim()
    setInputValue('')
    setIsSubmitting(true)

    // Add user message
    addToConversation({
      role: 'user',
      content: message
    })

    try {
      // Build context for AI generation
      const context = buildAIEditorContext({
        mode: 'ask', // Sidebar uses ask mode for conversational queries
        prompt: message,
        scope: selectedNodeIds.length > 0 ? 'selection' : 'workspace',
        nodes,
        edges,
        selectedNodeIds,
        viewport,
        viewportBounds: { width: window.innerWidth, height: window.innerHeight },
        workspaceSettings: {
          defaultProvider: 'anthropic',
          themeMode: themeSettings.mode
        }
      })

      // Generate plan using AI
      await generatePlan(context)

      // Add AI response based on the plan
      const plan = useAIEditorStore.getState().currentPlan
      const error = useAIEditorStore.getState().generationError

      if (error) {
        addToConversation({
          role: 'assistant',
          content: `I encountered an error: ${error}. Please try rephrasing your request.`
        })
      } else if (plan) {
        const opCount = plan.operations.length
        const reasoning = plan.reasoning || 'Here\'s what I found based on your request.'
        addToConversation({
          role: 'assistant',
          content: reasoning,
          plan: plan
        })
      } else {
        addToConversation({
          role: 'assistant',
          content: 'I processed your request but no specific actions were generated. Try being more specific about what you\'d like to do.'
        })
      }
    } catch (error) {
      addToConversation({
        role: 'assistant',
        content: `Something went wrong: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [inputValue, isSubmitting, addToConversation, generatePlan, nodes, edges, selectedNodeIds, viewport, themeSettings.mode])

  // Handle key down
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
      if (e.key === 'Escape') {
        onClose()
      }
    },
    [handleSubmit, onClose]
  )

  // Toggle plan expansion
  const togglePlanExpansion = useCallback((index: number) => {
    setExpandedPlans((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }, [])

  // Apply a plan from a conversation message to the canvas
  const handleApplyPlan = useCallback(async (plan: MutationPlan) => {
    await executeMutationPlan(plan)
  }, [])

  // Parse @mentions in input (reserved for future use)
  const _parseNodeMentions = useCallback(
    (text: string): { text: string; mentionedNodes: string[] } => {
      const mentionedNodes: string[] = []
      const processedText = text.replace(/@(\w+)/g, (match, name) => {
        const node = nodes.find(
          (n) =>
            n.data.title?.toLowerCase().includes(name.toLowerCase()) ||
            n.id.toLowerCase().includes(name.toLowerCase())
        )
        if (node) {
          mentionedNodes.push(node.id)
          return `[${node.data.title || node.id}]`
        }
        return match
      })
      return { text: processedText, mentionedNodes }
    },
    [nodes]
  )

  if (!isOpen) return null

  return (
    <div
      className="ai-sidebar"
      role="complementary"
      aria-label="AI Assistant sidebar"
    >
      {/* Header */}
      <div className="sidebar-header">
        <div className="header-title">
          <Sparkles className="header-icon" />
          <span>AI Assistant</span>
        </div>
        <div className="header-actions">
          <button
            className="action-btn"
            onClick={clearConversation}
            title="Clear conversation"
            disabled={conversationHistory.length === 0}
            aria-label="Clear conversation history"
          >
            <Trash2 className="action-icon" />
          </button>
          <button
            className="action-btn close-btn"
            onClick={onClose}
            title="Close sidebar"
            aria-label="Close AI Assistant sidebar"
          >
            <X className="action-icon" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="messages-container" role="log" aria-label="Conversation history" aria-live="polite">
        <div ref={messagesRef}>
        {conversationHistory.length === 0 ? (
          <div className="empty-state">
            <Sparkles className="empty-icon" />
            <p className="empty-title">Start a conversation</p>
            <p className="empty-description">
              Ask questions about your workspace, generate content, or get AI assistance.
            </p>
            <p className="empty-hint">
              Tip: Use @nodename to reference specific nodes
            </p>
          </div>
        ) : (
          conversationHistory.map((msg, index) => (
            <div key={index} className={`message ${msg.role}`}>
              <div className="message-header">
                <span className="message-role">{msg.role === 'user' ? 'You' : 'AI'}</span>
                <span className="message-time">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
              <div className="message-content">{msg.content}</div>
              {msg.plan && (
                <div className="message-plan">
                  <button
                    className="plan-toggle"
                    onClick={() => togglePlanExpansion(index)}
                    aria-expanded={expandedPlans.has(index)}
                    aria-label={`${expandedPlans.has(index) ? 'Collapse' : 'Expand'} plan details`}
                  >
                    {expandedPlans.has(index) ? (
                      <ChevronUp className="toggle-icon" />
                    ) : (
                      <ChevronDown className="toggle-icon" />
                    )}
                    <span>
                      {msg.plan.operations.length} operation
                      {msg.plan.operations.length !== 1 ? 's' : ''}
                    </span>
                  </button>
                  {expandedPlans.has(index) && (
                    <div className="plan-details">
                      {msg.plan.operations.map((op, opIndex) => (
                        <div key={opIndex} className="plan-op">
                          <span className="op-type">{op.op}</span>
                        </div>
                      ))}
                      <button
                        className="apply-plan-btn"
                        aria-label="Apply plan to canvas"
                        onClick={() => handleApplyPlan(msg.plan!)}
                      >
                        <Play className="apply-icon" />
                        Apply to Canvas
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}

        {isSubmitting && (
          <div className="message assistant loading">
            <div className="loading-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="input-container">
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask AI anything... (use @ to mention nodes)"
          rows={1}
          disabled={isSubmitting}
          aria-label="Ask AI anything"
        />
        <button
          className="send-btn"
          onClick={handleSubmit}
          disabled={!inputValue.trim() || isSubmitting}
          aria-label="Send message"
        >
          <Send className="send-icon" />
        </button>
      </div>

      <style>{`
        .ai-sidebar {
          position: fixed;
          right: 0;
          top: 0;
          bottom: 0;
          width: 360px;
          background: rgba(20, 20, 20, 0.98);
          border-left: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          flex-direction: column;
          z-index: var(--z-modals, 100);
          animation: slideIn 0.2s ease-out;
        }

        @keyframes slideIn {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }

        .sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .header-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 600;
          color: #f0f0f0;
        }

        .header-icon {
          width: 18px;
          height: 18px;
          color: var(--gui-accent-primary, #7c3aed);
        }

        .header-actions {
          display: flex;
          gap: 4px;
        }

        .action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: transparent;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .action-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.1);
        }

        .action-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .action-icon {
          width: 16px;
          height: 16px;
          color: #888;
        }

        .action-btn:hover .action-icon {
          color: #ccc;
        }

        .close-btn:hover .action-icon {
          color: #ef4444;
        }

        .messages-container {
          flex: 1;
          padding: 16px;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          text-align: center;
          padding: 32px;
        }

        .empty-icon {
          width: 48px;
          height: 48px;
          color: rgba(124, 58, 237, 0.3);
          margin-bottom: 16px;
        }

        .empty-title {
          font-size: 16px;
          font-weight: 500;
          color: #ccc;
          margin-bottom: 8px;
        }

        .empty-description {
          font-size: 13px;
          color: #888;
          line-height: 1.5;
          margin-bottom: 16px;
        }

        .empty-hint {
          font-size: 11px;
          color: #666;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 6px;
        }

        .message {
          margin-bottom: 16px;
        }

        .message.user {
          background: rgba(124, 58, 237, 0.1);
          border-radius: 12px 12px 4px 12px;
          padding: 12px;
        }

        .message.assistant {
          background: rgba(255, 255, 255, 0.03);
          border-radius: 12px 12px 12px 4px;
          padding: 12px;
        }

        .message-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }

        .message-role {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .message.user .message-role {
          color: var(--gui-accent-primary, #7c3aed);
        }

        .message.assistant .message-role {
          color: #4ade80;
        }

        .message-time {
          font-size: 10px;
          color: #555;
        }

        .message-content {
          font-size: 13px;
          color: #e0e0e0;
          line-height: 1.5;
          white-space: pre-wrap;
        }

        .message.loading {
          padding: 16px;
        }

        .loading-dots {
          display: flex;
          gap: 4px;
        }

        .loading-dots span {
          width: 6px;
          height: 6px;
          background: #666;
          border-radius: 50%;
          animation: bounce 1.4s infinite ease-in-out both;
        }

        .loading-dots span:nth-child(1) { animation-delay: -0.32s; }
        .loading-dots span:nth-child(2) { animation-delay: -0.16s; }

        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }

        .message-plan {
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .plan-toggle {
          display: flex;
          align-items: center;
          gap: 6px;
          background: transparent;
          border: none;
          color: #888;
          font-size: 12px;
          cursor: pointer;
          padding: 4px 0;
        }

        .plan-toggle:hover {
          color: #ccc;
        }

        .toggle-icon {
          width: 14px;
          height: 14px;
        }

        .plan-details {
          margin-top: 8px;
        }

        .plan-op {
          padding: 4px 8px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 4px;
          margin-bottom: 4px;
        }

        .op-type {
          font-size: 11px;
          color: #888;
          font-family: monospace;
        }

        .apply-plan-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 8px;
          padding: 8px 12px;
          background: var(--gui-accent-primary, #7c3aed);
          border: none;
          border-radius: 6px;
          color: white;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s;
        }

        .apply-plan-btn:hover {
          background: var(--gui-accent-secondary, #6d28d9);
        }

        .apply-icon {
          width: 12px;
          height: 12px;
        }

        .input-container {
          display: flex;
          gap: 8px;
          padding: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .input-container textarea {
          flex: 1;
          padding: 10px 12px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 8px;
          color: #f0f0f0;
          font-size: 13px;
          line-height: 1.4;
          resize: none;
          outline: none;
          min-height: 40px;
          max-height: 100px;
        }

        .input-container textarea:focus {
          border-color: var(--gui-accent-primary, #7c3aed);
        }

        .input-container textarea::placeholder {
          color: #666;
        }

        .send-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          background: var(--gui-accent-primary, #7c3aed);
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s;
          flex-shrink: 0;
        }

        .send-btn:hover:not(:disabled) {
          background: var(--gui-accent-secondary, #6d28d9);
        }

        .send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .send-icon {
          width: 18px;
          height: 18px;
          color: white;
        }

        /* Light mode */
        [data-theme="light"] .ai-sidebar {
          background: rgba(255, 255, 255, 0.98);
          border-color: rgba(0, 0, 0, 0.1);
        }

        [data-theme="light"] .header-title {
          color: #1f2937;
        }

        [data-theme="light"] .message.user {
          background: rgba(124, 58, 237, 0.08);
        }

        [data-theme="light"] .message.assistant {
          background: rgba(0, 0, 0, 0.03);
        }

        [data-theme="light"] .message-content {
          color: #374151;
        }

        [data-theme="light"] .input-container textarea {
          background: rgba(0, 0, 0, 0.03);
          border-color: rgba(0, 0, 0, 0.15);
          color: #1f2937;
        }
      `}</style>
    </div>
  )
}

const AISidebar = memo(AISidebarComponent)
export default AISidebar
