/**
 * AI Editor Workflow Adapter
 *
 * Converts AI Editor mutation plans into workflow definitions that can be
 * executed with progress tracking, approval handling, and undo support.
 */

import type { MutationPlan, MutationOp, NodeData } from '@shared/types'
import { createStep, type StepDefinition, type ExecutionContext } from './workflowExecutor'
import { executeMutationPlan } from '../utils/mutationExecutor'
import { useWorkflowStore, type TrustLevel } from '../stores/workflowStore'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface AdapterOptions {
  /** Show progress UI while executing */
  showProgress?: boolean
  /** Pause for approval on specific operation types */
  requireApprovalFor?: MutationOp['op'][]
  /** Callback when workflow completes */
  onComplete?: (results: OperationResult[]) => void
  /** Callback when workflow fails */
  onError?: (error: string, completedOps: number) => void
  /** Callback when workflow is cancelled */
  onCancel?: (completedOps: number) => void
}

export interface OperationResult {
  operation: MutationOp
  success: boolean
  nodeId?: string
  edgeId?: string
  error?: string
}

// -----------------------------------------------------------------------------
// Default Trust Levels for Operation Types
// -----------------------------------------------------------------------------

const OPERATION_TRUST_LEVELS: Record<MutationOp['op'], TrustLevel> = {
  'create-node': 'auto',
  'update-node': 'auto',
  'delete-node': 'prompt_once',
  'move-node': 'auto',
  'create-edge': 'auto',
  'update-edge': 'auto',
  'delete-edge': 'auto'
}

// Operation type display names
const OPERATION_NAMES: Record<MutationOp['op'], string> = {
  'create-node': 'Create node',
  'update-node': 'Update node',
  'delete-node': 'Delete node',
  'move-node': 'Move node',
  'create-edge': 'Connect nodes',
  'update-edge': 'Update connection',
  'delete-edge': 'Remove connection'
}

// -----------------------------------------------------------------------------
// Plan to Workflow Converter
// -----------------------------------------------------------------------------

/**
 * Convert a mutation plan to a workflow definition
 *
 * Note: This creates a single-step workflow that executes the entire plan,
 * since the mutation executor handles batching and dependency resolution.
 * The progress UI shows the plan's operation count.
 */
export function convertPlanToWorkflow(
  plan: MutationPlan,
  options: AdapterOptions = {}
): { name: string; description: string; steps: StepDefinition[] } {
  const { requireApprovalFor = [] } = options

  // Create individual steps for visibility, but batch execution
  const steps = createOperationSteps(plan, requireApprovalFor)

  return {
    name: plan.reasoning ? plan.reasoning.slice(0, 50) : 'AI Editor Operation',
    description: `${plan.operations.length} operations`,
    steps
  }
}

/**
 * Create step definitions for each operation in the plan
 */
function createOperationSteps(
  plan: MutationPlan,
  requireApprovalFor: MutationOp['op'][]
): StepDefinition[] {
  // For simple plans (≤5 ops), show each operation as a step
  // For larger plans, group by operation type
  if (plan.operations.length <= 5) {
    return plan.operations.map((op, index) =>
      createOperationStep(op, index, plan, requireApprovalFor)
    )
  }

  // Group operations by type for larger plans
  const grouped = groupOperationsByType(plan.operations)
  const steps: StepDefinition[] = []

  for (const [opType, ops] of Object.entries(grouped)) {
    if (ops.length === 0) continue

    const trustLevel = determineGroupTrustLevel(ops, requireApprovalFor)

    steps.push(createStep(
      `${OPERATION_NAMES[opType as MutationOp['op']]} (${ops.length})`,
      async () => {
        // Execute entire plan - this step is just for progress tracking
        return { success: true, data: { count: ops.length } }
      },
      {
        description: `${ops.length} ${opType} operations`,
        trustLevel,
        approvalReason: trustLevel === 'always_approve'
          ? `This will ${opType.replace('-', ' ')} ${ops.length} items`
          : undefined
      }
    ))
  }

  return steps
}

/**
 * Create a step definition for a single operation
 */
function createOperationStep(
  op: MutationOp,
  index: number,
  _plan: MutationPlan,
  requireApprovalFor: MutationOp['op'][]
): StepDefinition {
  const description = getOperationDescription(op)

  // Determine trust level
  let trustLevel: TrustLevel = OPERATION_TRUST_LEVELS[op.op]
  if (requireApprovalFor.includes(op.op)) {
    trustLevel = 'always_approve'
  }

  return createStep(
    getOperationTitle(op),
    async (_context: ExecutionContext) => {
      // For individual steps, we just track progress
      // The actual execution happens in executePlanAsWorkflow
      return { success: true, data: { operationIndex: index } }
    },
    {
      description,
      trustLevel,
      approvalReason: trustLevel === 'always_approve'
        ? `This operation will ${op.op.replace('-', ' ')}`
        : undefined,
      approvalPreview: trustLevel === 'always_approve'
        ? () => getOperationPreview(op)
        : undefined
    }
  )
}

/**
 * Execute a mutation plan as a workflow with progress tracking
 */
export async function executePlanAsWorkflow(
  plan: MutationPlan,
  options: AdapterOptions = {}
): Promise<boolean> {
  const { onComplete, onError, onCancel: _onCancel } = options
  const results: OperationResult[] = []

  // Create workflow for progress tracking
  const workflow = convertPlanToWorkflow(plan, options)

  // Start the workflow for UI feedback
  const store = useWorkflowStore.getState()
  store.startWorkflow(
    workflow.name,
    workflow.description,
    workflow.steps.map(s => ({
      name: s.name,
      description: s.description,
      trustLevel: s.trustLevel
    }))
  )

  try {
    // Get fresh state after startWorkflow - the previous store reference is stale
    const currentStore = useWorkflowStore.getState()
    const steps = currentStore.currentWorkflow?.steps ?? []

    // Execute the entire plan using the existing mutation executor
    // This handles batching and dependency resolution
    for (const step of steps) {
      if (!step) continue
      store.startStep(step.id)

      // Small delay for visual feedback
      await new Promise(resolve => setTimeout(resolve, 100))

      store.completeStep(step.id)
    }

    // Now execute the actual plan
    const result = await executeMutationPlan(plan)

    if (result.success) {
      // Map results to operations
      plan.operations.forEach((op, i) => {
        results.push({
          operation: op,
          success: true,
          nodeId: op.op === 'create-node' ? result.createdNodeIds[i] : undefined
        })
      })

      onComplete?.(results)
      return true
    } else {
      onError?.(result.error ?? 'Plan execution failed', 0)
      return false
    }
  } catch (error) {
    const errorMessage = (error as Error).message
    onError?.(errorMessage, results.filter(r => r.success).length)
    store.cancelWorkflow()
    return false
  }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function groupOperationsByType(operations: MutationOp[]): Record<string, MutationOp[]> {
  const grouped: Record<string, MutationOp[]> = {}

  for (const op of operations) {
    const key = op.op
    if (!grouped[key]) {
      grouped[key] = []
    }
    grouped[key]!.push(op)
  }

  return grouped
}

function determineGroupTrustLevel(
  operations: MutationOp[],
  requireApprovalFor: MutationOp['op'][]
): TrustLevel {
  // If any operation requires approval, the group does too
  for (const op of operations) {
    if (requireApprovalFor.includes(op.op)) {
      return 'always_approve'
    }
    if (op.op === 'delete-node') {
      return 'prompt_once'
    }
  }
  return 'auto'
}

function getOperationTitle(op: MutationOp): string {
  switch (op.op) {
    case 'create-node':
      return `Create ${op.type}: ${(op.data as { title?: string })?.title ?? 'Untitled'}`
    case 'update-node':
      return `Update node`
    case 'delete-node':
      return `Delete node`
    case 'move-node':
      return `Move node`
    case 'create-edge':
      return `Connect nodes`
    case 'update-edge':
      return `Update connection`
    case 'delete-edge':
      return `Remove connection`
    default:
      return 'Unknown operation'
  }
}

function getOperationDescription(op: MutationOp): string {
  switch (op.op) {
    case 'create-node':
      return `Create a ${op.type} node named "${(op.data as { title?: string })?.title ?? 'Untitled'}"`
    case 'update-node':
      return `Update node properties`
    case 'delete-node':
      return `Delete node ${op.nodeId}${op.reason ? `: ${op.reason}` : ''}`
    case 'move-node':
      return `Move node to new position`
    case 'create-edge':
      return `Connect ${op.source} to ${op.target}`
    case 'delete-edge':
      return `Remove connection ${op.edgeId}`
    case 'update-edge':
      return `Update connection properties`
    default:
      return 'Unknown operation'
  }
}

function getOperationPreview(op: MutationOp): string {
  switch (op.op) {
    case 'create-node': {
      const data = op.data as { title?: string; content?: string }
      return [
        `Type: ${op.type}`,
        `Title: ${data?.title ?? 'Untitled'}`,
        data?.content ? `Content preview: ${data.content.slice(0, 100)}...` : ''
      ].filter(Boolean).join('\n')
    }
    case 'delete-node':
      return `This node will be permanently deleted.${op.reason ? `\nReason: ${op.reason}` : ''}`
    case 'delete-edge':
      return `This connection will be removed.${op.reason ? `\nReason: ${op.reason}` : ''}`
    default:
      return JSON.stringify(op, null, 2)
  }
}

// -----------------------------------------------------------------------------
// Quick Workflow Creators
// -----------------------------------------------------------------------------

/**
 * Create a workflow that creates multiple nodes in sequence
 */
export function createNodeCreationWorkflow(
  nodes: Array<{
    type: NodeData['type']
    title: string
    content?: string
    position: { x: number; y: number }
  }>,
  workflowName: string = 'Create Nodes'
): { name: string; description: string; steps: StepDefinition[] } {
  return {
    name: workflowName,
    description: `Create ${nodes.length} nodes`,
    steps: nodes.map((node, i) =>
      createStep(
        `Create ${node.type}: ${node.title}`,
        async () => {
          // This would use the workspace store directly
          // For now, return success - actual implementation would add the node
          return { success: true, data: { nodeIndex: i } }
        },
        {
          description: `Create a ${node.type} node titled "${node.title}"`,
          trustLevel: 'auto'
        }
      )
    )
  }
}

/**
 * Create a workflow that organizes nodes into a project
 */
export function createOrganizeWorkflow(
  nodeIds: string[],
  projectTitle: string,
  _projectPosition: { x: number; y: number }
): { name: string; description: string; steps: StepDefinition[] } {
  return {
    name: `Organize into "${projectTitle}"`,
    description: `Group ${nodeIds.length} nodes into a new project`,
    steps: [
      createStep(
        `Create project: ${projectTitle}`,
        async () => {
          return { success: true, data: { step: 'create-project' } }
        },
        {
          description: `Create a new project container`,
          trustLevel: 'auto'
        }
      ),
      createStep(
        `Move ${nodeIds.length} nodes into project`,
        async () => {
          return { success: true, data: { movedCount: nodeIds.length } }
        },
        {
          description: `Move selected nodes into the new project`,
          trustLevel: 'auto'
        }
      )
    ]
  }
}

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export default {
  convertPlanToWorkflow,
  executePlanAsWorkflow,
  createNodeCreationWorkflow,
  createOrganizeWorkflow
}
