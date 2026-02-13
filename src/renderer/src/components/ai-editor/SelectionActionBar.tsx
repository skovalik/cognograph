/**
 * SelectionActionBar Component
 *
 * Floating toolbar that appears when nodes are selected and Tab is pressed.
 * Provides quick AI actions: Organize, Summarize, Connect, Expand.
 * Implements ARIA toolbar pattern with arrow key navigation.
 */

import { memo, useState, useCallback, useRef, useEffect } from 'react'
import {
  LayoutGrid,
  FileText,
  Link2,
  Expand,
  Wand2,
  X
} from 'lucide-react'
import { useAIEditorStore } from '../../stores/aiEditorStore'

interface SelectionActionBarProps {
  selectedNodeIds: string[]
  position: { x: number; y: number }
  onClose: () => void
}

interface QuickAction {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  mode: 'organize' | 'ask' | 'generate' | 'edit'
  prompt: string
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'organize',
    label: 'Organize',
    icon: LayoutGrid,
    mode: 'organize',
    prompt: 'Organize these nodes into a logical layout'
  },
  {
    id: 'summarize',
    label: 'Summarize',
    icon: FileText,
    mode: 'ask',
    prompt: 'Summarize the content of these selected notes'
  },
  {
    id: 'connect',
    label: 'Connect',
    icon: Link2,
    mode: 'generate',
    prompt: 'Create meaningful connections between these nodes'
  },
  {
    id: 'expand',
    label: 'Expand',
    icon: Expand,
    mode: 'generate',
    prompt: 'Expand on these ideas and create related notes'
  }
]

function SelectionActionBarComponent({
  selectedNodeIds,
  position,
  onClose
}: SelectionActionBarProps): JSX.Element {
  const barRef = useRef<HTMLDivElement>(null)
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [showCustomPrompt, setShowCustomPrompt] = useState(false)
  const [customPrompt, setCustomPrompt] = useState('')

  const openModal = useAIEditorStore((s) => s.openModal)
  const setPrompt = useAIEditorStore((s) => s.setPrompt)

  // Focus management
  useEffect(() => {
    if (barRef.current) {
      const buttons = barRef.current.querySelectorAll<HTMLButtonElement>('[role="button"]')
      buttons[focusedIndex]?.focus()
    }
  }, [focusedIndex])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const actionCount = QUICK_ACTIONS.length + 1 // +1 for custom button

    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault()
        setFocusedIndex((prev) => (prev + 1) % actionCount)
        break
      case 'ArrowLeft':
        e.preventDefault()
        setFocusedIndex((prev) => (prev - 1 + actionCount) % actionCount)
        break
      case 'Home':
        e.preventDefault()
        setFocusedIndex(0)
        break
      case 'End':
        e.preventDefault()
        setFocusedIndex(actionCount - 1)
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
    }
  }, [onClose])

  // Handle quick action click
  const handleQuickAction = useCallback((action: QuickAction) => {
    openModal({
      mode: action.mode,
      scope: 'selection',
      prompt: action.prompt
    })
    onClose()
  }, [openModal, onClose])

  // Handle custom prompt
  const handleCustomPrompt = useCallback(() => {
    if (!customPrompt.trim()) {
      setShowCustomPrompt(true)
      return
    }

    openModal({
      mode: 'generate',
      scope: 'selection',
      prompt: customPrompt.trim()
    })
    onClose()
  }, [customPrompt, openModal, onClose])

  // Handle custom prompt submit
  const handleCustomSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (customPrompt.trim()) {
      openModal({
        mode: 'generate',
        scope: 'selection',
        prompt: customPrompt.trim()
      })
      onClose()
    }
  }, [customPrompt, openModal, onClose])

  return (
    <div
      ref={barRef}
      className="selection-action-bar"
      style={{
        left: position.x,
        top: position.y
      }}
      role="toolbar"
      aria-label={`AI actions for ${selectedNodeIds.length} selected node${selectedNodeIds.length !== 1 ? 's' : ''}`}
      onKeyDown={handleKeyDown}
    >
      {/* Close button */}
      <button
        className="close-button"
        onClick={onClose}
        aria-label="Close action bar"
      >
        <X className="close-icon" />
      </button>

      {/* Node count badge */}
      <div className="node-count">
        {selectedNodeIds.length} node{selectedNodeIds.length !== 1 ? 's' : ''}
      </div>

      {/* Quick actions */}
      <div className="actions">
        {QUICK_ACTIONS.map((action, index) => {
          const Icon = action.icon
          return (
            <button
              key={action.id}
              className={`action-button ${focusedIndex === index ? 'focused' : ''}`}
              onClick={() => handleQuickAction(action)}
              role="button"
              tabIndex={focusedIndex === index ? 0 : -1}
              aria-label={action.label}
            >
              <Icon className="action-icon" />
              <span className="action-label">{action.label}</span>
            </button>
          )
        })}

        {/* Custom prompt button */}
        <button
          className={`action-button custom ${focusedIndex === QUICK_ACTIONS.length ? 'focused' : ''}`}
          onClick={handleCustomPrompt}
          role="button"
          tabIndex={focusedIndex === QUICK_ACTIONS.length ? 0 : -1}
          aria-label="Custom prompt"
        >
          <Wand2 className="action-icon" />
          <span className="action-label">Custom</span>
        </button>
      </div>

      {/* Custom prompt input */}
      {showCustomPrompt && (
        <form className="custom-prompt-form" onSubmit={handleCustomSubmit}>
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Enter your prompt..."
            autoFocus
            aria-label="Custom AI prompt"
          />
          <button type="submit" disabled={!customPrompt.trim()} aria-label="Submit custom prompt">
            Go
          </button>
        </form>
      )}

      <style>{`
        .selection-action-bar {
          position: fixed;
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 12px;
          background: rgba(25, 25, 25, 0.98);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
          z-index: 1000;
          min-width: 280px;
          animation: slideIn 0.2s ease-out;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .close-button {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          border-radius: 4px;
          color: #666;
          cursor: pointer;
          transition: all 0.15s;
        }

        .close-button:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #ccc;
        }

        .close-icon {
          width: 14px;
          height: 14px;
        }

        .node-count {
          font-size: 11px;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding-bottom: 8px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .actions {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 4px;
        }

        .action-button {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 10px 8px;
          background: transparent;
          border: 1px solid transparent;
          border-radius: 8px;
          color: #ccc;
          cursor: pointer;
          transition: all 0.15s;
        }

        .action-button:hover {
          background: rgba(255, 255, 255, 0.08);
        }

        .action-button.focused {
          border-color: var(--gui-accent-primary, #7c3aed);
          background: rgba(124, 58, 237, 0.1);
        }

        .action-button.custom {
          border-left: 1px solid rgba(255, 255, 255, 0.1);
        }

        .action-icon {
          width: 20px;
          height: 20px;
        }

        .action-button.focused .action-icon {
          color: var(--gui-accent-primary, #7c3aed);
        }

        .action-label {
          font-size: 10px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .custom-prompt-form {
          display: flex;
          gap: 8px;
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .custom-prompt-form input {
          flex: 1;
          padding: 8px 12px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 6px;
          color: #f0f0f0;
          font-size: 13px;
          outline: none;
        }

        .custom-prompt-form input:focus {
          border-color: var(--gui-accent-primary, #7c3aed);
        }

        .custom-prompt-form button {
          padding: 8px 16px;
          background: var(--gui-accent-primary, #7c3aed);
          border: none;
          border-radius: 6px;
          color: white;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s;
        }

        .custom-prompt-form button:hover:not(:disabled) {
          background: var(--gui-accent-secondary, #6d28d9);
        }

        .custom-prompt-form button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Light mode */
        [data-theme="light"] .selection-action-bar {
          background: rgba(255, 255, 255, 0.98);
          border-color: rgba(0, 0, 0, 0.1);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
        }

        [data-theme="light"] .action-button {
          color: #374151;
        }

        [data-theme="light"] .action-button:hover {
          background: rgba(0, 0, 0, 0.05);
        }

        [data-theme="light"] .custom-prompt-form input {
          background: rgba(0, 0, 0, 0.03);
          border-color: rgba(0, 0, 0, 0.15);
          color: #1f2937;
        }
      `}</style>
    </div>
  )
}

const SelectionActionBar = memo(SelectionActionBarComponent)
export default SelectionActionBar
