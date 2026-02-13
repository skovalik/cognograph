/**
 * SuggestionList Sub-Component
 *
 * Shows recent prompts and suggestions from the learning system.
 * Keyboard navigable with ARIA listbox pattern.
 */

import { memo, useState, useCallback, useRef, useEffect } from 'react'
import { Clock, Sparkles, TrendingUp } from 'lucide-react'

interface Suggestion {
  id: string
  text: string
  type: 'recent' | 'learned' | 'suggested'
  score?: number
}

interface SuggestionListProps {
  suggestions: Suggestion[]
  recentPrompts: string[]
  onSelect: (text: string) => void
  isVisible: boolean
  highlightedIndex?: number
  onHighlightChange?: (index: number) => void
}

const MAX_SUGGESTIONS = 6

function SuggestionListComponent({
  suggestions,
  recentPrompts,
  onSelect,
  isVisible,
  highlightedIndex = -1,
  onHighlightChange
}: SuggestionListProps): JSX.Element | null {
  const listRef = useRef<HTMLDivElement>(null)

  // Combine recent prompts and suggestions, limit total
  const allItems: Suggestion[] = [
    // Recent prompts first (max 3)
    ...recentPrompts.slice(0, 3).map((text, i) => ({
      id: `recent-${i}`,
      text,
      type: 'recent' as const
    })),
    // Then suggestions
    ...suggestions.slice(0, MAX_SUGGESTIONS - Math.min(recentPrompts.length, 3))
  ]

  // Keyboard navigation
  useEffect(() => {
    if (!isVisible || allItems.length === 0) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const next = highlightedIndex < allItems.length - 1 ? highlightedIndex + 1 : 0
        onHighlightChange?.(next)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const prev = highlightedIndex > 0 ? highlightedIndex - 1 : allItems.length - 1
        onHighlightChange?.(prev)
      } else if (e.key === 'Enter' && highlightedIndex >= 0) {
        e.preventDefault()
        const item = allItems[highlightedIndex]
        if (item) {
          onSelect(item.text)
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isVisible, allItems, highlightedIndex, onHighlightChange, onSelect])

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('.suggestion-item')
      items[highlightedIndex]?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightedIndex])

  if (!isVisible || allItems.length === 0) {
    return null
  }

  const getIcon = (type: Suggestion['type']) => {
    switch (type) {
      case 'recent':
        return <Clock className="suggestion-icon recent" />
      case 'learned':
        return <TrendingUp className="suggestion-icon learned" />
      case 'suggested':
        return <Sparkles className="suggestion-icon suggested" />
      default:
        return null
    }
  }

  const getLabel = (type: Suggestion['type']) => {
    switch (type) {
      case 'recent':
        return 'Recent'
      case 'learned':
        return 'Learned'
      case 'suggested':
        return 'Suggested'
      default:
        return ''
    }
  }

  return (
    <div className="suggestion-list" ref={listRef} role="listbox" aria-label="Prompt suggestions">
      {allItems.map((item, index) => (
        <button
          key={item.id}
          className={`suggestion-item ${highlightedIndex === index ? 'highlighted' : ''}`}
          onClick={() => onSelect(item.text)}
          onMouseEnter={() => onHighlightChange?.(index)}
          role="option"
          aria-selected={highlightedIndex === index}
        >
          {getIcon(item.type)}
          <span className="suggestion-text">{item.text}</span>
          <span className="suggestion-type">{getLabel(item.type)}</span>
          {item.score !== undefined && (
            <span className="suggestion-score">{Math.round(item.score * 100)}%</span>
          )}
        </button>
      ))}

      <style>{`
        .suggestion-list {
          background: rgba(25, 25, 25, 0.98);
          border: 1px solid #444;
          border-radius: 8px;
          padding: 4px;
          margin-top: 4px;
          max-height: 240px;
          overflow-y: auto;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
        }

        .suggestion-item {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 8px 10px;
          background: transparent;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          text-align: left;
          color: #e0e0e0;
          font-size: 13px;
          transition: background 0.1s ease;
        }

        .suggestion-item:hover,
        .suggestion-item.highlighted {
          background: rgba(255, 255, 255, 0.08);
        }

        .suggestion-icon {
          width: 14px;
          height: 14px;
          flex-shrink: 0;
        }

        .suggestion-icon.recent {
          color: #888;
        }

        .suggestion-icon.learned {
          color: #4ade80;
        }

        .suggestion-icon.suggested {
          color: #a78bfa;
        }

        .suggestion-text {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .suggestion-type {
          font-size: 10px;
          color: #666;
          text-transform: uppercase;
          flex-shrink: 0;
        }

        .suggestion-score {
          font-size: 10px;
          color: #4ade80;
          flex-shrink: 0;
          font-weight: 500;
        }

        /* Light mode */
        [data-theme="light"] .suggestion-list {
          background: rgba(255, 255, 255, 0.98);
          border-color: #e5e7eb;
        }

        [data-theme="light"] .suggestion-item {
          color: #374151;
        }

        [data-theme="light"] .suggestion-item:hover,
        [data-theme="light"] .suggestion-item.highlighted {
          background: rgba(0, 0, 0, 0.05);
        }
      `}</style>
    </div>
  )
}

const SuggestionList = memo(SuggestionListComponent)
export default SuggestionList
