/**
 * Workflow Store
 *
 * Zustand store for managing workflow execution state.
 * Tracks multi-step AI operations with progress, approvals, and undo support.
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { nanoid } from 'nanoid'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type TrustLevel = 'auto' | 'prompt_once' | 'always_approve'

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'waiting_approval'

export interface WorkflowStep {
  id: string
  name: string
  description: string
  trustLevel: TrustLevel
  status: StepStatus
  startTime?: number
  endTime?: number
  error?: string
  result?: unknown
}

export interface WorkflowEvent {
  id: string
  workflowId: string
  timestamp: number
  type: 'step_started' | 'step_completed' | 'step_failed' | 'step_skipped' | 'approval_requested' | 'approval_granted' | 'approval_denied' | 'workflow_cancelled' | 'workflow_completed'
  stepId?: string
  payload?: unknown
}

export type WorkflowStatus = 'idle' | 'running' | 'paused' | 'completed' | 'cancelled' | 'failed'

export interface Workflow {
  id: string
  name: string
  description: string
  steps: WorkflowStep[]
  currentStepIndex: number
  status: WorkflowStatus
  startTime?: number
  endTime?: number
  error?: string
  events: WorkflowEvent[]
  approvalContext?: {
    stepId: string
    reason: string
    preview?: string
  }
}

// -----------------------------------------------------------------------------
// Store Interface
// -----------------------------------------------------------------------------

interface WorkflowState {
  currentWorkflow: Workflow | null
  workflowHistory: Workflow[]
  isProgressVisible: boolean
}

interface WorkflowActions {
  // Workflow lifecycle
  startWorkflow: (name: string, description: string, steps: Omit<WorkflowStep, 'id' | 'status'>[]) => string
  cancelWorkflow: () => void
  completeWorkflow: () => void
  failWorkflow: (error: string) => void

  // Step management
  startStep: (stepId: string) => void
  completeStep: (stepId: string, result?: unknown) => void
  failStep: (stepId: string, error: string) => void
  skipStep: (stepId: string) => void
  requestApproval: (stepId: string, reason: string, preview?: string) => void
  approveStep: () => void
  denyStep: () => void
  retryStep: () => void

  // UI
  toggleProgressVisibility: () => void
  dismissProgress: () => void

  // Events
  addEvent: (type: WorkflowEvent['type'], stepId?: string, payload?: unknown) => void

  // Computed
  getProgress: () => { current: number; total: number; percent: number }
  getCurrentStep: () => WorkflowStep | null
  getCompletedSteps: () => WorkflowStep[]
  getPendingSteps: () => WorkflowStep[]
}

type WorkflowStore = WorkflowState & WorkflowActions

// -----------------------------------------------------------------------------
// Initial State
// -----------------------------------------------------------------------------

const initialState: WorkflowState = {
  currentWorkflow: null,
  workflowHistory: [],
  isProgressVisible: true
}

// -----------------------------------------------------------------------------
// Store Implementation
// -----------------------------------------------------------------------------

export const useWorkflowStore = create<WorkflowStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      ...initialState,

      // -----------------------------------------------------------------------
      // Workflow Lifecycle
      // -----------------------------------------------------------------------

      startWorkflow: (name, description, steps) => {
        const workflowId = nanoid()
        const workflow: Workflow = {
          id: workflowId,
          name,
          description,
          steps: steps.map((step) => ({
            ...step,
            id: nanoid(),
            status: 'pending' as StepStatus
          })),
          currentStepIndex: 0,
          status: 'running',
          startTime: Date.now(),
          events: []
        }

        set((state) => {
          state.currentWorkflow = workflow
          state.isProgressVisible = true
        })

        // Add start event
        get().addEvent('step_started', workflow.steps[0]?.id)

        return workflowId
      },

      cancelWorkflow: () => {
        set((state) => {
          if (state.currentWorkflow) {
            state.currentWorkflow.status = 'cancelled'
            state.currentWorkflow.endTime = Date.now()
            // Keep in history
            state.workflowHistory.unshift(state.currentWorkflow)
            if (state.workflowHistory.length > 10) {
              state.workflowHistory.pop()
            }
          }
        })
        get().addEvent('workflow_cancelled')
      },

      completeWorkflow: () => {
        set((state) => {
          if (state.currentWorkflow) {
            state.currentWorkflow.status = 'completed'
            state.currentWorkflow.endTime = Date.now()
            state.workflowHistory.unshift(state.currentWorkflow)
            if (state.workflowHistory.length > 10) {
              state.workflowHistory.pop()
            }
          }
        })
        get().addEvent('workflow_completed')
      },

      failWorkflow: (error) => {
        set((state) => {
          if (state.currentWorkflow) {
            state.currentWorkflow.status = 'failed'
            state.currentWorkflow.error = error
            state.currentWorkflow.endTime = Date.now()
            state.workflowHistory.unshift(state.currentWorkflow)
            if (state.workflowHistory.length > 10) {
              state.workflowHistory.pop()
            }
          }
        })
      },

      // -----------------------------------------------------------------------
      // Step Management
      // -----------------------------------------------------------------------

      startStep: (stepId) => {
        set((state) => {
          if (!state.currentWorkflow) return
          const step = state.currentWorkflow.steps.find((s) => s.id === stepId)
          if (step) {
            step.status = 'running'
            step.startTime = Date.now()
          }
        })
        get().addEvent('step_started', stepId)
      },

      completeStep: (stepId, result) => {
        set((state) => {
          if (!state.currentWorkflow) return
          const stepIndex = state.currentWorkflow.steps.findIndex((s) => s.id === stepId)
          const step = state.currentWorkflow.steps[stepIndex]
          if (stepIndex !== -1 && step) {
            step.status = 'completed'
            step.endTime = Date.now()
            step.result = result

            // Move to next step
            if (stepIndex < state.currentWorkflow.steps.length - 1) {
              state.currentWorkflow.currentStepIndex = stepIndex + 1
            }
          }
        })
        get().addEvent('step_completed', stepId, result)

        // Check if workflow is complete
        const workflow = get().currentWorkflow
        if (workflow) {
          const allCompleted = workflow.steps.every(
            (s) => s.status === 'completed' || s.status === 'skipped'
          )
          if (allCompleted) {
            get().completeWorkflow()
          }
        }
      },

      failStep: (stepId, error) => {
        set((state) => {
          if (!state.currentWorkflow) return
          const step = state.currentWorkflow.steps.find((s) => s.id === stepId)
          if (step) {
            step.status = 'failed'
            step.endTime = Date.now()
            step.error = error
          }
          state.currentWorkflow.status = 'paused'
        })
        get().addEvent('step_failed', stepId, { error })
      },

      skipStep: (stepId) => {
        set((state) => {
          if (!state.currentWorkflow) return
          const stepIndex = state.currentWorkflow.steps.findIndex((s) => s.id === stepId)
          const step = state.currentWorkflow.steps[stepIndex]
          if (stepIndex !== -1 && step) {
            step.status = 'skipped'
            step.endTime = Date.now()

            // Move to next step
            if (stepIndex < state.currentWorkflow.steps.length - 1) {
              state.currentWorkflow.currentStepIndex = stepIndex + 1
              state.currentWorkflow.status = 'running'
            }
          }
          // Clear approval context
          state.currentWorkflow.approvalContext = undefined
        })
        get().addEvent('step_skipped', stepId)
      },

      requestApproval: (stepId, reason, preview) => {
        set((state) => {
          if (!state.currentWorkflow) return
          const step = state.currentWorkflow.steps.find((s) => s.id === stepId)
          if (step) {
            step.status = 'waiting_approval'
          }
          state.currentWorkflow.status = 'paused'
          state.currentWorkflow.approvalContext = { stepId, reason, preview }
        })
        get().addEvent('approval_requested', stepId, { reason })
      },

      approveStep: () => {
        const workflow = get().currentWorkflow
        if (!workflow?.approvalContext) return

        const stepId = workflow.approvalContext.stepId
        set((state) => {
          if (!state.currentWorkflow) return
          state.currentWorkflow.approvalContext = undefined
          state.currentWorkflow.status = 'running'
        })
        get().addEvent('approval_granted', stepId)
      },

      denyStep: () => {
        const workflow = get().currentWorkflow
        if (!workflow?.approvalContext) return

        const stepId = workflow.approvalContext.stepId
        get().addEvent('approval_denied', stepId)
        get().cancelWorkflow()
      },

      retryStep: () => {
        set((state) => {
          if (!state.currentWorkflow) return
          const currentStep = state.currentWorkflow.steps[state.currentWorkflow.currentStepIndex]
          if (currentStep) {
            currentStep.status = 'pending'
            currentStep.error = undefined
            currentStep.endTime = undefined
          }
          state.currentWorkflow.status = 'running'
        })
      },

      // -----------------------------------------------------------------------
      // UI
      // -----------------------------------------------------------------------

      toggleProgressVisibility: () => {
        set((state) => {
          state.isProgressVisible = !state.isProgressVisible
        })
      },

      dismissProgress: () => {
        set((state) => {
          state.currentWorkflow = null
          state.isProgressVisible = false
        })
      },

      // -----------------------------------------------------------------------
      // Events
      // -----------------------------------------------------------------------

      addEvent: (type, stepId, payload) => {
        set((state) => {
          if (!state.currentWorkflow) return
          state.currentWorkflow.events.push({
            id: nanoid(),
            workflowId: state.currentWorkflow.id,
            timestamp: Date.now(),
            type,
            stepId,
            payload
          })
        })
      },

      // -----------------------------------------------------------------------
      // Computed
      // -----------------------------------------------------------------------

      getProgress: () => {
        const workflow = get().currentWorkflow
        if (!workflow) return { current: 0, total: 0, percent: 0 }

        const completed = workflow.steps.filter(
          (s) => s.status === 'completed' || s.status === 'skipped'
        ).length
        const total = workflow.steps.length
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0

        return { current: completed, total, percent }
      },

      getCurrentStep: () => {
        const workflow = get().currentWorkflow
        if (!workflow) return null
        return workflow.steps[workflow.currentStepIndex] ?? null
      },

      getCompletedSteps: () => {
        const workflow = get().currentWorkflow
        if (!workflow) return []
        return workflow.steps.filter((s) => s.status === 'completed')
      },

      getPendingSteps: () => {
        const workflow = get().currentWorkflow
        if (!workflow) return []
        return workflow.steps.filter((s) => s.status === 'pending')
      }
    }))
  )
)

// -----------------------------------------------------------------------------
// Selectors
// -----------------------------------------------------------------------------

export const useCurrentWorkflow = () => useWorkflowStore((s) => s.currentWorkflow)

export const useWorkflowStatus = () => useWorkflowStore((s) => s.currentWorkflow?.status ?? 'idle')

export const useWorkflowProgress = () => useWorkflowStore((s) => s.getProgress())

export const useCurrentStep = () => useWorkflowStore((s) => s.getCurrentStep())

export const useIsWorkflowActive = () =>
  useWorkflowStore((s) => s.currentWorkflow !== null && s.currentWorkflow.status === 'running')

export const useNeedsApproval = () =>
  useWorkflowStore((s) => s.currentWorkflow?.status === 'paused' && s.currentWorkflow?.approvalContext !== undefined)

export const useApprovalContext = () => useWorkflowStore((s) => s.currentWorkflow?.approvalContext)

export const useIsProgressVisible = () => useWorkflowStore((s) => s.isProgressVisible)
