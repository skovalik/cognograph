/**
 * ModeIndicator Sub-Component
 *
 * Shows the inferred AI operation mode based on prompt keywords.
 * Clickable to manually change mode. Keyboard accessible.
 */

import { memo, useState, useCallback, useRef, useEffect } from 'react'
import {
  Sparkles,
  Pencil,
  LayoutGrid,
  Zap,
  MessageCircle,
  ChevronDown
} from 'lucide-react'
import type { AIEditorMode } from '@shared/types'
import { AI_EDITOR_MODE_DESCRIPTIONS } from '@shared/types'

interface ModeIndicatorProps {
  mode: AIEditorMode
  onModeChange: (mode: AIEditorMode) => void
  inferredFromPrompt?: boolean
}

const modeIcons: Record<AIEditorMode, React.ComponentType<{ className?: string }>> = {
  generate: Sparkles,
  edit: Pencil,
  organize: LayoutGrid,
  automate: Zap,
  ask: MessageCircle
}

const modeColors: Record<AIEditorMode, string> = {
  generate: '#a78bfa',
  edit: '#60a5fa',
  organize: '#4ade80',
  automate: '#fbbf24',
  ask: '#f472b6'
}

function ModeIndicatorComponent({
  mode,
  onModeChange,
  inferredFromPrompt = false
}: ModeIndicatorProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const Icon = modeIcons[mode]
  const modeInfo = AI_EDITOR_MODE_DESCRIPTIONS[mode]
  const color = modeColors[mode]

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        buttonRef.current?.focus()
      } else if (e.key === 'ArrowDown' && isOpen) {
        e.preventDefault()
        const modes = Object.keys(AI_EDITOR_MODE_DESCRIPTIONS) as AIEditorMode[]
        const currentIndex = modes.indexOf(mode)
        const nextIndex = (currentIndex + 1) % modes.length
        onModeChange(modes[nextIndex])
      } else if (e.key === 'ArrowUp' && isOpen) {
        e.preventDefault()
        const modes = Object.keys(AI_EDITOR_MODE_DESCRIPTIONS) as AIEditorMode[]
        const currentIndex = modes.indexOf(mode)
        const prevIndex = (currentIndex - 1 + modes.length) % modes.length
        onModeChange(modes[prevIndex])
      }
    },
    [isOpen, mode, onModeChange]
  )

  const handleModeSelect = useCallback(
    (newMode: AIEditorMode) => {
      onModeChange(newMode)
      setIsOpen(false)
      buttonRef.current?.focus()
    },
    [onModeChange]
  )

  return (
    <div className="mode-indicator" ref={dropdownRef} onKeyDown={handleKeyDown}>
      <button
        ref={buttonRef}
        className="mode-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`Mode: ${modeInfo.label}. Click to change.`}
        style={{ '--mode-color': color } as React.CSSProperties}
      >
        <Icon className="mode-icon" />
        <span className="mode-label">{modeInfo.label}</span>
        {inferredFromPrompt && <span className="inferred-badge">auto</span>}
        <ChevronDown className={`chevron ${isOpen ? 'open' : ''}`} />
      </button>

      {isOpen && (
        <div className="mode-dropdown" role="listbox" aria-label="Select mode">
          {(Object.keys(AI_EDITOR_MODE_DESCRIPTIONS) as AIEditorMode[]).map((m) => {
            const ModeIcon = modeIcons[m]
            const info = AI_EDITOR_MODE_DESCRIPTIONS[m]
            const isSelected = m === mode

            return (
              <button
                key={m}
                className={`mode-option ${isSelected ? 'selected' : ''}`}
                onClick={() => handleModeSelect(m)}
                role="option"
                aria-selected={isSelected}
                style={{ '--option-color': modeColors[m] } as React.CSSProperties}
              >
                <ModeIcon className="option-icon" />
                <div className="option-content">
                  <span className="option-label">{info.label}</span>
                  <span className="option-description">{info.description}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <style>{`
        .mode-indicator {
          position: relative;
        }

        .mode-button {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          color: var(--mode-color);
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .mode-button:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: var(--mode-color);
        }

        .mode-icon {
          width: 14px;
          height: 14px;
        }

        .mode-label {
          font-weight: 500;
        }

        .inferred-badge {
          font-size: 9px;
          padding: 1px 4px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          color: #888;
          text-transform: uppercase;
        }

        .chevron {
          width: 12px;
          height: 12px;
          color: #666;
          transition: transform 0.15s ease;
        }

        .chevron.open {
          transform: rotate(180deg);
        }

        .mode-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          margin-top: 4px;
          background: rgba(30, 30, 30, 0.98);
          border: 1px solid #444;
          border-radius: 8px;
          padding: 4px;
          min-width: 200px;
          z-index: 100;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        }

        .mode-option {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          width: 100%;
          padding: 8px;
          background: transparent;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          text-align: left;
          transition: all 0.1s ease;
        }

        .mode-option:hover {
          background: rgba(255, 255, 255, 0.08);
        }

        .mode-option.selected {
          background: rgba(255, 255, 255, 0.1);
        }

        .option-icon {
          width: 16px;
          height: 16px;
          color: var(--option-color);
          flex-shrink: 0;
          margin-top: 2px;
        }

        .option-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .option-label {
          font-size: 13px;
          font-weight: 500;
          color: #f0f0f0;
        }

        .option-description {
          font-size: 11px;
          color: #888;
          line-height: 1.3;
        }

        /* Light mode */
        [data-theme="light"] .mode-button {
          background: rgba(0, 0, 0, 0.03);
          border-color: rgba(0, 0, 0, 0.1);
        }

        [data-theme="light"] .mode-button:hover {
          background: rgba(0, 0, 0, 0.06);
        }

        [data-theme="light"] .mode-dropdown {
          background: rgba(255, 255, 255, 0.98);
          border-color: #e5e7eb;
        }

        [data-theme="light"] .option-label {
          color: #111827;
        }

        [data-theme="light"] .option-description {
          color: #6b7280;
        }
      `}</style>
    </div>
  )
}

const ModeIndicator = memo(ModeIndicatorComponent)
export default ModeIndicator
