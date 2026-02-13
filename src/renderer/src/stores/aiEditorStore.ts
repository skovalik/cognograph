/**
 * AI Editor Store
 *
 * Zustand store for managing AI Workspace Editor state.
 * Handles modal UI, plan generation, preview state, and execution.
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type {
  AIEditorMode,
  AIEditorScope,
  AIEditorState,
  MutationPlan,
  MutationPreviewState,
  AIEditorContext,
  StreamingPhase,
  ConversationMessage
} from '@shared/types'

// -----------------------------------------------------------------------------
// Store Interface
// -----------------------------------------------------------------------------

interface AIEditorActions {
  // Modal actions
  openModal: (options?: { mode?: AIEditorMode; scope?: AIEditorScope; prompt?: string; targetNodeId?: string }) => void
  closeModal: () => void
  openSidebar: () => void
  closeSidebar: () => void
  toggleSidebar: () => void
  setMode: (mode: AIEditorMode) => void
  setPrompt: (prompt: string) => void
  setScope: (scope: AIEditorScope) => void
  setUseAgentMode: (useAgent: boolean) => void

  // Plan generation
  generatePlan: (context: AIEditorContext) => Promise<void>
  generatePlanStreaming: (context: AIEditorContext) => Promise<void>
  cancelGeneration: () => Promise<void>
  clearPlan: () => void

  // Preview
  setPreviewState: (preview: MutationPreviewState | null) => void
  togglePreviewVisibility: () => void

  // Execution
  startExecution: () => void
  completeExecution: () => void
  failExecution: (error: string) => void
  registerTempIdMapping: (tempId: string, realId: string) => void
  resolveId: (idOrTempId: string) => string

  // Conversation refinement
  addToConversation: (message: Omit<ConversationMessage, 'timestamp'>) => void
  clearConversation: () => void
  getConversationContext: () => string

  // Reset
  resetState: () => void
}

type AIEditorStore = AIEditorState & AIEditorActions

// -----------------------------------------------------------------------------
// Initial State
// -----------------------------------------------------------------------------

const initialState: AIEditorState = {
  isOpen: false,
  isSidebarOpen: false,
  mode: 'generate',
  prompt: '',
  scope: 'selection',
  useAgentMode: true, // Default to agent mode for smarter plans
  isGeneratingPlan: false,
  generationError: null,
  currentPlan: null,
  streamingPhase: 'idle',
  streamingText: '',
  streamingRequestId: null,
  previewState: null,
  isPreviewVisible: true,
  isExecutingPlan: false,
  executionError: null,
  tempIdToRealId: new Map(),
  conversationHistory: []
}

// -----------------------------------------------------------------------------
// Store Implementation
// -----------------------------------------------------------------------------

export const useAIEditorStore = create<AIEditorStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      // Initial state
      ...initialState,

      // ---------------------------------------------------------------------
      // Modal Actions
      // ---------------------------------------------------------------------

      openModal: (options) => {
        set((state) => {
          state.isOpen = true
          if (options?.mode) state.mode = options.mode
          if (options?.scope) state.scope = options.scope
          if (options?.prompt) state.prompt = options.prompt
          state.targetNodeId = options?.targetNodeId
          // Clear previous state when opening
          state.currentPlan = null
          state.previewState = null
          state.generationError = null
          state.executionError = null
          // Reset streaming state
          state.streamingPhase = 'idle'
          state.streamingText = ''
          state.streamingRequestId = null
        })
      },

      closeModal: () => {
        set((state) => {
          state.isOpen = false
          // Clear plan and preview when closing
          state.currentPlan = null
          state.previewState = null
          state.generationError = null
          state.executionError = null
          state.prompt = ''
          // Reset streaming state
          state.streamingPhase = 'idle'
          state.streamingText = ''
          state.streamingRequestId = null
          // Clear conversation history
          state.conversationHistory = []
        })
      },

      openSidebar: () => {
        set((state) => {
          state.isSidebarOpen = true
        })
      },

      closeSidebar: () => {
        set((state) => {
          state.isSidebarOpen = false
        })
      },

      toggleSidebar: () => {
        set((state) => {
          state.isSidebarOpen = !state.isSidebarOpen
        })
      },

      setMode: (mode) => {
        set((state) => {
          state.mode = mode
        })
      },

      setPrompt: (prompt) => {
        set((state) => {
          state.prompt = prompt
        })
      },

      setScope: (scope) => {
        set((state) => {
          state.scope = scope
        })
      },

      setUseAgentMode: (useAgent) => {
        set((state) => {
          state.useAgentMode = useAgent
        })
      },

      // ---------------------------------------------------------------------
      // Plan Generation
      // ---------------------------------------------------------------------

      generatePlan: async (context) => {
        const useAgentMode = get().useAgentMode

        set((state) => {
          state.isGeneratingPlan = true
          state.generationError = null
          state.currentPlan = null
          state.previewState = null
        })

        try {
          // Check if API is available (requires app restart after code changes)
          const api = window.api?.aiEditor
          if (!api?.generatePlan || !api?.generatePlanWithAgent) {
            throw new Error('AI Editor API not available. Please restart the application.')
          }

          // Use agent mode or standard mode based on setting
          const result = useAgentMode
            ? await api.generatePlanWithAgent(context)
            : await api.generatePlan(context)

          if (result.success && result.data) {
            set((state) => {
              state.currentPlan = result.data as MutationPlan
              state.isGeneratingPlan = false
            })
          } else {
            set((state) => {
              state.generationError = result.error?.message || 'Failed to generate plan'
              state.isGeneratingPlan = false
            })
          }
        } catch (error) {
          set((state) => {
            state.generationError = String(error)
            state.isGeneratingPlan = false
          })
        }
      },

      generatePlanStreaming: async (context) => {
        const requestId = `plan-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

        set((state) => {
          state.isGeneratingPlan = true
          state.generationError = null
          state.currentPlan = null
          state.previewState = null
          state.streamingPhase = 'connecting'
          state.streamingText = ''
          state.streamingRequestId = requestId
        })

        const api = window.api?.aiEditor
        if (!api?.generatePlanStreaming) {
          set((state) => {
            state.generationError = 'Streaming API not available. Please restart the application.'
            state.isGeneratingPlan = false
            state.streamingPhase = 'error'
          })
          return
        }

        // Set up event listeners
        const cleanupFns: Array<() => void> = []

        const cleanup = () => {
          for (const fn of cleanupFns) {
            fn()
          }
        }

        // Listen for chunks
        if (api.onPlanChunk) {
          const unsubChunk = api.onPlanChunk((chunk) => {
            if (chunk.requestId !== requestId) return
            set((state) => {
              state.streamingText += chunk.content
            })
          })
          cleanupFns.push(unsubChunk)
        }

        // Listen for phase updates
        if (api.onPlanPhase) {
          const unsubPhase = api.onPlanPhase((phase) => {
            if (phase.requestId !== requestId) return
            set((state) => {
              // Map the main process phase to our store's phase
              const phaseMap: Record<string, typeof state.streamingPhase> = {
                initializing: 'connecting',
                analyzing: 'analyzing',
                planning: 'generating',
                finalizing: 'parsing',
                complete: 'complete',
                error: 'error',
                cancelled: 'cancelled'
              }
              state.streamingPhase = phaseMap[phase.phase] || 'generating'
            })
          })
          cleanupFns.push(unsubPhase)
        }

        // Listen for completion
        if (api.onPlanComplete) {
          const unsubComplete = api.onPlanComplete((result) => {
            if (result.requestId !== requestId) return
            cleanup()
            set((state) => {
              state.isGeneratingPlan = false
              state.streamingPhase = 'complete'
              if (result.data) {
                state.currentPlan = result.data as typeof state.currentPlan
              }
            })
          })
          cleanupFns.push(unsubComplete)
        }

        // Listen for errors
        if (api.onPlanError) {
          const unsubError = api.onPlanError((error) => {
            if (error.requestId !== requestId) return
            cleanup()
            set((state) => {
              state.isGeneratingPlan = false
              state.streamingPhase = 'error'
              state.generationError = error.error
            })
          })
          cleanupFns.push(unsubError)
        }

        // Start streaming — attach requestId so main process can echo it in events
        try {
          const contextWithRequestId = { ...context, requestId }
          const result = await api.generatePlanStreaming(contextWithRequestId)
          if (!result.success) {
            cleanup()
            set((state) => {
              state.generationError = result.message || 'Failed to start streaming'
              state.isGeneratingPlan = false
              state.streamingPhase = 'error'
            })
          }
        } catch (error) {
          cleanup()
          set((state) => {
            state.generationError = String(error)
            state.isGeneratingPlan = false
            state.streamingPhase = 'error'
          })
        }
      },

      cancelGeneration: async () => {
        const api = window.api?.aiEditor
        if (api?.cancelGeneration) {
          try {
            await api.cancelGeneration()
          } catch {
            // Ignore cancellation errors
          }
        }
        set((state) => {
          state.isGeneratingPlan = false
          state.streamingPhase = 'cancelled'
          state.streamingRequestId = null
        })
      },

      clearPlan: () => {
        set((state) => {
          state.currentPlan = null
          state.previewState = null
          state.generationError = null
          state.streamingPhase = 'idle'
          state.streamingText = ''
          state.streamingRequestId = null
        })
      },

      // ---------------------------------------------------------------------
      // Preview
      // ---------------------------------------------------------------------

      setPreviewState: (preview) => {
        set((state) => {
          state.previewState = preview
        })
      },

      togglePreviewVisibility: () => {
        set((state) => {
          state.isPreviewVisible = !state.isPreviewVisible
        })
      },

      // ---------------------------------------------------------------------
      // Execution
      // ---------------------------------------------------------------------

      startExecution: () => {
        set((state) => {
          state.isExecutingPlan = true
          state.executionError = null
          state.tempIdToRealId = new Map()
        })
      },

      completeExecution: () => {
        set((state) => {
          state.isExecutingPlan = false
          state.isOpen = false
          state.currentPlan = null
          state.previewState = null
          state.prompt = ''
        })
      },

      failExecution: (error) => {
        set((state) => {
          state.isExecutingPlan = false
          state.executionError = error
        })
      },

      registerTempIdMapping: (tempId, realId) => {
        set((state) => {
          state.tempIdToRealId.set(tempId, realId)
        })
      },

      resolveId: (idOrTempId) => {
        const mapping = get().tempIdToRealId
        return mapping.get(idOrTempId) || idOrTempId
      },

      // ---------------------------------------------------------------------
      // Conversation Refinement
      // ---------------------------------------------------------------------

      addToConversation: (message) => {
        set((state) => {
          state.conversationHistory.push({
            ...message,
            timestamp: Date.now()
          })
        })
      },

      clearConversation: () => {
        set((state) => {
          state.conversationHistory = []
        })
      },

      getConversationContext: () => {
        const { conversationHistory } = get()
        if (conversationHistory.length === 0) return ''

        return conversationHistory
          .map((msg) => {
            const roleLabel = msg.role === 'user' ? 'User' : 'Assistant'
            return `${roleLabel}: ${msg.content}`
          })
          .join('\n\n')
      },

      // ---------------------------------------------------------------------
      // Reset
      // ---------------------------------------------------------------------

      resetState: () => {
        set(() => ({
          ...initialState,
          tempIdToRealId: new Map(),
          conversationHistory: []
        }))
      }
    }))
  )
)

// -----------------------------------------------------------------------------
// Selectors
// -----------------------------------------------------------------------------

export const useAIEditorIsOpen = (): boolean =>
  useAIEditorStore((s) => s.isOpen)

export const useAIEditorSidebarOpen = (): boolean =>
  useAIEditorStore((s) => s.isSidebarOpen)

export const useAIEditorMode = (): AIEditorMode =>
  useAIEditorStore((s) => s.mode)

export const useAIEditorPrompt = (): string =>
  useAIEditorStore((s) => s.prompt)

export const useAIEditorScope = (): AIEditorScope =>
  useAIEditorStore((s) => s.scope)

export const useAIEditorIsGenerating = (): boolean =>
  useAIEditorStore((s) => s.isGeneratingPlan)

export const useAIEditorGenerationError = (): string | null =>
  useAIEditorStore((s) => s.generationError)

export const useAIEditorCurrentPlan = (): MutationPlan | null =>
  useAIEditorStore((s) => s.currentPlan)

export const useAIEditorPreviewState = (): MutationPreviewState | null =>
  useAIEditorStore((s) => s.previewState)

export const useAIEditorIsPreviewVisible = (): boolean =>
  useAIEditorStore((s) => s.isPreviewVisible)

export const useAIEditorIsExecuting = (): boolean =>
  useAIEditorStore((s) => s.isExecutingPlan)

export const useAIEditorExecutionError = (): string | null =>
  useAIEditorStore((s) => s.executionError)

export const useAIEditorHasPlan = (): boolean =>
  useAIEditorStore((s) => s.currentPlan !== null)

// Streaming selectors
export const useAIEditorStreamingPhase = (): StreamingPhase =>
  useAIEditorStore((s) => s.streamingPhase)

export const useAIEditorStreamingText = (): string =>
  useAIEditorStore((s) => s.streamingText)

export const useAIEditorStreamingState = () =>
  useAIEditorStore((s) => ({
    phase: s.streamingPhase,
    text: s.streamingText,
    requestId: s.streamingRequestId
  }))

// Combined selector for modal header state
export const useAIEditorModalState = () =>
  useAIEditorStore((s) => ({
    isOpen: s.isOpen,
    mode: s.mode,
    scope: s.scope,
    isGenerating: s.isGeneratingPlan,
    hasPlan: s.currentPlan !== null,
    streamingPhase: s.streamingPhase
  }))
