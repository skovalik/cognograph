/**
 * AI Editor Modal
 *
 * Main modal for the AI Workspace Editor.
 * Allows users to select mode, enter prompts, and generate/execute plans.
 */

import { memo, useState, useCallback, useRef, useEffect } from 'react'
import {
  X,
  GripHorizontal,
  Minimize2,
  Maximize2,
  Wand2,
  Pencil,
  LayoutGrid,
  Sparkles,
  Zap,
  MessageCircle,
  Target,
  Layers,
  Globe,
  AlertCircle,
  Bot
} from 'lucide-react'
import { useAIEditorStore } from '../../stores/aiEditorStore'
import { createFocusTrap } from '../../utils/accessibility'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { buildAIEditorContext } from '../../utils/contextBuilder'
import { buildPreviewState } from '../../utils/previewBuilder'
import { executeMutationPlan } from '../../utils/mutationExecutor'
import LoadingState from './LoadingState'
import PreviewControls from './PreviewControls'
import type { AIEditorMode, AIEditorScope } from '@shared/types'
import { AI_EDITOR_MODE_DESCRIPTIONS, AI_EDITOR_SCOPE_DESCRIPTIONS } from '@shared/types'

interface Position {
  x: number
  y: number
}

// Persist position between renders
let lastModalPosition: Position | null = null

const modeIcons: Record<AIEditorMode, React.ComponentType<{ className?: string }>> = {
  generate: Sparkles,
  edit: Pencil,
  organize: LayoutGrid,
  automate: Zap,
  ask: MessageCircle
}

const scopeIcons: Record<AIEditorScope, React.ComponentType<{ className?: string }>> = {
  selection: Target,
  canvas: Layers,
  workspace: Globe,
  single: Target,  // Internal scope - uses same icon as selection
  view: Layers     // Internal scope - uses same icon as canvas
}

function AIEditorModalComponent(): JSX.Element | null {
  const {
    isOpen,
    mode,
    prompt,
    scope,
    useAgentMode,
    isGeneratingPlan,
    generationError,
    currentPlan,
    previewState,
    isPreviewVisible,
    isExecutingPlan,
    executionError,
    streamingPhase,
    streamingText,
    openModal: _openModal,
    closeModal,
    setMode,
    setPrompt,
    setScope,
    setUseAgentMode,
    generatePlan,
    cancelGeneration,
    setPreviewState,
    togglePreviewVisibility
  } = useAIEditorStore()

  const nodes = useWorkspaceStore((state) => state.nodes)
  const edges = useWorkspaceStore((state) => state.edges)
  const selectedNodeIds = useWorkspaceStore((state) => state.selectedNodeIds)
  const viewport = useWorkspaceStore((state) => state.viewport)
  const themeSettings = useWorkspaceStore((state) => state.themeSettings)

  const [position, setPosition] = useState<Position>(() => {
    if (lastModalPosition) {
      return lastModalPosition
    }
    return {
      x: Math.max(50, (window.innerWidth - 400) / 2),
      y: Math.max(50, (window.innerHeight - 500) / 2)
    }
  })
  const [isDragging, setIsDragging] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [size, setSize] = useState({ width: 400, height: 500 })

  const dragStartPos = useRef<Position>({ x: 0, y: 0 })
  const modalRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Update lastModalPosition when position changes
  useEffect(() => {
    lastModalPosition = position
  }, [position])

  // Focus trap for accessibility
  useEffect(() => {
    if (!isOpen || !modalRef.current) return

    const trap = createFocusTrap(modalRef.current)
    trap.activate()

    return () => {
      trap.deactivate()
    }
  }, [isOpen])

  // Focus textarea when modal opens
  useEffect(() => {
    if (isOpen && textareaRef.current && !isGeneratingPlan && !currentPlan) {
      textareaRef.current.focus()
    }
  }, [isOpen, isGeneratingPlan, currentPlan])

  // Build preview when plan is generated
  useEffect(() => {
    if (currentPlan && !previewState) {
      const preview = buildPreviewState(
        currentPlan,
        nodes,
        edges,
        selectedNodeIds,
        viewport
      )
      setPreviewState(preview)
    }
  }, [currentPlan, previewState, nodes, edges, selectedNodeIds, viewport, setPreviewState])

  // Handle drag start
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsDragging(true)
      dragStartPos.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y
      }
    },
    [position]
  )

  // Handle drag move
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent): void => {
      const newX = Math.max(0, Math.min(window.innerWidth - 100, e.clientX - dragStartPos.current.x))
      const newY = Math.max(0, Math.min(window.innerHeight - 50, e.clientY - dragStartPos.current.y))
      setPosition({ x: newX, y: newY })
    }

    const handleMouseUp = (): void => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  // Handle generate
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return

    const context = buildAIEditorContext({
      mode,
      prompt,
      scope,
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

    await generatePlan(context)
  }, [mode, prompt, scope, nodes, edges, selectedNodeIds, viewport, themeSettings.mode, generatePlan])

  // Handle apply
  const handleApply = useCallback(async () => {
    if (!currentPlan) return
    await executeMutationPlan(currentPlan)
  }, [currentPlan])

  // Handle cancel
  const handleCancel = useCallback(() => {
    setPreviewState(null)
    closeModal()
  }, [setPreviewState, closeModal])

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent): void => {
      // Don't capture if typing in a text input
      const target = e.target as HTMLElement
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
        if (e.key === 'Escape') {
          handleCancel()
        } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          if (!isGeneratingPlan && prompt.trim()) {
            handleGenerate()
          }
        }
        return
      }

      if (e.key === 'Escape') {
        if (isGeneratingPlan) {
          cancelGeneration()
        } else {
          handleCancel()
        }
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        if (currentPlan) {
          handleApply()
        } else if (!isGeneratingPlan) {
          handleGenerate()
        }
      } else if (e.key.toLowerCase() === 'v' && previewState) {
        // Toggle preview visibility when preview is available
        togglePreviewVisibility()
      } else if (e.key.toLowerCase() === 'c' && isGeneratingPlan) {
        // Cancel generation
        cancelGeneration()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, currentPlan, isGeneratingPlan, previewState, prompt, handleCancel, handleApply, handleGenerate, cancelGeneration, togglePreviewVisibility])

  if (!isOpen) return null

  const bgClass = 'bg-[var(--surface-panel)]'
  const borderClass = 'border-[var(--border-subtle)]'
  const headerBgClass = 'bg-[var(--surface-panel-secondary)]'
  const textClass = 'text-[var(--text-primary)]'
  const textMutedClass = 'text-[var(--text-secondary)]'
  const inputBgClass = 'bg-[var(--surface-panel-secondary)] border-[var(--border-subtle)]'

  const titleId = 'ai-editor-modal-title'

  return (
    <div
      ref={modalRef}
      className={`fixed z-[100] ${bgClass} glass-fluid border ${borderClass} rounded-lg shadow-2xl overflow-hidden`}
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: isMinimized ? 44 : size.height,
        transition: isDragging ? 'none' : 'height 0.2s ease-out'
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {/* Title Bar */}
      <div
        className={`flex items-center justify-between px-3 py-2 ${headerBgClass} border-b ${borderClass} cursor-move select-none`}
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center gap-2">
          <GripHorizontal className={`w-4 h-4 ${textMutedClass}`} />
          <Wand2 className="w-4 h-4" style={{ color: 'var(--gui-accent-primary)' }} />
          <span id={titleId} className={`text-sm font-medium ${textClass}`}>AI Editor</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-[var(--surface-panel-secondary)] rounded transition-colors"
            title={isMinimized ? 'Expand' : 'Minimize'}
            aria-label={isMinimized ? 'Expand modal' : 'Minimize modal'}
            aria-expanded={!isMinimized}
          >
            {isMinimized ? (
              <Maximize2 className={`w-3.5 h-3.5 ${textMutedClass}`} />
            ) : (
              <Minimize2 className={`w-3.5 h-3.5 ${textMutedClass}`} />
            )}
          </button>
          <button
            onClick={handleCancel}
            className="p-1 hover:bg-[var(--surface-panel-secondary)] rounded transition-colors"
            title="Close (Esc)"
            aria-label="Close AI Editor"
          >
            <X className={`w-4 h-4 ${textMutedClass}`} />
          </button>
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
        <div className="h-[calc(100%-44px)] overflow-auto p-4">
          {isGeneratingPlan ? (
            <LoadingState
              mode={mode}
              streamingPhase={streamingPhase}
              streamingText={streamingText}
              onCancel={cancelGeneration}
            />
          ) : currentPlan && previewState ? (
            <PreviewControls
              preview={previewState}
              warnings={currentPlan.warnings}
              reasoning={currentPlan.reasoning}
              isExecuting={isExecutingPlan}
              isPreviewVisible={isPreviewVisible}
              onApply={handleApply}
              onCancel={handleCancel}
              onToggleVisibility={togglePreviewVisibility}
            />
          ) : (
            <div className="flex flex-col gap-4">
              {/* Mode Selection */}
              <div>
                <label className={`block text-xs font-medium ${textMutedClass} uppercase tracking-wide mb-2`}>
                  Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(AI_EDITOR_MODE_DESCRIPTIONS) as AIEditorMode[]).map((m) => {
                    const Icon = modeIcons[m]
                    const isSelected = mode === m
                    return (
                      <button
                        key={m}
                        onClick={() => setMode(m)}
                        className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
                          isSelected
                            ? ''
                            : `${borderClass} hover:bg-[var(--surface-panel-secondary)] ${textClass}`
                        }`}
                        style={isSelected ? {
                          borderColor: 'var(--gui-accent-primary)',
                          backgroundColor: 'color-mix(in srgb, var(--gui-accent-primary) 10%, transparent)',
                          color: 'var(--gui-accent-primary)'
                        } : undefined}
                        aria-pressed={isSelected}
                      >
                        <Icon className="w-4 h-4" />
                        <div className="text-left">
                          <div className="text-sm font-medium">{AI_EDITOR_MODE_DESCRIPTIONS[m].label}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Scope Selection */}
              <div>
                <label className={`block text-xs font-medium ${textMutedClass} uppercase tracking-wide mb-2`}>
                  Scope
                </label>
                <div className="flex gap-2">
                  {(Object.keys(AI_EDITOR_SCOPE_DESCRIPTIONS) as AIEditorScope[]).map((s) => {
                    const Icon = scopeIcons[s]
                    const isSelected = scope === s
                    const isDisabled = s === 'selection' && selectedNodeIds.length === 0
                    return (
                      <button
                        key={s}
                        onClick={() => !isDisabled && setScope(s)}
                        disabled={isDisabled}
                        className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg border transition-all ${
                          isDisabled
                            ? 'opacity-50 cursor-not-allowed'
                            : isSelected
                              ? ''
                              : `${borderClass} hover:bg-[var(--surface-panel-secondary)] ${textClass}`
                        }`}
                        style={!isDisabled && isSelected ? {
                          borderColor: 'var(--gui-accent-primary)',
                          backgroundColor: 'color-mix(in srgb, var(--gui-accent-primary) 10%, transparent)',
                          color: 'var(--gui-accent-primary)'
                        } : undefined}
                        title={AI_EDITOR_SCOPE_DESCRIPTIONS[s].description}
                        aria-pressed={isSelected}
                        aria-disabled={isDisabled}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-sm">{AI_EDITOR_SCOPE_DESCRIPTIONS[s].label}</span>
                      </button>
                    )
                  })}
                </div>
                {scope === 'selection' && selectedNodeIds.length === 0 && (
                  <p className="text-xs text-amber-500 mt-1">Select nodes on the canvas first</p>
                )}
              </div>

              {/* Agent Mode Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot
                    className={`w-4 h-4 ${useAgentMode ? '' : textMutedClass}`}
                    style={useAgentMode ? { color: 'var(--gui-accent-primary)' } : undefined}
                  />
                  <span className={`text-sm ${textClass}`}>Agent Mode</span>
                </div>
                <button
                  onClick={() => setUseAgentMode(!useAgentMode)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    useAgentMode ? '' : 'bg-[var(--surface-panel-secondary)]'
                  }`}
                  style={useAgentMode ? { backgroundColor: 'var(--gui-accent-primary)' } : undefined}
                  title={useAgentMode ? 'Agent mode: AI will use tools to explore workspace' : 'Standard mode: Faster but less context-aware'}
                  role="switch"
                  aria-checked={useAgentMode}
                  aria-label="Toggle Agent Mode"
                >
                  <div
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      useAgentMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <p className={`text-xs ${textMutedClass} -mt-2`}>
                {useAgentMode
                  ? 'AI will explore your workspace using tools before generating plan'
                  : 'Faster generation without workspace exploration'}
              </p>

              {/* Prompt Input */}
              <div>
                <label className={`block text-xs font-medium ${textMutedClass} uppercase tracking-wide mb-2`}>
                  Prompt
                </label>
                <textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={getPlaceholder(mode)}
                  className={`w-full h-32 p-3 rounded-lg border ${inputBgClass} ${textClass} placeholder:text-[var(--text-muted)] resize-none focus:outline-none focus:ring-2`}
                  style={{ ['--tw-ring-color' as string]: 'var(--gui-accent-primary)' }}
                  onFocus={(e) => e.currentTarget.style.setProperty('--tw-ring-color', 'var(--gui-accent-primary)')}
                  aria-label="Enter your AI prompt"
                />
                <p className={`text-xs ${textMutedClass} mt-1`}>
                  {AI_EDITOR_MODE_DESCRIPTIONS[mode].description}
                </p>
              </div>

              {/* Error Display */}
              {(generationError || executionError) && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{generationError || executionError}</span>
                </div>
              )}

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={!prompt.trim() || (scope === 'selection' && selectedNodeIds.length === 0)}
                className="flex items-center justify-center gap-2 p-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-2"
                style={{
                  borderColor: 'var(--gui-accent-primary)',
                  color: 'var(--gui-accent-primary)',
                  backgroundColor: 'transparent'
                }}
                onMouseEnter={(e) => {
                  if (!e.currentTarget.disabled) {
                    e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--gui-accent-primary) 15%, transparent)'
                  }
                }}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Wand2 className="w-4 h-4" />
                Generate Plan
              </button>

              <p className={`text-xs ${textMutedClass} text-center`}>
                Press Ctrl+Enter to generate
              </p>
            </div>
          )}
        </div>
      )}

      {/* Resize Handle */}
      {!isMinimized && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            const startX = e.clientX
            const startY = e.clientY
            const startWidth = size.width
            const startHeight = size.height

            const handleResize = (moveE: MouseEvent): void => {
              const newWidth = Math.max(350, startWidth + (moveE.clientX - startX))
              const newHeight = Math.max(400, startHeight + (moveE.clientY - startY))
              setSize({ width: newWidth, height: newHeight })
            }

            const handleResizeEnd = (): void => {
              document.removeEventListener('mousemove', handleResize)
              document.removeEventListener('mouseup', handleResizeEnd)
            }

            document.addEventListener('mousemove', handleResize)
            document.addEventListener('mouseup', handleResizeEnd)
          }}
        >
          <div className={`absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 ${borderClass}`} />
        </div>
      )}
    </div>
  )
}

function getPlaceholder(mode: AIEditorMode): string {
  switch (mode) {
    case 'generate':
      return 'Describe what to create...\ne.g., "Create a brainstorming cluster for marketing ideas"'
    case 'edit':
      return 'Describe what to change...\ne.g., "Expand this note with more details" or "Fix broken connections"'
    case 'organize':
      return 'Describe the desired layout...\ne.g., "Arrange nodes in a timeline from left to right"'
    case 'automate':
      return 'Describe the automation...\ne.g., "When I create a task, automatically link it to the current project"'
    case 'ask':
      return 'Ask a question about your workspace...\ne.g., "What are the main themes in my research notes?"'
    default:
      return 'Enter your prompt...'
  }
}

const AIEditorModal = memo(AIEditorModalComponent)
export default AIEditorModal
