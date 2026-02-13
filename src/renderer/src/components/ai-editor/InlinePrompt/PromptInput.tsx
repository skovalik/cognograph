/**
 * PromptInput Sub-Component
 *
 * Text input for the inline prompt with auto-focus,
 * placeholder text, character count, and ARIA labels.
 */

import { memo, useRef, useEffect, useCallback, useState } from 'react'
import { Wand2, Send, X } from 'lucide-react'

interface PromptInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onCancel: () => void
  placeholder?: string
  maxLength?: number
  isGenerating?: boolean
  autoFocus?: boolean
}

const MAX_PROMPT_LENGTH = 500

function PromptInputComponent({
  value,
  onChange,
  onSubmit,
  onCancel,
  placeholder = 'Describe what you want to create or change...',
  maxLength = MAX_PROMPT_LENGTH,
  isGenerating = false,
  autoFocus = true
}: PromptInputProps): JSX.Element {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [isFocused, setIsFocused] = useState(false)

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`
    }
  }, [value])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (value.trim() && !isGenerating) {
          onSubmit()
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    },
    [value, isGenerating, onSubmit, onCancel]
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value
      if (newValue.length <= maxLength) {
        onChange(newValue)
      }
    },
    [onChange, maxLength]
  )

  const charCount = value.length
  const isNearLimit = charCount > maxLength * 0.8
  const isAtLimit = charCount >= maxLength

  return (
    <div className="prompt-input-container">
      <div className={`prompt-input-wrapper ${isFocused ? 'focused' : ''}`}>
        <Wand2 className="prompt-icon" />
        <textarea
          ref={inputRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={isGenerating}
          rows={1}
          aria-label="AI prompt input"
          aria-describedby="prompt-char-count"
          className="prompt-textarea"
        />
        <div className="prompt-actions">
          {value.trim() && !isGenerating && (
            <button
              onClick={onSubmit}
              className="submit-button"
              aria-label="Generate plan"
              title="Generate (Enter)"
            >
              <Send className="action-icon" />
            </button>
          )}
          <button
            onClick={onCancel}
            className="cancel-button"
            aria-label="Cancel"
            title="Cancel (Esc)"
          >
            <X className="action-icon" />
          </button>
        </div>
      </div>

      <div
        id="prompt-char-count"
        className={`char-count ${isNearLimit ? 'near-limit' : ''} ${isAtLimit ? 'at-limit' : ''}`}
        aria-live="polite"
      >
        {charCount}/{maxLength}
      </div>

      <style>{`
        .prompt-input-container {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .prompt-input-wrapper {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 12px;
          background: rgba(23, 23, 23, 0.95);
          border: 1px solid #444;
          border-radius: 12px;
          transition: all 0.15s ease;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        .prompt-input-wrapper.focused {
          border-color: var(--gui-accent-primary, #7c3aed);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3), 0 0 0 2px rgba(124, 58, 237, 0.2);
        }

        .prompt-icon {
          width: 20px;
          height: 20px;
          color: var(--gui-accent-primary, #7c3aed);
          flex-shrink: 0;
          margin-top: 2px;
        }

        .prompt-textarea {
          flex: 1;
          background: transparent;
          border: none;
          color: #f0f0f0;
          font-size: 14px;
          line-height: 1.5;
          resize: none;
          outline: none;
          min-height: 24px;
          max-height: 120px;
        }

        .prompt-textarea::placeholder {
          color: #666;
        }

        .prompt-textarea:disabled {
          opacity: 0.6;
        }

        .prompt-actions {
          display: flex;
          gap: 4px;
          flex-shrink: 0;
        }

        .submit-button,
        .cancel-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .submit-button {
          background: var(--gui-accent-primary, #7c3aed);
          color: white;
        }

        .submit-button:hover {
          background: var(--gui-accent-primary-hover, #6d28d9);
        }

        .cancel-button {
          background: rgba(255, 255, 255, 0.1);
          color: #888;
        }

        .cancel-button:hover {
          background: rgba(255, 255, 255, 0.15);
          color: #ccc;
        }

        .action-icon {
          width: 14px;
          height: 14px;
        }

        .char-count {
          font-size: 10px;
          color: #666;
          text-align: right;
          padding-right: 4px;
        }

        .char-count.near-limit {
          color: #f59e0b;
        }

        .char-count.at-limit {
          color: #ef4444;
        }

        /* Light mode */
        [data-theme="light"] .prompt-input-wrapper {
          background: rgba(255, 255, 255, 0.95);
          border-color: #d1d5db;
        }

        [data-theme="light"] .prompt-textarea {
          color: #111827;
        }

        [data-theme="light"] .prompt-textarea::placeholder {
          color: #9ca3af;
        }
      `}</style>
    </div>
  )
}

const PromptInput = memo(PromptInputComponent)
export default PromptInput
