/**
 * CommandBar -- Fixed-bottom natural language command input
 *
 * Always visible when enabled. User types commands that get interpreted
 * by the Canvas Agent and converted to proposals (ghost nodes).
 *
 * Features:
 * - "/" keyboard shortcut to focus
 * - Escape to blur and dismiss suggestions
 * - Up arrow to navigate command history
 * - Real-time suggestions (recent, template, AI)
 * - Optimistic intent preview before LLM response
 * - Parsing spinner during interpretation
 */

import { memo, useState, useRef, useCallback, useEffect } from 'react'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { ScrollArea } from '../ui/scroll-area'
import {
  Terminal, Send, Loader2, ChevronUp, Clock, Sparkles, Command as CommandIcon, ArrowRight
} from 'lucide-react'
import { useCommandBarStore } from '../../stores/commandBarStore'
import type { CommandSuggestion } from '@shared/types/bridge'
import { cn } from '../../lib/utils'

// =============================================================================
// HELPERS
// =============================================================================

function isInputFocused(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || (el as HTMLElement).isContentEditable
}

function isModalOpen(): boolean {
  return document.querySelector('[role="dialog"]') !== null ||
         document.querySelector('[data-radix-popper-content-wrapper]') !== null
}

function SuggestionIcon({ source }: { source: string }): JSX.Element {
  switch (source) {
    case 'recent': return <Clock className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
    case 'template': return <CommandIcon className="w-3 h-3 text-blue-400" />
    case 'ai-completion': return <Sparkles className="w-3 h-3 text-purple-400" />
    case 'contextual': return <ArrowRight className="w-3 h-3 text-green-400" />
    default: return <Terminal className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

interface CommandBarProps {
  onToggle?: () => void
}

function CommandBarComponent({ onToggle }: CommandBarProps): JSX.Element {
  const [inputValue, setInputValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [historyIndex, setHistoryIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  const submitCommand = useCommandBarStore(s => s.submitCommand)
  const currentStatus = useCommandBarStore(s => s.currentStatus)
  const suggestions = useCommandBarStore(s => s.suggestions)
  const history = useCommandBarStore(s => s.history)
  const isVisible = useCommandBarStore(s => s.isVisible)
  const loadSuggestions = useCommandBarStore(s => s.loadSuggestions)
  const optimisticIntent = useCommandBarStore(s => s.optimisticIntent)

  // Keyboard shortcut: / to focus (when not already in an input)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === '/' && !isInputFocused() && !isModalOpen()) {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        inputRef.current?.blur()
        setShowSuggestions(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSubmit = useCallback(() => {
    if (!inputValue.trim() || currentStatus === 'parsing') return
    submitCommand(inputValue.trim())
    setInputValue('')
    setShowSuggestions(false)
    setHistoryIndex(-1)
  }, [inputValue, currentStatus, submitCommand])

  const handleInputChange = useCallback((value: string) => {
    setInputValue(value)
    setShowSuggestions(value.length > 0)
    loadSuggestions(value)
    setHistoryIndex(-1)
  }, [loadSuggestions])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      // Navigate command history
      if (history.length > 0) {
        const nextIndex = Math.min(historyIndex + 1, history.length - 1)
        setHistoryIndex(nextIndex)
        setInputValue(history[nextIndex].raw)
      }
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex > 0) {
        const nextIndex = historyIndex - 1
        setHistoryIndex(nextIndex)
        setInputValue(history[nextIndex].raw)
      } else if (historyIndex === 0) {
        setHistoryIndex(-1)
        setInputValue('')
      }
    }
  }, [handleSubmit, history, historyIndex])

  if (!isVisible) return <></>

  return (
    <div
      className="fixed bottom-0 left-0 right-0 px-4 pb-3"
      style={{ zIndex: 45 }}
      role="search"
      aria-label="Bridge command bar"
    >
      {/* Suggestions popover (above input) */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          className="mb-1 rounded-lg border shadow-lg p-1 max-w-[600px] mx-auto"
          style={{
            background: 'var(--popover, var(--surface-panel))',
            borderColor: 'var(--border-default, rgba(255,255,255,0.06))',
          }}
        >
          <ScrollArea className="max-h-[200px]">
            {suggestions.map((suggestion, i) => (
              <button
                key={`${suggestion.source}-${i}`}
                className="w-full text-left px-3 py-1.5 rounded text-xs hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => {
                  setInputValue(suggestion.text)
                  inputRef.current?.focus()
                }}
              >
                <SuggestionIcon source={suggestion.source} />
                <span className="flex-1" style={{ color: 'var(--text-primary)' }}>
                  {suggestion.text}
                </span>
                <Badge variant="outline" className="text-[9px] px-1">
                  {suggestion.source}
                </Badge>
              </button>
            ))}
          </ScrollArea>
        </div>
      )}

      {/* Main input bar */}
      <div className="max-w-[600px] mx-auto">
        <div
          className="flex items-center gap-2 rounded-xl border backdrop-blur-xl px-3 py-2"
          style={{
            background: 'var(--popover, var(--surface-panel))',
            borderColor: 'var(--border-default, rgba(255,255,255,0.06))',
            boxShadow: 'var(--shadow-panel, 0 4px 12px rgba(0,0,0,0.3))',
            opacity: 0.95,
          }}
        >
          {/* Status indicator */}
          <div className="flex-shrink-0">
            {currentStatus === 'parsing' ? (
              <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
            ) : (
              <Terminal className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            )}
          </div>

          {/* Input */}
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => setShowSuggestions(inputValue.length > 0)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            onKeyDown={handleKeyDown}
            placeholder='Type a command... (press / to focus)'
            className="border-0 bg-transparent focus-visible:ring-0 text-sm"
            style={{ color: 'var(--text-primary)' }}
            disabled={currentStatus === 'parsing'}
            aria-label="Bridge command input"
          />

          {/* Submit button */}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 flex-shrink-0"
            onClick={handleSubmit}
            disabled={!inputValue.trim() || currentStatus === 'parsing'}
          >
            <Send className="w-4 h-4" />
          </Button>

          {/* History button */}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 flex-shrink-0"
            onClick={() => setShowSuggestions(!showSuggestions)}
          >
            <ChevronUp className="w-4 h-4" />
          </Button>
        </div>

        {/* Parsing status indicator with optimistic preview */}
        {currentStatus === 'parsing' && (
          <div className="mt-1 text-center">
            <Badge variant="outline" className="text-[10px] animate-pulse">
              <Sparkles className="w-3 h-3 mr-1" />
              {optimisticIntent && optimisticIntent !== 'unknown'
                ? `Recognized: ${optimisticIntent.replace('-', ' ')}... refining...`
                : 'Interpreting command...'}
            </Badge>
          </div>
        )}

        {/* Error display */}
        {currentStatus === 'failed' && (
          <div className="mt-1 text-center">
            <Badge variant="outline" className="text-[10px] text-red-400 border-red-500/30">
              {useCommandBarStore.getState().currentCommand?.error || 'Command failed'}
            </Badge>
          </div>
        )}
      </div>
    </div>
  )
}

export const CommandBar = memo(CommandBarComponent)
