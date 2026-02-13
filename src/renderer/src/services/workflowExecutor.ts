/**
 * Workflow Executor Service
 *
 * Executes multi-step workflows with progress tracking, approval handling,
 * and undo support. Integrates with the workflow store for state management.
 */

import { useWorkflowStore, type TrustLevel, type WorkflowStep } from '../stores/workflowStore'
import { useWorkspaceStore } from '../stores/workspaceStore'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface StepDefinition {
  name: string
  description: string
  trustLevel: TrustLevel
  execute: (context: ExecutionContext) => Promise<StepResult>
  undo?: (context: ExecutionContext) => Promise<void>
  validate?: (context: ExecutionContext) => ValidationResult
  approvalReason?: string
  approvalPreview?: (context: ExecutionContext) => string
}

export interface ExecutionContext {
  workflowId: string
  stepIndex: number
  previousResults: unknown[]
  abortSignal: AbortSignal
}

export interface StepResult {
  success: boolean
  data?: unknown
  error?: string
}

export interface ValidationResult {
  valid: boolean
  errors?: string[]
}

export interface WorkflowDefinition {
  name: string
  description: string
  steps: StepDefinition[]
}

export interface ExecutionOptions {
  onStepStart?: (step: StepDefinition, index: number) => void
  onStepComplete?: (step: StepDefinition, index: number, result: StepResult) => void
  onStepFailed?: (step: StepDefinition, index: number, error: string) => void
  onApprovalNeeded?: (step: StepDefinition, index: number) => void
  onComplete?: () => void
  onCancelled?: () => void
}

// -----------------------------------------------------------------------------
// Workflow Executor Class
// -----------------------------------------------------------------------------

class WorkflowExecutorService {
  private abortController: AbortController | null = null
  private currentWorkflowId: string | null = null
  private executionPromise: Promise<void> | null = null
  private previousResults: unknown[] = []

  /**
   * Execute a workflow definition
   */
  async execute(
    workflow: WorkflowDefinition,
    options: ExecutionOptions = {}
  ): Promise<boolean> {
    // Cancel any existing workflow
    if (this.abortController) {
      this.abortController.abort()
    }

    this.abortController = new AbortController()
    this.previousResults = []

    const store = useWorkflowStore.getState()

    // Start the workflow in the store
    this.currentWorkflowId = store.startWorkflow(
      workflow.name,
      workflow.description,
      workflow.steps.map((s) => ({
        name: s.name,
        description: s.description,
        trustLevel: s.trustLevel
      }))
    )

    // Execute steps sequentially
    this.executionPromise = this.executeSteps(workflow.steps, options)

    try {
      await this.executionPromise
      return true
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        options.onCancelled?.()
        return false
      }
      throw error
    }
  }

  /**
   * Execute steps sequentially
   */
  private async executeSteps(
    steps: StepDefinition[],
    options: ExecutionOptions
  ): Promise<void> {
    const store = useWorkflowStore.getState()

    for (let i = 0; i < steps.length; i++) {
      // Check for abort
      if (this.abortController?.signal.aborted) {
        throw new DOMException('Workflow aborted', 'AbortError')
      }

      const step = steps[i]
      const workflowStep = store.currentWorkflow?.steps[i]
      if (!workflowStep || !step) continue

      // Validate step if validator exists
      if (step.validate) {
        const context = this.createContext(i)
        const validation = step.validate(context)
        if (!validation.valid) {
          store.failStep(workflowStep.id, validation.errors?.join(', ') ?? 'Validation failed')
          await this.waitForUserAction(workflowStep)
          // User either retried, skipped, or cancelled
          if (store.currentWorkflow?.status === 'cancelled') {
            throw new DOMException('Workflow cancelled', 'AbortError')
          }
          if (workflowStep.status === 'skipped') continue
          // Retry - decrement i to re-run this step
          i--
          continue
        }
      }

      // Check if approval is needed
      if (step.trustLevel === 'always_approve') {
        const reason = step.approvalReason ?? `This step requires approval: ${step.name}`
        const preview = step.approvalPreview?.(this.createContext(i))
        store.requestApproval(workflowStep.id, reason, preview)
        options.onApprovalNeeded?.(step, i)

        await this.waitForUserAction(workflowStep)

        // Check result after waiting
        const updatedStep = useWorkflowStore.getState().currentWorkflow?.steps[i]
        if (updatedStep?.status === 'skipped') continue
        if (useWorkflowStore.getState().currentWorkflow?.status === 'cancelled') {
          throw new DOMException('Workflow cancelled', 'AbortError')
        }
      }

      // Start step
      store.startStep(workflowStep.id)
      options.onStepStart?.(step, i)

      // Execute step
      try {
        const context = this.createContext(i)
        const result = await step.execute(context)

        if (result.success) {
          this.previousResults.push(result.data)
          store.completeStep(workflowStep.id, result.data)
          options.onStepComplete?.(step, i, result)
        } else {
          store.failStep(workflowStep.id, result.error ?? 'Step failed')
          options.onStepFailed?.(step, i, result.error ?? 'Step failed')

          // Wait for user to retry, skip, or cancel
          await this.waitForUserAction(workflowStep)

          // Check result after waiting
          const updatedStep = useWorkflowStore.getState().currentWorkflow?.steps[i]
          if (updatedStep?.status === 'skipped') continue
          if (useWorkflowStore.getState().currentWorkflow?.status === 'cancelled') {
            throw new DOMException('Workflow cancelled', 'AbortError')
          }
          // Retry
          i--
          continue
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          throw error
        }

        const errorMessage = (error as Error).message ?? 'Unknown error'
        store.failStep(workflowStep.id, errorMessage)
        options.onStepFailed?.(step, i, errorMessage)

        // Wait for user to retry, skip, or cancel
        await this.waitForUserAction(workflowStep)

        const updatedStep = useWorkflowStore.getState().currentWorkflow?.steps[i]
        if (updatedStep?.status === 'skipped') continue
        if (useWorkflowStore.getState().currentWorkflow?.status === 'cancelled') {
          throw new DOMException('Workflow cancelled', 'AbortError')
        }
        // Retry
        i--
        continue
      }
    }

    // Workflow complete
    options.onComplete?.()
  }

  /**
   * Wait for user action (approval, retry, skip, or cancel)
   */
  private waitForUserAction(step: WorkflowStep): Promise<void> {
    return new Promise((resolve) => {
      const unsubscribe = useWorkflowStore.subscribe(
        (state) => ({
          status: state.currentWorkflow?.status,
          stepStatus: state.currentWorkflow?.steps.find((s) => s.id === step.id)?.status
        }),
        (current, previous) => {
          // Resolve when:
          // - Workflow resumes (status changes from paused to running)
          // - Workflow is cancelled
          // - Step is skipped
          // - Step is reset to pending for retry
          const shouldResolve =
            current.status === 'running' ||
            current.status === 'cancelled' ||
            current.stepStatus === 'skipped' ||
            (current.stepStatus === 'pending' && previous.stepStatus !== 'pending')

          if (shouldResolve) {
            unsubscribe()
            resolve()
          }
        }
      )
    })
  }

  /**
   * Create execution context for a step
   */
  private createContext(stepIndex: number): ExecutionContext {
    return {
      workflowId: this.currentWorkflowId!,
      stepIndex,
      previousResults: [...this.previousResults],
      abortSignal: this.abortController!.signal
    }
  }

  /**
   * Cancel the current workflow
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort()
    }
    useWorkflowStore.getState().cancelWorkflow()
  }

  /**
   * Get whether a workflow is currently executing
   */
  isExecuting(): boolean {
    const workflow = useWorkflowStore.getState().currentWorkflow
    return workflow !== null && workflow.status === 'running'
  }
}

// -----------------------------------------------------------------------------
// Singleton Instance
// -----------------------------------------------------------------------------

export const workflowExecutor = new WorkflowExecutorService()

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Create a simple step definition
 */
export function createStep(
  name: string,
  execute: (context: ExecutionContext) => Promise<StepResult>,
  options: Partial<Omit<StepDefinition, 'name' | 'execute'>> = {}
): StepDefinition {
  return {
    name,
    description: options.description ?? name,
    trustLevel: options.trustLevel ?? 'auto',
    execute,
    undo: options.undo,
    validate: options.validate,
    approvalReason: options.approvalReason,
    approvalPreview: options.approvalPreview
  }
}

/**
 * Create a node creation step
 */
export function createNodeStep(
  nodeData: {
    type: 'conversation' | 'note' | 'task' | 'project' | 'artifact' | 'text' | 'action' | 'workspace'
    title: string
    content?: string
    position?: { x: number; y: number }
    parentId?: string
  },
  options: Partial<Omit<StepDefinition, 'name' | 'execute'>> = {}
): StepDefinition {
  return createStep(
    `Create ${nodeData.type}: ${nodeData.title}`,
    async () => {
      const { addNode, updateNode } = useWorkspaceStore.getState()
      const position = nodeData.position ?? { x: 0, y: 0 }

      // addNode returns the new node ID
      const nodeId = addNode(nodeData.type, position)

      // Update with additional data
      updateNode(nodeId, {
        title: nodeData.title,
        content: nodeData.content ?? '',
        parentId: nodeData.parentId
      })

      return { success: true, data: { nodeId } }
    },
    {
      description: `Create a new ${nodeData.type} node titled "${nodeData.title}"`,
      trustLevel: 'auto',
      ...options
    }
  )
}

/**
 * Create an edge creation step
 */
export function createEdgeStep(
  sourceId: string,
  targetId: string,
  options: Partial<Omit<StepDefinition, 'name' | 'execute'>> = {}
): StepDefinition {
  return createStep(
    `Connect nodes`,
    async () => {
      const { addEdge } = useWorkspaceStore.getState()

      // addEdge takes a Connection object
      addEdge({
        source: sourceId,
        target: targetId,
        sourceHandle: null,
        targetHandle: null
      })

      return { success: true, data: { sourceId, targetId } }
    },
    {
      description: 'Create a connection between nodes',
      trustLevel: 'auto',
      ...options
    }
  )
}

/**
 * Create a batch node creation step
 */
export function createBatchNodesStep(
  nodes: Array<{
    type: 'conversation' | 'note' | 'task' | 'project' | 'artifact' | 'text' | 'action' | 'workspace'
    title: string
    content?: string
    position?: { x: number; y: number }
    parentId?: string
  }>,
  options: Partial<Omit<StepDefinition, 'name' | 'execute'>> = {}
): StepDefinition {
  return createStep(
    `Create ${nodes.length} nodes`,
    async () => {
      const { addNode, updateNode } = useWorkspaceStore.getState()
      const createdIds: string[] = []

      for (const nodeData of nodes) {
        const position = nodeData.position ?? { x: 0, y: 0 }
        const nodeId = addNode(nodeData.type, position)
        createdIds.push(nodeId)

        // Update with additional data
        updateNode(nodeId, {
          title: nodeData.title,
          content: nodeData.content ?? '',
          parentId: nodeData.parentId
        })
      }

      return { success: true, data: { nodeIds: createdIds } }
    },
    {
      description: `Create ${nodes.length} nodes in batch`,
      trustLevel: 'auto',
      ...options
    }
  )
}

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export default workflowExecutor
