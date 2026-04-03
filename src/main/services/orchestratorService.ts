// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

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
import { execLogWriter } from './notionExecLog'
import { emitPluginEvent } from '@plugins/registry'
import { runAgentForOrchestrator } from '../agent/claudeAgent'
import { buildTool } from '../tools/buildTool'
import { assembleToolPool } from '../tools/assembleToolPool'
import {
  SpawnWorkerSchema,
  GetWorkerResultSchema,
  SynthesizeResultsSchema,
} from '../tools/canonicalSchemas'
import type { Tool, ToolResult } from '../tools/types'
import { AGENT_RESULT_SUMMARY_MAX_CHARS } from '../../shared/types/edges'
import type { AgentEdgeResult } from '../../shared/types/edges'
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
import * as fs from 'fs/promises'
import * as path from 'path'
import { app } from 'electron'

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
    // Emit plugin event for failed runs (exec log is triggered via plugin event handler)
    emitPluginEvent('orchestrator:run-complete', run)
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
    case 'coordinator':
      await executeCoordinator(state)
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

    // Run agent with retry support
    let result = await runAgent(state, agent, previousOutput)

    // Apply failure policy — if agent fails, applyFailurePolicy may set status to 'retrying'
    while (result.status === 'failed') {
      const shouldAbort = await applyFailurePolicy(state, agent, result)
      if (shouldAbort) break

      // If applyFailurePolicy set agent to 'retrying', actually re-run the agent
      if (agent.status === 'retrying') {
        emitStatus({
          orchestratorId: state.orchestratorId,
          runId: state.run.id,
          type: 'agent-retrying',
          agentNodeId: agent.nodeId,
        })
        result = await runAgent(state, agent, previousOutput)
      } else {
        break
      }
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

// ---------------------------------------------------------------------------
// Coordinator strategy — LLM-driven orchestration with tool-use loop
// ---------------------------------------------------------------------------

/**
 * Get the workspace-local temp directory for spilling large results.
 * Creates the directory if it does not exist.
 */
async function getCoordinatorTempDir(workspaceId: string): Promise<string> {
  const userDataPath = app.getPath('userData')
  const tempDir = path.join(userDataPath, 'workspaces', '.cognograph', 'temp', workspaceId)
  await fs.mkdir(tempDir, { recursive: true })
  return tempDir
}

/**
 * Write a full result to the temp directory when it exceeds the summary cap.
 * Returns the absolute path to the spilled file.
 */
async function spillResultToTemp(
  tempDir: string,
  agentNodeId: string,
  fullOutput: string,
): Promise<string> {
  const filename = `result-${agentNodeId}-${Date.now()}.txt`
  const filePath = path.join(tempDir, filename)
  await fs.writeFile(filePath, fullOutput, 'utf-8')
  return filePath
}

/**
 * Create an AgentEdgeResult with summary capping and optional file spill.
 */
async function buildEdgeResult(
  output: string,
  tempDir: string,
  agentNodeId: string,
): Promise<AgentEdgeResult> {
  const result: AgentEdgeResult = {
    summary: output,
    timestamp: new Date().toISOString(),
  }

  if (output.length > AGENT_RESULT_SUMMARY_MAX_CHARS) {
    result.summary =
      output.slice(0, AGENT_RESULT_SUMMARY_MAX_CHARS) +
      `\n[Truncated — ${output.length} total characters. Full result saved to disk.]`
    result.fullResultPath = await spillResultToTemp(tempDir, agentNodeId, output)
  }

  return result
}

/**
 * Build the coordinator-specific tools that the coordinator LLM can call.
 *
 * These tools are the ONLY tools available to the coordinator — it cannot
 * access filesystem, commands, or canvas tools directly.
 */
function buildCoordinatorTools(state: ActiveRunState, tempDir: string): Tool[] {
  // Worker results collected during this coordinator run
  const workerResults = new Map<string, OrchestratorAgentResult>()

  const spawnWorkerTool = buildTool({
    name: 'spawn_worker',
    description:
      'Dispatch a worker agent on a connected conversation node. ' +
      'The worker runs to completion and its result is stored. ' +
      'Returns a summary of the worker output.',
    inputSchema: SpawnWorkerSchema,
    async call(input: unknown): Promise<ToolResult> {
      const { agentNodeId, prompt, edgeId } = input as {
        agentNodeId: string
        prompt: string
        edgeId?: string
      }

      // Find the agent in our connected agents
      const agent = state.agents.find((a) => a.nodeId === agentNodeId)
      if (!agent) {
        return {
          content: [{ type: 'text', text: `Error: No connected agent with nodeId "${agentNodeId}"` }],
          isError: true,
        }
      }

      // Budget check
      const budgetCheck = canRunAgent(state.budget, state.run)
      if (!budgetCheck.allowed) {
        return {
          content: [{
            type: 'text',
            text: `Budget exceeded: ${budgetCheck.reason}`,
          }],
          isError: true,
        }
      }

      // Override prompt for this worker dispatch
      const originalPrompt = agent.promptOverride
      agent.promptOverride = prompt
      if (edgeId) {
        agent.edgeId = edgeId
      }

      // Run the worker agent
      const result = await runAgent(state, agent, undefined)
      agent.promptOverride = originalPrompt

      // Store result for later retrieval
      workerResults.set(agentNodeId, result)

      // Build edge result and store on run for edge annotation
      const edgeResult = await buildEdgeResult(
        result.output || '',
        tempDir,
        agentNodeId,
      )

      // Store edge results on the run's agentResults for downstream edge annotation
      if (!state.run.edgeResults) {
        state.run.edgeResults = {}
      }
      const effectiveEdgeId = edgeId || agent.edgeId
      if (effectiveEdgeId) {
        state.run.edgeResults[effectiveEdgeId] = edgeResult
      }

      const summary = edgeResult.summary
      return {
        content: [{
          type: 'text',
          text: `Worker "${agentNodeId}" completed with status: ${result.status}\n\n${summary}`,
        }],
      }
    },
  })

  const getWorkerResultTool = buildTool({
    name: 'get_worker_result',
    description:
      'Read the result from a completed worker agent. ' +
      'Returns the worker output summary, status, and token usage.',
    inputSchema: GetWorkerResultSchema,
    isReadOnly: true,
    async call(input: unknown): Promise<ToolResult> {
      const { agentNodeId } = input as { agentNodeId: string }

      const result = workerResults.get(agentNodeId)
      if (!result) {
        // Check if it's in the run's agentResults (from a previous spawn)
        const fromRun = state.run.agentResults.find((r) => r.agentNodeId === agentNodeId)
        if (fromRun) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                agentNodeId: fromRun.agentNodeId,
                status: fromRun.status,
                output: fromRun.output?.slice(0, AGENT_RESULT_SUMMARY_MAX_CHARS),
                inputTokens: fromRun.inputTokens,
                outputTokens: fromRun.outputTokens,
                durationMs: fromRun.durationMs,
              }),
            }],
          }
        }

        return {
          content: [{
            type: 'text',
            text: `No result found for worker "${agentNodeId}". Has it been spawned yet?`,
          }],
          isError: true,
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            agentNodeId: result.agentNodeId,
            status: result.status,
            output: result.output?.slice(0, AGENT_RESULT_SUMMARY_MAX_CHARS),
            error: result.error,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            durationMs: result.durationMs,
            toolCallCount: result.toolCallCount,
          }),
        }],
      }
    },
  })

  const synthesizeResultsTool = buildTool({
    name: 'synthesize_results',
    description:
      'Combine multiple worker results into a unified synthesis. ' +
      'If agentNodeIds is omitted, synthesizes all completed workers. ' +
      'Returns the combined summary.',
    inputSchema: SynthesizeResultsSchema,
    isReadOnly: true,
    async call(input: unknown): Promise<ToolResult> {
      const { agentNodeIds, synthesisPrompt } = input as {
        agentNodeIds?: string[]
        synthesisPrompt?: string
      }

      // Determine which results to include
      const targetIds = agentNodeIds || [...workerResults.keys()]
      if (targetIds.length === 0) {
        return {
          content: [{
            type: 'text',
            text: 'No worker results available to synthesize.',
          }],
          isError: true,
        }
      }

      // Collect results
      const parts: string[] = []
      for (const nodeId of targetIds) {
        const result = workerResults.get(nodeId)
        if (result) {
          const outputTruncated = (result.output || '').slice(0, AGENT_RESULT_SUMMARY_MAX_CHARS)
          parts.push(
            `## Worker: ${nodeId} (${result.status})\n${outputTruncated}`
          )
        } else {
          parts.push(`## Worker: ${nodeId}\n[No result available]`)
        }
      }

      const header = synthesisPrompt
        ? `Synthesis instructions: ${synthesisPrompt}\n\n`
        : 'Combined results from all workers:\n\n'

      const combined = header + parts.join('\n\n---\n\n')

      return {
        content: [{
          type: 'text',
          text: combined,
        }],
      }
    },
  })

  return [spawnWorkerTool, getWorkerResultTool, synthesizeResultsTool]
}

/**
 * Coordinator strategy — an LLM-driven orchestrator that reads graph topology
 * and dispatches workers via tool calls.
 *
 * The coordinator:
 * 1. Receives a restricted tool set (spawn_worker, get_worker_result, synthesize_results)
 * 2. Reads the graph topology from connected agents list
 * 3. Uses runAgentWithToolLoop to drive the coordination LLM
 * 4. Worker results are stored on edges via AgentEdgeResult
 */
async function executeCoordinator(state: ActiveRunState): Promise<void> {
  // Budget check
  const budgetCheck = canRunAgent(state.budget, state.run)
  if (!budgetCheck.allowed) {
    state.run.status = 'failed'
    state.run.error = budgetCheck.reason
    emitStatus({
      orchestratorId: state.orchestratorId,
      runId: state.run.id,
      type: 'budget-exceeded',
      error: budgetCheck.reason,
    })
    return
  }

  // Prepare temp directory for result spilling
  const workspaceId = state.run.workspaceId || state.orchestratorId
  const tempDir = await getCoordinatorTempDir(workspaceId)

  // Build coordinator-only tools
  const coordinatorTools = buildCoordinatorTools(state, tempDir)

  // Build the tool pool with ONLY coordinator tools (no filesystem, no canvas)
  const toolPool = assembleToolPool(coordinatorTools, [])

  // Build the graph topology description for the coordinator
  const agentDescriptions = state.agents.map((a) => {
    const desc = [
      `- Agent "${a.nodeId}" (order: ${a.order})`,
    ]
    if (a.promptOverride) {
      desc.push(`  Prompt: ${a.promptOverride.slice(0, 200)}...`)
    }
    if (a.edgeId) {
      desc.push(`  Edge ID: ${a.edgeId}`)
    }
    return desc.join('\n')
  })

  const systemPrompt = [
    'You are an orchestration coordinator for a spatial AI canvas.',
    'Your job is to read the graph topology of connected agents and coordinate their execution.',
    '',
    'You have access to these tools ONLY:',
    '- spawn_worker: Dispatch a worker agent with a prompt. Pass the agentNodeId and a clear prompt.',
    '- get_worker_result: Read the output from a completed worker.',
    '- synthesize_results: Combine results from multiple workers into a unified output.',
    '',
    'Connected agents available for dispatch:',
    ...agentDescriptions,
    '',
    'Strategy:',
    '1. Analyze which agents to run and in what order based on the topology.',
    '2. Spawn workers with clear, specific prompts.',
    '3. After all workers complete, synthesize their results.',
    '4. Provide a final summary of the orchestrated work.',
    '',
    'IMPORTANT: You may ONLY use the tools listed above. You cannot access files, run commands, or modify the canvas directly.',
  ].join('\n')

  // Determine the prompt for the coordinator
  // Use the orchestrator's description or a default
  const coordinatorPrompt =
    'Analyze the connected agents and orchestrate their execution. ' +
    'Spawn each agent with an appropriate prompt, then synthesize the results.'

  // Run the coordinator through the claudeAgent bridge (simpler than full agentLoop for now)
  // We use runAgentForOrchestrator with coordinator tools converted to Anthropic format
  const anthropicTools = toolPool.toAnthropicFormat().map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }))

  const coordinatorResult = await runAgentForOrchestrator({
    agentNodeId: `coordinator-${state.orchestratorId}`,
    context: systemPrompt,
    prompt: coordinatorPrompt,
    tools: anthropicTools as import('@anthropic-ai/sdk').default.Tool[],
    model: state.run.model,
    maxTokens: state.budget?.maxTokensPerAgent,
  })

  // Record the coordinator's own usage
  const COST_PER_1K_INPUT = 0.003
  const COST_PER_1K_OUTPUT = 0.015
  const coordinatorCostUSD =
    (coordinatorResult.inputTokens / 1000) * COST_PER_1K_INPUT +
    (coordinatorResult.outputTokens / 1000) * COST_PER_1K_OUTPUT

  // NOTE: The coordinator itself is NOT a worker — but we record its usage for budgeting.
  // Individual worker results are already in state.run.agentResults (added by runAgent).
  state.run.totalInputTokens += coordinatorResult.inputTokens
  state.run.totalOutputTokens += coordinatorResult.outputTokens
  state.run.totalCostUSD += coordinatorCostUSD

  if (coordinatorResult.status === 'failed') {
    state.run.status = 'failed'
    state.run.error = coordinatorResult.error || 'Coordinator agent failed'
    emitStatus({
      orchestratorId: state.orchestratorId,
      runId: state.run.id,
      type: 'run-failed',
      error: state.run.error,
    })
  }
}

// Run a single agent via the real claudeAgent bridge
async function runAgent(
  state: ActiveRunState,
  agent: ConnectedAgent,
  previousOutput: string | undefined
): Promise<OrchestratorAgentResult> {
  const startTime = Date.now()

  agent.status = 'running'
  emitStatus({
    orchestratorId: state.orchestratorId,
    runId: state.run.id,
    type: 'agent-started',
    agentNodeId: agent.nodeId,
  })

  // Estimate cost per 1K tokens (Claude Sonnet pricing approx)
  const COST_PER_1K_INPUT = 0.003
  const COST_PER_1K_OUTPUT = 0.015

  // Call the real agent via claudeAgent bridge
  const agentResult = await runAgentForOrchestrator({
    agentNodeId: agent.nodeId,
    context: '',  // Context is injected by the agent system prompt builder
    prompt: agent.promptOverride || `You are agent "${agent.nodeId}" in an orchestrated pipeline. Complete your assigned task.`,
    model: state.run.model,
    maxTokens: state.budget?.maxTokensPerAgent,
    previousOutput,
  })

  const costUSD =
    (agentResult.inputTokens / 1000) * COST_PER_1K_INPUT +
    (agentResult.outputTokens / 1000) * COST_PER_1K_OUTPUT

  const result: OrchestratorAgentResult = {
    agentNodeId: agent.nodeId,
    status: agentResult.status,
    output: agentResult.output,
    error: agentResult.error,
    inputTokens: agentResult.inputTokens,
    outputTokens: agentResult.outputTokens,
    cacheCreationTokens: agentResult.cacheCreationTokens,
    cacheReadTokens: agentResult.cacheReadTokens,
    costUSD,
    durationMs: Date.now() - startTime,
    toolCallCount: agentResult.toolCallCount,
    startedAt: startTime,
    completedAt: Date.now(),
  }

  // Update run aggregates
  state.run.agentResults.push(result)
  state.run.totalInputTokens += result.inputTokens
  state.run.totalOutputTokens += result.outputTokens
  state.run.totalCacheCreationTokens = (state.run.totalCacheCreationTokens || 0) + (result.cacheCreationTokens || 0)
  state.run.totalCacheReadTokens = (state.run.totalCacheReadTokens || 0) + (result.cacheReadTokens || 0)
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

  // Emit plugin event for completed/successful runs (exec log is triggered via plugin event handler)
  emitPluginEvent('orchestrator:run-complete', run)

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
