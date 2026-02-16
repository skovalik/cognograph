/**
 * Orchestrator Service — Main Process
 *
 * Manages orchestrator pipeline execution. Runs in the main process to:
 * 1. Survive renderer crashes/reloads
 * 2. Coordinate multiple agent streams via claudeAgent.ts
 * 3. Maintain long-running state (orchestrations can take minutes)
 *
 * Status updates are sent to the renderer via the 'orchestrator:status' IPC channel.
 */

import { BrowserWindow } from 'electron'
import type {
  OrchestratorNodeData,
  OrchestratorRun,
  OrchestratorStrategy,
  OrchestratorBudget,
  FailurePolicy,
  ConnectedAgent,
  OrchestratorAgentResult,
  OrchestratorRunStatus,
  OrchestratorConditionType,
} from '../../shared/types/nodes'

// Unique run ID generator
let runIdCounter = 0
function generateRunId(): string {
  runIdCounter++
  return `orch-run-${Date.now()}-${runIdCounter}`
}

// Status update payload sent to renderer
export interface OrchestratorStatusUpdate {
  orchestratorId: string
  runId: string
  type:
    | 'run-started'
    | 'agent-started'
    | 'agent-completed'
    | 'agent-failed'
    | 'agent-retrying'
    | 'agent-skipped'
    | 'budget-warning'
    | 'budget-exceeded'
    | 'run-paused'
    | 'run-resumed'
    | 'run-completed'
    | 'run-completed-with-errors'
    | 'run-failed'
    | 'run-aborted'
  agentNodeId?: string
  agentResult?: OrchestratorAgentResult
  totalTokens?: number
  totalCostUSD?: number
  error?: string
}

// Active run state stored in main process
interface ActiveRunState {
  orchestratorId: string
  run: OrchestratorRun
  agents: ConnectedAgent[]
  strategy: OrchestratorStrategy
  budget: OrchestratorBudget
  failurePolicy: FailurePolicy
  aborted: boolean
  paused: boolean
}

// Map of active orchestration runs (orchestratorId -> state)
const activeRuns = new Map<string, ActiveRunState>()

// Send status update to all renderer windows
function emitStatus(update: OrchestratorStatusUpdate): void {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send('orchestrator:status', update)
    }
  }
}

// Cycle detection
export function detectCycle(
  orchestratorId: string,
  parentOrchestrationId: string | undefined
): { hasCycle: boolean; chain: string[] } {
  const chain: string[] = [orchestratorId]
  let currentParentId = parentOrchestrationId

  while (currentParentId) {
    if (currentParentId === orchestratorId) {
      return { hasCycle: true, chain }
    }
    if (chain.length > 20) {
      return { hasCycle: true, chain }
    }
    chain.push(currentParentId)

    const parentRun = activeRuns.get(currentParentId)
    currentParentId = parentRun?.run.parentOrchestrationId
  }

  return { hasCycle: false, chain }
}

// Budget check — can we run another agent?
export function canRunAgent(
  budget: OrchestratorBudget,
  run: OrchestratorRun
): { allowed: boolean; reason?: string } {
  if (budget.maxTotalTokens) {
    const used = run.totalInputTokens + run.totalOutputTokens
    if (used >= budget.maxTotalTokens) {
      return {
        allowed: false,
        reason: `Total token budget exhausted (${used}/${budget.maxTotalTokens})`,
      }
    }
  }

  if (budget.maxTotalCostUSD) {
    if (run.totalCostUSD >= budget.maxTotalCostUSD) {
      return {
        allowed: false,
        reason: `Total cost budget exhausted ($${run.totalCostUSD.toFixed(4)}/$${budget.maxTotalCostUSD})`,
      }
    }
  }

  return { allowed: true }
}

// Parallel budget reservation
export function validateParallelBudget(
  budget: OrchestratorBudget,
  agentCount: number
): { allowed: boolean; reason?: string; effectiveConcurrency?: number } {
  if (!budget.maxTotalTokens && !budget.maxTotalCostUSD) {
    return { allowed: true, effectiveConcurrency: agentCount }
  }

  if (budget.maxTotalTokens && budget.maxTokensPerAgent) {
    const reservedTokens = agentCount * budget.maxTokensPerAgent
    if (reservedTokens > budget.maxTotalTokens) {
      const maxConcurrent = Math.floor(budget.maxTotalTokens / budget.maxTokensPerAgent)
      if (maxConcurrent < 1) {
        return {
          allowed: false,
          reason: `Per-agent token limit (${budget.maxTokensPerAgent}) exceeds total budget (${budget.maxTotalTokens})`,
        }
      }
      return { allowed: true, effectiveConcurrency: maxConcurrent }
    }
  }

  if (budget.maxTotalCostUSD && budget.maxCostPerAgent) {
    const reservedCost = agentCount * budget.maxCostPerAgent
    if (reservedCost > budget.maxTotalCostUSD) {
      const maxConcurrent = Math.floor(budget.maxTotalCostUSD / budget.maxCostPerAgent)
      if (maxConcurrent < 1) {
        return {
          allowed: false,
          reason: `Per-agent cost limit ($${budget.maxCostPerAgent}) exceeds total budget ($${budget.maxTotalCostUSD})`,
        }
      }
      return { allowed: true, effectiveConcurrency: maxConcurrent }
    }
  }

  if (budget.maxTotalTokens && !budget.maxTokensPerAgent) {
    const impliedPerAgent = Math.floor(budget.maxTotalTokens / agentCount)
    console.warn(
      `[Orchestrator] Parallel budget advisory: no per-agent token limit set. ` +
      `Total budget ${budget.maxTotalTokens} / ${agentCount} agents = ~${impliedPerAgent} tokens each. ` +
      `Budget may be exceeded.`
    )
  }

  return { allowed: true, effectiveConcurrency: agentCount }
}

// Evaluate a single condition against the last completed agent result
export function evaluateCondition(
  conditionType: OrchestratorConditionType,
  conditionValue: string | undefined,
  conditionThreshold: number | undefined,
  lastResult: OrchestratorAgentResult | undefined,
  cumulativeTokens: number
): boolean {
  switch (conditionType) {
    case 'agent-succeeded':
      return lastResult?.status === 'completed'

    case 'agent-failed':
      return lastResult?.status === 'failed'

    case 'output-contains': {
      if (!conditionValue) {
        console.warn('[Orchestrator] Warning: output-contains condition has empty value - will always match')
      }
      const output = lastResult?.output ?? ''
      return output.toLowerCase().includes((conditionValue ?? '').toLowerCase())
    }

    case 'output-matches': {
      if (!conditionValue) return false
      try {
        const regex = new RegExp(conditionValue)
        return regex.test(lastResult?.output ?? '')
      } catch (err) {
        console.error(
          `[Orchestrator] Invalid regex in output-matches condition: ${conditionValue} - ${(err as Error).message}`
        )
        return false
      }
    }

    case 'token-count-below':
      return conditionThreshold !== undefined ? cumulativeTokens < conditionThreshold : true

    case 'custom-expression':
      throw new Error(
        'custom-expression conditions are not yet implemented. ' +
        'This condition type requires a safe expression parser (Phase 2+).'
      )

    default:
      return false
  }
}

// Crash recovery: resets interrupted runs on workspace load
export function recoverOrchestrators(
  nodes: Array<{ data: { type: string; [key: string]: unknown } }>
): void {
  for (const node of nodes) {
    if (node.data.type !== 'orchestrator') continue
    const nodeData = node.data as unknown as OrchestratorNodeData

    if (
      nodeData.currentRun &&
      (nodeData.currentRun.status === 'running' ||
       nodeData.currentRun.status === 'paused' ||
       nodeData.currentRun.status === 'planning')
    ) {
      nodeData.currentRun.status = 'failed'
      nodeData.currentRun.error = 'Orchestration interrupted by app restart'
      nodeData.currentRun.completedAt = Date.now()

      nodeData.runHistory.unshift(nodeData.currentRun)
      if (nodeData.runHistory.length > nodeData.maxHistoryRuns) {
        nodeData.runHistory = nodeData.runHistory.slice(0, nodeData.maxHistoryRuns)
      }
      nodeData.currentRun = undefined

      for (const agent of nodeData.connectedAgents) {
        if (agent.status === 'running' || agent.status === 'queued' || agent.status === 'retrying') {
          agent.status = 'idle'
        }
      }
    }
  }
}

// Determine final run status based on agent results
export function determineFinalStatus(
  agentResults: OrchestratorAgentResult[],
  failurePolicy: FailurePolicy
): OrchestratorRunStatus {
  if (agentResults.length === 0) return 'failed'

  const hasSucceeded = agentResults.some((r) => r.status === 'completed')
  const hasFailed = agentResults.some((r) => r.status === 'failed')

  if (failurePolicy.type === 'abort-all' && hasFailed) {
    return 'failed'
  }

  if (hasSucceeded && !hasFailed) return 'completed'
  if (hasFailed) return 'completed-with-errors'
  return 'completed'
}

// Start an orchestration run
export async function startOrchestration(
  orchestratorId: string,
  nodeData: OrchestratorNodeData,
  parentOrchestrationId?: string
): Promise<{ success: boolean; error?: string }> {
  // Check for cycles
  const cycleCheck = detectCycle(orchestratorId, parentOrchestrationId)
  if (cycleCheck.hasCycle) {
    return {
      success: false,
      error: `Circular orchestration detected: ${cycleCheck.chain.join(' -> ')}`,
    }
  }

  // Check for existing active run
  if (activeRuns.has(orchestratorId)) {
    return {
      success: false,
      error: 'Orchestration is already running',
    }
  }

  // Check agents
  if (nodeData.connectedAgents.length === 0) {
    return {
      success: false,
      error: 'No agents found',
    }
  }

  // Create run
  const runId = generateRunId()
  const run: OrchestratorRun = {
    id: runId,
    status: 'planning',
    strategy: nodeData.strategy,
    startedAt: Date.now(),
    agentResults: [],
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCostUSD: 0,
    totalDurationMs: 0,
    parentOrchestrationId,
  }

  // Store active run state
  const state: ActiveRunState = {
    orchestratorId,
    run,
    agents: [...nodeData.connectedAgents],
    strategy: nodeData.strategy,
    budget: nodeData.budget,
    failurePolicy: nodeData.failurePolicy,
    aborted: false,
    paused: false,
  }

  activeRuns.set(orchestratorId, state)

  // Transition to running
  run.status = 'running'
  emitStatus({
    orchestratorId,
    runId,
    type: 'run-started',
  })

  // Execute strategy (non-blocking — runs in background)
  executeStrategy(state).catch((err) => {
    console.error(`[Orchestrator ${orchestratorId}] Strategy execution error:`, err)
    run.status = 'failed'
    run.error = (err as Error).message
    run.completedAt = Date.now()
    run.totalDurationMs = run.completedAt - run.startedAt
    emitStatus({
      orchestratorId,
      runId,
      type: 'run-failed',
      error: run.error,
    })
    activeRuns.delete(orchestratorId)
  })

  return { success: true }
}

// Execute the chosen strategy
async function executeStrategy(state: ActiveRunState): Promise<void> {
  const { strategy } = state

  switch (strategy) {
    case 'sequential':
      await executeSequential(state)
      break
    case 'parallel':
      await executeParallel(state)
      break
    case 'conditional':
      await executeConditional(state)
      break
  }

  finishRun(state)
}

// Sequential strategy: run agents one at a time in order
async function executeSequential(state: ActiveRunState): Promise<void> {
  const sortedAgents = [...state.agents].sort((a, b) => a.order - b.order)

  let previousOutput: string | undefined

  for (const agent of sortedAgents) {
    if (state.aborted) break

    // Wait while paused
    while (state.paused && !state.aborted) {
      await sleep(500)
    }
    if (state.aborted) break

    // Budget check
    const budgetCheck = canRunAgent(state.budget, state.run)
    if (!budgetCheck.allowed) {
      emitStatus({
        orchestratorId: state.orchestratorId,
        runId: state.run.id,
        type: 'budget-exceeded',
        error: budgetCheck.reason,
      })
      // Skip remaining agents
      agent.status = 'skipped'
      agent.lastError = budgetCheck.reason
      continue
    }

    // Run agent (placeholder — actual execution requires claudeAgent integration)
    const result = await runAgent(state, agent, previousOutput)

    // Apply failure policy
    if (result.status === 'failed') {
      const shouldAbort = await applyFailurePolicy(state, agent, result)
      if (shouldAbort) break
    }

    if (result.status === 'completed' && result.output) {
      // Truncate output for sequential context propagation (10K chars max)
      const maxChars = 10000
      if (result.output.length > maxChars) {
        previousOutput = result.output.slice(0, maxChars) +
          `\n[Truncated - ${result.output.length} total characters]`
      } else {
        previousOutput = result.output
      }
    }
  }
}

// Parallel strategy: run agents simultaneously (with optional batching)
async function executeParallel(state: ActiveRunState): Promise<void> {
  const agents = [...state.agents]

  // Validate parallel budget
  const validation = validateParallelBudget(state.budget, agents.length)
  if (!validation.allowed) {
    state.run.status = 'failed'
    state.run.error = validation.reason
    emitStatus({
      orchestratorId: state.orchestratorId,
      runId: state.run.id,
      type: 'run-failed',
      error: validation.reason,
    })
    return
  }

  const concurrency = validation.effectiveConcurrency ?? agents.length

  // Run in batches if concurrency is limited
  for (let i = 0; i < agents.length; i += concurrency) {
    if (state.aborted) break

    // Budget check before each batch
    const budgetCheck = canRunAgent(state.budget, state.run)
    if (!budgetCheck.allowed) {
      emitStatus({
        orchestratorId: state.orchestratorId,
        runId: state.run.id,
        type: 'budget-exceeded',
        error: budgetCheck.reason,
      })
      break
    }

    const batch = agents.slice(i, i + concurrency)
    const promises = batch.map((agent) => runAgent(state, agent, undefined))
    const results = await Promise.allSettled(promises)

    // Process results and apply failure policies
    for (let j = 0; j < results.length; j++) {
      const settledResult = results[j]!
      const agent = batch[j]!

      if (settledResult.status === 'rejected') {
        agent.status = 'failed'
        agent.lastError = (settledResult.reason as Error).message
      } else if (settledResult.value.status === 'failed') {
        const shouldAbort = await applyFailurePolicy(state, agent, settledResult.value)
        if (shouldAbort) {
          state.aborted = true
          break
        }
      }
    }
  }
}

// Conditional strategy: evaluate conditions after each agent
async function executeConditional(state: ActiveRunState): Promise<void> {
  const sortedAgents = [...state.agents].sort((a, b) => a.order - b.order)
  if (sortedAgents.length === 0) return

  // Start with first agent
  let currentAgent = sortedAgents[0]
  let lastResult: OrchestratorAgentResult | undefined

  while (currentAgent && !state.aborted) {
    // Wait while paused
    while (state.paused && !state.aborted) {
      await sleep(500)
    }
    if (state.aborted) break

    // Budget check
    const budgetCheck = canRunAgent(state.budget, state.run)
    if (!budgetCheck.allowed) {
      emitStatus({
        orchestratorId: state.orchestratorId,
        runId: state.run.id,
        type: 'budget-exceeded',
        error: budgetCheck.reason,
      })
      break
    }

    const result = await runAgent(state, currentAgent, lastResult?.output)
    lastResult = result

    if (result.status === 'failed') {
      const shouldAbort = await applyFailurePolicy(state, currentAgent, result)
      if (shouldAbort) break
    }

    // Find next agent based on conditions
    const cumulativeTokens = state.run.totalInputTokens + state.run.totalOutputTokens
    let nextAgent: ConnectedAgent | undefined

    for (const candidate of sortedAgents) {
      if (candidate === currentAgent) continue
      if (candidate.status !== 'idle' && candidate.status !== 'queued') continue

      // Evaluate all conditions (AND logic)
      let allConditionsMet = true
      for (const condition of candidate.conditions) {
        let condResult = evaluateCondition(
          condition.type,
          condition.value,
          condition.threshold,
          lastResult,
          cumulativeTokens
        )
        if (condition.invert) condResult = !condResult
        if (!condResult) {
          allConditionsMet = false
          break
        }
      }

      // If agent has no conditions, it defaults to "always run next"
      if (candidate.conditions.length === 0 || allConditionsMet) {
        nextAgent = candidate
        break
      }
    }

    currentAgent = nextAgent as ConnectedAgent
  }
}

// Run a single agent (placeholder — real implementation needs claudeAgent bridge)
async function runAgent(
  state: ActiveRunState,
  agent: ConnectedAgent,
  _previousOutput: string | undefined
): Promise<OrchestratorAgentResult> {
  const startTime = Date.now()

  agent.status = 'running'
  emitStatus({
    orchestratorId: state.orchestratorId,
    runId: state.run.id,
    type: 'agent-started',
    agentNodeId: agent.nodeId,
  })

  // Placeholder: In the full implementation, this calls runAgentForOrchestrator()
  // from claudeAgent.ts. For now, we create a stub result.
  // The actual integration requires the main-process agent execution bridge.
  const result: OrchestratorAgentResult = {
    agentNodeId: agent.nodeId,
    status: 'completed',
    output: `[Agent ${agent.nodeId} completed - orchestrator bridge pending implementation]`,
    inputTokens: 0,
    outputTokens: 0,
    costUSD: 0,
    durationMs: Date.now() - startTime,
    toolCallCount: 0,
    startedAt: startTime,
    completedAt: Date.now(),
  }

  // Update run aggregates
  state.run.agentResults.push(result)
  state.run.totalInputTokens += result.inputTokens
  state.run.totalOutputTokens += result.outputTokens
  state.run.totalCostUSD += result.costUSD

  agent.status = result.status === 'completed' ? 'completed' : 'failed'

  emitStatus({
    orchestratorId: state.orchestratorId,
    runId: state.run.id,
    type: result.status === 'completed' ? 'agent-completed' : 'agent-failed',
    agentNodeId: agent.nodeId,
    agentResult: result,
    totalTokens: state.run.totalInputTokens + state.run.totalOutputTokens,
    totalCostUSD: state.run.totalCostUSD,
  })

  return result
}

// Apply failure policy; returns true if orchestration should abort
async function applyFailurePolicy(
  state: ActiveRunState,
  agent: ConnectedAgent,
  _result: OrchestratorAgentResult
): Promise<boolean> {
  const policy = state.failurePolicy

  switch (policy.type) {
    case 'abort-all': {
      // Retry first
      if (agent.retryCount < policy.maxRetries) {
        agent.retryCount++
        agent.status = 'retrying'
        emitStatus({
          orchestratorId: state.orchestratorId,
          runId: state.run.id,
          type: 'agent-retrying',
          agentNodeId: agent.nodeId,
        })
        await sleep(policy.retryDelayMs)
        // After retry, the caller will re-run the agent
        return false
      }
      // Retries exhausted: abort
      state.run.status = 'failed'
      state.run.error = `Agent ${agent.nodeId} failed after ${policy.maxRetries} retries (abort-all policy)`
      emitStatus({
        orchestratorId: state.orchestratorId,
        runId: state.run.id,
        type: 'run-failed',
        error: state.run.error,
      })
      return true
    }

    case 'retry-and-continue': {
      if (agent.retryCount < policy.maxRetries) {
        agent.retryCount++
        agent.status = 'retrying'
        emitStatus({
          orchestratorId: state.orchestratorId,
          runId: state.run.id,
          type: 'agent-retrying',
          agentNodeId: agent.nodeId,
        })
        await sleep(policy.retryDelayMs)
        return false
      }
      // Retries exhausted: continue to next
      agent.status = 'failed'
      return false
    }

    case 'skip-failed': {
      agent.status = 'skipped'
      emitStatus({
        orchestratorId: state.orchestratorId,
        runId: state.run.id,
        type: 'agent-skipped',
        agentNodeId: agent.nodeId,
      })
      return false
    }

    default:
      return false
  }
}

// Finalize a run
function finishRun(state: ActiveRunState): void {
  const { run, orchestratorId } = state

  if (state.aborted) {
    if (run.status !== 'failed') {
      run.status = 'aborted'
    }
  } else {
    run.status = determineFinalStatus(run.agentResults, state.failurePolicy)
  }

  run.completedAt = Date.now()
  run.totalDurationMs = run.completedAt - run.startedAt

  const statusType = run.status === 'completed'
    ? 'run-completed' as const
    : run.status === 'completed-with-errors'
    ? 'run-completed-with-errors' as const
    : run.status === 'aborted'
    ? 'run-aborted' as const
    : 'run-failed' as const

  emitStatus({
    orchestratorId,
    runId: run.id,
    type: statusType,
    totalTokens: run.totalInputTokens + run.totalOutputTokens,
    totalCostUSD: run.totalCostUSD,
    error: run.error,
  })

  activeRuns.delete(orchestratorId)
}

// Pause an active run
export function pauseOrchestration(orchestratorId: string): { success: boolean; error?: string } {
  const state = activeRuns.get(orchestratorId)
  if (!state) return { success: false, error: 'No active orchestration' }
  if (state.paused) return { success: false, error: 'Already paused' }

  state.paused = true
  state.run.status = 'paused'
  emitStatus({
    orchestratorId,
    runId: state.run.id,
    type: 'run-paused',
  })

  return { success: true }
}

// Resume a paused run
export function resumeOrchestration(orchestratorId: string): { success: boolean; error?: string } {
  const state = activeRuns.get(orchestratorId)
  if (!state) return { success: false, error: 'No active orchestration' }
  if (!state.paused) return { success: false, error: 'Not paused' }

  state.paused = false
  state.run.status = 'running'
  emitStatus({
    orchestratorId,
    runId: state.run.id,
    type: 'run-resumed',
  })

  return { success: true }
}

// Abort an active run
export function abortOrchestration(orchestratorId: string): { success: boolean; error?: string } {
  const state = activeRuns.get(orchestratorId)
  if (!state) return { success: false, error: 'No active orchestration' }

  state.aborted = true
  state.run.status = 'aborted'
  emitStatus({
    orchestratorId,
    runId: state.run.id,
    type: 'run-aborted',
  })

  return { success: true }
}

// Resync: return all active runs for renderer recovery
export function getActiveRuns(): Record<string, { runId: string; status: string }> {
  const result: Record<string, { runId: string; status: string }> = {}
  for (const [orchestratorId, state] of activeRuns) {
    result[orchestratorId] = {
      runId: state.run.id,
      status: state.run.status,
    }
  }
  return result
}

// Utility
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
