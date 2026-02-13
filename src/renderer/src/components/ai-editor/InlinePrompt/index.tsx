/**
 * InlinePrompt Component
 *
 * Primary entry point for AI Editor via the '/' key.
 * Combines prompt input, mode indicator, suggestions, and streaming preview.
 */

import { memo, useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useAIEditorStore } from '../../../stores/aiEditorStore'
import { useWorkspaceStore } from '../../../stores/workspaceStore'
import { buildAIEditorContext } from '../../../utils/contextBuilder'
import { executeMutationPlan } from '../../../utils/mutationExecutor'
import { inferModeFromPrompt } from '../../../utils/modeInference'
import { aiConfigLearning } from '../../../services/aiConfigLearning'
import PromptInput from './PromptInput'
import ModeIndicator from './ModeIndicator'
import SuggestionList from './SuggestionList'
import StreamingPreview from './StreamingPreview'
import type { AIEditorMode } from '@shared/types'

interface InlinePromptProps {
  position: { x: number; y: number }
  onClose: () => void
}

function InlinePromptComponent({ position, onClose }: InlinePromptProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)

  // Store state
  const {
    mode,
    prompt,
    streamingPhase,
    streamingText,
    currentPlan,
    generationError,
    setMode,
    setPrompt,
    generatePlanStreaming,
    cancelGeneration
  } = useAIEditorStore()

  const nodes = useWorkspaceStore((s) => s.nodes)
  const edges = useWorkspaceStore((s) => s.edges)
  const selectedNodeIds = useWorkspaceStore((s) => s.selectedNodeIds)
  const viewport = useWorkspaceStore((s) => s.viewport)
  const themeSettings = useWorkspaceStore((s) => s.themeSettings)

  // Local state
  const [localPrompt, setLocalPrompt] = useState(prompt)
  const [showSuggestions, setShowSuggestions] = useState(true)
  const [highlightedSuggestion, setHighlightedSuggestion] = useState(-1)
  const [inferredMode, setInferredMode] = useState(false)

  // Load recent prompts from learning service
  const recentPrompts = useMemo(() => {
    const history = aiConfigLearning.getPromptHistory()
    // Return top prompts (sorted by lastUsed)
    return history
      .filter(h => h.wasSuccessful)
      .slice(0, 5)
      .map(h => h.prompt)
  }, [])

  // Infer mode from prompt
  useEffect(() => {
    if (localPrompt.trim()) {
      const detected = inferModeFromPrompt(localPrompt)
      if (detected && detected !== mode) {
        setMode(detected)
        setInferredMode(true)
      }
    }
  }, [localPrompt, mode, setMode])

  // Handle prompt change
  const handlePromptChange = useCallback((value: string) => {
    setLocalPrompt(value)
    setPrompt(value)
    setShowSuggestions(value.trim().length === 0)
    setHighlightedSuggestion(-1)
  }, [setPrompt])

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!localPrompt.trim()) return

    setShowSuggestions(false)

    // Build context
    const context = buildAIEditorContext({
      mode,
      prompt: localPrompt,
      scope: selectedNodeIds.length > 0 ? 'selection' : 'canvas',
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

    // Use streaming by default
    await generatePlanStreaming(context)
  }, [localPrompt, mode, nodes, edges, selectedNodeIds, viewport, themeSettings.mode, generatePlanStreaming])

  // Handle apply — execute the generated plan and close the prompt
  const handleApply = useCallback(async () => {
    if (!currentPlan) return
    await executeMutationPlan(currentPlan)
    onClose()
  }, [currentPlan, onClose])

  // Handle cancel
  const handleCancel = useCallback(() => {
    if (streamingPhase !== 'idle' && streamingPhase !== 'complete') {
      cancelGeneration()
    } else {
      onClose()
    }
  }, [streamingPhase, cancelGeneration, onClose])

  // Handle mode change
  const handleModeChange = useCallback((newMode: AIEditorMode) => {
    setMode(newMode)
    setInferredMode(false)
  }, [setMode])

  // Handle suggestion select
  const handleSuggestionSelect = useCallback((text: string) => {
    setLocalPrompt(text)
    setPrompt(text)
    setShowSuggestions(false)
  }, [setPrompt])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // Parse streaming operations (simplified - would come from store in full impl)
  const streamingOperations: any[] = []

  const isGenerating = !['idle', 'complete', 'cancelled', 'error'].includes(streamingPhase)

  return (
    <div
      ref={containerRef}
      className="inline-prompt"
      style={{
        left: position.x,
        top: position.y
      }}
      role="dialog"
      aria-label="AI Editor inline prompt"
    >
      <div className="inline-prompt-header">
        <ModeIndicator
          mode={mode}
          onModeChange={handleModeChange}
          inferredFromPrompt={inferredMode}
        />
      </div>

      <PromptInput
        value={localPrompt}
        onChange={handlePromptChange}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isGenerating={isGenerating}
        placeholder={getPlaceholder(mode)}
      />

      {showSuggestions && (
        <SuggestionList
          suggestions={[]}
          recentPrompts={recentPrompts}
          onSelect={handleSuggestionSelect}
          isVisible={showSuggestions && !isGenerating}
          highlightedIndex={highlightedSuggestion}
          onHighlightChange={setHighlightedSuggestion}
        />
      )}

      {streamingPhase !== 'idle' && (
        <StreamingPreview
          phase={streamingPhase}
          operations={streamingOperations}
          onCancel={handleCancel}
          onApply={handleApply}
          error={generationError}
        />
      )}

      <style>{`
        .inline-prompt {
          position: fixed;
          z-index: var(--z-modals, 100);
          width: 400px;
          max-width: calc(100vw - 40px);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .inline-prompt-header {
          display: flex;
          align-items: center;
          gap: 8px;
        }
      `}</style>
    </div>
  )
}

function getPlaceholder(mode: AIEditorMode): string {
  switch (mode) {
    case 'generate':
      return 'Create something new... (e.g., "brainstorm marketing ideas")'
    case 'edit':
      return 'Edit or refine... (e.g., "make this more concise")'
    case 'organize':
      return 'Organize layout... (e.g., "arrange by date")'
    case 'automate':
      return 'Create automation... (e.g., "when task done, notify")'
    case 'ask':
      return 'Ask a question... (e.g., "summarize these notes")'
    default:
      return 'What would you like to do?'
  }
}

const InlinePrompt = memo(InlinePromptComponent)
export default InlinePrompt
