// =============================================================================
// AI CONFIG MODAL COMPONENT
// =============================================================================
// Main modal for AI-assisted action configuration

import { memo, useCallback, useEffect, useReducer, useRef } from 'react'
import { X, AlertCircle, Sparkles, RotateCcw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { createFocusTrap } from '../../utils/accessibility'
import { MiniConstellationLoader } from '../MiniConstellationLoader'
import type {
  ActionNodeData,
  AIConfigResponse,
  AIStreamingState,
  AIClarifyingQuestion,
  AIGeneratedConfig,
  AIActionContext
} from '@shared/actionTypes'
import { useAIConfigStreaming } from '../../services/actionAIStreaming'
import { buildPrompt, parseAIResponse, validateConfig, MAX_QUESTION_ROUNDS } from '../../services/actionAIService'
import { aiConfigAnalytics } from '../../services/aiConfigAnalytics'
import { aiConfigLearning } from '../../services/aiConfigLearning'
import { AIConfigQuestions } from './AIConfigQuestions'
import { AIConfigPreview } from './AIConfigPreview'
import { AIConfigFeedback } from './AIConfigFeedback'
import { useConnectorStore } from '../../stores/connectorStore'

// =============================================================================
// STATE MACHINE
// =============================================================================

type AIConfigPhase =
  | 'idle'
  | 'streaming'
  | 'questions'
  | 'preview'
  | 'applied'
  | 'error'

interface AIConfigState {
  phase: AIConfigPhase
  streamState: AIStreamingState | null
  questions: AIClarifyingQuestion[]
  questionRound: number
  allAnswers: Record<string, string>
  config: AIGeneratedConfig | null
  suggestedTitle: string | null
  planSummary: string | null
  warnings: string[]
  error: string | null
  sessionId: string | null
}

type AIConfigAction =
  | { type: 'START'; sessionId: string }
  | { type: 'STREAM_UPDATE'; state: AIStreamingState }
  | { type: 'STREAM_COMPLETE'; response: AIConfigResponse }
  | { type: 'ANSWER_QUESTIONS'; answers: Record<string, string> }
  | { type: 'APPLY' }
  | { type: 'CANCEL' }
  | { type: 'RETRY' }
  | { type: 'ERROR'; error: string }
  | { type: 'DISMISS_FEEDBACK' }

const initialState: AIConfigState = {
  phase: 'idle',
  streamState: null,
  questions: [],
  questionRound: 0,
  allAnswers: {},
  config: null,
  suggestedTitle: null,
  planSummary: null,
  warnings: [],
  error: null,
  sessionId: null
}

function reducer(state: AIConfigState, action: AIConfigAction): AIConfigState {
  switch (action.type) {
    case 'START':
      return {
        ...initialState,
        phase: 'streaming',
        sessionId: action.sessionId,
        streamState: { phase: 'analyzing', partialConfig: {} }
      }

    case 'STREAM_UPDATE':
      return {
        ...state,
        streamState: action.state
      }

    case 'STREAM_COMPLETE': {
      const response = action.response

      // If questions, go to questions phase
      if (response.questions && response.questions.length > 0) {
        return {
          ...state,
          phase: 'questions',
          questions: response.questions,
          questionRound: state.questionRound + 1,
          planSummary: response.planSummary || null,
          streamState: null
        }
      }

      // If config, go directly to preview phase
      if (response.config) {
        const validation = validateConfig(response.config)
        return {
          ...state,
          phase: 'preview',
          config: response.config,
          suggestedTitle: response.suggestedTitle || null,
          planSummary: response.planSummary || response.reasoning,
          warnings: validation.warnings,
          streamState: null,
          error: validation.errors.length > 0 ? validation.errors.join(', ') : null
        }
      }

      // Neither questions nor config - error
      return {
        ...state,
        phase: 'error',
        error: response.reasoning || 'Could not generate configuration',
        streamState: null
      }
    }

    case 'ANSWER_QUESTIONS':
      return {
        ...state,
        phase: 'streaming',
        allAnswers: { ...state.allAnswers, ...action.answers },
        questions: [],
        streamState: { phase: 'analyzing', partialConfig: {} }
      }

    case 'APPLY':
      return {
        ...state,
        phase: 'applied'
      }

    case 'CANCEL':
      return initialState

    case 'RETRY':
      return {
        ...state,
        phase: 'idle',
        error: null,
        streamState: null,
        questions: [],
        config: null
      }

    case 'ERROR':
      return {
        ...state,
        phase: 'error',
        error: action.error,
        streamState: null
      }

    case 'DISMISS_FEEDBACK':
      return initialState

    default:
      return state
  }
}

// =============================================================================
// MODAL COMPONENT
// =============================================================================

interface AIConfigModalProps {
  nodeId: string
  data: ActionNodeData
  description: string
  context: AIActionContext
  onApply: (config: AIGeneratedConfig, title?: string) => void
  onApplyAndRun: (config: AIGeneratedConfig, title?: string) => void
  onClose: () => void
}

function AIConfigModalComponent({
  nodeId,
  data,
  description,
  context,
  onApply,
  onApplyAndRun,
  onClose
}: AIConfigModalProps): JSX.Element {
  const [state, dispatch] = useReducer(reducer, initialState)
  const {
    state: streamState,
    error: streamError,
    response: streamResponse,
    isStreaming: _isStreaming, // Reserved for future use
    start,
    cancel
  } = useAIConfigStreaming()
  const defaultConnector = useConnectorStore(s => s.getDefaultConnector?.())
  const modalRef = useRef<HTMLDivElement>(null)

  // Consolidated streaming state effect - handles all streaming updates in priority order
  // This prevents race conditions from separate effects firing in wrong order
  useEffect(() => {
    // Only process streaming events when in streaming phase
    if (state.phase !== 'streaming') return

    // Priority 1: Handle errors first (most important)
    if (streamError) {
      aiConfigAnalytics.trackError('timeout', streamError.message)
      dispatch({ type: 'ERROR', error: streamError.message })
      return
    }

    // Priority 2: Handle completion (response ready)
    if (streamResponse) {
      dispatch({ type: 'STREAM_COMPLETE', response: streamResponse })

      // Track analytics after dispatch
      if (streamResponse.questions) {
        aiConfigAnalytics.trackQuestionsShown(state.questionRound + 1, streamResponse.questions)
      } else if (streamResponse.config) {
        const validation = validateConfig(streamResponse.config)
        aiConfigAnalytics.trackPreviewShown(
          streamResponse.confidence,
          streamResponse.config.trigger.type,
          streamResponse.config.actions.length,
          validation.warnings.length > 0
        )
      }
      return
    }

    // Priority 3: Handle progress updates (lowest priority)
    if (streamState) {
      dispatch({ type: 'STREAM_UPDATE', state: streamState })
    }
  }, [streamState, streamError, streamResponse, state.phase, state.questionRound])

  // Start configuration on mount
  useEffect(() => {
    startConfiguration()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Focus trap for accessibility
  useEffect(() => {
    if (!modalRef.current) return

    const trap = createFocusTrap(modalRef.current)
    trap.activate()

    return () => {
      trap.deactivate()
    }
  }, [])

  const startConfiguration = useCallback(() => {
    // Check for connector
    if (!defaultConnector) {
      dispatch({ type: 'ERROR', error: 'No AI connector configured. Set one up in Settings.' })
      return
    }

    // Start session
    const sessionId = aiConfigAnalytics.startSession(
      nodeId,
      !!data.trigger && data.trigger.type !== 'manual',
      description.length
    )

    dispatch({ type: 'START', sessionId })

    // Start streaming
    start(description, context, defaultConnector.id)
  }, [defaultConnector, nodeId, data.trigger, description, context, start])

  // Handle question answers
  const handleAnswerQuestions = useCallback(async (answers: Record<string, string>) => {
    // Track answers
    aiConfigAnalytics.trackQuestionsAnswered(
      state.questionRound,
      Object.keys(answers).length,
      state.questions.filter(q => !answers[q.id]).length
    )

    // Check if max rounds reached
    if (state.questionRound >= MAX_QUESTION_ROUNDS) {
      dispatch({ type: 'ERROR', error: 'Too many clarifications needed. Try being more specific.' })
      return
    }

    dispatch({ type: 'ANSWER_QUESTIONS', answers })

    // Make another LLM call with answers
    const allAnswers = { ...state.allAnswers, ...answers }
    const { systemPrompt, userPrompt } = buildPrompt(description, context, allAnswers)

    try {
      const response = await window.api.llm.extract({
        systemPrompt,
        userPrompt,
        maxTokens: 2048
      })

      // Check for API errors first
      if (!response.success) {
        throw new Error(response.error?.message || 'LLM call failed')
      }

      // Ensure we have content to parse
      if (!response.data) {
        throw new Error('LLM returned empty response')
      }

      // Parse the content string (not the response object)
      const parsed = parseAIResponse(response.data)
      dispatch({ type: 'STREAM_COMPLETE', response: parsed })
    } catch (error) {
      dispatch({ type: 'ERROR', error: (error as Error).message })
    }
  }, [state.questionRound, state.questions, state.allAnswers, description, context])

  // Handle apply
  const handleApply = useCallback((useSuggestedTitle: boolean) => {
    if (!state.config) return

    // Track apply
    aiConfigAnalytics.trackApplied(state.config, state.questionRound)

    // Record learning outcome
    aiConfigLearning.recordOutcome(description, state.config, true, false)

    // Record prompt to history
    aiConfigLearning.recordPrompt(description, state.config.trigger.type)

    dispatch({ type: 'APPLY' })

    // Apply to parent
    const title = useSuggestedTitle && state.suggestedTitle ? state.suggestedTitle : undefined
    onApply(state.config, title)
  }, [state.config, state.questionRound, state.suggestedTitle, description, onApply])

  // Handle apply and run (apply config then execute the action immediately)
  const handleApplyAndRun = useCallback((useSuggestedTitle: boolean) => {
    if (!state.config) return

    // Track apply
    aiConfigAnalytics.trackApplied(state.config, state.questionRound)

    // Record learning outcome
    aiConfigLearning.recordOutcome(description, state.config, true, false)

    // Record prompt to history
    aiConfigLearning.recordPrompt(description, state.config.trigger.type)

    dispatch({ type: 'APPLY' })

    // Apply to parent and trigger execution
    const title = useSuggestedTitle && state.suggestedTitle ? state.suggestedTitle : undefined
    onApplyAndRun(state.config, title)
  }, [state.config, state.questionRound, state.suggestedTitle, description, onApplyAndRun])

  // Handle edit (apply but keep modal open for manual editing)
  const handleEdit = useCallback(() => {
    if (!state.config) return

    // Apply config first
    onApply(state.config)
    onClose()
  }, [state.config, onApply, onClose])

  // Handle cancel
  const handleCancel = useCallback(() => {
    cancel()
    aiConfigAnalytics.trackCancelled(
      state.phase === 'streaming' ? 'streaming' :
      state.phase === 'questions' ? 'questions' : 'preview'
    )
    dispatch({ type: 'CANCEL' })
    onClose()
  }, [cancel, state.phase, onClose])

  // Handle retry
  const handleRetry = useCallback(() => {
    dispatch({ type: 'RETRY' })
    startConfiguration()
  }, [startConfiguration])

  // Handle feedback dismiss
  const handleDismissFeedback = useCallback(() => {
    dispatch({ type: 'DISMISS_FEEDBACK' })
    onClose()
  }, [onClose])

  // Keyboard handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleCancel])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && handleCancel()}
    >
      <motion.div
        ref={modalRef}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-md gui-panel-bg glass-fluid border border-[var(--border-subtle)] rounded-lg shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-config-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span id="ai-config-modal-title" className="text-sm font-medium gui-text">AI Configuration</span>
          </div>
          <button
            onClick={handleCancel}
            className="p-1 hover:bg-[var(--surface-panel-secondary)] rounded transition-colors"
          >
            <X className="w-4 h-4 gui-text-secondary" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <AnimatePresence mode="wait">
            {/* Streaming state */}
            {state.phase === 'streaming' && state.streamState && (
              <motion.div
                key="streaming"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <StreamingView state={state.streamState} />
              </motion.div>
            )}

            {/* Questions state */}
            {state.phase === 'questions' && (
              <motion.div
                key="questions"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <AIConfigQuestions
                  questions={state.questions}
                  round={state.questionRound}
                  maxRounds={MAX_QUESTION_ROUNDS}
                  onSubmit={handleAnswerQuestions}
                  onCancel={handleCancel}
                />
              </motion.div>
            )}

            {/* Preview state */}
            {state.phase === 'preview' && state.config && (
              <motion.div
                key="preview"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <AIConfigPreview
                  config={state.config}
                  suggestedTitle={state.suggestedTitle || undefined}
                  currentTitle={data.title}
                  warnings={state.warnings}
                  onApply={handleApply}
                  onApplyAndRun={handleApplyAndRun}
                  onEdit={handleEdit}
                  onCancel={handleCancel}
                />
              </motion.div>
            )}

            {/* Applied state (with feedback) */}
            {state.phase === 'applied' && state.config && state.sessionId && (
              <motion.div
                key="applied"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
              >
                <AIConfigFeedback
                  sessionId={state.sessionId}
                  config={state.config}
                  questionRounds={state.questionRound}
                  onDismiss={handleDismissFeedback}
                />
              </motion.div>
            )}

            {/* Error state */}
            {state.phase === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <ErrorView
                  error={state.error || 'Unknown error'}
                  onRetry={handleRetry}
                  onCancel={handleCancel}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  )
}

// =============================================================================
// STREAMING VIEW
// =============================================================================

function StreamingView({ state }: { state: AIStreamingState }): JSX.Element {
  const phaseMessages: Record<string, string> = {
    analyzing: 'Analyzing your description...',
    trigger: 'Detected trigger...',
    conditions: 'Checking conditions...',
    steps: 'Building action steps...',
    complete: 'Configuration ready!'
  }

  return (
    <div className="space-y-4">
      {/* Loading indicator */}
      <div className="flex items-center gap-3">
        <MiniConstellationLoader size={40} />
        <div>
          <p className="text-sm gui-text">{state.message || phaseMessages[state.phase]}</p>
          {state.currentStep && (
            <p className="text-[10px] text-[var(--text-muted)]">Step {state.currentStep}</p>
          )}
        </div>
      </div>

      {/* Partial config preview */}
      {state.partialConfig && Object.keys(state.partialConfig).length > 0 && (
        <div className="space-y-2 pl-8">
          {state.partialConfig.trigger && (
            <div className="text-xs gui-text-secondary">
              <span className="text-purple-400">Trigger:</span>{' '}
              {state.partialConfig.trigger.type}
            </div>
          )}
          {state.partialConfig.conditions && state.partialConfig.conditions.length > 0 && (
            <div className="text-xs gui-text-secondary">
              <span className="text-blue-400">Conditions:</span>{' '}
              {state.partialConfig.conditions.length}
            </div>
          )}
          {state.partialConfig.actions && state.partialConfig.actions.length > 0 && (
            <div className="text-xs gui-text-secondary">
              <span className="text-emerald-400">Steps:</span>{' '}
              {state.partialConfig.actions.length}
            </div>
          )}
        </div>
      )}

      {/* Aria live region for screen readers */}
      <div role="status" aria-live="polite" className="sr-only">
        {state.message || phaseMessages[state.phase]}
      </div>
    </div>
  )
}

// =============================================================================
// ERROR VIEW
// =============================================================================

function ErrorView({
  error,
  onRetry,
  onCancel
}: {
  error: string
  onRetry: () => void
  onCancel: () => void
}): JSX.Element {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-3 bg-red-900/20 border border-red-500/30 rounded">
        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-red-300">{error}</p>
          <p className="text-[10px] text-red-400/70 mt-1">
            Try simplifying your description or configure manually.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs gui-text-secondary hover:gui-text rounded transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 rounded transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          Try Again
        </button>
      </div>
    </div>
  )
}

export const AIConfigModal = memo(AIConfigModalComponent)
