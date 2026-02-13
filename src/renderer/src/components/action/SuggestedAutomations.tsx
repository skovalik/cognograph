import { memo, useState, useEffect, useCallback } from 'react'
import { Zap, X, Plus, Sparkles } from 'lucide-react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useIsWorkflowActive } from '../../stores/workflowStore'
import { useGlassClassName } from '../../hooks/useGlassClassName'
import { analyzeHistoryForPatterns, resetAnalysisState, type AutomationSuggestion } from '../../services/automationSuggester'
import { createActionData } from '@shared/actionTypes'

/**
 * Floating panel that shows AI-suggested automations based on user activity patterns.
 * Monitors history for repetitive patterns and offers to create Action nodes.
 */
function SuggestedAutomationsComponent(): JSX.Element | null {
  const [suggestions, setSuggestions] = useState<AutomationSuggestion[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [isMinimized, setIsMinimized] = useState(false)

  const historyIndex = useWorkspaceStore((state) => state.historyIndex)
  const addNode = useWorkspaceStore((state) => state.addNode)
  const updateNode = useWorkspaceStore((state) => state.updateNode)

  // Check if a workflow (template execution) is in progress
  const isWorkflowActive = useIsWorkflowActive()

  // Get appropriate glass class based on user settings
  const glassClassName = useGlassClassName('overlays')

  // Reset analysis when workspace changes
  useEffect(() => {
    resetAnalysisState()
    setSuggestions([])
    setDismissed(new Set())
  }, [])

  // Periodically check for patterns
  useEffect(() => {
    const newSuggestions = analyzeHistoryForPatterns()
    if (newSuggestions.length > 0) {
      setSuggestions(prev => {
        // Merge new suggestions, avoiding duplicates
        const existingIds = new Set(prev.map(s => s.id))
        const novel = newSuggestions.filter(s => !existingIds.has(s.id))
        if (novel.length === 0) return prev
        return [...prev, ...novel].slice(-5) // Keep last 5
      })
    }
  }, [historyIndex])

  const handleDismiss = useCallback((id: string) => {
    setDismissed(prev => new Set(prev).add(id))
  }, [])

  const handleCreateAction = useCallback((suggestion: AutomationSuggestion) => {
    // Create an action node at the center of the viewport
    const viewport = useWorkspaceStore.getState().viewport
    const position = {
      x: (-viewport.x + window.innerWidth / 2) / viewport.zoom - 140,
      y: (-viewport.y + window.innerHeight / 2) / viewport.zoom - 70
    }

    const nodeId = addNode('action', position)

    // Configure the action node with the suggested trigger and steps
    const actionData = createActionData()
    updateNode(nodeId, {
      ...actionData,
      title: suggestion.title,
      description: suggestion.description,
      trigger: suggestion.trigger,
      actions: suggestion.steps,
      enabled: false // Start disabled so user can review
    })

    // Dismiss the suggestion
    handleDismiss(suggestion.id)
  }, [addNode, updateNode, handleDismiss])

  // Filter out dismissed suggestions
  const visibleSuggestions = suggestions.filter(s => !dismissed.has(s.id))

  // Don't show suggestions during template execution - reduces cognitive load
  // (Check placed after all hooks to comply with Rules of Hooks)
  if (isWorkflowActive) return null

  if (visibleSuggestions.length === 0) return null

  if (isMinimized) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsMinimized(false)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded ${glassClassName} gui-panel-bg border border-orange-500/30 shadow-lg hover:border-orange-500/60 transition-colors`}
          title={`${visibleSuggestions.length} automation suggestion${visibleSuggestions.length > 1 ? 's' : ''}`}
        >
          <Sparkles className="w-4 h-4 text-orange-400" />
          <span className="text-xs text-orange-400 font-medium">{visibleSuggestions.length}</span>
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Minimized button (visible, serves as anchor) */}
      <button
        onClick={() => setIsMinimized(true)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded ${glassClassName} gui-panel-bg border border-orange-500/50 shadow-lg transition-colors`}
        title={`${visibleSuggestions.length} automation suggestion${visibleSuggestions.length > 1 ? 's' : ''}`}
      >
        <Sparkles className="w-4 h-4 text-orange-400" />
        <span className="text-xs text-orange-400 font-medium">{visibleSuggestions.length}</span>
      </button>

      {/* Expanded panel (opens above button) */}
      <div className={`absolute bottom-full left-0 mb-2 w-72 max-h-80 overflow-y-auto ${glassClassName} gui-panel-bg border border-[var(--border-subtle)] rounded-lg shadow-xl`}>
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-xs font-medium gui-text-primary">Suggested Automations</span>
          </div>
          <button
            onClick={() => setIsMinimized(true)}
            className="p-0.5 rounded hover:bg-[var(--surface-panel-secondary)] transition-colors"
            title="Minimize"
          >
            <X className="w-3 h-3 gui-text-secondary" />
          </button>
        </div>

        {/* Suggestions */}
        <div className="p-2 space-y-2">
          {visibleSuggestions.map(suggestion => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onDismiss={() => handleDismiss(suggestion.id)}
              onCreate={() => handleCreateAction(suggestion)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

interface SuggestionCardProps {
  suggestion: AutomationSuggestion
  onDismiss: () => void
  onCreate: () => void
}

function SuggestionCard({ suggestion, onDismiss, onCreate }: SuggestionCardProps): JSX.Element {
  return (
    <div className="p-2 rounded border border-[var(--border-subtle)] bg-[var(--surface-panel)]/50 group">
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <Zap className="w-3 h-3 text-orange-400 shrink-0" />
          <span className="text-[11px] font-medium gui-text-primary truncate">{suggestion.title}</span>
        </div>
        <button
          onClick={onDismiss}
          className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--surface-panel-secondary)] transition-all shrink-0"
          title="Dismiss"
        >
          <X className="w-2.5 h-2.5 gui-text-secondary" />
        </button>
      </div>
      <p className="text-[10px] gui-text-secondary mt-1 line-clamp-2">{suggestion.description}</p>
      <div className="flex items-center justify-between mt-2">
        <span className="text-[9px] gui-text-secondary opacity-60">
          {Math.round(suggestion.confidence * 100)}% match
        </span>
        <button
          onClick={onCreate}
          className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-orange-500/20 text-orange-400 rounded hover:bg-orange-500/30 transition-colors"
        >
          <Plus className="w-2.5 h-2.5" />
          Create Action
        </button>
      </div>
    </div>
  )
}

export const SuggestedAutomations = memo(SuggestedAutomationsComponent)
