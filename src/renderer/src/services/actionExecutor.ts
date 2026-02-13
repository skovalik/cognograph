import type { ActionStep, ExecutionContext } from '@shared/actionTypes'
import type { NodeData } from '@shared/types'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { useConnectorStore } from '../stores/connectorStore'

export interface ExecutionResult {
  success: boolean
  error?: string
  stepsCompleted: number
}

/**
 * Execute a sequence of action steps.
 * Wraps all mutations in a batch for atomic undo.
 */
export async function executeActionSteps(
  steps: ActionStep[],
  context: ExecutionContext,
  _workspaceState: ReturnType<typeof useWorkspaceStore.getState>
): Promise<ExecutionResult> {
  let stepsCompleted = 0
  let skipRemaining = 0

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!

    // Skip disabled steps
    if (step.disabled) {
      stepsCompleted++
      continue
    }

    // Skip steps due to a condition step
    if (skipRemaining > 0) {
      skipRemaining--
      stepsCompleted++
      continue
    }

    try {
      const result = await executeStep(step, context)

      if (result.skip) {
        skipRemaining = result.skip
      }

      stepsCompleted++
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      switch (step.onError) {
        case 'stop':
          return { success: false, error: `Step ${i + 1} (${step.type}): ${errorMessage}`, stepsCompleted }

        case 'retry': {
          let retried = false
          for (let attempt = 1; attempt <= 3; attempt++) {
            await delay(Math.pow(2, attempt) * 100)
            try {
              const retryResult = await executeStep(step, context)
              if (retryResult.skip) skipRemaining = retryResult.skip
              retried = true
              break
            } catch {
              // Continue retrying
            }
          }
          if (!retried) {
            return { success: false, error: `Step ${i + 1} (${step.type}) failed after 3 retries: ${errorMessage}`, stepsCompleted }
          }
          stepsCompleted++
          break
        }

        case 'continue':
          stepsCompleted++
          continue
      }
    }
  }

  return { success: true, stepsCompleted }
}

// -----------------------------------------------------------------------------
// Individual Step Execution
// -----------------------------------------------------------------------------

interface StepResult {
  skip?: number // Number of subsequent steps to skip (for condition steps)
}

async function executeStep(step: ActionStep, context: ExecutionContext): Promise<StepResult> {
  const store = useWorkspaceStore.getState()

  switch (step.type) {
    case 'update-property': {
      const targetId = resolveTarget(step.config.target, step.config.targetNodeId, context)
      if (!targetId) throw new Error('Target node not found')
      store.updateNode(targetId, { [step.config.property]: step.config.value } as Partial<NodeData>)
      return {}
    }

    case 'create-node': {
      // Validate node type
      const validTypes = ['note', 'task', 'conversation', 'artifact', 'project', 'action', 'text', 'workspace']
      if (!validTypes.includes(step.config.nodeType)) {
        throw new Error(`Invalid node type: ${step.config.nodeType}`)
      }

      const position = resolvePosition(step.config.position, step.config, context, store)

      // Validate position is reasonable (warn but don't fail)
      if (position.x < -10000 || position.x > 10000 || position.y < -10000 || position.y > 10000) {
        console.warn(`[ActionExecutor] Unusual position: ${JSON.stringify(position)}`)
      }

      const nodeId = store.addNode(step.config.nodeType as NodeData['type'], position)

      // Verify node was created
      if (!nodeId) {
        throw new Error('Failed to create node - addNode returned undefined')
      }

      // Apply initial data
      if (step.config.title) {
        store.updateNode(nodeId, { title: step.config.title } as Partial<NodeData>)
      }
      if (step.config.initialData) {
        store.updateNode(nodeId, step.config.initialData as Partial<NodeData>)
      }

      // Store created node ID in context variables
      if (step.config.variableName) {
        context.variables[step.config.variableName] = nodeId
      }
      // Always store the last created node ID
      context.variables._lastCreatedNodeId = nodeId
      return {}
    }

    case 'delete-node': {
      const targetId = resolveTarget(step.config.target, step.config.targetNodeId, context)
      if (!targetId) throw new Error('Target node not found')
      store.deleteNodes([targetId])
      return {}
    }

    case 'move-node': {
      const targetId = resolveTarget(step.config.target, step.config.targetNodeId, context)
      if (!targetId) throw new Error('Target node not found')

      const node = store.nodes.find(n => n.id === targetId)
      if (!node) throw new Error(`Node ${targetId} not found`)

      let newX: number, newY: number
      if (step.config.position === 'relative') {
        newX = node.position.x + step.config.x
        newY = node.position.y + step.config.y
      } else {
        newX = step.config.x
        newY = step.config.y
      }

      store.moveNode(targetId, { x: newX, y: newY })
      return {}
    }

    case 'link-nodes': {
      const sourceId = resolveTarget(step.config.source, step.config.sourceNodeId, context)
      const targetId = resolveTarget(step.config.target, step.config.targetNodeId, context)
      if (!sourceId || !targetId) throw new Error('Source or target node not found')

      store.addEdge({
        source: sourceId,
        target: targetId,
        sourceHandle: 'bottom-source',
        targetHandle: 'top-target'
      })
      return {}
    }

    case 'unlink-nodes': {
      const sourceId = resolveTarget(step.config.source, step.config.sourceNodeId, context)
      const targetId = resolveTarget(step.config.target, step.config.targetNodeId, context)
      if (!sourceId || !targetId) throw new Error('Source or target node not found')

      const edgeIds = store.edges
        .filter(e =>
          (e.source === sourceId && e.target === targetId) ||
          (e.source === targetId && e.target === sourceId)
        )
        .map(e => e.id)

      if (edgeIds.length > 0) {
        store.deleteEdges(edgeIds)
      }
      return {}
    }

    case 'wait': {
      await delay(step.config.duration)
      return {}
    }

    case 'condition': {
      const targetId = resolveTarget(step.config.target, step.config.targetNodeId, context)
      if (!targetId) throw new Error('Target node not found')

      const node = store.nodes.find(n => n.id === targetId)
      if (!node) throw new Error(`Node ${targetId} not found`)

      const fieldValue = getNestedValue(node.data, step.config.field)
      const conditionMet = evaluateSimpleCondition(fieldValue, step.config.operator, step.config.value)

      if (!conditionMet) {
        return { skip: step.config.skipCount }
      }
      return {}
    }

    case 'llm-call': {
      const prompt = resolveTemplate(step.config.prompt, context, store)

      // Guard: Empty prompt means no context was provided
      if (!prompt || prompt.trim().length < 5) {
        // Check if they have connected nodes but didn't use the template
        const connectedCount = store.edges.filter(
          e => e.source === context.actionNodeId || e.target === context.actionNodeId
        ).length

        if (connectedCount > 0) {
          throw new Error(`Prompt is empty. Use {{connectedNodes}} to include context from ${connectedCount} connected node(s).`)
        } else {
          throw new Error('Prompt is empty. Connect nodes and use {{connectedNodes}} in your prompt.')
        }
      }

      const variableName = step.config.variableName || 'llmResponse'
      const systemPrompt = step.config.systemPrompt
        ? resolveTemplate(step.config.systemPrompt, context, store)
        : 'You are a helpful assistant integrated into a spatial canvas workflow tool. Respond concisely.'

      // Get connector config
      const connector = useConnectorStore.getState().getDefaultConnector()
      if (!connector) {
        throw new Error('No LLM connector configured. Add a connector in Settings.')
      }

      // Call LLM via IPC extract method (non-streaming, returns full response)
      const response = await window.api.llm.extract({
        systemPrompt,
        userPrompt: prompt,
        model: connector.model,
        maxTokens: step.config.maxTokens || 1024
      })

      if (!response.success) {
        throw new Error(`LLM call failed: ${response.error?.message || 'Unknown error'}`)
      }

      // Guard: Empty response
      if (!response.data || response.data.trim() === '') {
        throw new Error('LLM returned empty response')
      }

      context.variables[variableName] = response.data

      // Auto-create output node if configured (default: true)
      if (step.config.autoCreateOutput !== false) {
        const outputType = step.config.outputNodeType || 'note'
        const position = resolveOutputPosition(step.config.outputPosition || 'right', context, store)

        const nodeId = store.addNode(outputType, position)
        store.updateNode(nodeId, {
          title: 'AI Output',
          content: response.data
        })

        // Connect to action node
        store.addEdge({
          source: context.actionNodeId,
          target: nodeId,
          sourceHandle: 'right-source',
          targetHandle: 'left-target'
        })

        context.variables._lastCreatedNodeId = nodeId
      }

      return {}
    }

    case 'http-request': {
      const url = resolveTemplate(step.config.url, context, store)

      // Validate URL scheme to prevent SSRF (only allow http/https)
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        throw new Error(`Invalid URL scheme. Only http:// and https:// are allowed. Got: ${url.split(':')[0]}://`)
      }

      const body = step.config.body ? resolveTemplate(step.config.body, context, store) : undefined

      const response = await fetch(url, {
        method: step.config.method,
        headers: step.config.headers || {},
        body: step.config.method !== 'GET' ? body : undefined,
        signal: AbortSignal.timeout(step.config.timeout || 30000)
      })

      const responseText = await response.text()
      const variableName = step.config.variableName || 'httpResponse'
      context.variables[variableName] = responseText

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${responseText.substring(0, 200)}`)
      }
      return {}
    }

    default:
      throw new Error(`Unknown step type: ${(step as ActionStep).type}`)
  }
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function resolveTarget(
  target: string,
  specificNodeId: string | undefined,
  context: ExecutionContext
): string | undefined {
  switch (target) {
    case 'trigger-node':
      return context.triggerNodeId
    case 'action-node':
      return context.actionNodeId
    case 'specific-node':
      return specificNodeId
    case 'created-node':
      return context.variables._lastCreatedNodeId as string | undefined
    default:
      return undefined
  }
}

function resolvePosition(
  positionType: string,
  config: { offsetX?: number; offsetY?: number; absoluteX?: number; absoluteY?: number },
  context: ExecutionContext,
  store: ReturnType<typeof useWorkspaceStore.getState>
): { x: number; y: number } {
  switch (positionType) {
    case 'near-trigger': {
      const triggerNode = store.nodes.find(n => n.id === context.triggerNodeId)
      if (triggerNode) {
        return {
          x: triggerNode.position.x + (config.offsetX ?? 300),
          y: triggerNode.position.y + (config.offsetY ?? 0)
        }
      }
      return { x: 0, y: 0 }
    }
    case 'near-action': {
      const actionNode = store.nodes.find(n => n.id === context.actionNodeId)
      if (actionNode) {
        return {
          x: actionNode.position.x + (config.offsetX ?? 300),
          y: actionNode.position.y + (config.offsetY ?? 0)
        }
      }
      return { x: 0, y: 0 }
    }
    case 'absolute':
      return { x: config.absoluteX ?? 0, y: config.absoluteY ?? 0 }
    default:
      return { x: 0, y: 0 }
  }
}


function resolveOutputPosition(
  positionType: string,
  context: ExecutionContext,
  store: ReturnType<typeof useWorkspaceStore.getState>
): { x: number; y: number } {
  const actionNode = store.nodes.find(n => n.id === context.actionNodeId)
  if (!actionNode) return { x: 0, y: 0 }

  const width = actionNode.measured?.width || 280

  switch (positionType) {
    case 'right':
      return { x: actionNode.position.x + width + 50, y: actionNode.position.y }
    case 'below':
      return { x: actionNode.position.x, y: actionNode.position.y + 200 }
    case 'near-trigger': {
      const triggerNode = store.nodes.find(n => n.id === context.triggerNodeId)
      if (triggerNode) {
        return { x: triggerNode.position.x + 300, y: triggerNode.position.y }
      }
      return { x: actionNode.position.x + width + 50, y: actionNode.position.y }
    }
    default:
      return { x: actionNode.position.x + width + 50, y: actionNode.position.y }
  }
}

function resolveTemplate(
  template: string,
  context: ExecutionContext,
  store: ReturnType<typeof useWorkspaceStore.getState>
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_match, path: string) => {
    const trimmed = path.trim()

    // Handle connected nodes context
    if (trimmed === 'connectedNodes' || trimmed.startsWith('connectedNodes.')) {
      const actionNode = store.nodes.find(n => n.id === context.actionNodeId)
      if (!actionNode) return ''

      // Get all connected node IDs (both directions)
      const connectedIds = store.edges
        .filter(e => e.source === context.actionNodeId || e.target === context.actionNodeId)
        .map(e => e.source === context.actionNodeId ? e.target : e.source)

      const connectedNodes = store.nodes.filter(n => connectedIds.includes(n.id))

      if (trimmed === 'connectedNodes') {
        // Return formatted content from all connected nodes
        return connectedNodes
          .map(n => `[${n.data.title || n.data.type}]: ${n.data.content || n.data.description || ''}`)
          .filter(s => s.length > 10)
          .join('\n\n')
      }

      // Handle connectedNodes.count, connectedNodes.titles, etc.
      if (trimmed === 'connectedNodes.count') return String(connectedNodes.length)
      if (trimmed === 'connectedNodes.titles') return connectedNodes.map(n => n.data.title).join(', ')

      return ''
    }

    // Check context variables first
    if (trimmed.startsWith('variables.')) {
      const varName = trimmed.slice('variables.'.length)
      return String(context.variables[varName] ?? '')
    }

    // Check trigger node data
    if (trimmed.startsWith('triggerNode.')) {
      const fieldPath = trimmed.slice('triggerNode.'.length)
      const node = store.nodes.find(n => n.id === context.triggerNodeId)
      if (node) {
        return String(getNestedValue(node.data, fieldPath) ?? '')
      }
    }

    // Direct variable reference
    if (context.variables[trimmed] !== undefined) {
      return String(context.variables[trimmed])
    }

    // Special references
    if (trimmed === 'triggerNodeId') return context.triggerNodeId
    if (trimmed === 'actionNodeId') return context.actionNodeId
    if (trimmed === 'timestamp') return String(Date.now())

    return ''
  })
}

function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

function evaluateSimpleCondition(fieldValue: unknown, operator: string, conditionValue: unknown): boolean {
  switch (operator) {
    case 'equals':
      return String(fieldValue) === String(conditionValue)
    case 'not-equals':
      return String(fieldValue) !== String(conditionValue)
    case 'contains':
      return String(fieldValue).includes(String(conditionValue))
    case 'greater-than':
      return Number(fieldValue) > Number(conditionValue)
    case 'less-than':
      return Number(fieldValue) < Number(conditionValue)
    case 'is-empty':
      return fieldValue === undefined || fieldValue === null || fieldValue === ''
    case 'is-not-empty':
      return fieldValue !== undefined && fieldValue !== null && fieldValue !== ''
    default:
      return true
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
