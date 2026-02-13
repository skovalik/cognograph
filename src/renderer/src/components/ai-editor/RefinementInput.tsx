/**
 * RefinementInput Component
 *
 * Input for refining the current AI Editor plan.
 * Shows after plan generation, allowing users to iterate on the plan.
 */

import { memo, useState, useCallback, useRef, useEffect } from 'react'
import { Send, RotateCcw, History } from 'lucide-react'
import { useAIEditorStore } from '../../stores/aiEditorStore'

interface RefinementInputProps {
  onRefine: (prompt: string) => Promise<void>
  isRefining?: boolean
}

function RefinementInputComponent({
  onRefine,
  isRefining = false
}: RefinementInputProps): JSX.Element {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [value, setValue] = useState('')
  const [showHistory, setShowHistory] = useState(false)

  const conversationHistory = useAIEditorStore((s) => s.conversationHistory)
  const clearConversation = useAIEditorStore((s) => s.clearConversation)

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`
    }
  }, [value])

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!value.trim() || isRefining) return
    await onRefine(value.trim())
    setValue('')
  }, [value, isRefining, onRefine])

  // Handle key down
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  return (
    <div className="refinement-input">
      {/* Conversation history toggle */}
      {conversationHistory.length > 0 && (
        <div className="history-section">
          <button
            className="history-toggle"
            onClick={() => setShowHistory(!showHistory)}
            aria-expanded={showHistory}
          >
            <History className="history-icon" />
            <span>{conversationHistory.length} previous message{conversationHistory.length !== 1 ? 's' : ''}</span>
          </button>

          {showHistory && (
            <div className="history-list">
              {conversationHistory.map((msg, i) => (
                <div key={i} className={`history-item ${msg.role}`}>
                  <span className="history-role">{msg.role === 'user' ? 'You' : 'AI'}</span>
                  <span className="history-content">{msg.content}</span>
                </div>
              ))}
              <button className="clear-history" onClick={clearConversation}>
                <RotateCcw className="clear-icon" />
                Clear history
              </button>
            </div>
          )}
        </div>
      )}

      {/* Input area */}
      <div className="input-wrapper">
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Refine the plan... (e.g., 'Make it more detailed' or 'Add a summary section')"
          disabled={isRefining}
          rows={1}
          aria-label="Refinement prompt"
        />
        <button
          className="send-button"
          onClick={handleSubmit}
          disabled={!value.trim() || isRefining}
          aria-label="Send refinement"
        >
          <Send className={`send-icon ${isRefining ? 'refining' : ''}`} />
        </button>
      </div>

      {/* Helper text */}
      <div className="helper-text">
        Press Enter to send, Shift+Enter for new line
      </div>

      <style>{`
        .refinement-input {
          margin-top: 12px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
        }

        .history-section {
          margin-bottom: 10px;
        }

        .history-toggle {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 8px;
          background: transparent;
          border: none;
          color: #888;
          font-size: 11px;
          cursor: pointer;
          transition: color 0.15s;
        }

        .history-toggle:hover {
          color: #aaa;
        }

        .history-icon {
          width: 12px;
          height: 12px;
        }

        .history-list {
          margin-top: 8px;
          padding: 8px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 6px;
          max-height: 200px;
          overflow-y: auto;
        }

        .history-item {
          display: flex;
          gap: 8px;
          padding: 6px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .history-item:last-of-type {
          border-bottom: none;
        }

        .history-role {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          min-width: 24px;
        }

        .history-item.user .history-role {
          color: #60a5fa;
        }

        .history-item.assistant .history-role {
          color: #a78bfa;
        }

        .history-content {
          font-size: 12px;
          color: #ccc;
          line-height: 1.4;
        }

        .clear-history {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 8px;
          padding: 4px 8px;
          background: transparent;
          border: none;
          color: #666;
          font-size: 11px;
          cursor: pointer;
          transition: color 0.15s;
        }

        .clear-history:hover {
          color: #ef4444;
        }

        .clear-icon {
          width: 12px;
          height: 12px;
        }

        .input-wrapper {
          display: flex;
          align-items: flex-end;
          gap: 8px;
        }

        .input-wrapper textarea {
          flex: 1;
          padding: 10px 12px;
          background: rgba(25, 25, 25, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 8px;
          color: #f0f0f0;
          font-size: 13px;
          line-height: 1.5;
          resize: none;
          outline: none;
          min-height: 40px;
          max-height: 120px;
          transition: border-color 0.15s;
        }

        .input-wrapper textarea:focus {
          border-color: var(--gui-accent-primary, #7c3aed);
        }

        .input-wrapper textarea::placeholder {
          color: #666;
        }

        .input-wrapper textarea:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .send-button {
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
        }

        .send-button:hover:not(:disabled) {
          background: var(--gui-accent-secondary, #6d28d9);
        }

        .send-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .send-icon {
          width: 18px;
          height: 18px;
          color: white;
        }

        .send-icon.refining {
          animation: pulse 1s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        .helper-text {
          margin-top: 6px;
          font-size: 10px;
          color: #555;
        }

        /* Light mode */
        [data-theme="light"] .refinement-input {
          background: rgba(0, 0, 0, 0.02);
          border-color: rgba(0, 0, 0, 0.1);
        }

        [data-theme="light"] .input-wrapper textarea {
          background: rgba(255, 255, 255, 0.8);
          border-color: rgba(0, 0, 0, 0.15);
          color: #1f2937;
        }

        [data-theme="light"] .input-wrapper textarea::placeholder {
          color: #9ca3af;
        }

        [data-theme="light"] .history-list {
          background: rgba(0, 0, 0, 0.05);
        }

        [data-theme="light"] .history-content {
          color: #374151;
        }
      `}</style>
    </div>
  )
}

const RefinementInput = memo(RefinementInputComponent)
export default RefinementInput
